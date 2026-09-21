import type {
  SettingArrayItemsDescriptor,
  SettingDescriptor,
  SettingDescriptorObject,
  SettingValidationError,
  SettingsValidationResult,
} from '@elraptorus/bfw_studio_sdk';
import {
  SETTING_COLOR_VALUE_PATTERN,
  SETTING_DATE_VALUE_PATTERN,
  resolveSettingEnum,
} from '@elraptorus/bfw_studio_sdk';

const colorValueRegex = new RegExp(SETTING_COLOR_VALUE_PATTERN);
const dateValueRegex = new RegExp(SETTING_DATE_VALUE_PATTERN);

export function validateSetting(key: string, value: unknown, descriptor: SettingDescriptor): SettingValidationError[] {
  const errors: SettingValidationError[] = [];

  if (value === undefined) {
    return errors;
  }

  switch (descriptor.type) {
    case 'boolean':
      if (typeof value !== 'boolean') {
        errors.push({
          key,
          message: `Expected boolean, got ${typeof value}`,
          expected: 'boolean',
          actual: typeof value,
        });
      }
      break;

    case 'string':
      if (value !== null && typeof value !== 'string') {
        errors.push({
          key,
          message: `Expected string or null, got ${typeof value}`,
          expected: 'string | null',
          actual: typeof value,
        });
      }
      {
        const enumValues = resolveSettingEnum(descriptor.enum);
        if (enumValues != null && value != null && !enumValues.includes(value as string)) {
          errors.push({
            key,
            message: `Value "${value}" is not one of the allowed values: ${enumValues.join(', ')}`,
            expected: enumValues.join(' | '),
            actual: String(value),
          });
        }
      }
      if (descriptor.pattern != null && typeof value === 'string') {
        try {
          const regex = new RegExp(descriptor.pattern);
          if (!regex.test(value)) {
            errors.push({
              key,
              message: descriptor.patternErrorMessage ?? `Value does not match pattern: ${descriptor.pattern}`,
              expected: `match(${descriptor.pattern})`,
              actual: String(value),
            });
          }
        } catch {
          errors.push({
            key,
            message: `Invalid pattern "${descriptor.pattern}" in descriptor`,
            expected: 'valid regex',
            actual: descriptor.pattern,
          });
        }
      }
      break;

    case 'color':
      if (typeof value !== 'string') {
        errors.push({
          key,
          message: `Expected string (CSS hex color), got ${typeof value}`,
          expected: 'color (hex string)',
          actual: typeof value,
        });
      } else if (!colorValueRegex.test(value)) {
        errors.push({
          key,
          message: `Value is not a valid CSS hex color (expected #RGB, #RRGGBB, or #RRGGBBAA)`,
          expected: SETTING_COLOR_VALUE_PATTERN,
          actual: value,
        });
      }
      break;

    case 'date':
      if (typeof value !== 'string') {
        errors.push({
          key,
          message: `Expected string (YYYY-MM-DD), got ${typeof value}`,
          expected: 'date (YYYY-MM-DD)',
          actual: typeof value,
        });
      } else if (!dateValueRegex.test(value)) {
        errors.push({
          key,
          message: `Value is not a valid ISO date (expected YYYY-MM-DD)`,
          expected: SETTING_DATE_VALUE_PATTERN,
          actual: value,
        });
      }
      break;

    case 'number':
    case 'integer':
      if (typeof value !== 'number') {
        errors.push({
          key,
          message: `Expected number, got ${typeof value}`,
          expected: 'number',
          actual: typeof value,
        });
      } else {
        if (descriptor.type === 'integer' && !Number.isInteger(value)) {
          errors.push({
            key,
            message: `Expected integer, got float (${value})`,
            expected: 'integer',
            actual: 'float',
          });
        }
        const enumValues = resolveSettingEnum(descriptor.enum);
        if (enumValues != null) {
          if (!enumValues.includes(value)) {
            errors.push({
              key,
              message: `Value ${value} is not one of the allowed values: ${enumValues.join(', ')}`,
              expected: enumValues.join(' | '),
              actual: String(value),
            });
          }
        } else {
          if (descriptor.minimum != null && value < descriptor.minimum) {
            errors.push({
              key,
              message: `Value ${value} is below minimum ${descriptor.minimum}`,
              expected: `>= ${descriptor.minimum}`,
              actual: String(value),
            });
          }
          if (descriptor.maximum != null && value > descriptor.maximum) {
            errors.push({
              key,
              message: `Value ${value} exceeds maximum ${descriptor.maximum}`,
              expected: `<= ${descriptor.maximum}`,
              actual: String(value),
            });
          }
        }
      }
      break;

    case 'array':
      if (!Array.isArray(value)) {
        errors.push({
          key,
          message: `Expected array, got ${typeof value}`,
          expected: 'array',
          actual: typeof value,
        });
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
                errors.push({
                  key,
                  message: `Item at index ${i}: expected object, got ${actualKind}`,
                  expected: 'object',
                  actual: actualKind,
                });
              } else {
                errors.push(
                  ...validateObjectProperties(`${key}[${i}]`, el as Record<string, unknown>, objectItemDescriptor),
                );
              }
            }
          } else {
            for (let i = 0; i < value.length; i++) {
              if (!matchesPrimitiveType(value[i], descriptor.items.type)) {
                errors.push({
                  key,
                  message: `Item at index ${i}: expected ${descriptor.items.type}, got ${typeof value[i]}`,
                  expected: descriptor.items.type,
                  actual: typeof value[i],
                });
              }
            }
          }
        }
        if (descriptor.minItems != null && value.length < descriptor.minItems) {
          errors.push({
            key,
            message: `Array has ${value.length} items, minimum is ${descriptor.minItems}`,
            expected: `>= ${descriptor.minItems} items`,
            actual: `${value.length} items`,
          });
        }
        if (descriptor.maxItems != null && value.length > descriptor.maxItems) {
          errors.push({
            key,
            message: `Array has ${value.length} items, maximum is ${descriptor.maxItems}`,
            expected: `<= ${descriptor.maxItems} items`,
            actual: `${value.length} items`,
          });
        }
        if (descriptor.uniqueItems === true) {
          const serialized = value.map((item) => JSON.stringify(item));
          if (new Set(serialized).size !== serialized.length) {
            errors.push({
              key,
              message: 'Array contains duplicate items',
              expected: 'unique items',
              actual: 'duplicates found',
            });
          }
        }
      }
      break;

    case 'object':
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        errors.push({
          key,
          message: `Expected object, got ${Array.isArray(value) ? 'array' : typeof value}`,
          expected: 'object',
          actual: Array.isArray(value) ? 'array' : typeof value,
        });
      } else if (descriptor.properties != null) {
        errors.push(...validateObjectProperties(key, value as Record<string, unknown>, descriptor));
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
  value: Record<string, unknown>,
  descriptor: SettingDescriptorObject,
): SettingValidationError[] {
  if (descriptor.properties == null) {
    return [];
  }

  const errors: SettingValidationError[] = [];

  for (const [propKey, propDescriptor] of Object.entries(descriptor.properties)) {
    const propValue = value[propKey];
    if (propValue !== undefined) {
      errors.push(...validateSetting(`${parentKey}.${propKey}`, propValue, propDescriptor));
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
): SettingsValidationResult {
  const errors: SettingValidationError[] = [];

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
