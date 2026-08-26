import type { Disposable } from './Disposable';
import type { SettingDescriptorMap } from './types';

/**
 * Settings read/write API with change observation.
 *
 * Settings registered via {@link register} appear in the Studio's Settings editor
 * and are persisted across sessions.
 */
export interface SettingsApi {
  /**
   * Register one or more setting descriptors.
   * Each key is a dot-separated path (e.g. `"myPlugin.theme"`).
   *
   * @param descriptors - Map of setting keys to their descriptors.
   */
  register(descriptors: SettingDescriptorMap): Promise<void>;

  /** Check whether a setting with the given key exists. */
  has(key: string): Promise<boolean>;

  /** Read the current value of a setting. */
  get<T = unknown>(key: string): Promise<T>;

  /** Retrieve the JSON Schema descriptor for a single setting key, or `undefined` if not found. */
  getSchema(key: string): Promise<Record<string, unknown> | undefined>;

  /** Retrieve all registered setting schemas, keyed by setting path. */
  getSchemas(): Promise<Record<string, Record<string, unknown>>>;

  /** Read the default value of a setting. */
  getDefault<T = unknown>(key: string): Promise<T>;

  /** Retrieve all default values, keyed by setting path. */
  getDefaults(): Promise<Record<string, unknown>>;

  /** Write a new value for a setting. */
  set(key: string, value: unknown): Promise<void>;

  /**
   * Append a value to an array-type setting.
   * Throws if the setting is not an array.
   */
  add(key: string, value: unknown): Promise<void>;

  /**
   * Remove a specific value from an array-type setting.
   * Throws if the setting is not an array.
   */
  removeValue(key: string, value: string): Promise<void>;

  /**
   * Subscribe to changes of a specific setting key.
   * The callback receives the new value whenever the setting changes.
   *
   * @param key - Setting key to observe.
   * @param callback - Called with the new value on each change.
   */
  onDidChange(key: string, callback: (newValue: unknown) => void): Promise<Disposable>;
}
