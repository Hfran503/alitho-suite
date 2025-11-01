import SftpClient from 'ssh2-sftp-client'

export interface SftpConfig {
  host: string
  port: number
  username: string
  password?: string
  privateKey?: string
}

// Get SFTP configuration from environment variables
export function getSftpConfig(): SftpConfig | null {
  const host = process.env.SFTP_HOST
  const port = process.env.SFTP_PORT ? parseInt(process.env.SFTP_PORT) : 22
  const username = process.env.SFTP_USERNAME
  const password = process.env.SFTP_PASSWORD
  const privateKey = process.env.SFTP_PRIVATE_KEY

  if (!host || !username) {
    return null
  }

  return {
    host,
    port,
    username,
    ...(password && { password }),
    ...(privateKey && { privateKey }),
  }
}

// Upload a file to SFTP server
export async function uploadToSftp(
  localBuffer: Buffer,
  remoteFilePath: string
): Promise<void> {
  const config = getSftpConfig()

  if (!config) {
    throw new Error('SFTP configuration not found. Please set SFTP_HOST, SFTP_USERNAME, and SFTP_PASSWORD.')
  }

  const sftp = new SftpClient()

  try {
    // Connect to SFTP server
    await sftp.connect(config)

    // Upload file
    await sftp.put(localBuffer, remoteFilePath)

    console.log(`Successfully uploaded file to SFTP: ${remoteFilePath}`)
  } catch (error) {
    console.error('SFTP upload error:', error)
    throw new Error(`Failed to upload to SFTP: ${error instanceof Error ? error.message : 'Unknown error'}`)
  } finally {
    // Always close the connection
    await sftp.end()
  }
}

// Check if SFTP is configured
export function isSftpConfigured(): boolean {
  return getSftpConfig() !== null
}

// Test SFTP connection
export async function testSftpConnection(): Promise<boolean> {
  const config = getSftpConfig()

  if (!config) {
    return false
  }

  const sftp = new SftpClient()

  try {
    await sftp.connect(config)
    await sftp.end()
    return true
  } catch (error) {
    console.error('SFTP connection test failed:', error)
    return false
  }
}
