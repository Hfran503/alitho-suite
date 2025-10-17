import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const s3Client = new S3Client({
  region: process.env.S3_REGION || 'us-east-1',
  // Only use explicit credentials if provided (for local MinIO)
  // Otherwise, AWS SDK will use default credential chain
  ...(process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
    ? {
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        },
      }
    : {}),
  // Only use custom endpoint for non-AWS S3 (like MinIO)
  ...(process.env.S3_ENDPOINT && !process.env.S3_ENDPOINT.includes('amazonaws.com')
    ? {
        endpoint: process.env.S3_ENDPOINT,
        forcePathStyle: true,
      }
    : {}),
})

export async function generatePresignedUploadUrl(
  key: string,
  mimeType: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: key,
    ContentType: mimeType,
  })

  return await getSignedUrl(s3Client, command, { expiresIn })
}

export async function generatePresignedDownloadUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: key,
  })

  return await getSignedUrl(s3Client, command, { expiresIn })
}

export function getPublicUrl(key: string): string {
  const endpoint = process.env.S3_ENDPOINT || ''
  const bucket = process.env.S3_BUCKET || ''

  // For MinIO, construct direct URL
  if (endpoint.includes('minio')) {
    return `${endpoint}/${bucket}/${key}`
  }

  // For AWS S3
  return `https://${bucket}.s3.${process.env.S3_REGION}.amazonaws.com/${key}`
}

export { s3Client }
