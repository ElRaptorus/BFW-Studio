const path = require('path');

const { rspack } = require('@rspack/core');

const generateBuildInfo = require('./build/rspack/generate-build-info');

const { TsCheckerRspackPlugin } = require('ts-checker-rspack-plugin');

const MODE = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = MODE === 'production';

const optimization = {};

if (IS_PRODUCTION) {
  optimization.minimize = true;
  optimization.minimizer = [
    new rspack.SwcJsMinimizerRspackPlugin({
      extractComments: false,
      minimizerOptions: {
        format: { comments: false },
        mangle: { keep_classnames: true },
      },
    }),
  ];
}

const configPluginHost = {
  mode: MODE,
  entry: {
    'plugin-host': './src/bifrost/common/plugin-host/plugin-host-main.ts',
    'sandbox-worker': './src/bifrost/common/plugin-host/sandbox/sandbox-worker.ts',
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'out'),
  },
  resolve: { extensions: ['.ts', '.tsx', '.js'] },
  plugins: [
    new TsCheckerRspackPlugin({
      async: !IS_PRODUCTION,
      typescript: {
        configFile: './tsconfig.electron-main.json',
      },
    }),
  ],
  module: {
    rules: [
      {
        test: /\.m?js/,
        resolve: {
          fullySpecified: false,
        },
      },
      {
        test: /\.[jt]sx?$/,
        exclude: /\.(d|test)\.tsx?$/,
        loader: 'builtin:swc-loader',
        options: {
          jsc: {
            parser: {
              syntax: 'typescript',
            },
            target: 'esnext',
          },
        },
      },
    ],
  },
  devtool: IS_PRODUCTION ? 'source-map' : 'cheap-module-source-map',
  target: 'node',
  node: {
    __dirname: false,
  },
  optimization,
};

const configElectronRenderer = {
  mode: MODE,
  entry: './src/bifrost/electron-renderer/entrypoint-electron-renderer.tsx',
  output: {
    filename: 'bundle-electron-renderer.js',
    path: path.resolve(__dirname, 'out'),
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
    alias: {
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      'react-dnd': path.resolve(__dirname, 'node_modules/react-dnd'),
      'react-select': path.resolve(__dirname, 'node_modules/react-select'),
      'dnd-core': path.resolve(__dirname, 'node_modules/dnd-core'),
      '@mdxeditor/editor$': path.resolve(__dirname, 'node_modules/@mdxeditor/editor'),
    },
  },
  plugins: [
    new rspack.CopyRspackPlugin({
      patterns: [{ from: 'assets/icons', to: '.' }],
    }),
    new rspack.CssExtractRspackPlugin({ filename: 'imported-styles.css' }),
    new rspack.DefinePlugin({
      __BIFROST_CLIENT__: JSON.stringify('electron'),
    }),
    new TsCheckerRspackPlugin({
      async: !IS_PRODUCTION,
      typescript: {
        configFile: './tsconfig.electron-renderer.json',
      },
    }),
  ],
  module: {
    rules: [
      {
        test: /\.m?js/,
        resolve: {
          fullySpecified: false,
        },
      },
      {
        test: /\.(bpmn|txt)$/,
        type: 'asset/source',
      },
      {
        test: /\.css$/,
        use: [rspack.CssExtractRspackPlugin.loader, 'css-loader'],
        type: 'javascript/auto',
      },
      {
        test: /\.(svg|png|jpg|gif)$/,
        type: 'asset/resource',
      },
      {
        test: /\.(md|markdown)$/,
        use: 'markdown-image-loader',
      },
      {
        test: /.node$/,
        loader: 'node-loader',
      },
      {
        test: [/\.scss$/, /\.(d|test)\.tsx?$/],
        use: 'null-loader',
      },
      {
        test: /\.[jt]sx?$/,
        exclude: /\.(d|test)\.tsx?$/,
        loader: 'builtin:swc-loader',
        options: {
          jsc: {
            parser: {
              syntax: 'typescript',
              tsx: true,
            },
            target: 'esnext',
          },
        },
      },
    ],
  },
  devtool: IS_PRODUCTION ? 'source-map' : 'cheap-module-source-map',
  target: 'electron-renderer',
  node: {
    __dirname: false,
  },
  optimization,
  ignoreWarnings: [
    {
      message: /Can\'t resolve \'osx-temperature-sensor\'/,
    },
    {
      message: /Can\'t resolve \'macos-temperature-sensor\'/,
    },
  ],
};

generateBuildInfo(IS_PRODUCTION);

module.exports = [
  require('./rspack.config.css'),
  ...require('./rspack.config.electron-main'),
  configPluginHost,
  configElectronRenderer,
];
