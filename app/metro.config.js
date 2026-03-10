const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('metro-config').MetroConfig} */
module.exports = (() => {
  const config = getDefaultConfig(__dirname);
  return config;
})();

