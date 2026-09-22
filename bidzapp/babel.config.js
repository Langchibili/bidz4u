module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./src'],
          extensions: [
            '.ios.ts',
            '.android.ts',
            '.ts',
            '.ios.tsx',
            '.android.tsx',
            '.tsx',
            '.jsx',
            '.js',
            '.json',
          ],
          alias: {
            '@services': './src/services',
            '@utils': './src/utils',
            '@types': './src/types',
            '@components': './src/components',
            '@modules': './src/modules',
            '@tasks': './src/tasks',
          },
        },
      ],
    ],
  };
};