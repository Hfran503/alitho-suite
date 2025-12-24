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
  // Explicit webpack alias configuration for Docker builds
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname),
      '@/components': path.resolve(__dirname, 'components'),
      '@/lib': path.resolve(__dirname, 'lib'),
      '@/app': path.resolve(__dirname, 'app'),
    }
    return config
  },
}

module.exports = nextConfig
