export type SettingType = 'boolean' | 'string' | 'number' | 'integer' | 'array' | 'object' | 'color' | 'date';

/**
 * Which settings layers may store this descriptor.
 *
 * The scopes are hierarchical:
 * - `'application'` (the default) — User only.
 * - `'solution'` — User and Solution.
 * - `'project'` — User, Solution and Project.
 *
 * Plugin descriptors are application-only in v1: plugin setting reads are not scope-aware,
 * and a plugin-supplied `scope` is ignored.
 */
export type SettingScope = 'application' | 'solution' | 'project';

/** CSS hex color (`#RGB`, `#RRGGBB`, or `#RRGGBBAA`). Used for `type: 'color'` validation and JSON Schema. */
export const SETTING_COLOR_VALUE_PATTERN = '^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$';

/** ISO 8601 calendar date (`YYYY-MM-DD`). Used for `type: 'date'` validation and JSON Schema. */
export const SETTING_DATE_VALUE_PATTERN = '^\\d{4}-\\d{2}-\\d{2}$';

interface SettingDescriptorBase {
  label: string;
  description: string;
  hidden?: boolean;
  /**
   * Human-readable category name used to group settings in the Settings GUI.
   * If omitted, the category is inferred from the first segment of the setting key.
   */
  category?: string;
  /**
   * If set, the setting is marked as deprecated. The value is the deprecation message
   * shown on hover in the JSON editor (strikethrough) and as a warning in the GUI.
   */
  deprecated?: string;
  /**
   * Optional markdown-formatted description for richer hover tooltips in the JSON editor.
   * Falls back to `description` when not set.
   */
  markdownDescription?: string;
  /**
   * Which layers may store this setting. Hierarchical: `'solution'` includes User,
   * `'project'` includes User and Solution. Defaults to `'application'` (User only).
   * Plugin descriptors are treated as `'application'` in v1.
   */
  scope?: SettingScope;
}

export type SettingDescriptorBoolean = SettingDescriptorBase & {
  type: 'boolean';
  default: boolean;
};

export type SettingDescriptorString = SettingDescriptorBase & {
  type: 'string';
  default: string | null;
  enum?: string[] | (() => string[]);
  enumLabels?: Record<string, string> | (() => Record<string, string>);
  /** One description per enum value, in the same order as `enum`. Shown in JSON editor autocomplete. */
  enumDescriptions?: string[];
  /** Regex pattern the value must match. Validated at runtime and in the JSON editor. */
  pattern?: string;
  /** Custom error message shown when `pattern` validation fails. */
  patternErrorMessage?: string;
};

/**
 * When `enum` is provided, `minimum` and `maximum` are ignored.
 * The two constraint styles are mutually exclusive: use either `enum` or `minimum`/`maximum`, not both.
 */
export type SettingDescriptorNumber = SettingDescriptorBase & {
  type: 'number' | 'integer';
  default: number;
  /** Allowed values, rendered as a dropdown in the Settings GUI and validated at runtime. Mutually exclusive with `minimum`/`maximum`. */
  enum?: number[] | (() => number[]);
  /** Human-readable labels for enum values, keyed by stringified number. Only used when `enum` is set. */
  enumLabels?: Record<string, string> | (() => Record<string, string>);
  /** Inclusive lower bound. Validated at runtime and in the JSON editor. Ignored when `enum` is set. */
  minimum?: number;
  /** Inclusive upper bound. Validated at runtime and in the JSON editor. Ignored when `enum` is set. */
  maximum?: number;
};

export type SettingDescriptorColor = SettingDescriptorBase & {
  type: 'color';
  /** Hex color string, e.g. `#RRGGBB` (same value space as `input type="color"`). */
  default: string;
};

export type SettingDescriptorDate = SettingDescriptorBase & {
  type: 'date';
  /** ISO 8601 calendar date (`YYYY-MM-DD`). */
  default: string;
};

/**
 * Describes the element type of an `array` setting for validation, JSON Schema, and (when possible) the Settings GUI.
 *
 * - **Primitive** — each element is a boolean, string, number, color, date, etc. (not `object` / `array`).
 * - **Object** — each element is an object; `properties` defines per-field descriptors (same shape as top-level object settings).
 */
export type SettingArrayItemsDescriptor =
  | { type: Exclude<SettingType, 'object' | 'array'> }
  | {
      type: 'object';
      properties: Record<string, SettingDescriptor>;
    };

export type SettingDescriptorArray = SettingDescriptorBase & {
  type: 'array';
  default: unknown[];
  items?: SettingArrayItemsDescriptor;
  /** Minimum number of items. */
  minItems?: number;
  /** Maximum number of items. */
  maxItems?: number;
  /** If true, all items must be unique. */
  uniqueItems?: boolean;
};

export type SettingDescriptorObject = SettingDescriptorBase & {
  type: 'object';
  default: Record<string, unknown>;
  properties?: Record<string, SettingDescriptor>;
};

export type SettingDescriptor =
  | SettingDescriptorBoolean
  | SettingDescriptorString
  | SettingDescriptorNumber
  | SettingDescriptorColor
  | SettingDescriptorDate
  | SettingDescriptorArray
  | SettingDescriptorObject;

export interface SettingValidationError {
  key: string;
  message: string;
  expected: string;
  actual: string;
}

export interface SettingsValidationResult {
  valid: boolean;
  errors: SettingValidationError[];
}

/**
 * Resolves a setting enum field that may be either a static value or a factory function.
 * Factory functions are evaluated lazily each time this is called.
 */
export function resolveSettingEnum<T>(value: T | (() => T) | undefined): T | undefined {
  return typeof value === 'function' ? (value as () => T)() : value;
}
