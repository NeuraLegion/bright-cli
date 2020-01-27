const { join } = require('path');
const { BannerPlugin } = require('webpack');
const nodeExternals = require('webpack-node-externals');
const TsConfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

module.exports = (env, argv) => ({
  entry: './src/index.ts',
  devtool:
    argv.mode === 'development' ? 'eval-cheap-source-map' : 'source-map',
  context: process.cwd(),
  optimization: {
    sideEffects: false,
    usedExports: true,
    splitChunks: false,
    noEmitOnErrors: true,
    minimize: false
  },
  plugins: [
    new CleanWebpackPlugin(),
    new BannerPlugin({ banner: '#!/usr/bin/env node', raw: true })
  ],
  resolve: {
    plugins: [new TsConfigPathsPlugin()],
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
});
