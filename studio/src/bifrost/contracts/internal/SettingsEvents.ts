/**
 * Fired as `(key, value, addedValue?, scopeTarget?)`.
 * `scopeTarget` is set only for Solution and Project layer changes. Those must not be
 * forwarded across windows: each window watches the layer files itself.
 */
export const EVENT_SETTINGS_CHANGED = 'EVENT_SETTINGS_CHANGED';
export const EVENT_SETTINGS_MERGED = 'EVENT_SETTINGS_MERGED';
export const EVENT_SETTINGS_SCHEMA_REGISTERED = 'EVENT_SETTINGS_SCHEMA_REGISTERED';
