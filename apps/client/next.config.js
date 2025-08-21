// next.config.js
const withPlugins = require('next-compose-plugins');
const removeImports = require('next-remove-imports')();
const nextTranslate = require('next-translate-plugin');
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: false,
});

module.exports = withPlugins(
  [removeImports, nextTranslate, withPWA],
  {
    reactStrictMode: false,
    output: 'standalone',
    outputFileTracingRoot: require('path').join(__dirname, '../../'),

    async rewrites() {
      return [
        {
          source: '/api/v1/:path*',
          destination: 'http://localhost:5003/api/v1/:path*',
        },
      ];
    },
  }
);
