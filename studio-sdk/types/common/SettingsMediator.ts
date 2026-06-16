import type { SettingDescriptor, SettingsValidationResult } from '../../src/contracts/SettingTypes';

/**
 * Settings are key/value pairs of information which determine Studio's behaviour in a customizable way.
 *
 * Settings are app-specific, not instance-specific. In practical terms, this means that settings are propagated
 * across windows in the Electron app.
 *
 * Every setting must be registered with a `SettingDescriptor` before it can be used.
 */
export declare class SettingsMediator {
  /**
   * Registers settings with their descriptors (type, default, label, description, validation).
   *
   * Example:
   *
   *    studio.settings.register({
   *      'myPlugin.feature.enabled': {
   *        type: 'boolean',
   *        label: 'Enable Feature',
   *        description: 'Controls whether the feature is active.',
   *        default: true,
   *      },
   *    });
   */
  register(descriptors: Record<string, SettingDescriptor>): void;

  /**
   * Returns the schema descriptor for the given setting key, or `undefined` if not registered.
   */
  getSchema(key: string): SettingDescriptor | undefined;

  /**
   * Returns a copy of all registered setting descriptors.
   */
  getSchemas(): Map<string, SettingDescriptor>;

  /**
   * Returns the default setting for the given `key`.
   */
  getDefault(key: string): any;

  /**
   * Gets all registered default settings.
   */
  getDefaults(): any;

  /**
   * Checks if a setting with the given key exists.
   *
   * @param key The key to lookup.
   * @returns True, if the setting exists. False, if it does not.
   */
  has(key: string): boolean;

  /**
   * Returns the setting for the given `key`.
   *
   * Example:
   *
   *    studio.settings.get('workbench.general.theme');
   */
  get(key: string): any;

  /**
   * Sets the setting for the given `key` to the given `value`.
   * The value is validated against the registered descriptor.
   *
   * Example:
   *
   *    studio.settings.set('workbench.general.theme', 'dark');
   */
  set(key: string, config: any): void;

  /**
   * Adds the given `value` to the given `key`.
   *
   * For array settings, the value is pushed onto the array.
   * For object settings, the value is shallow-merged into the existing object.
   */
  add(key: string, config: any): void;

  /**
   * Removes the given value from the given key.
   */
  removeValue(key: string, value: string): void;

  /**
   * Merges the given config object as the full set of user overrides.
   * All entries are validated against their registered descriptors.
   *
   * @returns The validation result. If `valid` is false, `errors` contains the details.
   */
  merge(settingsAsObject: object): SettingsValidationResult;

  /**
   * Resets all settings to their registered defaults.
   */
  resetToDefault(): void;
}
