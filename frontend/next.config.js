/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  swcMinify: true,
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? {
            exclude: ["error", "warn"],
          }
        : false,
  },
  images: {
    domains: ["firebasestorage.googleapis.com"],
  },
  transpilePackages: ["react-quill"],

  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
      {
        source: "/upload-audio",
        destination: `${apiUrl}/upload-audio`,
      },
      {
        source: "/trash-files",
        destination: `${apiUrl}/trash-files`,
      },
      {
        source: "/restore_file/:path*",
        destination: `${apiUrl}/restore_file/:path*`,
      },
      {
        source: "/perm_delete_files/:path*",
        destination: `${apiUrl}/perm_delete_files/:path*`,
      },
      {
        source: "/local-audio/:path*",
        destination: `${apiUrl}/local-audio/:path*`,
      },
      {
        source: "/socket.io",
        destination: `${apiUrl}/socket.io`,
      },
      {
        source: "/socket.io/:path*",
        destination: `${apiUrl}/socket.io/:path*`,
      },
    ];
  },

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.optimization.splitChunks.cacheGroups = {
        ...config.optimization.splitChunks.cacheGroups,
        commons: {
          test: /[\\/]node_modules[\\/]/,
          name: "vendors",
          chunks: "all",
          priority: 10,
        },
        default: {
          minChunks: 2,
          priority: -10,
          reuseExistingChunk: true,
        },
      };

      config.optimization.runtimeChunk = {
        name: "runtime",
      };
    }

    return config;
  },

  env: {
    NEXT_PUBLIC_DEFAULT_REPLICATE_API_KEY:
      "r8_P18zK076s92g3ZuY4pcb1THRAzmnFpE3j70Vf",
  },

  experimental: {
    optimizeCss: true,
    optimizePackageImports: ["primereact", "@firebase/auth"],
  },

  poweredByHeader: false,
};

module.exports = nextConfig;
