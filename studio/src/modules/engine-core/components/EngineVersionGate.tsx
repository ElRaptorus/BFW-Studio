import React from 'react';

interface EngineVersionGateProps {
  engineVersion: string | undefined;
  minimumVersion?: string;
  children: React.ReactNode;
}

function parseSemanticVersion(version: string): [number, number, number] | null {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    return null;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function meetsMinimumVersion(current: string, minimum: string): boolean {
  const currentParts = parseSemanticVersion(current);
  const minimumParts = parseSemanticVersion(minimum);
  if (!currentParts || !minimumParts) {
    return true;
  }

  for (let index = 0; index < 3; index++) {
    if (currentParts[index] > minimumParts[index]) {
      return true;
    }
    if (currentParts[index] < minimumParts[index]) {
      return false;
    }
  }
  return true;
}

/**
 * Renders children only when the engine version meets the minimum requirement.
 * Shows a warning when the version is too old or unavailable.
 */
export const EngineVersionGate: React.FC<EngineVersionGateProps> = ({ engineVersion, minimumVersion, children }) => {
  if (!engineVersion) {
    return (
      <div className="engine-version-gate">
        <p>Engine version information is not available.</p>
      </div>
    );
  }

  if (minimumVersion && !meetsMinimumVersion(engineVersion, minimumVersion)) {
    return (
      <div className="engine-version-gate">
        <p>
          This feature requires engine version {minimumVersion} or newer. Current version: {engineVersion}.
        </p>
      </div>
    );
  }

  return <>{children}</>;
};
