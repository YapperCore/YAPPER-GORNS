// next.config.js
/** @type {import('next').NextConfig} */

const nextConfig = {
  reactStrictMode: false, // Disable strict mode to avoid ReactQuill issues
  swcMinify: true,
  experimental: {
    // Recommended experimental features for improved performance
    optimizeCss: true,
    optimizePackageImports: ['react-quill', 'primereact'],
  },
  transpilePackages: ['react-quill'], // Ensure React-Quill is properly transpiled
  webpack: (config) => {
    // Add webpack configuration to handle specific modules if needed
    return config;
  },
};

module.exports = nextConfig;
