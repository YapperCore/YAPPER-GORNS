// next.config.js - Updated with proper socket.io configuration
/** @type {import('next').NextConfig} */

const nextConfig = {
  reactStrictMode: false, // Disable strict mode to avoid ReactQuill issues
  swcMinify: true,
  transpilePackages: ['react-quill'], // Ensure React-Quill is properly transpiled
  
  // Configure API proxy for development
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.NEXT_PUBLIC_API_URL 
          ? `${process.env.NEXT_PUBLIC_API_URL}/api/:path*` 
          : 'http://localhost:5000/api/:path*',
      },
      {
        source: '/upload-audio',
        destination: process.env.NEXT_PUBLIC_API_URL 
          ? `${process.env.NEXT_PUBLIC_API_URL}/upload-audio` 
          : 'http://localhost:5000/upload-audio',
      },
      {
        source: '/trash-files',
        destination: process.env.NEXT_PUBLIC_API_URL 
          ? `${process.env.NEXT_PUBLIC_API_URL}/trash-files` 
          : 'http://localhost:5000/trash-files',
      },
      {
        source: '/restore_file/:path*',
        destination: process.env.NEXT_PUBLIC_API_URL 
          ? `${process.env.NEXT_PUBLIC_API_URL}/restore_file/:path*` 
          : 'http://localhost:5000/restore_file/:path*',
      },
      {
        source: '/perm_delete_files/:path*',
        destination: process.env.NEXT_PUBLIC_API_URL 
          ? `${process.env.NEXT_PUBLIC_API_URL}/perm_delete_files/:path*` 
          : 'http://localhost:5000/perm_delete_files/:path*',
      },
      {
        source: '/local-audio/:path*',
        destination: process.env.NEXT_PUBLIC_API_URL 
          ? `${process.env.NEXT_PUBLIC_API_URL}/local-audio/:path*` 
          : 'http://localhost:5000/local-audio/:path*',
      },
      {
        source: '/socket.io',
        destination: process.env.NEXT_PUBLIC_API_URL 
          ? `${process.env.NEXT_PUBLIC_API_URL}/socket.io` 
          : 'http://localhost:5000/socket.io',
      },
      {
        source: '/socket.io/:path*',
        destination: process.env.NEXT_PUBLIC_API_URL 
          ? `${process.env.NEXT_PUBLIC_API_URL}/socket.io/:path*` 
          : 'http://localhost:5000/socket.io/:path*',
      }
    ];
  },
  
  webpack: (config) => {
    return config;
  },
};

module.exports = nextConfig;
