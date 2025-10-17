import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generatePresignedUploadUrl } from '@/lib/s3'
import { db } from '@repo/database'
import { createPresignedUploadSchema } from '@repo/types'
import { nanoid } from 'nanoid'

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse and validate request body
    const body = await req.json()
    const validated = createPresignedUploadSchema.parse(body)

    // Get user's tenant (assuming first membership for now)
    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
      include: { tenant: true },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 })
    }

    // Generate unique S3 key
    const fileExtension = validated.filename.split('.').pop()
    const timestamp = Date.now()
    const uniqueId = nanoid(10)
    const key = `${membership.tenantId}/${timestamp}-${uniqueId}.${fileExtension}`

    // Generate presigned URL
    const uploadUrl = await generatePresignedUploadUrl(key, validated.mimeType)

    // Create attachment record in database
    const attachment = await db.attachment.create({
      data: {
        filename: validated.filename,
        mimeType: validated.mimeType,
        size: validated.size,
        bucket: process.env.S3_BUCKET!,
        key,
        tenantId: membership.tenantId,
        uploadedBy: session.user.id,
        ...(validated.entityId && validated.entityType === 'order' && { orderId: validated.entityId }),
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        attachmentId: attachment.id,
        uploadUrl,
        key,
      },
    })
  } catch (error) {
    console.error('Presign upload error:', error)

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
