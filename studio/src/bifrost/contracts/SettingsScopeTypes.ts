/**
 * Where a scoped settings read or write is aimed.
 * Solution exists only when the open solution has a `.bfwsln` file.
 */
export type SettingsScopeTarget =
  { scope: 'user' } | { scope: 'solution' } | { scope: 'project'; projectBaseUri: string };

/** Effective value of one setting and the layer that supplied it. */
export type SettingInspection = {
  value: unknown;
  definedIn: 'default' | 'user' | 'solution' | 'project';
};
