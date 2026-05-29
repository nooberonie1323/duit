module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [
      // Windows hermesc (bundled with RN 0.81.5) doesn't support private class fields.
      // Transform them away before hermesc sees them so `eas update` works locally.
      ['@babel/plugin-transform-class-properties', { loose: true }],
      ['@babel/plugin-transform-private-methods', { loose: true }],
    ],
  };
};
