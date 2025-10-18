import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager'

// Initialize the Secrets Manager client
const client = new SecretsManagerClient({
  region: process.env.AWS_REGION || process.env.S3_REGION || 'us-west-1',
})

// Cache for secrets to avoid repeated API calls
const secretsCache = new Map<string, any>()

/**
 * Fetch a secret from AWS Secrets Manager
 * @param secretName - The name or ARN of the secret
 * @param parseJson - Whether to parse the secret as JSON (default: true)
 * @returns The secret value
 */
export async function getSecret(
  secretName: string,
  parseJson: boolean = true
): Promise<any> {
  // Check cache first
  if (secretsCache.has(secretName)) {
    return secretsCache.get(secretName)
  }

  try {
    const command = new GetSecretValueCommand({
      SecretId: secretName,
    })

    const response = await client.send(command)

    let secret: any
    if (response.SecretString) {
      secret = parseJson ? JSON.parse(response.SecretString) : response.SecretString
    } else if (response.SecretBinary) {
      // Handle binary secrets if needed
      const buff = Buffer.from(response.SecretBinary)
      secret = buff.toString('ascii')
    } else {
      throw new Error('Secret has no value')
    }

    // Cache the secret
    secretsCache.set(secretName, secret)

    return secret
  } catch (error) {
    console.error(`Error fetching secret ${secretName}:`, error)
    throw error
  }
}

/**
 * Get database credentials from AWS Secrets Manager
 * Falls back to environment variables if AWS Secrets Manager is not configured
 */
export async function getDatabaseUrl(): Promise<string> {
  // If using local development, use env var
  if (process.env.NODE_ENV === 'development' && process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }

  // Try to fetch from AWS Secrets Manager
  try {
    const secretName = process.env.AWS_SECRET_DATABASE || 'calitho-suite/database'
    const secret = await getSecret(secretName)
    return secret.DATABASE_URL || secret.url || secret.connectionString
  } catch (error) {
    // Fallback to env var if Secrets Manager fails
    if (process.env.DATABASE_URL) {
      console.warn('Failed to fetch database secret, using env var')
      return process.env.DATABASE_URL
    }
    throw new Error('DATABASE_URL not found in Secrets Manager or environment')
  }
}

/**
 * Get NextAuth secret from AWS Secrets Manager
 * Falls back to environment variables if AWS Secrets Manager is not configured
 */
export async function getNextAuthSecret(): Promise<string> {
  // If using local development, use env var
  if (process.env.NODE_ENV === 'development' && process.env.NEXTAUTH_SECRET) {
    return process.env.NEXTAUTH_SECRET
  }

  // Try to fetch from AWS Secrets Manager
  try {
    const secretName = process.env.AWS_SECRET_NEXTAUTH || 'calitho-suite/nextauth'
    const secret = await getSecret(secretName)
    return secret.NEXTAUTH_SECRET || secret.secret
  } catch (error) {
    // Fallback to env var if Secrets Manager fails
    if (process.env.NEXTAUTH_SECRET) {
      console.warn('Failed to fetch NextAuth secret, using env var')
      return process.env.NEXTAUTH_SECRET
    }
    throw new Error('NEXTAUTH_SECRET not found in Secrets Manager or environment')
  }
}

/**
 * Get Redis URL from AWS Secrets Manager
 * Falls back to environment variables if AWS Secrets Manager is not configured
 */
export async function getRedisUrl(): Promise<string> {
  // If using local development, use env var
  if (process.env.NODE_ENV === 'development' && process.env.REDIS_URL) {
    return process.env.REDIS_URL
  }

  // Try to fetch from AWS Secrets Manager
  try {
    const secretName = process.env.AWS_SECRET_REDIS || 'calitho-suite/redis'
    const secret = await getSecret(secretName)
    return secret.REDIS_URL || secret.url
  } catch (error) {
    // Fallback to env var if Secrets Manager fails
    if (process.env.REDIS_URL) {
      console.warn('Failed to fetch Redis secret, using env var')
      return process.env.REDIS_URL
    }
    throw new Error('REDIS_URL not found in Secrets Manager or environment')
  }
}

/**
 * Get PACE API credentials from AWS Secrets Manager
 * Falls back to environment variables if AWS Secrets Manager is not configured
 */
export async function getPaceApiCredentials(): Promise<{
  url: string
  username: string
  password: string
}> {
  // If using local development, use env vars
  if (
    process.env.NODE_ENV === 'development' &&
    process.env.PACE_API_URL &&
    process.env.PACE_USERNAME &&
    process.env.PACE_PASSWORD
  ) {
    return {
      url: process.env.PACE_API_URL,
      username: process.env.PACE_USERNAME,
      password: process.env.PACE_PASSWORD,
    }
  }

  // Try to fetch from AWS Secrets Manager
  try {
    const secretName = process.env.AWS_SECRET_PACE || 'calitho-suite/pace'
    const secret = await getSecret(secretName)

    const url = secret.PACE_API_URL || secret.url || secret.apiUrl
    const username = secret.PACE_USERNAME || secret.username
    const password = secret.PACE_PASSWORD || secret.password

    if (!url || !username || !password) {
      throw new Error('PACE API credentials incomplete in Secrets Manager')
    }

    return { url, username, password }
  } catch (error) {
    // Fallback to env vars if Secrets Manager fails
    if (process.env.PACE_API_URL && process.env.PACE_USERNAME && process.env.PACE_PASSWORD) {
      console.warn('Failed to fetch PACE API secret, using env vars')
      return {
        url: process.env.PACE_API_URL,
        username: process.env.PACE_USERNAME,
        password: process.env.PACE_PASSWORD,
      }
    }
    throw new Error('PACE API credentials not found in Secrets Manager or environment')
  }
}

/**
 * Get all application secrets from AWS Secrets Manager
 * This is useful for initializing the application with all secrets at once
 */
export async function getAllSecrets() {
  const [databaseUrl, nextAuthSecret, redisUrl, paceApi] = await Promise.allSettled([
    getDatabaseUrl(),
    getNextAuthSecret(),
    getRedisUrl(),
    getPaceApiCredentials(),
  ])

  return {
    databaseUrl:
      databaseUrl.status === 'fulfilled' ? databaseUrl.value : process.env.DATABASE_URL,
    nextAuthSecret:
      nextAuthSecret.status === 'fulfilled'
        ? nextAuthSecret.value
        : process.env.NEXTAUTH_SECRET,
    redisUrl: redisUrl.status === 'fulfilled' ? redisUrl.value : process.env.REDIS_URL,
    paceApi:
      paceApi.status === 'fulfilled'
        ? paceApi.value
        : {
            url: process.env.PACE_API_URL,
            username: process.env.PACE_USERNAME,
            password: process.env.PACE_PASSWORD,
          },
  }
}

/**
 * Clear the secrets cache
 * Useful for forcing a refresh of secrets
 */
export function clearSecretsCache() {
  secretsCache.clear()
}
