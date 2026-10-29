import type { LocatedSettingValidationError } from '#bifrost/common/SettingsValidator';
import type { JsonAssistBackend, JsonAssistCompletion, JsonAssistDiagnostic } from '#components/code-editor/jsonAssist';
import type { JsonPath } from '#components/code-editor/jsonSyntaxPaths';

import type { SettingDescriptor } from '@elraptorus/bfw_studio_sdk';
import { resolveSettingEnum } from '@elraptorus/bfw_studio_sdk';

type SettingsJsonAssistOptions = {
  /** The save-time validation of the layer, so editor and save report the same errors. */
  validateLayer: (layer: Record<string, unknown>) => LocatedSettingValidationError[];
  /** Whether key completion offers this registered key at the root. */
  isKeyOffered: (key: string) => boolean;
};

/** `inItem`: the descriptor is an array and the path points at one of its items. */
function propertiesOf(descriptor: SettingDescriptor, inItem: boolean): Record<string, SettingDescriptor> | undefined {
  if (inItem) {
    return descriptor.type === 'array' && descriptor.items?.type === 'object' ? descriptor.items.properties : undefined;
  }
  return descriptor.type === 'object' ? descriptor.properties : undefined;
}

function descriptorAt(registry: Map<string, SettingDescriptor>, path: JsonPath): SettingDescriptor | undefined {
  const [first, ...rest] = path;
  let descriptor = typeof first === 'string' ? registry.get(first) : undefined;
  let inItem = false;
  for (const segment of rest) {
    if (descriptor == null) {
      return undefined;
    }
    if (typeof segment === 'number') {
      if (descriptor.type !== 'array' || inItem) {
        return undefined;
      }
      inItem = true;
    } else {
      descriptor = propertiesOf(descriptor, inItem)?.[segment];
      inItem = false;
    }
  }
  return inItem ? undefined : descriptor;
}

function keyCompletion(key: string, descriptor: SettingDescriptor): JsonAssistCompletion {
  return {
    label: key,
    insertText: `${JSON.stringify(key)}: ${JSON.stringify(descriptor.default ?? null)}`,
    detail: descriptor.label,
    info: descriptor.description,
  };
}

function valueCompletion(value: unknown, detail?: string): JsonAssistCompletion {
  return {
    label: typeof value === 'string' ? value : JSON.stringify(value),
    insertText: JSON.stringify(value),
    detail,
  };
}

function valueCompletions(descriptor: SettingDescriptor): JsonAssistCompletion[] {
  const completions: JsonAssistCompletion[] = [];
  if (descriptor.type === 'string' || descriptor.type === 'number' || descriptor.type === 'integer') {
    const enumLabels = resolveSettingEnum(descriptor.enumLabels);
    const enumDescriptions = descriptor.type === 'string' ? descriptor.enumDescriptions : undefined;
    (resolveSettingEnum(descriptor.enum) ?? []).forEach((value: string | number, index: number) => {
      completions.push(valueCompletion(value, enumDescriptions?.[index] ?? enumLabels?.[String(value)]));
    });
  }
  if (descriptor.type === 'boolean') {
    completions.push(valueCompletion(true), valueCompletion(false));
  }
  const defaultText = JSON.stringify(descriptor.default);
  if (defaultText != null && !completions.some((completion) => completion.insertText === defaultText)) {
    completions.push(valueCompletion(descriptor.default, 'Default'));
  }
  return completions;
}

/** Lint, completion and hover for a settings layer, from the registered descriptors. */
export function createSettingsJsonAssist(
  registry: Map<string, SettingDescriptor>,
  options: SettingsJsonAssistOptions,
): JsonAssistBackend {
  return {
    validate(value) {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return [{ path: [], message: 'Settings layer must be a JSON object.', severity: 'error' }];
      }
      const layer = value as Record<string, unknown>;
      const diagnostics: JsonAssistDiagnostic[] = options
        .validateLayer(layer)
        .map((error) => ({ path: error.path, message: error.message, severity: 'error' }));
      for (const key of Object.keys(layer)) {
        const descriptor = registry.get(key);
        if (descriptor == null) {
          diagnostics.push({ path: [key], target: 'key', message: 'Unknown setting.', severity: 'warning' });
        } else if (descriptor.deprecated != null) {
          diagnostics.push({
            path: [key],
            target: 'key',
            message: descriptor.deprecated,
            severity: 'warning',
            deprecated: true,
          });
        }
      }
      return diagnostics;
    },

    describe(path) {
      const descriptor = descriptorAt(registry, path);
      if (descriptor == null) {
        return null;
      }
      const parts = [
        descriptor.label ? `**${descriptor.label}**` : '',
        descriptor.markdownDescription ?? descriptor.description,
        descriptor.deprecated == null ? '' : `**Deprecated:** ${descriptor.deprecated}`,
      ];
      return parts.filter((part) => part !== '').join('\n\n');
    },

    complete(location) {
      if (location.slot === 'value') {
        const descriptor = descriptorAt(registry, location.path);
        return descriptor == null ? [] : valueCompletions(descriptor);
      }
      const inItem = typeof location.path[location.path.length - 1] === 'number';
      const parent = descriptorAt(registry, inItem ? location.path.slice(0, -1) : location.path);
      const entries =
        location.path.length === 0
          ? [...registry].filter(([key]) => options.isKeyOffered(key))
          : Object.entries((parent == null ? undefined : propertiesOf(parent, inItem)) ?? {});
      return entries
        .filter(([key]) => !location.existingKeys.includes(key))
        .map(([key, descriptor]) => keyCompletion(key, descriptor));
    },
  };
}
