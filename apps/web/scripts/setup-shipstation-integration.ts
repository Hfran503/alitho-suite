import { db } from '@repo/database'

async function main() {
  const tenantSlug = 'calitho'

  console.log('Setting up ShipStation integration for tenant:', tenantSlug)

  // Find the tenant
  const tenant = await db.tenant.findUnique({
    where: { slug: tenantSlug },
  })

  if (!tenant) {
    console.error('Tenant not found:', tenantSlug)
    process.exit(1)
  }

  console.log('Found tenant:', tenant.name, `(${tenant.id})`)

  // Check if integration already exists
  const existingIntegration = await db.integration.findUnique({
    where: {
      tenantId_provider: {
        tenantId: tenant.id,
        provider: 'shipstation',
      },
    },
  })

  if (existingIntegration) {
    console.log('ShipStation integration already exists, updating...')
    await db.integration.update({
      where: { id: existingIntegration.id },
      data: {
        enabled: true,
        config: { mode: 'test' }, // Use test mode for development
      },
    })
  } else {
    console.log('Creating ShipStation integration...')
    await db.integration.create({
      data: {
        tenantId: tenant.id,
        provider: 'shipstation',
        enabled: true,
        config: { mode: 'test' }, // Use test mode for development
      },
    })
  }

  console.log('✅ ShipStation integration configured')

  // Prompt for API key
  console.log('\n⚠️  IMPORTANT: You need to save your ShipStation (ShipEngine) API key to AWS Secrets Manager')
  console.log('\nTo save the API key, run:')
  console.log(`\nnode -e "require('./lib/secrets').saveShipStationApiKey('${tenant.id}', 'YOUR_TEST_API_KEY', 'YOUR_PRODUCTION_API_KEY').then(() => console.log('Saved!')).catch(console.error)"`)
  console.log('\nOr manually create the secret in AWS Secrets Manager:')
  console.log(`Secret Name: calitho-suite/integrations/shipstation/${tenant.id}`)
  console.log(`Secret Value: {"testApiKey":"YOUR_KEY","productionApiKey":"YOUR_KEY"}`)
  console.log('\nIf you are in development and do not have AWS configured, you can use environment variables instead.')
  console.log('The system will automatically fall back to checking for ShipStation credentials in env vars.')
}

main()
  .catch((error) => {
    console.error('Error setting up ShipStation integration:', error)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
