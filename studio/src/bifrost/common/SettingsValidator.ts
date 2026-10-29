import type {
  SettingArrayItemsDescriptor,
  SettingDescriptor,
  SettingDescriptorObject,
  SettingValidationError,
} from '@elraptorus/bfw_studio_sdk';
import {
  SETTING_COLOR_VALUE_PATTERN,
  SETTING_DATE_VALUE_PATTERN,
  resolveSettingEnum,
} from '@elraptorus/bfw_studio_sdk';

const colorValueRegex = new RegExp(SETTING_COLOR_VALUE_PATTERN);
const dateValueRegex = new RegExp(SETTING_DATE_VALUE_PATTERN);

/** A validation error with the location of the wrong value: the setting key, then property names and item indices. */
export type LocatedSettingValidationError = SettingValidationError & { path: (string | number)[] };

export function validateSetting(
  key: string,
  value: unknown,
  descriptor: SettingDescriptor,
): LocatedSettingValidationError[] {
  return validateValueAt(key, [key], value, descriptor);
}

function validateValueAt(
  key: string,
  path: (string | number)[],
  value: unknown,
  descriptor: SettingDescriptor,
): LocatedSettingValidationError[] {
  const errors: LocatedSettingValidationError[] = [];
  const add = (message: string, expected: string, actual: string, at: (string | number)[] = path): void => {
    errors.push({ key, message, expected, actual, path: at });
  };

  if (value === undefined) {
    return errors;
  }

  switch (descriptor.type) {
    case 'boolean':
      if (typeof value !== 'boolean') {
        add(`Expected boolean, got ${typeof value}`, 'boolean', typeof value);
      }
      break;

    case 'string':
      if (value !== null && typeof value !== 'string') {
        add(`Expected string or null, got ${typeof value}`, 'string | null', typeof value);
      }
      {
        const enumValues = resolveSettingEnum(descriptor.enum);
        if (enumValues != null && value != null && !enumValues.includes(value as string)) {
          add(
            `Value "${value}" is not one of the allowed values: ${enumValues.join(', ')}`,
            enumValues.join(' | '),
            String(value),
          );
        }
      }
      if (descriptor.pattern != null && typeof value === 'string') {
        try {
          const regex = new RegExp(descriptor.pattern);
          if (!regex.test(value)) {
            add(
              descriptor.patternErrorMessage ?? `Value does not match pattern: ${descriptor.pattern}`,
              `match(${descriptor.pattern})`,
              String(value),
            );
          }
        } catch {
          add(`Invalid pattern "${descriptor.pattern}" in descriptor`, 'valid regex', descriptor.pattern);
        }
      }
      break;

    case 'color':
      if (typeof value !== 'string') {
        add(`Expected string (CSS hex color), got ${typeof value}`, 'color (hex string)', typeof value);
      } else if (!colorValueRegex.test(value)) {
        add(
          `Value is not a valid CSS hex color (expected #RGB, #RRGGBB, or #RRGGBBAA)`,
          SETTING_COLOR_VALUE_PATTERN,
          value,
        );
      }
      break;

    case 'date':
      if (typeof value !== 'string') {
        add(`Expected string (YYYY-MM-DD), got ${typeof value}`, 'date (YYYY-MM-DD)', typeof value);
      } else if (!dateValueRegex.test(value)) {
        add(`Value is not a valid ISO date (expected YYYY-MM-DD)`, SETTING_DATE_VALUE_PATTERN, value);
      }
      break;

    case 'number':
    case 'integer':
      if (typeof value !== 'number') {
        add(`Expected number, got ${typeof value}`, 'number', typeof value);
      } else {
        if (descriptor.type === 'integer' && !Number.isInteger(value)) {
          add(`Expected integer, got float (${value})`, 'integer', 'float');
        }
        const enumValues = resolveSettingEnum(descriptor.enum);
        if (enumValues != null) {
          if (!enumValues.includes(value)) {
            add(
              `Value ${value} is not one of the allowed values: ${enumValues.join(', ')}`,
              enumValues.join(' | '),
              String(value),
            );
          }
        } else {
          if (descriptor.minimum != null && value < descriptor.minimum) {
            add(`Value ${value} is below minimum ${descriptor.minimum}`, `>= ${descriptor.minimum}`, String(value));
          }
          if (descriptor.maximum != null && value > descriptor.maximum) {
            add(`Value ${value} exceeds maximum ${descriptor.maximum}`, `<= ${descriptor.maximum}`, String(value));
          }
        }
      }
      break;

    case 'array':
      if (!Array.isArray(value)) {
        add(`Expected array, got ${typeof value}`, 'array', typeof value);
      } else {
        if (descriptor.items != null) {
          if (isObjectArrayItems(descriptor.items)) {
            const objectItemDescriptor: SettingDescriptorObject = {
              type: 'object',
              label: '',
              description: '',
              default: {},
              properties: descriptor.items.properties,
            };
            for (let i = 0; i < value.length; i++) {
              const el = value[i];
              if (el === null || typeof el !== 'object' || Array.isArray(el)) {
                const actualKind = describeNonPlainObjectElement(el);
                add(`Item at index ${i}: expected object, got ${actualKind}`, 'object', actualKind, [...path, i]);
              } else {
                errors.push(
                  ...validateObjectProperties(
                    `${key}[${i}]`,
                    [...path, i],
                    el as Record<string, unknown>,
                    objectItemDescriptor,
                  ),
                );
              }
            }
          } else {
            for (let i = 0; i < value.length; i++) {
              if (!matchesPrimitiveType(value[i], descriptor.items.type)) {
                add(
                  `Item at index ${i}: expected ${descriptor.items.type}, got ${typeof value[i]}`,
                  descriptor.items.type,
                  typeof value[i],
                  [...path, i],
                );
              }
            }
          }
        }
        if (descriptor.minItems != null && value.length < descriptor.minItems) {
          add(
            `Array has ${value.length} items, minimum is ${descriptor.minItems}`,
            `>= ${descriptor.minItems} items`,
            `${value.length} items`,
          );
        }
        if (descriptor.maxItems != null && value.length > descriptor.maxItems) {
          add(
            `Array has ${value.length} items, maximum is ${descriptor.maxItems}`,
            `<= ${descriptor.maxItems} items`,
            `${value.length} items`,
          );
        }
        if (descriptor.uniqueItems === true) {
          const serialized = value.map((item) => JSON.stringify(item));
          if (new Set(serialized).size !== serialized.length) {
            add('Array contains duplicate items', 'unique items', 'duplicates found');
          }
        }
      }
      break;

    case 'object':
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        const actual = Array.isArray(value) ? 'array' : typeof value;
        add(`Expected object, got ${actual}`, 'object', actual);
      } else if (descriptor.properties != null) {
        errors.push(...validateObjectProperties(key, path, value as Record<string, unknown>, descriptor));
      }
      break;
  }

  return errors;
}

function isObjectArrayItems(
  items: SettingArrayItemsDescriptor,
): items is { type: 'object'; properties: Record<string, SettingDescriptor> } {
  return items.type === 'object';
}

function describeNonPlainObjectElement(el: unknown): string {
  if (el === null) {
    return 'null';
  }
  if (Array.isArray(el)) {
    return 'array';
  }
  return typeof el;
}

function validateObjectProperties(
  parentKey: string,
  parentPath: (string | number)[],
  value: Record<string, unknown>,
  descriptor: SettingDescriptorObject,
): LocatedSettingValidationError[] {
  if (descriptor.properties == null) {
    return [];
  }

  const errors: LocatedSettingValidationError[] = [];

  for (const [propKey, propDescriptor] of Object.entries(descriptor.properties)) {
    const propValue = value[propKey];
    if (propValue !== undefined) {
      errors.push(...validateValueAt(`${parentKey}.${propKey}`, [...parentPath, propKey], propValue, propDescriptor));
    }
  }

  return errors;
}

function matchesPrimitiveType(value: unknown, expectedType: string): boolean {
  switch (expectedType) {
    case 'boolean':
      return typeof value === 'boolean';
    case 'string':
      return typeof value === 'string' || value === null;
    case 'number':
    case 'integer':
      return typeof value === 'number';
    case 'array':
      return Array.isArray(value);
    case 'object':
      return value !== null && typeof value === 'object' && !Array.isArray(value);
    case 'color':
      return typeof value === 'string' && colorValueRegex.test(value);
    case 'date':
      return typeof value === 'string' && dateValueRegex.test(value);
    default:
      return true;
  }
}

/**
 * Validates a settings dump against the schema registry.
 *
 * Unknown keys (not in the registry) are ignored and do NOT cause validation failure.
 * Leftover plugin settings stay in the dump. Only type/enum/constraint
 * violations on registered keys cause failure. The Settings JSON editor
 * surfaces unknown keys as warnings ("Unknown setting."), not save blockers.
 */
export function validateSettings(
  dump: Record<string, unknown>,
  schemaRegistry: Map<string, SettingDescriptor>,
): { valid: boolean; errors: LocatedSettingValidationError[] } {
  const errors: LocatedSettingValidationError[] = [];

  for (const [key, value] of Object.entries(dump)) {
    const descriptor = schemaRegistry.get(key);

    if (descriptor == null) {
      continue;
    }

    errors.push(...validateSetting(key, value, descriptor));
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
