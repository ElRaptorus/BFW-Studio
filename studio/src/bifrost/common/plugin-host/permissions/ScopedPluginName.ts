/**
 * Flatten a scoped npm name to a hostname-safe form.
 * `@scope/name` → `scope--name`. Unscoped names pass through unchanged.
 */
export function pluginNameToHostname(name: string): string {
  if (name.startsWith('@') && name.includes('/')) {
    return name.slice(1).replace('/', '--');
  }
  return name;
}

/**
 * Reverse a hostname-flattened name back to the scoped npm form.
 * `scope--name` → `@scope/name`. Names without `--` pass through unchanged.
 */
export function hostnameToPluginName(hostname: string): string {
  if (hostname.includes('--')) {
    const idx = hostname.indexOf('--');
    return `@${hostname.slice(0, idx)}/${hostname.slice(idx + 2)}`;
  }
  return hostname;
}
