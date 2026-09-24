const path = require('path');
const BuildInfo = require('../src/generatedBuildAndProductInfo');

const ICON_PATH = path.join(__dirname, '..', 'assets', 'icons', 'app');
const ICON_PATH_MAC = `${ICON_PATH}.icns`;
const ICON_PATH_WIN = `${ICON_PATH}.ico`;
const ICON_PATH_LINUX = `${ICON_PATH}.png`;

const appId = `de.bifrost.forge.world.${BuildInfo.packageName}`;

/**
 * @type {import('electron-builder').Configuration}
 */
const buildConfiguration = {
  nativeModules: {
    rebuildMode: 'parallel',
  },
  productName: BuildInfo.productNameWithReleaseChannel,
  appId: appId,
  asar: {
    smartUnpack: false,
  },
  directories: {
    output: 'dist/electron',
  },
  // NOTE: electron-builder adds `package.json` and `node_modules` (among others)
  files: ['out/**/*', 'vendor/**/*', 'electron-renderer.html', 'migration.html'],
  extraResources: [
    {
      from: 'assets/',
      to: 'assets/',
      filter: ['**/*'],
    },
  ],
  extraMetadata: {
    desktopName: appId,
  },
  nsis: {
    perMachine: false,
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    runAfterFinish: true,
  },
  win: {
    sign: {
      publisherName: 'ElRaptorus',
      type: 'signtool',
    },
    icon: ICON_PATH_WIN,
    target: 'nsis',
    fileAssociations: [
      {
        ext: ['bpmn'],
        name: 'BPMN',
        description: 'BPMN diagram extension',
      },
      {
        ext: ['dmn'],
        name: 'DMN',
        description: 'DMN diagram extension',
      },
    ],
    artifactName: 'bfw-studio-${version}.${ext}',
  },
  mac: {
    icon: ICON_PATH_MAC,
    target: [
      {
        target: 'dmg',
        arch: ['x64', 'arm64'],
      },
      {
        target: 'zip',
        arch: ['x64', 'arm64'],
      },
    ],
    fileAssociations: [
      {
        ext: ['bpmn'],
        name: 'BPMN',
      },
      {
        ext: ['dmn'],
        name: 'DMN',
        description: 'DMN diagram extension',
      },
    ],
    artifactName: 'bfw-studio-${version}-${arch}.${ext}',
  },
  linux: {
    icon: path.resolve(ICON_PATH_LINUX),
    category: 'Development',
    executableName: `bfw-studio-${BuildInfo.version}`,
    fileAssociations: [
      {
        ext: 'bpmn',
        name: 'BPMN',
        description: 'BPMN diagram extension',
      },
      {
        ext: 'dmn',
        name: 'DMN',
        description: 'DMN diagram extension',
      },
    ],
    target: ['AppImage'],
    vendor: 'ElRaptorus',
  },
  appImage: {
    artifactName: 'bfw-studio-${version}.${ext}',
    description: 'BPMN & DMN Editor for the Bifrost Forge World Workflow Engine.',
    synopsis: 'Fully integrated editor for developing BPMNs and DMNs.',
  },
  publish: {
    provider: 'generic',
    url: 'https://this-is-a-dummy.com',
  },
};

exports.default = buildConfiguration;
