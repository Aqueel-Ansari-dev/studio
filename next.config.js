
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
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**', // Allows all hostnames over HTTPS
      },
      {
        protocol: 'http',
        hostname: '**', // Allows all hostnames over HTTP
      },
    ],
  },
};

export default nextConfig;
