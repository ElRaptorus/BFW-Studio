const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const RELEASE_CHANNEL_NAME_bloodforge = 'bloodforge';
const RELEASE_CHANNEL_NAME_STABLE = 'stable';
const RELEASE_CHANNEL_NAME_UNKNOWN = 'unknown';

function readInstalledPackageVersion(packageName) {
  try {
    const manifestPath = path.join(__dirname, '..', '..', 'node_modules', packageName, 'package.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (typeof manifest.version !== 'string' || manifest.version.trim() === '') {
      return 'NA';
    }
    return manifest.version;
  } catch {
    return 'NA';
  }
}

function getReleaseChannelName(version, isProductionBuild) {
  if (!isProductionBuild) {
    return RELEASE_CHANNEL_NAME_UNKNOWN;
  }

  const isSemVer = version.match(/^\d+\.\d+\.\d+/) != null;
  if (!isSemVer) {
    return RELEASE_CHANNEL_NAME_UNKNOWN;
  }

  const isPreVersion = version.includes('-');
  if (!isPreVersion) {
    return RELEASE_CHANNEL_NAME_STABLE;
  }

  const parts = version.split('-');
  const releaseChannelString = parts[1];
  const isNumberedReleaseChannel = releaseChannelString.includes('.');
  if (!isNumberedReleaseChannel) {
    return RELEASE_CHANNEL_NAME_UNKNOWN;
  }

  const releaseChannelName = releaseChannelString.split('.')[0];

  switch (releaseChannelName) {
    case RELEASE_CHANNEL_NAME_bloodforge:
      return RELEASE_CHANNEL_NAME_bloodforge;
    default:
      return RELEASE_CHANNEL_NAME_UNKNOWN;
  }
}

function getProductNameWithReleaseChannel(releaseChannelName) {
  switch (releaseChannelName) {
    case RELEASE_CHANNEL_NAME_STABLE:
      return 'Bifrost Forge World';
    case RELEASE_CHANNEL_NAME_bloodforge:
      return 'Bifrost Forge World (bloodforge)';
  }

  return 'Bifrost Forge World (Development)';
}

function getPackageName(version) {
  let packageName = 'bifrost-forge-world-dev';

  if (version.match(/-bloodforge\./)) {
    packageName = 'bifrost-forge-world-bloodforge';
  }

  if (version.match(/-/) == null) {
    packageName = 'bifrost-forge-world';
  }

  return packageName;
}

module.exports = function generateBuildInfo(isProductionBuild) {
  const version = process.env.npm_package_version !== undefined ? process.env.npm_package_version : 'NA';
  const commit = execSync('git describe --always', { encoding: 'utf-8' }).trim() || 'NA';
  const date = new Date().toISOString();

  const releaseChannelName = getReleaseChannelName(version, isProductionBuild);
  const productName = 'Bifrost Forge World';
  const productNameWithReleaseChannel = getProductNameWithReleaseChannel(releaseChannelName);
  const packageName = getPackageName(version);

  const buildAndProductInfo = {
    version,
    commit,
    date,
    releaseChannelName,
    productName,
    productNameWithReleaseChannel,
    packageName,
    bpmnJsVersion: readInstalledPackageVersion('bpmn-js'),
    dmnJsVersion: readInstalledPackageVersion('dmn-js'),
  };

  const lines = [
    '// This file is generated during the build process',
    '/* eslint-disable */',
    `module.exports = ${JSON.stringify(buildAndProductInfo, null, 2)}`,
  ];

  fs.writeFileSync('./src/generatedBuildAndProductInfo.js', lines.join('\n'));
};
