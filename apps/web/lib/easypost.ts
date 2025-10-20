import EasyPost from '@easypost/api'
import { getEasyPostApiKey } from './secrets'
import { db } from '@repo/database'

/**
 * Get an EasyPost client instance for a specific tenant
 * Uses the mode configured in the integration settings (test or production)
 * @param tenantId - The tenant ID to get the client for
 * @returns An initialized EasyPost client
 * @throws Error if the API key is not configured for the tenant
 */
export async function getEasyPostClient(tenantId: string): Promise<InstanceType<typeof EasyPost>> {
  // Get integration settings to determine mode
  const integration = await db.integration.findUnique({
    where: {
      tenantId_provider: {
        tenantId,
        provider: 'easypost',
      },
    },
    select: {
      config: true,
    },
  })

  // Default to test mode if not configured
  const mode = (integration?.config as any)?.mode || 'test'

  const apiKey = await getEasyPostApiKey(tenantId, mode)
  return new EasyPost(apiKey)
}

/**
 * Check if EasyPost is configured for a tenant
 * @param tenantId - The tenant ID to check
 * @param mode - The mode to check (test or production), defaults to test
 * @returns True if configured, false otherwise
 */
export async function isEasyPostConfigured(
  tenantId: string,
  mode: 'test' | 'production' = 'test'
): Promise<boolean> {
  try {
    await getEasyPostApiKey(tenantId, mode)
    return true
  } catch (error) {
    return false
  }
}
