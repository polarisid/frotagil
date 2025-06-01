
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.media.stellantis.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'resizer.iproimg.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'fotos-estradao-estadao.nyc3.cdn.digitaloceanspaces.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Environment variables prefixed with NEXT_PUBLIC_ are automatically
  // available in the browser and do not need to be explicitly defined here.
  // Removing this block relies on Next.js's default behavior.
};

export default nextConfig;
