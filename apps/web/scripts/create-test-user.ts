import { db } from '@repo/database'
import { hash } from 'bcryptjs'

async function main() {
  const email = 'hector.franco@calitho.com'
  const name = 'Hector Franco'
  const password = 'Calitho94520!'

  console.log('Creating test user:', email)

  // Check if user already exists
  const existingUser = await db.user.findUnique({
    where: { email },
  })

  if (existingUser) {
    console.log('User already exists with ID:', existingUser.id)

    // Check if user has a tenant
    const membership = await db.membership.findFirst({
      where: { userId: existingUser.id },
      include: { tenant: true },
    })

    if (membership) {
      console.log('User is member of tenant:', membership.tenant.name, `(${membership.tenant.slug})`)
    } else {
      console.log('User has no tenant membership')
    }

    return
  }

  // Hash the password
  const hashedPassword = await hash(password, 10)

  // Create tenant first
  const tenant = await db.tenant.create({
    data: {
      name: 'Calitho',
      slug: 'calitho',
      plan: 'enterprise',
      status: 'active',
    },
  })

  console.log('Created tenant:', tenant.name, `(${tenant.slug})`)

  // Create user
  const user = await db.user.create({
    data: {
      email,
      name,
      password: hashedPassword,
      emailVerified: new Date(), // Mark as verified
      passwordResetRequired: false,
    },
  })

  console.log('Created user:', user.email, 'with ID:', user.id)

  // Create membership (link user to tenant)
  const membership = await db.membership.create({
    data: {
      userId: user.id,
      tenantId: tenant.id,
      role: 'owner', // Make them owner
    },
  })

  console.log('Created membership with role:', membership.role)

  console.log('\n✅ Test user created successfully!')
  console.log('\nLogin credentials:')
  console.log('Email:', email)
  console.log('Password:', password)
  console.log('\nTenant:', tenant.name, `(${tenant.slug})`)
}

main()
  .catch((error) => {
    console.error('Error creating test user:', error)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
