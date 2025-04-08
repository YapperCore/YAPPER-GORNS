const webpack = require('webpack');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');

module.exports = {
  webpack: {
    configure: (webpackConfig, { env, paths }) => {
      // Add fallbacks
      const fallback = webpackConfig.resolve.fallback || {};
      Object.assign(fallback, {
        "http": require.resolve("stream-http"),
        "https": require.resolve("https-browserify"),
        "crypto": require.resolve("crypto-browserify"),
        "stream": require.resolve("stream-browserify"),
        "os": require.resolve("os-browserify/browser"),
        "url": require.resolve("url/"),
        "assert": require.resolve("assert/"),
        "querystring": require.resolve("querystring-es3"),
        "path": require.resolve("path-browserify"),
        "zlib": require.resolve("browserify-zlib"),
        "buffer": require.resolve("buffer/"),
        "process": require.resolve("process/browser"),
        "events": require.resolve("events/"),
        "net": false,
        "tls": false,
        "fs": false,
        "child_process": false,
        "http2": false
      });
      webpackConfig.resolve.fallback = fallback;

      // Add plugins
      webpackConfig.plugins = (webpackConfig.plugins || []).concat([
        new webpack.ProvidePlugin({
          process: 'process/browser',
          Buffer: ['buffer', 'Buffer'],
        }),
        new NodePolyfillPlugin() // Add this line
      ]);

      // Add this new section for node: protocol handling
      webpackConfig.module = {
        ...webpackConfig.module,
        parser: {
          ...webpackConfig.module?.parser,
          javascript: {
            ...webpackConfig.module?.parser?.javascript,
            importExportsPresence: 'error',
          },
        },
      };

      return webpackConfig;
    }
  }
};