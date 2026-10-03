import * as path from 'path';

export type DeployPackage = { name: string; files: string[] };

export function toFilePath(uri: string): string {
  return uri.startsWith('file://') ? uri.slice('file://'.length) : uri;
}

/** A POSIX path of the file relative to the base folder. It starts with `../` when the file lives outside the base. */
export function toRelativePackagePath(fileUri: string, baseUri: string): string {
  return path.posix.relative(toFilePath(baseUri), toFilePath(fileUri));
}

export function toPackageFileUri(relativePath: string, baseUri: string): string {
  return `file://${path.posix.resolve(toFilePath(baseUri), relativePath)}`;
}

/** Why a package name is not usable, or null. Names are compared case-insensitively and trimmed. */
export function validatePackageName(name: string): string | null {
  return name.trim() === '' ? 'Enter a name for the package.' : null;
}

export function findPackage(packages: readonly DeployPackage[], name: string): DeployPackage | undefined {
  const wanted = name.trim().toLowerCase();
  return packages.find((candidate) => candidate.name.toLowerCase() === wanted);
}

/** Saves the files under the name; a package with the same name (ignoring case) is replaced in place. */
export function upsertPackage(
  packages: readonly DeployPackage[],
  name: string,
  files: readonly string[],
): DeployPackage[] {
  const trimmedName = name.trim();
  const saved: DeployPackage = { name: trimmedName, files: [...new Set(files)] };
  const existing = findPackage(packages, trimmedName);
  return existing == null
    ? [...packages, saved]
    : packages.map((candidate) => (candidate === existing ? saved : candidate));
}

export function removePackage(packages: readonly DeployPackage[], name: string): DeployPackage[] {
  const existing = findPackage(packages, name);
  return packages.filter((candidate) => candidate !== existing);
}

/** Reads the setting value defensively: anything that is not a well-formed package is dropped. */
export function readPackages(value: unknown): DeployPackage[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry): DeployPackage[] => {
    const candidate = entry as Partial<DeployPackage> | null;
    if (
      candidate == null ||
      typeof candidate.name !== 'string' ||
      candidate.name.trim() === '' ||
      !Array.isArray(candidate.files)
    ) {
      return [];
    }
    return [{ name: candidate.name, files: candidate.files.filter((file) => typeof file === 'string') }];
  });
}
