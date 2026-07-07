import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Anchor the Turbopack workspace root to this folder. Otherwise Next picks
  // up the parent `marketing/package-lock.json` and warns about ambiguity.
  turbopack: {
    root: path.join(__dirname),
  },
  // Enable compression to reduce payload sizes
  compress: true,
  // Optimize images
  images: {
    domains: ['avatars.githubusercontent.com', 'lh3.googleusercontent.com'],
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
  // Enable experimental features for better performance
  experimental: {
    typedRoutes: true,
    instrumentationHook: true,
  },
  // Optimize webpack bundles
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }
    return config;
  },
};

export default nextConfig;