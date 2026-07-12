// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// expo-sqlite's web support (alpha) is backed by a WASM build of SQLite, so
// Metro needs to treat .wasm files as bundleable assets.
config.resolver.assetExts.push('wasm');

// The WASM SQLite build needs SharedArrayBuffer to persist data via OPFS in
// the browser, which only exists on "cross-origin isolated" pages. That
// requires these two response headers on every request from the dev server.
// Without them expo-sqlite still runs on web, it just can't persist data
// across reloads (irrelevant for native builds, which don't use WASM at all).
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
      return middleware(req, res, next);
    };
  },
};

module.exports = config;
