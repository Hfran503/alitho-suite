#!/usr/bin/env tsx
/**
 * Setup NetSuite Integration in Production Database
 *
 * This script creates the NetSuiteIntegration record in the database
 * so the worker can start processing invoices.
 *
 * Usage:
 *   DATABASE_URL=your-db-url tsx scripts/setup-netsuite-production.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function setupNetSuiteIntegration() {
  try {
    console.log('🔧 Setting up NetSuite integration...')

    // Get the tenant (should be only one for most deployments)
    const tenant = await prisma.tenant.findFirst()

    if (!tenant) {
      console.error('❌ No tenant found in database')
      console.log('💡 Tip: You need to create a tenant first')
      process.exit(1)
    }

    console.log(`✓ Found tenant: ${tenant.name} (${tenant.id})`)

    // Check if NetSuite integration already exists
    const existing = await prisma.netSuiteIntegration.findUnique({
      where: { tenantId: tenant.id },
    })

    if (existing) {
      console.log('⚠️  NetSuite integration already exists')
      console.log('   Current mode:', existing.currentMode)
      console.log('   Sandbox enabled:', existing.sandboxEnabled)
      console.log('   Production enabled:', existing.productionEnabled)

      const answer = await askQuestion('Do you want to update it? (yes/no): ')
      if (answer.toLowerCase() !== 'yes') {
        console.log('Cancelled')
        process.exit(0)
      }
    }

    // Get configuration details
    console.log('\n📝 NetSuite Configuration')
    console.log('Note: Credentials are stored in AWS Secrets Manager')
    console.log('      You only need to set the mode and enable flags here\n')

    const currentMode = await askQuestion('Select mode (sandbox/production) [sandbox]: ') || 'sandbox'
    const sandboxEnabled = (await askQuestion('Enable sandbox? (yes/no) [yes]: ') || 'yes') === 'yes'
    const productionEnabled = (await askQuestion('Enable production? (yes/no) [no]: ') || 'no') === 'yes'

    // Create or update the integration
    const integration = await prisma.netSuiteIntegration.upsert({
      where: { tenantId: tenant.id },
      create: {
        tenantId: tenant.id,
        currentMode: currentMode as 'sandbox' | 'production',
        sandboxEnabled,
        productionEnabled,
      },
      update: {
        currentMode: currentMode as 'sandbox' | 'production',
        sandboxEnabled,
        productionEnabled,
      },
    })

    console.log('\n✅ NetSuite integration configured successfully!')
    console.log('   Tenant:', tenant.name)
    console.log('   Mode:', integration.currentMode)
    console.log('   Sandbox enabled:', integration.sandboxEnabled)
    console.log('   Production enabled:', integration.productionEnabled)

    console.log('\n📋 Next Steps:')
    console.log('1. Make sure NetSuite credentials are in AWS Secrets Manager')
    console.log('   Secret name: calitho-suite/netsuite/{tenantId}')
    console.log('2. Set NETSUITE_RESTLET_URL environment variable')
    console.log('3. Restart the worker service')
    console.log('4. Test by sending an invoice from PACE')

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Helper to ask questions in terminal
function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    readline.question(question, (answer: string) => {
      readline.close()
      resolve(answer.trim())
    })
  })
}

// Run the setup
setupNetSuiteIntegration()
