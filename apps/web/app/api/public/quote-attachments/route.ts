import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { nanoid } from 'nanoid'

// In production (Dokploy), a named volume is mounted at /app/apps/web/public/quote-attachments.
// The Next.js process runs from inside .next/standalone/apps/web, so cwd-relative paths land
// in ephemeral build artifacts that get wiped on every redeploy — always resolve to the
// absolute mount when it exists, and fall back to a cwd-relative path for local dev.
const UPLOAD_DIR = existsSync('/app/apps/web/public/quote-attachments')
  ? '/app/apps/web/public/quote-attachments'
  : path.join(process.cwd(), 'public', 'quote-attachments')
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB per file
const MAX_FILES = 5

// Allowed file types
const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'doc', 'docx', 'xls', 'xlsx']

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Maximum ${MAX_FILES} files allowed` },
        { status: 400 }
      )
    }

    // Ensure upload directory exists
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true })
    }

    const uploadedFiles: { filename: string; originalName: string; url: string; size: number }[] = []

    for (const file of files) {
      // Validate file type
      const fileExtension = file.name.split('.').pop()?.toLowerCase() || ''
      if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXTENSIONS.includes(fileExtension)) {
        return NextResponse.json(
          { error: `File type not allowed: ${file.name}. Allowed types: PDF, images, Word, Excel` },
          { status: 400 }
        )
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File too large: ${file.name}. Maximum size is 10MB` },
          { status: 400 }
        )
      }

      // Generate unique filename
      const uniqueId = nanoid(10)
      const timestamp = Date.now()
      const sanitizedExtension = fileExtension || 'bin'
      const filename = `${timestamp}-${uniqueId}.${sanitizedExtension}`
      const filepath = path.join(UPLOAD_DIR, filename)

      // Convert file to buffer and save
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      await writeFile(filepath, buffer)

      uploadedFiles.push({
        filename,
        originalName: file.name,
        url: `/api/files/quote-attachment/${filename}`,
        size: file.size,
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        files: uploadedFiles,
      },
    })
  } catch (error) {
    console.error('Quote attachment upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload files' },
      { status: 500 }
    )
  }
}
