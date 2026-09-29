import type { FormAction, FormFieldDefinition } from '#modules/bpmn-core/form-renderer/FormModel';

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
