/**
 * SFTP Upload Utility
 * Handles uploading files to the SFTP server
 */

import Client from 'ssh2-sftp-client';

interface SFTPConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  remoteDir: string;
}

function getSFTPConfig(): SFTPConfig {
  const host = process.env.SFTP_HOST;
  const port = parseInt(process.env.SFTP_PORT || '2222', 10);
  const username = process.env.SFTP_USERNAME;
  const password = process.env.SFTP_PASSWORD;
  const remoteDir = process.env.SFTP_REMOTE_DIR || '/upload';

  if (!host || !username || !password) {
    throw new Error('SFTP configuration is incomplete. Please set SFTP_HOST, SFTP_USERNAME, and SFTP_PASSWORD environment variables.');
  }

  return {
    host,
    port,
    username,
    password,
    remoteDir,
  };
}

/**
 * Upload a file to the SFTP server
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
  const config = getSFTPConfig();
  const sftp = new Client();

  try {
    // Connect to SFTP server
    await sftp.connect({
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
    });

    console.log(`Connected to SFTP server: ${config.host}:${config.port}`);

    // Build remote directory path with optional subfolder
    const remoteDir = subfolder
      ? `${config.remoteDir}/${subfolder}`
      : config.remoteDir;

    // Ensure remote directory exists
    try {
      await sftp.mkdir(remoteDir, true);
    } catch (error) {
      // Directory might already exist, ignore error
      console.log(`Remote directory ${remoteDir} already exists or created`);
    }

    // Build remote file path
    const remoteFilePath = `${remoteDir}/${remoteFileName}`;

    // Upload the file
    console.log(`Uploading ${localFilePath} to ${remoteFilePath}...`);
    await sftp.put(localFilePath, remoteFilePath);
    console.log(`✓ File uploaded successfully to ${remoteFilePath}`);

    return remoteFilePath;
  } catch (error) {
    console.error('Error uploading file to SFTP:', error);
    throw error;
  } finally {
    // Always disconnect
    await sftp.end();
  }
}

/**
 * Upload a buffer to the SFTP server
 * @param buffer - File buffer
 * @param remoteFileName - Name of the file on the remote server
 * @param subfolder - Optional subfolder within the base remote directory (e.g., 'atlassian')
 * @returns The remote file path
 */
export async function uploadBufferToSFTP(
  buffer: Buffer,
  remoteFileName: string,
  subfolder?: string
): Promise<string> {
  const config = getSFTPConfig();
  const sftp = new Client();

  try {
    // Connect to SFTP server
    await sftp.connect({
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
    });

    console.log(`Connected to SFTP server: ${config.host}:${config.port}`);

    // Build remote directory path with optional subfolder
    const remoteDir = subfolder
      ? `${config.remoteDir}/${subfolder}`
      : config.remoteDir;

    // Ensure remote directory exists
    try {
      await sftp.mkdir(remoteDir, true);
    } catch (error) {
      // Directory might already exist, ignore error
      console.log(`Remote directory ${remoteDir} already exists or created`);
    }

    // Build remote file path
    const remoteFilePath = `${remoteDir}/${remoteFileName}`;

    // Upload the buffer
    console.log(`Uploading buffer to ${remoteFilePath}...`);
    await sftp.put(buffer, remoteFilePath);
    console.log(`✓ Buffer uploaded successfully to ${remoteFilePath}`);

    return remoteFilePath;
  } catch (error) {
    console.error('Error uploading buffer to SFTP:', error);
    throw error;
  } finally {
    // Always disconnect
    await sftp.end();
  }
}

/**
 * Check if SFTP is configured
 */
export function isSFTPConfigured(): boolean {
  try {
    getSFTPConfig();
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get the public URL for an SFTP file
 * @param remoteFileName - The remote file name (e.g., 'filename.pdf')
 * @param subfolder - Optional subfolder within the base remote directory (e.g., 'atlassian')
 * @returns The public URL to access the file
 */
export function getSFTPPublicURL(remoteFileName: string, subfolder?: string): string {
  const config = getSFTPConfig();
  const publicBaseUrl = process.env.SFTP_PUBLIC_URL || `sftp://${config.host}:${config.port}`;

  // Build the full path with optional subfolder
  const remoteDir = subfolder
    ? `${config.remoteDir}/${subfolder}`
    : config.remoteDir;

  // If remoteFileName already includes the full path, use it as is
  // Otherwise, prepend the remote directory
  const fullPath = remoteFileName.startsWith('/')
    ? remoteFileName
    : `${remoteDir}/${remoteFileName}`;

  return `${publicBaseUrl}${fullPath}`;
}
