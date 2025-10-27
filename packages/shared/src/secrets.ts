import {
  SecretsManagerClient,
  GetSecretValueCommand,
  CreateSecretCommand,
  UpdateSecretCommand,
  DeleteSecretCommand,
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
  // Try to fetch from AWS Secrets Manager first (even in development)
  try {
    const secretName = process.env.AWS_SECRET_NEXTAUTH || 'calitho-suite/nextauth'
    const secret = await getSecret(secretName)
    return secret.NEXTAUTH_SECRET || secret.secret
  } catch (error) {
    // Fallback to env var if Secrets Manager fails
    if (process.env.NEXTAUTH_SECRET) {
      console.warn('Failed to fetch NextAuth secret from AWS, using env var')
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

// ============================================
// INTEGRATION CREDENTIALS (EASYPOST, etc.)
// ============================================

/**
 * Get EasyPost API key from AWS Secrets Manager for a specific tenant
 * @param tenantId - The tenant ID to get the API key for
 * @returns The EasyPost API key
 */
export async function getEasyPostApiKey(
  tenantId: string,
  mode: 'test' | 'production' = 'test'
): Promise<string> {
  const secretName = `calitho-suite/integrations/easypost/${tenantId}`

  try {
    const secret = await getSecret(secretName, true) // Now stored as JSON
    const apiKey = mode === 'test' ? secret.testApiKey : secret.productionApiKey

    if (!apiKey) {
      throw new Error(`EasyPost ${mode} API key not found for tenant ${tenantId}`)
    }

    return apiKey
  } catch (error) {
    throw new Error(`EasyPost API keys not found for tenant ${tenantId}`)
  }
}

/**
 * Save EasyPost API keys to AWS Secrets Manager for a specific tenant
 * @param tenantId - The tenant ID to save the API keys for
 * @param testApiKey - The EasyPost test API key (optional)
 * @param productionApiKey - The EasyPost production API key (optional)
 */
export async function saveEasyPostApiKey(
  tenantId: string,
  testApiKey?: string,
  productionApiKey?: string
): Promise<void> {
  const secretName = `calitho-suite/integrations/easypost/${tenantId}`

  // Get existing keys if they exist
  let existingSecret: any = {}
  try {
    existingSecret = await getSecret(secretName, true)
  } catch (error) {
    // Secret doesn't exist yet, will create new one
  }

  // Merge with new keys (only update provided keys)
  const secretValue = {
    testApiKey: testApiKey || existingSecret.testApiKey,
    productionApiKey: productionApiKey || existingSecret.productionApiKey,
  }

  const secretString = JSON.stringify(secretValue)

  try {
    // Try to update existing secret first
    const updateCommand = new UpdateSecretCommand({
      SecretId: secretName,
      SecretString: secretString,
    })

    await client.send(updateCommand)

    // Update cache
    secretsCache.set(secretName, secretValue)
  } catch (error: any) {
    // If secret doesn't exist, create it
    if (error.name === 'ResourceNotFoundException') {
      const createCommand = new CreateSecretCommand({
        Name: secretName,
        SecretString: secretString,
        Description: `EasyPost API keys for tenant ${tenantId}`,
        Tags: [
          { Key: 'Application', Value: 'calitho-suite' },
          { Key: 'Integration', Value: 'easypost' },
          { Key: 'TenantId', Value: tenantId },
        ],
      })

      await client.send(createCommand)

      // Update cache
      secretsCache.set(secretName, secretValue)
    } else {
      throw error
    }
  }
}

/**
 * Delete EasyPost API key from AWS Secrets Manager for a specific tenant
 * @param tenantId - The tenant ID to delete the API key for
 */
export async function deleteEasyPostApiKey(tenantId: string): Promise<void> {
  const secretName = `calitho-suite/integrations/easypost/${tenantId}`

  try {
    const deleteCommand = new DeleteSecretCommand({
      SecretId: secretName,
      ForceDeleteWithoutRecovery: false, // Allow 30-day recovery window
    })

    await client.send(deleteCommand)

    // Clear from cache
    secretsCache.delete(secretName)
  } catch (error: any) {
    // Ignore if secret doesn't exist
    if (error.name !== 'ResourceNotFoundException') {
      throw error
    }
  }
}

// ============================================
// SHIPSTATION INTEGRATION CREDENTIALS
// ============================================

/**
 * Get ShipStation API key from AWS Secrets Manager for a specific tenant
 * @param tenantId - The tenant ID to get the API key for
 * @param mode - The mode (test or production)
 * @returns The ShipStation API key
 */
export async function getShipStationApiKey(
  tenantId: string,
  mode: 'test' | 'production' = 'test'
): Promise<string> {
  const secretName = `calitho-suite/integrations/shipstation/${tenantId}`

  try {
    const secret = await getSecret(secretName, true) // Stored as JSON
    const apiKey = mode === 'test' ? secret.testApiKey : secret.productionApiKey

    if (!apiKey) {
      throw new Error(`ShipStation ${mode} API key not found for tenant ${tenantId}`)
    }

    return apiKey
  } catch (error) {
    throw new Error(`ShipStation API keys not found for tenant ${tenantId}`)
  }
}

/**
 * Save ShipStation API keys to AWS Secrets Manager for a specific tenant
 * @param tenantId - The tenant ID to save the API keys for
 * @param testApiKey - The ShipStation test API key (optional)
 * @param productionApiKey - The ShipStation production API key (optional)
 */
export async function saveShipStationApiKey(
  tenantId: string,
  testApiKey?: string,
  productionApiKey?: string
): Promise<void> {
  const secretName = `calitho-suite/integrations/shipstation/${tenantId}`

  // Get existing keys if they exist
  let existingSecret: any = {}
  try {
    existingSecret = await getSecret(secretName, true)
  } catch (error) {
    // Secret doesn't exist yet, will create new one
  }

  // Merge with new keys (only update provided keys)
  const secretValue = {
    testApiKey: testApiKey || existingSecret.testApiKey,
    productionApiKey: productionApiKey || existingSecret.productionApiKey,
  }

  const secretString = JSON.stringify(secretValue)

  try {
    // Try to update existing secret first
    const updateCommand = new UpdateSecretCommand({
      SecretId: secretName,
      SecretString: secretString,
    })

    await client.send(updateCommand)

    // Update cache
    secretsCache.set(secretName, secretValue)
  } catch (error: any) {
    // If secret doesn't exist, create it
    if (error.name === 'ResourceNotFoundException') {
      const createCommand = new CreateSecretCommand({
        Name: secretName,
        SecretString: secretString,
        Description: `ShipStation API keys for tenant ${tenantId}`,
        Tags: [
          { Key: 'Application', Value: 'calitho-suite' },
          { Key: 'Integration', Value: 'shipstation' },
          { Key: 'TenantId', Value: tenantId },
        ],
      })

      await client.send(createCommand)

      // Update cache
      secretsCache.set(secretName, secretValue)
    } else {
      throw error
    }
  }
}

/**
 * Delete ShipStation API key from AWS Secrets Manager for a specific tenant
 * @param tenantId - The tenant ID to delete the API key for
 */
export async function deleteShipStationApiKey(tenantId: string): Promise<void> {
  const secretName = `calitho-suite/integrations/shipstation/${tenantId}`

  try {
    const deleteCommand = new DeleteSecretCommand({
      SecretId: secretName,
      ForceDeleteWithoutRecovery: false, // Allow 30-day recovery window
    })

    await client.send(deleteCommand)

    // Clear from cache
    secretsCache.delete(secretName)
  } catch (error: any) {
    // Ignore if secret doesn't exist
    if (error.name !== 'ResourceNotFoundException') {
      throw error
    }
  }
}

// ============================================
// NETSUITE INTEGRATION CREDENTIALS
// ============================================

export interface NetSuiteCredentials {
  sandboxAccountId?: string
  sandboxConsumerKey?: string
  sandboxConsumerSecret?: string
  sandboxTokenId?: string
  sandboxTokenSecret?: string
  productionAccountId?: string
  productionConsumerKey?: string
  productionConsumerSecret?: string
  productionTokenId?: string
  productionTokenSecret?: string
}

/**
 * Get NetSuite credentials from AWS Secrets Manager for a specific tenant
 * @param tenantId - The tenant ID to get credentials for
 * @returns The NetSuite credentials
 */
export async function getNetSuiteCredentials(tenantId: string): Promise<NetSuiteCredentials> {
  const secretName = `calitho-suite/integrations/netsuite/${tenantId}`

  try {
    const secret = await getSecret(secretName, true)
    return secret as NetSuiteCredentials
  } catch (error) {
    throw new Error(`NetSuite credentials not found for tenant ${tenantId}`)
  }
}

/**
 * Save NetSuite credentials to AWS Secrets Manager for a specific tenant
 * @param tenantId - The tenant ID to save credentials for
 * @param credentials - The NetSuite credentials to save
 */
export async function saveNetSuiteCredentials(
  tenantId: string,
  credentials: Partial<NetSuiteCredentials>
): Promise<void> {
  const secretName = `calitho-suite/integrations/netsuite/${tenantId}`

  // Get existing credentials if they exist
  let existingSecret: NetSuiteCredentials = {}
  try {
    existingSecret = await getSecret(secretName, true)
  } catch (error) {
    // Secret doesn't exist yet, will create new one
  }

  // Merge with new credentials (only update provided fields)
  const secretValue: NetSuiteCredentials = {
    sandboxAccountId: credentials.sandboxAccountId ?? existingSecret.sandboxAccountId,
    sandboxConsumerKey: credentials.sandboxConsumerKey ?? existingSecret.sandboxConsumerKey,
    sandboxConsumerSecret: credentials.sandboxConsumerSecret ?? existingSecret.sandboxConsumerSecret,
    sandboxTokenId: credentials.sandboxTokenId ?? existingSecret.sandboxTokenId,
    sandboxTokenSecret: credentials.sandboxTokenSecret ?? existingSecret.sandboxTokenSecret,
    productionAccountId: credentials.productionAccountId ?? existingSecret.productionAccountId,
    productionConsumerKey: credentials.productionConsumerKey ?? existingSecret.productionConsumerKey,
    productionConsumerSecret: credentials.productionConsumerSecret ?? existingSecret.productionConsumerSecret,
    productionTokenId: credentials.productionTokenId ?? existingSecret.productionTokenId,
    productionTokenSecret: credentials.productionTokenSecret ?? existingSecret.productionTokenSecret,
  }

  const secretString = JSON.stringify(secretValue)

  try {
    // Try to update existing secret first
    const updateCommand = new UpdateSecretCommand({
      SecretId: secretName,
      SecretString: secretString,
    })

    await client.send(updateCommand)

    // Update cache
    secretsCache.set(secretName, secretValue)
  } catch (error: any) {
    // If secret doesn't exist, create it
    if (error.name === 'ResourceNotFoundException') {
      const createCommand = new CreateSecretCommand({
        Name: secretName,
        SecretString: secretString,
        Description: `NetSuite OAuth credentials for tenant ${tenantId}`,
        Tags: [
          { Key: 'Application', Value: 'calitho-suite' },
          { Key: 'Integration', Value: 'netsuite' },
          { Key: 'TenantId', Value: tenantId },
        ],
      })

      await client.send(createCommand)

      // Update cache
      secretsCache.set(secretName, secretValue)
    } else {
      throw error
    }
  }
}

/**
 * Delete NetSuite credentials from AWS Secrets Manager for a specific tenant
 * @param tenantId - The tenant ID to delete credentials for
 */
export async function deleteNetSuiteCredentials(tenantId: string): Promise<void> {
  const secretName = `calitho-suite/integrations/netsuite/${tenantId}`

  try {
    const deleteCommand = new DeleteSecretCommand({
      SecretId: secretName,
      ForceDeleteWithoutRecovery: false, // Allow 30-day recovery window
    })

    await client.send(deleteCommand)

    // Clear from cache
    secretsCache.delete(secretName)
  } catch (error: any) {
    // Ignore if secret doesn't exist
    if (error.name !== 'ResourceNotFoundException') {
      throw error
    }
  }
}

// ============================================
// EMAIL INTEGRATION CREDENTIALS
// ============================================

export interface EmailCredentials {
  provider: 'smtp' | 'sendgrid' | 'ses' | 'resend'

  // SMTP credentials
  smtpHost?: string
  smtpPort?: number
  smtpSecure?: boolean
  smtpUser?: string
  smtpPassword?: string

  // SendGrid credentials
  sendgridApiKey?: string

  // AWS SES credentials
  sesRegion?: string
  sesAccessKeyId?: string
  sesSecretAccessKey?: string

  // Resend credentials
  resendApiKey?: string

  // Common fields
  fromEmail?: string
  fromName?: string
}

/**
 * Get email credentials from AWS Secrets Manager for a specific tenant
 * @param tenantId - The tenant ID to get credentials for
 * @returns The email credentials
 */
export async function getEmailCredentials(tenantId: string): Promise<EmailCredentials> {
  const secretName = `calitho-suite/integrations/email/${tenantId}`

  try {
    const secret = await getSecret(secretName, true)
    return secret as EmailCredentials
  } catch (error) {
    throw new Error(`Email credentials not found for tenant ${tenantId}`)
  }
}

/**
 * Save email credentials to AWS Secrets Manager for a specific tenant
 * @param tenantId - The tenant ID to save credentials for
 * @param credentials - The email credentials to save
 */
export async function saveEmailCredentials(
  tenantId: string,
  credentials: Partial<EmailCredentials>
): Promise<void> {
  const secretName = `calitho-suite/integrations/email/${tenantId}`

  // Get existing credentials if they exist
  let existingSecret: EmailCredentials = { provider: 'smtp' }
  try {
    existingSecret = await getSecret(secretName, true)
  } catch (error) {
    // Secret doesn't exist yet, will create new one
  }

  // Merge with new credentials (only update provided fields)
  const secretValue: EmailCredentials = {
    provider: credentials.provider ?? existingSecret.provider,
    smtpHost: credentials.smtpHost ?? existingSecret.smtpHost,
    smtpPort: credentials.smtpPort ?? existingSecret.smtpPort,
    smtpSecure: credentials.smtpSecure ?? existingSecret.smtpSecure,
    smtpUser: credentials.smtpUser ?? existingSecret.smtpUser,
    smtpPassword: credentials.smtpPassword ?? existingSecret.smtpPassword,
    sendgridApiKey: credentials.sendgridApiKey ?? existingSecret.sendgridApiKey,
    sesRegion: credentials.sesRegion ?? existingSecret.sesRegion,
    sesAccessKeyId: credentials.sesAccessKeyId ?? existingSecret.sesAccessKeyId,
    sesSecretAccessKey: credentials.sesSecretAccessKey ?? existingSecret.sesSecretAccessKey,
    resendApiKey: credentials.resendApiKey ?? existingSecret.resendApiKey,
    fromEmail: credentials.fromEmail ?? existingSecret.fromEmail,
    fromName: credentials.fromName ?? existingSecret.fromName,
  }

  const secretString = JSON.stringify(secretValue)

  try {
    // Try to update existing secret first
    const updateCommand = new UpdateSecretCommand({
      SecretId: secretName,
      SecretString: secretString,
    })

    await client.send(updateCommand)

    // Update cache
    secretsCache.set(secretName, secretValue)
  } catch (error: any) {
    // If secret doesn't exist, create it
    if (error.name === 'ResourceNotFoundException') {
      const createCommand = new CreateSecretCommand({
        Name: secretName,
        SecretString: secretString,
        Description: `Email service credentials for tenant ${tenantId}`,
        Tags: [
          { Key: 'Application', Value: 'calitho-suite' },
          { Key: 'Integration', Value: 'email' },
          { Key: 'TenantId', Value: tenantId },
        ],
      })

      await client.send(createCommand)

      // Update cache
      secretsCache.set(secretName, secretValue)
    } else {
      throw error
    }
  }
}

/**
 * Delete email credentials from AWS Secrets Manager for a specific tenant
 * @param tenantId - The tenant ID to delete credentials for
 */
export async function deleteEmailCredentials(tenantId: string): Promise<void> {
  const secretName = `calitho-suite/integrations/email/${tenantId}`

  try {
    const deleteCommand = new DeleteSecretCommand({
      SecretId: secretName,
      ForceDeleteWithoutRecovery: false, // Allow 30-day recovery window
    })

    await client.send(deleteCommand)

    // Clear from cache
    secretsCache.delete(secretName)
  } catch (error: any) {
    // Ignore if secret doesn't exist
    if (error.name !== 'ResourceNotFoundException') {
      throw error
    }
  }
}
