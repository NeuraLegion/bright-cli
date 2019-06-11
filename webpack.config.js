const { join } = require('path');
const { BannerPlugin } = require('webpack');
const nodeExternals = require('webpack-node-externals');
const TsConfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

const config = {
  entry: './src/index.ts',
  context: process.cwd(),
  optimization: {
    minimize: false,
    mergeDuplicateChunks: true,
    removeAvailableModules: true,
    removeEmptyChunks: true,
    splitChunks: false
  },
  plugins: [
    new BannerPlugin({ banner: '#!/usr/bin/env node', raw: true })
  ],
  resolve: {
    plugins: [
      new TsConfigPathsPlugin()
    ],
    extensions: ['.ts', '.js', '.json']
  },
  module: {
    rules: [
      {
        test: /\.ts?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  output: {
    libraryTarget: 'commonjs',
    path: join(process.cwd(), 'dist'),
    filename: 'index.js'
  },
  externals: [nodeExternals()],
  target: 'node'
};

module.exports = (env, argv) => {
  if (argv.mode === 'development') {
    config.devtool = 'cheap-module-eval-source-map';
  } else {
    config.devtool = 'source-map';
  }

  return config;
};
