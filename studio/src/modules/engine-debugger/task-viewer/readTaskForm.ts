import type { FormAction, FormFieldDefinition } from '#modules/bpmn-core/form-renderer/FormModel';

import type { UserTaskResultToken } from '@elraptorus/bfw_engine_sdk';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readFormFields(value: unknown): FormFieldDefinition[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value as FormFieldDefinition[];
}

export function readFormActions(value: unknown): FormAction[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value as FormAction[];
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
