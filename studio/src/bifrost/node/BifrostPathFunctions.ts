import os from 'os';
import { join, resolve } from 'path';

import * as BuildInfo from '../../generatedBuildAndProductInfo';
import { ReleaseChannelName } from '../common/Environment';

const HOME_DIRNAME = '.evil';

export const BIFROST_APP_STORAGE_FILENAME = 'app.json';

/**
 * Returns the local "working" directory for Bifrost.
 */
export function getBifrostHomeDir(): string {
  const defaultWorkDir = join(os.homedir(), HOME_DIRNAME, getStudioSubdirname());

  return defaultWorkDir;
}

/**
 * Returns the local filename used by `BifrostAppStorage`.
 */
export function getBifrostAppStorageFilename(): string {
  return join(getBifrostHomeDir(), BIFROST_APP_STORAGE_FILENAME);
}

/**
 * Returns the directory where plugins are stored.
 * If `BFR_PLUGINS_DIR` is set, that value takes precedence (no
 * channel-awareness needed because the user is explicitly overriding).
 * Otherwise falls back to `<bifrostHomeDir>/plugins`, which is
 * release-channel aware via {@link getBifrostHomeDir}.
 */
export function getPluginsDir(): string {
  if (process.env.BFR_PLUGINS_DIR) {
    return resolve(process.env.BFR_PLUGINS_DIR);
  }
  return join(getBifrostHomeDir(), 'plugins');
}

function getStudioSubdirname(): string {
  if (process.env.APP_TEST == 'true') {
    return 'studio-tests';
  }

  switch (BuildInfo.releaseChannelName) {
    case ReleaseChannelName.Stable:
      return 'studio';
    case ReleaseChannelName.bloodforge:
      return 'studio-bloodforge';
    default:
      return 'studio-dev';
  }
}
