const { join } = require('path');
const { BannerPlugin } = require('webpack');
const nodeExternals = require('webpack-node-externals');
const TsConfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = (env, argv) => ({
  entry: './src/index.ts',
  devtool: argv.mode === 'development' ? 'eval-cheap-source-map' : 'source-map',
  context: process.cwd(),
  optimization: {
    noEmitOnErrors: true,
    usedExports: true,
    splitChunks: false,
    minimizer: [
      new TerserPlugin({
        sourceMap: true,
        parallel: true,
        terserOptions: {
          keep_classnames: true,
          keep_fnames: true
        }
      })
    ]
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
  stats: {
    // Ignore warnings due to yarg's dynamic module loading
    warningsFilter: [/node_modules\/yargs/]
  },
  output: {
    libraryTarget: 'commonjs',
    path: join(process.cwd(), 'dist'),
    filename: 'index.js'
  },
  node: {
    __filename: false,
    __dirname: false
  },
  externals: [nodeExternals()],
  target: 'node'
});
