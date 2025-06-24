/** @type {import('next').NextConfig} */
const nextConfig = {
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

module.exports = nextConfig;
