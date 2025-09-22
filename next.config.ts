import type { NextConfig } from "next";

// Set up global environment before Next.js processes anything
if (typeof global !== 'undefined') {
  if (typeof (global as any).self === 'undefined') {
    (global as any).self = global;
  }
  if (typeof (global as any).globalThis === 'undefined') {
    (global as any).globalThis = global;
  }
}

const nextConfig: NextConfig = {
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  // PERFORMANCE OPTIMIZATIONS
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-accordion', '@radix-ui/react-avatar'],
  },
  compiler: {
    // Remove console.logs in production
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // Ensure TypeScript path mapping works
  typescript: {
    ignoreBuildErrors: false,
  },
  // Webpack configuration for path resolution
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': require('path').resolve(__dirname, 'src'),
    };
    return config;
  },
};

export default nextConfig;