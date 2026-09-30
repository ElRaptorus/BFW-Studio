import type { FormFieldDefinition, FormFieldOption } from '#modules/bpmn-core/form-renderer/FormModel';

/**
 * Initial state of form inputs.
 *
 * `initialValue` is a runtime value (for example a submitted value shown in a review). When it is
 * given, it wins, including `null` for a field the user left empty. Only `undefined` falls back to
 * the modelled `defaultValue`. The form builder writes `defaultValue` as a string; any other type
 * from a hand-written BPMN is ignored.
 */

function stringDefault(field: FormFieldDefinition): string | undefined {
  return typeof field.defaultValue === 'string' ? field.defaultValue : undefined;
}

export function initialText(field: FormFieldDefinition, initialValue?: unknown): string {
  if (initialValue !== undefined) {
    return initialValue == null ? '' : String(initialValue);
  }
  return stringDefault(field) ?? '';
}

export function initiallyChecked(field: FormFieldDefinition, initialValue?: unknown): boolean {
  if (initialValue !== undefined) {
    return initialValue === true || initialValue === 'true';
  }
  return stringDefault(field) === 'true';
}

export function optionInitiallyChecked(
  field: FormFieldDefinition,
  option: FormFieldOption,
  initialValue?: unknown,
): boolean {
  if (Array.isArray(initialValue)) {
    return initialValue.includes(option.value);
  }
  if (initialValue !== undefined) {
    return initialValue === option.value;
  }
  return stringDefault(field) === option.value;
}
