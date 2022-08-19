const { join, resolve } = require('path');
const { BannerPlugin, EnvironmentPlugin } = require('webpack');
const nodeExternals = require('webpack-node-externals');
const TsConfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const Terser = require('terser-webpack-plugin');
const configFile = resolve('./tsconfig.build.json');

module.exports = (env, argv) => ({
  entry: './src/index.ts',
  devtool:
    argv.mode === 'development' ? 'eval-cheap-module-source-map' : 'source-map',
  context: process.cwd(),
  optimization: {
    emitOnErrors: true,
    usedExports: true,
    splitChunks: false,
    nodeEnv: false,
    minimizer: [
      new Terser({
        parallel: true,
        terserOptions: {
          sourceMap: true,
          keep_classnames: true,
          keep_fnames: true
        }
      })
    ]
  },
  plugins: [
    new EnvironmentPlugin({
      VERSION: env.version
    }),
    new CleanWebpackPlugin(),
    new BannerPlugin({ banner: '#!/usr/bin/env node', raw: true })
  ],
  resolve: {
    plugins: [new TsConfigPathsPlugin({ configFile })],
    extensions: ['.ts', '.js', '.json']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              configFile
            }
          }
        ],
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
