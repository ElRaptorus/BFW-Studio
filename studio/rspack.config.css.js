const { globSync } = require('node:fs');
const path = require('path');

const { rspack } = require('@rspack/core');

const MODE = process.env.NODE_ENV || 'development';

const optimization = {
  minimizer: [],
};

if (MODE === 'production') {
  optimization.minimize = true;
  optimization.minimizer.push(new rspack.LightningCssMinimizerRspackPlugin());
}

module.exports = {
  mode: MODE,
  entry: [
    ...globSync('**/*.scss', { cwd: './src' }).map((f) => './src/' + f),
    ...globSync('**/components/**/*.scss', { cwd: '../studio-sdk/src' }).map((f) => '../studio-sdk/src/' + f),
  ],
  output: {
    filename: 'bundle-styles.js',
    path: path.resolve(__dirname, 'out'),
  },
  resolve: { extensions: ['.scss', '.sass', '.css'] },
  module: {
    rules: [
      {
        test: /\.s?css$/,
        use: [
          rspack.CssExtractRspackPlugin.loader,
          {
            loader: 'css-loader',
            options: { sourceMap: true },
          },
          {
            loader: 'sass-loader',
            options: {
              sourceMap: true,
              sassOptions: { charset: false },
            },
          },
        ],
        type: 'javascript/auto',
      },
    ],
  },
  devtool: 'source-map',
  plugins: [new rspack.CssExtractRspackPlugin({ filename: 'bifrost-styles.css' })],
  performance: {
    hints: false,
  },
  optimization,
  target: 'web',
};
