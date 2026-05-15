/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['192.168.1.11'],
  experimental: {
    serverActions: {
      allowedOrigins: ['192.168.1.11:3033'],
    },
  },
}

module.exports = nextConfig
