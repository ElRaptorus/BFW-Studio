const path = require('path');

const { TsCheckerRspackPlugin } = require('ts-checker-rspack-plugin');
const MODE = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = MODE === 'production';

const optimization = {};

if (IS_PRODUCTION) {
  optimization.minimize = true;
}

const warningsToIgnore = [
  {
    message: /Can\'t resolve \'osx-temperature-sensor\'/,
  },
  {
    message: /Can\'t resolve \'macos-temperature-sensor\'/,
  },
];

const configElectronMain = {
  mode: MODE,
  entry: './src/bifrost/electron-main/entrypoint-electron-main.ts',
  ignoreWarnings: warningsToIgnore,
  output: {
    filename: 'bundle-electron-main.js',
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
  target: 'electron-main',
  node: {
    __dirname: false,
  },
  optimization,
};

const configSysteminformation = {
  mode: MODE,
  entry: './src/bifrost/node/Systeminformation.ts',
  ignoreWarnings: warningsToIgnore,
  output: {
    filename: 'Systeminformation.js',
    path: path.resolve(__dirname, 'out'),
  },
  resolve: { extensions: ['.ts', '.tsx', '.js'] },
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

const configBridgeScript = {
  mode: MODE,
  entry: './src/components/webview/bridge-script.ts',
  output: {
    filename: 'studio-bridge.js',
    path: path.resolve(__dirname, 'out'),
  },
  resolve: { extensions: ['.ts', '.js'] },
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
  target: 'web',
  optimization,
};

module.exports = [configElectronMain, configSysteminformation, configBridgeScript];
