const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Asegurar que resuelva correctamente los archivos de entrada
config.resolver.sourceExts.push('js', 'jsx', 'json', 'ts', 'tsx');
config.watchFolders = [path.resolve(__dirname)];

module.exports = config;
