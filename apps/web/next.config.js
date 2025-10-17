/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ['@prisma/client', 'bcryptjs'],
  transpilePackages: ['@repo/ui', '@repo/types', '@repo/database'],
  // Next.js automatically loads .env files, no need to explicitly map them
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'minio',
        port: '9000',
      },
      {
        protocol: 'https',
        hostname: 'storage.yourdomain.com',
      },
    ],
  },
}

module.exports = nextConfig
