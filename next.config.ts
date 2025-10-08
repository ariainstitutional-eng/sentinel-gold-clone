import type { NextConfig } from "next";
import path from "node:path";

const LOADER = path.resolve(__dirname, 'src/visual-edits/component-tagger-loader.js');

const nextConfig: NextConfig = {
  // Exclude TensorFlow and native modules from client-side bundling
  serverExternalPackages: [
    '@tensorflow/tfjs-node',
    '@mapbox/node-pre-gyp',
  ],
  
  webpack: (config, { isServer }) => {
    // Only apply these rules to client-side builds
    if (!isServer) {
      // Externalize problematic modules
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push({
          '@tensorflow/tfjs-node': 'commonjs @tensorflow/tfjs-node',
          '@mapbox/node-pre-gyp': 'commonjs @mapbox/node-pre-gyp',
        });
      }
      
      // Add resolve fallbacks for Node.js modules
      config.resolve = config.resolve || {};
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'aws-sdk': false,
        'mock-aws-s3': false,
        'nock': false,
        'fs': false,
        'path': false,
        'crypto': false,
      };
    }
    
    return config;
  },
  
  turbopack: {
    rules: {
      "*.{jsx,tsx}": {
        loaders: [LOADER]
      }
    }
  }
};

export default nextConfig;
// Orchids restart: 1759591747548