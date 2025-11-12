import SftpClient from 'ssh2-sftp-client'

export interface SftpConfig {
  host: string
  port: number
  username: string
  password?: string
  privateKey?: string
  remoteDir: string
}

// Get SFTP configuration from environment variables
export function getSftpConfig(): SftpConfig | null {
  const host = process.env.SFTP_HOST
  const port = process.env.SFTP_PORT ? parseInt(process.env.SFTP_PORT) : 22
  const username = process.env.SFTP_USERNAME
  const password = process.env.SFTP_PASSWORD
  const privateKey = process.env.SFTP_PRIVATE_KEY
  const remoteDir = process.env.SFTP_REMOTE_DIR || '/upload'

  if (!host || !username) {
    return null
  }

  return {
    host,
    port,
    username,
    remoteDir,
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

/**
 * Upload a file from local path to SFTP server
 * @param localFilePath - Path to the local file
 * @param remoteFileName - Name of the file on the remote server
 * @param subfolder - Optional subfolder within the base remote directory (e.g., 'atlassian')
 * @returns The remote file path
 */
export async function uploadToSFTP(
  localFilePath: string,
  remoteFileName: string,
  subfolder?: string
): Promise<string> {
  const config = getSftpConfig()

  if (!config) {
    throw new Error('SFTP configuration not found. Please set SFTP_HOST, SFTP_USERNAME, and SFTP_PASSWORD.')
  }

  const sftp = new SftpClient()

  try {
    // Connect to SFTP server
    await sftp.connect({
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      privateKey: config.privateKey,
    })

    console.log(`Connected to SFTP server: ${config.host}:${config.port}`)

    // Build remote directory path with optional subfolder
    const remoteDir = subfolder
      ? `${config.remoteDir}/${subfolder}`
      : config.remoteDir

    // Ensure remote directory exists
    try {
      await sftp.mkdir(remoteDir, true)
    } catch (error) {
      // Directory might already exist, ignore error
      console.log(`Remote directory ${remoteDir} already exists or created`)
    }

    // Build remote file path
    const remoteFilePath = `${remoteDir}/${remoteFileName}`

    // Upload the file
    console.log(`Uploading ${localFilePath} to ${remoteFilePath}...`)
    await sftp.put(localFilePath, remoteFilePath)
    console.log(`✓ File uploaded successfully to ${remoteFilePath}`)

    return remoteFilePath
  } catch (error) {
    console.error('Error uploading file to SFTP:', error)
    throw new Error(`Failed to upload to SFTP: ${error instanceof Error ? error.message : 'Unknown error'}`)
  } finally {
    // Always disconnect
    await sftp.end()
  }
}

/**
 * Get the public URL for an SFTP file
 * @param remoteFileName - The remote file name (e.g., 'filename.pdf')
 * @param subfolder - Optional subfolder within the base remote directory (e.g., 'atlassian')
 * @returns The public URL to access the file
 */
export function getSFTPPublicURL(remoteFileName: string, subfolder?: string): string {
  const config = getSftpConfig()

  if (!config) {
    throw new Error('SFTP configuration not found')
  }

  const publicBaseUrl = process.env.SFTP_PUBLIC_URL || `sftp://${config.host}:${config.port}`

  // Build the full path with optional subfolder
  const remoteDir = subfolder
    ? `${config.remoteDir}/${subfolder}`
    : config.remoteDir

  // If remoteFileName already includes the full path, use it as is
  // Otherwise, prepend the remote directory
  const fullPath = remoteFileName.startsWith('/')
    ? remoteFileName
    : `${remoteDir}/${remoteFileName}`

  return `${publicBaseUrl}${fullPath}`
}
