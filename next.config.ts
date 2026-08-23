import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  basePath: '/cloud',
  // assetPrefix: '/account/',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'neupcdn.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'neupgroup.com',
        port: '',
        pathname: '/cloud/logo.svg',
      }
    ],
  },
  // Exclude server-only packages from webpack bundling
  serverExternalPackages: ['ssh2', 'node-ssh', 'cpu-features'],
  experimental: {
    proxyClientMaxBodySize: '100mb',
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
};

export default nextConfig;
