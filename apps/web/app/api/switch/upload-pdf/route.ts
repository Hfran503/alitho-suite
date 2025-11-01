import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { s3Client } from '@/lib/s3'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { nanoid } from 'nanoid'
import { uploadToSftp, isSftpConfigured } from '@/lib/sftp'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's tenant
    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
      include: { tenant: true },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 })
    }

    // Parse multipart form data
    const formData = await req.formData()
    const file = formData.get('file') as File
    const metadata = formData.get('metadata') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Only PDF files are allowed' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` },
        { status: 400 }
      )
    }

    // Generate unique S3 key
    const timestamp = Date.now()
    const uniqueId = nanoid(10)
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const s3Key = `switch-pdfs/${membership.tenantId}/${timestamp}-${uniqueId}-${sanitizedFilename}`

    // Upload to S3
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const uploadCommand = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: 'application/pdf',
    })

    await s3Client.send(uploadCommand)

    // Create database record
    const pdfUpload = await db.switchPdfUpload.create({
      data: {
        filename: sanitizedFilename,
        originalFilename: file.name,
        fileSize: file.size,
        mimeType: file.type,
        s3Bucket: process.env.S3_BUCKET!,
        s3Key,
        status: 'uploading',
        tenantId: membership.tenantId,
        uploadedBy: session.user.id,
        metadata: metadata ? JSON.parse(metadata) : null,
      },
    })

    // Send to Enfocus Switch via SFTP
    if (!isSftpConfigured()) {
      // Update status to indicate SFTP is not configured
      await db.switchPdfUpload.update({
        where: { id: pdfUpload.id },
        data: {
          status: 'sent',
          errorMessage: 'SFTP not configured - file uploaded to S3 only',
        },
      })

      return NextResponse.json({
        success: true,
        warning: 'SFTP not configured',
        data: {
          id: pdfUpload.id,
          filename: file.name,
          status: 'sent',
        },
      })
    }

    try {
      // Build remote file path
      // Format: /switch-inbox/YYYY-MM-DD-HHmmss-filename.pdf
      const sftpFolder = process.env.SFTP_UPLOAD_PATH || '/switch-inbox'
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5) // 2025-01-31-12-30-45
      const remotePath = `${sftpFolder}/${timestamp}-${sanitizedFilename}`

      // Upload to SFTP
      await uploadToSftp(fileBuffer, remotePath)

      // Update database record with success
      await db.switchPdfUpload.update({
        where: { id: pdfUpload.id },
        data: {
          status: 'sent',
          switchSubmitUrl: `sftp://${process.env.SFTP_HOST}${remotePath}`,
          switchResponse: {
            method: 'sftp',
            remotePath,
          },
          sentToSwitchAt: new Date(),
        },
      })

      return NextResponse.json({
        success: true,
        data: {
          id: pdfUpload.id,
          filename: file.name,
          status: 'sent',
          sentToSwitch: true,
          remotePath,
        },
      })
    } catch (sftpError: any) {
      // Update database record with failure
      await db.switchPdfUpload.update({
        where: { id: pdfUpload.id },
        data: {
          status: 'failed',
          switchSubmitUrl: `sftp://${process.env.SFTP_HOST}`,
          errorMessage: sftpError.message,
        },
      })

      return NextResponse.json(
        {
          success: false,
          error: `Failed to send to Switch via SFTP: ${sftpError.message}`,
          data: {
            id: pdfUpload.id,
            filename: file.name,
            status: 'failed',
          },
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('PDF upload error:', error)

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
