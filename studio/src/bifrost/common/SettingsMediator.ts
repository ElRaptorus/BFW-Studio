import type { SettingDescriptor, SettingsValidationResult } from '@evil/bifrost_fw_sdk';
import { AbstractEmitter } from '@evil/bifrost_fw_sdk';

import {
  EVENT_SETTINGS_CHANGED,
  EVENT_SETTINGS_MERGED,
  EVENT_SETTINGS_SCHEMA_REGISTERED,
} from '../../../../studio-sdk/src/contracts/internal/SettingsEvents';
import type { LocalStorageItem } from './LocalStorageItem';
import { SettingsManager } from './SettingsManager';

/**
 * Settings are key/value pairs of information which determine Bifrost's behaviour in a customizable way.
 *
 * Settings are app-specific, not instance-specific. In practical terms, this means that settings are propagated
 * across windows in the Electron app.
 *
 * Every setting must be registered with a `SettingDescriptor` before it can be used.
 * The descriptor defines the setting's type, default value, label, description, and validation rules.
 */
export class SettingsMediator extends AbstractEmitter {
  private settingsManager: SettingsManager;
  private settingsStorage: LocalStorageItem;

  constructor(localStorage: LocalStorageItem) {
    super();

    this.settingsManager = new SettingsManager({});
    this.settingsStorage = localStorage;

    this.settingsManager.on(EVENT_SETTINGS_CHANGED, (name: string, currentValue: any, addedValue?: any) => {
      const settingsData = this.settingsManager.serialize();
      this.settingsStorage.save(settingsData);

      this.emit(EVENT_SETTINGS_CHANGED, [name, currentValue, addedValue]);
    });

    this.settingsManager.on(EVENT_SETTINGS_MERGED, (_name: string, _currentValue: any, _addedValue?: any) => {
      this.emit(EVENT_SETTINGS_MERGED);
    });

    this.settingsManager.on(EVENT_SETTINGS_SCHEMA_REGISTERED, () => {
      this.emit(EVENT_SETTINGS_SCHEMA_REGISTERED);
    });

    const settingsData = this.settingsStorage.load();
    this.settingsManager.deserialize(settingsData);
  }

  /**
   * Registers settings with their descriptors (type, default, label, description, validation).
   *
   * Each key in the `descriptors` object is a setting key, and the value is a `SettingDescriptor`
   * that defines the setting's type, default value, and metadata for the Settings GUI.
   *
   * Example:
   *
   * ```ts
   * studio.settings.register({
   *   'myPlugin.feature.enabled': {
   *     type: 'boolean',
   *     label: 'Enable Feature',
   *     description: 'Controls whether the feature is active.',
   *     default: true,
   *   },
   * });
   * ```
   */
  register(descriptors: Record<string, SettingDescriptor>): void {
    this.settingsManager.register(descriptors);
  }

  /**
   * Removes setting schemas for the given keys. The stored values are preserved
   * (the user's customization remains inert) — only the schema is removed so the
   * settings no longer appear in the Settings editor.
   */
  unregisterSettings(keys: string[]): void {
    this.settingsManager.unregisterSettings(keys);
  }

  /**
   * Returns the schema descriptor for the given setting key, or `undefined` if not registered.
   */
  getSchema(key: string): SettingDescriptor | undefined {
    return this.settingsManager.getSchema(key);
  }

  /**
   * Returns a copy of all registered setting descriptors.
   */
  getSchemas(): Map<string, SettingDescriptor> {
    return this.settingsManager.getSchemas();
  }

  /**
   * Checks if a setting with the given key exists.
   *
   * @param key The key to lookup.
   * @returns True, if the setting exists. False, if it does not.
   */
  has(key: string): boolean {
    return this.settingsManager.has(key);
  }

  /**
   * Sets the setting for the given `key` to the given `value`.
   *
   * The value is validated against the registered descriptor for this key.
   * If validation fails, the value is rejected and a warning is logged.
   */
  set(key: string, config: any): void {
    this.settingsManager.set(key, config);
  }

  /**
   * Adds the given `value` to the given `key`.
   *
   * For array settings, the value is pushed onto the array.
   * For object settings, the value is shallow-merged into the existing object.
   */
  add(key: string, config: any): void {
    this.settingsManager.add(key, config);
  }

  /**
   * Removes the given value from the given key.
   *
   * For array settings, removes the first matching element.
   * For object settings, deletes the property with that key.
   */
  removeValue(key: string, value: string): void {
    this.settingsManager.removeValue(key, value);
  }

  /**
   * Returns the current value for the given `key`.
   *
   * Falls back to the registered default if no user override exists.
   * Throws if the key is not registered.
   */
  get(key: string): any {
    return this.settingsManager.get(key);
  }

  /**
   * Returns the registered default value for the given `key`.
   * Throws if the key is not registered.
   */
  getDefault(key: string): any {
    return this.settingsManager.getDefault(key);
  }

  /**
   * Gets all registered default values as a flat key-value object.
   */
  getDefaults(): any {
    return this.settingsManager.getDefaults();
  }

  /**
   * Merges the given config object as the full set of user overrides.
   *
   * All entries are validated against their registered descriptors.
   * If validation fails, the merge is rejected and the result contains the errors.
   *
   * @param settingsAsObject The full config as object.
   * @returns The validation result. If `valid` is false, `errors` contains the details.
   */
  merge(settingsAsObject: object): SettingsValidationResult {
    return this.settingsManager.deserialize(settingsAsObject);
  }

  /**
   * Internal: Used by settings propagation across windows.
   */
  onSettingsChangedInOtherInstance(_name: string, _value: any): void {
    const settingsData = this.settingsStorage.load();
    this.settingsManager.deserialize(settingsData);
  }

  resetToDefault(): void {
    this.settingsManager.resetToDefault();
  }

  /**
   * Internal: Methods using the `UNSAFE_` prefix are, well, unsafe to use. Most of the time, they are exposing
   * the internal state of objects for inspection purposes.
   *
   * IMPORTANT: You must not build ANY logic upon this data!
   */
  UNSAFE_getSerializedData(): any {
    return this.settingsManager.serialize();
  }

  /**
   * Removes the setting with the given key.
   *
   * WARNING: Should only be used for migrating old settings.
   *
   * @param key The setting to remove.
   */
  UNSAFE_delete(key: string): void {
    return this.settingsManager.delete(key);
  }
}
