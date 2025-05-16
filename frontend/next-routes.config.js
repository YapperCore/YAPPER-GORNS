// next-routes.config.js
module.exports = async function rewrites() {
  return [
    {
      source: "/api/:path*",
      destination: "http://127.0.0.1:5001/api/:path*",
    },
    {
      source: "/upload-audio",
      destination: "http://127.0.0.1:5001/upload-audio",
    },
    {
      source: "/local-audio/:path*",
      destination: "http://127.0.0.1:5001/local-audio/:path*",
    },
    {
      source: "/socket.io/:path*",
      destination: "http://127.0.0.1:5001/socket.io/:path*",
    },
    {
      source: "/trash-files",
      destination: "http://127.0.0.1:5001/trash-files",
    },
    {
      source: "/restore_file/:path*",
      destination: "http://127.0.0.1:5001/restore_file/:path*",
    },
    {
      source: "/upload-files",
      destination: "http://127.0.0.1:5001/upload-files",
    },
    {
      source: "/perm_delete_files/:path*",
      destination: "http://127.0.0.1:5001/perm_delete_files/:path*",
    },
  ];
};
