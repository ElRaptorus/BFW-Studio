import type { Bifrost } from '#bifrost/Bifrost';

const SEMVER_REGEX = /^(v?)(\d+)\.(\d+)\.(\d+)(.*)$/;
const PREFIXED_INTEGER_REGEX = /^(v?)(\d+)$/;
const TRAILING_NUMBER_REGEX = /^(.*-)(\d+)$/;

export const BPMN_COMMANDS = {
  suggestNextVersion: 'bpmn.suggestNextVersion',
} as const;

/**
 * Suggests the next version string based on the current version.
 *
 * - SemVer:           "1.0.0" → "1.0.1", "v2.1.3" → "v2.1.4"
 * - Simple integer:   "3" → "4", "v3" → "v4"
 * - Trailing number:  "alpha-2" → "alpha-3"
 * - Non-deterministic: "alpha" → "alpha-1"
 */
function suggestNextVersion(currentVersion: string): string {
  const semverMatch = currentVersion.match(SEMVER_REGEX);
  if (semverMatch) {
    const [, prefix, major, minor, patch, rest] = semverMatch;
    return `${prefix}${major}.${minor}.${parseInt(patch, 10) + 1}${rest}`;
  }

  const integerMatch = currentVersion.match(PREFIXED_INTEGER_REGEX);
  if (integerMatch) {
    const [, prefix, numberText] = integerMatch;
    return `${prefix}${parseInt(numberText, 10) + 1}`;
  }

  const trailingMatch = currentVersion.match(TRAILING_NUMBER_REGEX);
  if (trailingMatch) {
    const [, base, numberText] = trailingMatch;
    return `${base}${parseInt(numberText, 10) + 1}`;
  }

  return `${currentVersion}-1`;
}

export default function registerVersionCommands(bifrost: Bifrost): void {
  bifrost.commands.register(BPMN_COMMANDS.suggestNextVersion, (currentVersion: string) =>
    suggestNextVersion(currentVersion),
  );
}
