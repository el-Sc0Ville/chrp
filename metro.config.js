const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Allow SVG files to be bundled as static assets
config.resolver.assetExts.push('svg');

module.exports = config;
