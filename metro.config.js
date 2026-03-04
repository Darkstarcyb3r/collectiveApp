const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// 🔥 KILL MINIFICATION COMPLETELY 🔥
config.transformer.minifierConfig = {
  compress: false,
  mangle: false,
  output: {
    comments: true,
    beautify: true,
    indent_start: 2,
  },
};

// Disable all minification plugins
config.transformer.minifierConfig.compress = false;
config.transformer.minifierConfig.mangle = false;

// Use the regular transformer, not Hermes
config.transformer.hermesParser = false;

// Force development mode
config.transformer.dev = true;

module.exports = config;
