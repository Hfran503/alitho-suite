/** @type {import('next').NextConfig} */
const path = require('path')

const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  serverExternalPackages: ['@prisma/client', 'bcryptjs', 'ssh2', 'ssh2-sftp-client', 'cpu-features', '@napi-rs/canvas', 'pdf-to-png-converter'],
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
