import type { SettingArrayItemsDescriptor, SettingDescriptor } from '@evil/bifrost_fw_sdk';
import { SETTING_COLOR_VALUE_PATTERN, SETTING_DATE_VALUE_PATTERN, resolveSettingEnum } from '@evil/bifrost_fw_sdk';

type JsonSchema = {
  type: string;
  description?: string;
  markdownDescription?: string;
  deprecationMessage?: string;
  default?: unknown;
  enum?: (string | number)[];
  enumDescriptions?: string[];
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  additionalProperties?: boolean;
  minimum?: number;
  maximum?: number;
  pattern?: string;
  patternErrorMessage?: string;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
};

type RootJsonSchema = {
  type: 'object';
  properties: Record<string, JsonSchema>;
  additionalProperties: boolean | { not: true; errorMessage: string };
};

function settingDescriptorRootJsonType(descriptor: SettingDescriptor): string {
  if (descriptor.type === 'integer') {
    return 'integer';
  }
  if (descriptor.type === 'color' || descriptor.type === 'date') {
    return 'string';
  }
  return descriptor.type;
}

function arrayItemToJsonSchema(items: SettingArrayItemsDescriptor): JsonSchema {
  if (items.type === 'object') {
    const schema: JsonSchema = {
      type: 'object',
      properties: {},
      additionalProperties: true,
    };
    for (const [propKey, childDescriptor] of Object.entries(items.properties)) {
      schema.properties![propKey] = descriptorToJsonSchema(childDescriptor);
    }
    return schema;
  }

  const itemType = items.type;
  if (itemType === 'integer') {
    return { type: 'integer' };
  }
  if (itemType === 'color') {
    return {
      type: 'string',
      pattern: SETTING_COLOR_VALUE_PATTERN,
      patternErrorMessage: 'Expected CSS hex color (#RGB, #RRGGBB, or #RRGGBBAA).',
    };
  }
  if (itemType === 'date') {
    return {
      type: 'string',
      pattern: SETTING_DATE_VALUE_PATTERN,
      patternErrorMessage: 'Expected ISO date (YYYY-MM-DD).',
    };
  }
  return { type: itemType };
}

function descriptorToJsonSchema(descriptor: SettingDescriptor): JsonSchema {
  const schema: JsonSchema = {
    type: settingDescriptorRootJsonType(descriptor),
    description: descriptor.description,
    default: descriptor.default,
  };

  if (descriptor.markdownDescription != null) {
    schema.markdownDescription = descriptor.markdownDescription;
  }

  if (descriptor.deprecated != null) {
    schema.deprecationMessage = descriptor.deprecated;
  }

  switch (descriptor.type) {
    case 'string': {
      const enumValues = resolveSettingEnum(descriptor.enum);
      if (enumValues != null) {
        schema.enum = enumValues;

        if (descriptor.enumDescriptions != null) {
          schema.enumDescriptions = descriptor.enumDescriptions;
        } else {
          const enumLabels = resolveSettingEnum(descriptor.enumLabels);
          if (enumLabels != null) {
            schema.enumDescriptions = enumValues.map((value) => enumLabels[String(value)] ?? '');
          }
        }
      }
      if (descriptor.pattern != null) {
        schema.pattern = descriptor.pattern;
      }
      if (descriptor.patternErrorMessage != null) {
        schema.patternErrorMessage = descriptor.patternErrorMessage;
      }
      break;
    }

    case 'color':
      schema.pattern = SETTING_COLOR_VALUE_PATTERN;
      schema.patternErrorMessage = 'Expected CSS hex color (#RGB, #RRGGBB, or #RRGGBBAA).';
      break;

    case 'date':
      schema.pattern = SETTING_DATE_VALUE_PATTERN;
      schema.patternErrorMessage = 'Expected ISO date (YYYY-MM-DD).';
      break;

    case 'number':
    case 'integer': {
      const enumValues = resolveSettingEnum(descriptor.enum);
      if (enumValues != null) {
        schema.enum = enumValues;
        const enumLabels = resolveSettingEnum(descriptor.enumLabels);
        if (enumLabels != null) {
          schema.enumDescriptions = enumValues.map((value) => enumLabels[String(value)] ?? '');
        }
      } else {
        if (descriptor.minimum != null) {
          schema.minimum = descriptor.minimum;
        }
        if (descriptor.maximum != null) {
          schema.maximum = descriptor.maximum;
        }
      }
      break;
    }

    case 'array':
      if (descriptor.items != null) {
        schema.items = arrayItemToJsonSchema(descriptor.items);
      }
      if (descriptor.minItems != null) {
        schema.minItems = descriptor.minItems;
      }
      if (descriptor.maxItems != null) {
        schema.maxItems = descriptor.maxItems;
      }
      if (descriptor.uniqueItems != null) {
        schema.uniqueItems = descriptor.uniqueItems;
      }
      break;

    case 'object':
      if (descriptor.properties != null) {
        schema.properties = {};
        for (const [key, childDescriptor] of Object.entries(descriptor.properties)) {
          schema.properties[key] = descriptorToJsonSchema(childDescriptor);
        }
      }
      schema.additionalProperties = true;
      break;
  }

  return schema;
}

export function buildJsonSchema(schemaRegistry: Map<string, SettingDescriptor>): RootJsonSchema {
  const properties: Record<string, JsonSchema> = {};

  for (const [key, descriptor] of schemaRegistry) {
    properties[key] = descriptorToJsonSchema(descriptor);
  }

  return {
    type: 'object',
    properties,
    additionalProperties: { not: true, errorMessage: 'Unknown setting.' },
  };
}
