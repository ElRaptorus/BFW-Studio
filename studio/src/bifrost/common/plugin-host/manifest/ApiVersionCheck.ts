export interface ApiVersionCheckResult {
  compatible: boolean;
  studioVersion: string;
  requiredVersion: string;
  reason?: string;
}

/**
 * Checks whether a plugin's required API version is compatible with
 * the Studio's current API version.
 *
 * Compatibility rules (semver):
 * - Same major version required
 * - Plugin's minor version must be ≤ Studio's minor version
 *   (the plugin can't require features the Studio doesn't have)
 * - Patch version is ignored for compatibility
 */
export function checkApiVersionCompatibility(requiredVersion: string, studioVersion: string): ApiVersionCheckResult {
  const required = parseSemver(requiredVersion);
  const studio = parseSemver(studioVersion);

  if (required == null) {
    return {
      compatible: false,
      studioVersion,
      requiredVersion,
      reason: `Invalid version format: "${requiredVersion}". Expected semver (e.g. "1.0.0").`,
    };
  }

  if (studio == null) {
    return {
      compatible: false,
      studioVersion,
      requiredVersion,
      reason: `Invalid Studio version format: "${studioVersion}".`,
    };
  }

  if (required.major !== studio.major) {
    return {
      compatible: false,
      studioVersion,
      requiredVersion,
      reason: `Major version mismatch: plugin requires ${required.major}.x, Studio provides ${studio.major}.x.`,
    };
  }

  if (required.minor > studio.minor) {
    return {
      compatible: false,
      studioVersion,
      requiredVersion,
      reason: `Plugin requires API ${requiredVersion} but Studio only provides ${studioVersion}. Update the Studio to use this plugin.`,
    };
  }

  return {
    compatible: true,
    studioVersion,
    requiredVersion,
  };
}

interface SemverParts {
  major: number;
  minor: number;
  patch: number;
}

function parseSemver(version: string): SemverParts | null {
  const match = version.trim().match(/^(\d+)\.(\d+)(?:\.(\d+))?$/);
  if (match == null) {
    return null;
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3] ?? '0', 10),
  };
}
