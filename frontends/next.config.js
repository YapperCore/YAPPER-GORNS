// next.config.js
/** @type {import('next').NextConfig} */

const nextConfig = {
  reactStrictMode: false, // Disable strict mode to avoid ReactQuill issues
  swcMinify: true,
  transpilePackages: ['react-quill'], // Ensure React-Quill is properly transpiled
  
  // Configure API proxy for development
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
      {
        source: '/upload-audio',
        destination: `${apiUrl}/upload-audio`,
      },
      {
        source: '/trash-files',
        destination: `${apiUrl}/trash-files`,
      },
      {
        source: '/restore_file/:path*',
        destination: `${apiUrl}/restore_file/:path*`,
      },
      {
        source: '/perm_delete_files/:path*',
        destination: `${apiUrl}/perm_delete_files/:path*`,
      },
      {
        source: '/local-audio/:path*',
        destination: `${apiUrl}/local-audio/:path*`,
      },
      // Important: Properly proxy all socket.io requests
      {
        source: '/socket.io',
        destination: `${apiUrl}/socket.io`,
      },
      {
        source: '/socket.io/:path*',
        destination: `${apiUrl}/socket.io/:path*`,
      }
    ];
  },
  
  webpack: (config) => {
    return config;
  },
};

module.exports = nextConfig;
