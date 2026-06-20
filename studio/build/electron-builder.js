const path = require('path');
const BuildInfo = require('../src/generatedBuildAndProductInfo');

const ICON_NAME = BuildInfo.releaseChannelName === 'unknown' ? 'bloodforge' : BuildInfo.releaseChannelName;
const ICON_PATH = path.join(__dirname, '..', 'assets', 'icons', ICON_NAME);
const ICON_PATH_MAC = `${ICON_PATH}.icns`;
const ICON_PATH_WIN = `${ICON_PATH}.ico`;
const ICON_PATH_LINUX = `${ICON_PATH}.png`;

const appId = `de.bifrost.forge.world.${BuildInfo.packageName}`;

/**
 * @type {import('electron-builder').Configuration}
 */
const buildConfiguration = {
  productName: BuildInfo.productNameWithReleaseChannel,
  nativeRebuilder: 'parallel',
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
  nsis: {
    perMachine: false,
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    runAfterFinish: true,
  },
  win: {
    icon: ICON_PATH_WIN,
    target: 'nsis',
    fileAssociations: [
      {
        ext: ['bpmn'],
        name: 'BPMN',
        description: 'BPMN diagram extension',
      },
    ],
    artifactName: 'bifrost-forge-world-${version}.${ext}',
    signtoolOptions: {
      publisherName: 'ElRaptorus',
    },
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
    ],
    artifactName: 'bifrost-forge-world-${version}-${arch}.${ext}',
  },
  linux: {
    icon: path.resolve(ICON_PATH_LINUX),
    category: 'Development',
    fileAssociations: [
      {
        ext: 'bpmn',
        name: 'BPMN',
        description: 'BPMN diagram extension',
      },
    ],
    target: ['AppImage'],
    vendor: 'ElRaptorus',
  },
  appImage: {
    artifactName: 'bifrost-forge-world-${version}.${ext}',
    description: 'A fully integrated development enviroment for modeling and deploying BPMN diagrams.',
    synopsis: 'Fully integrated editor for developing BPMNs.',
  },
  publish: {
    provider: 'generic',
    url: 'https://this-is-a-dummy.com',
  },
};

exports.default = buildConfiguration;
