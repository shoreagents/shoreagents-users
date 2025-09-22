import type { NextConfig } from "next";
import webpack from "webpack";

// Set up global environment before Next.js processes anything
// Load our custom globalThis polyfill
require('./src/lib/globalthis-polyfill.js');

const nextConfig: NextConfig = {
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  // PERFORMANCE OPTIMIZATIONS
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-accordion', '@radix-ui/react-avatar'],
  },
  // Turbopack configuration (moved from experimental.turbo)
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
  compiler: {
    // Remove console.logs in production
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // Webpack configuration for production builds only
  webpack: (config, { isServer, dev }) => {
    // Set up global environment for server-side compatibility
    if (isServer) {
      // Ensure self is available in the global scope for server-side builds
      if (typeof global !== 'undefined' && typeof (global as any).self === 'undefined') {
        (global as any).self = global;
      }
    }
    // Provide fallbacks for both server and browser
    config.resolve.fallback = {
      ...config.resolve.fallback,
      ...(isServer ? {} : {
        fs: false,
        net: false,
        tls: false,
        process: false,
      }),
    };

    // Handle Supabase Edge Runtime warnings by providing process polyfill
    config.resolve.alias = {
      ...config.resolve.alias,
      'process/browser': require.resolve('process/browser'),
      // Block all globalThis polyfill files that use dynamic code evaluation
      'globalThis/implementation.browser.js': false,
      'globalThis/index.js': false,
      'globalThis': false,
    };

    // Add specific handling for Supabase modules
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@supabase/node-fetch': false,
      };
    }

    // Define global variables for both server and browser compatibility
    config.plugins = config.plugins || [];
    
    // Define globals to prevent "self is not defined" errors
    config.plugins.push(
      new webpack.DefinePlugin({
        'self': isServer ? 'global' : 'self',
        'window': isServer ? 'undefined' : 'window',
        'global': 'global',
        'globalThis': isServer ? 'global' : 'globalThis',
      })
    );
    
    // Block the problematic globalThis module entirely
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^globalThis$/,
      })
    );
    
    // PERFORMANCE: Optimize bundle splitting
    if (!dev) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
          radix: {
            test: /[\\/]node_modules[\\/]@radix-ui[\\/]/,
            name: 'radix-ui',
            chunks: 'all',
            priority: 10,
          },
        },
      };
    }
    
    return config;
  },
};

export default nextConfig;