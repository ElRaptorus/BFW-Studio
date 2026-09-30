import type { FormAction, FormFieldDefinition } from '#modules/bpmn-core/form-renderer/FormModel';

import type { UserTaskResultToken } from '@elraptorus/bfw_engine_sdk';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readFormFields(value: unknown): FormFieldDefinition[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (entry): entry is FormFieldDefinition =>
      isRecord(entry) && typeof entry.id === 'string' && typeof entry.type === 'string',
  );
}

export function readFormActions(value: unknown): FormAction[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is FormAction => isRecord(entry) && typeof entry.id === 'string');
}

/** Runtime entries win when there are any; the modelled definition is the fallback. */
export function preferRuntimeEntries<T>(runtimeEntries: T[], definitionEntries: T[]): T[] {
  return runtimeEntries.length > 0 ? runtimeEntries : definitionEntries;
}

export function readSubmittedFormValues(outputToken: unknown): Record<string, unknown> {
  if (!isRecord(outputToken)) {
    return {};
  }

  const values = (outputToken as Partial<UserTaskResultToken>).values;
  if (!isRecord(values)) {
    return {};
  }

  return values;
}
