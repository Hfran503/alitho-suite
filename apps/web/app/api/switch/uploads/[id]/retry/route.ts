import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { s3Client } from '@/lib/s3'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { uploadToSftp, isSftpConfigured } from '@/lib/sftp'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params in Next.js 15
    const { id } = await params

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

    // Fetch the upload record
    const upload = await db.switchPdfUpload.findUnique({
      where: { id },
    })

    if (!upload) {
      return NextResponse.json({ error: 'Upload not found' }, { status: 404 })
    }

    // Verify tenant access
    if (upload.tenantId !== membership.tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if already sent successfully
    if (upload.status === 'sent') {
      return NextResponse.json(
        { error: 'Upload already sent successfully' },
        { status: 400 }
      )
    }

    // Check SFTP configuration
    if (!isSftpConfigured()) {
      return NextResponse.json(
        { error: 'SFTP not configured. Please set SFTP_HOST, SFTP_USERNAME, and SFTP_PASSWORD.' },
        { status: 500 }
      )
    }

    try {
      // Download file from S3
      const getCommand = new GetObjectCommand({
        Bucket: upload.s3Bucket!,
        Key: upload.s3Key!,
      })

      const s3Response = await s3Client.send(getCommand)
      const fileBuffer = await s3Response.Body?.transformToByteArray()

      if (!fileBuffer) {
        throw new Error('Failed to download file from S3')
      }

      // Build remote file path
      const sftpFolder = process.env.SFTP_UPLOAD_PATH || '/switch-inbox'
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
      const remotePath = `${sftpFolder}/${timestamp}-${upload.filename}`

      // Upload to SFTP
      await uploadToSftp(Buffer.from(fileBuffer), remotePath)

      // Update database record with success
      const updatedUpload = await db.switchPdfUpload.update({
        where: { id: upload.id },
        data: {
          status: 'sent',
          switchSubmitUrl: `sftp://${process.env.SFTP_HOST}${remotePath}`,
          switchResponse: {
            method: 'sftp',
            remotePath,
          },
          errorMessage: null,
          sentToSwitchAt: new Date(),
        },
      })

      return NextResponse.json({
        success: true,
        data: updatedUpload,
      })
    } catch (sftpError: any) {
      // Update database record with failure
      const updatedUpload = await db.switchPdfUpload.update({
        where: { id: upload.id },
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
          data: updatedUpload,
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Retry upload error:', error)

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
