/**
 * The current Studio Plugin API version.
 *
 * This is injected into every plugin as `api.env.apiVersion` and compared
 * against the `bifrostStudio.apiVersion` field in the plugin's manifest
 * during discovery. Plugins whose required version is incompatible are
 * rejected before their code is loaded.
 *
 * Follows semver: MAJOR.MINOR.PATCH
 * - MAJOR: breaking API changes (plugin must be updated)
 * - MINOR: backward-compatible additions (old plugins still work)
 * - PATCH: bug fixes (no API surface change)
 */
export const STUDIO_PLUGIN_API_VERSION = '1.0.0';
