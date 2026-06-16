import type { BifrostOperatingSystem } from '../contracts/BifrostTypes';

export function getOperatingSystem(): BifrostOperatingSystem {
  const platformString = navigator.appVersion;

  if (platformString.indexOf('Win') !== -1) {
    return 'windows';
  }
  if (platformString.indexOf('Mac') !== -1) {
    return 'macos';
  }
  if (platformString.indexOf('X11') !== -1 || platformString.indexOf('Linux') !== -1) {
    return 'linux';
  }

  return 'unknown';
}
