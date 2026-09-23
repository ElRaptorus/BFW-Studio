import * as path from 'path';

const UNSCOPED_PACKAGE_NAME = /^[a-z0-9][a-z0-9._-]*$/i;
const SCOPED_PACKAGE_NAME = /^@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/i;

/**
 * A plugin install name is either `name` or `@scope/name`.
 * `.`, `..`, extra slashes, and backslashes are rejected.
 */
export function isSafePluginPackageName(packageName: string): boolean {
  if (packageName.includes('\\') || packageName.includes('..')) {
    return false;
  }
  if (packageName.startsWith('@')) {
    return SCOPED_PACKAGE_NAME.test(packageName);
  }
  return UNSCOPED_PACKAGE_NAME.test(packageName);
}

/**
 * Destination folder for an install. Scoped names become `plugins/@scope/name`,
 * which is the path the webview resolver already uses.
 */
export function resolvePluginInstallDestination(pluginsDirectory: string, packageName: string): string {
  if (!isSafePluginPackageName(packageName)) {
    throw new Error(`Plugin package name '${packageName}' is not a safe install name.`);
  }
  if (packageName.startsWith('@')) {
    const slashIndex = packageName.indexOf('/');
    const scope = packageName.slice(0, slashIndex);
    const name = packageName.slice(slashIndex + 1);
    return path.join(pluginsDirectory, scope, name);
  }
  return path.join(pluginsDirectory, packageName);
}

/** True when `candidate` is strictly inside `directory` after both are resolved. */
export function isResolvedPathInsideDirectory(directory: string, candidate: string): boolean {
  const root = path.resolve(directory);
  const resolved = path.resolve(candidate);
  const relative = path.relative(root, resolved);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}
