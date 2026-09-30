import type { FormFieldDefinition } from '#modules/bpmn-core/form-renderer/FormModel';

export function patternValidationMessage(field: FormFieldDefinition, value: string): string | null {
  if (value.trim() === '') {
    return null;
  }
  const rule = field.validationRules?.find((entry) => entry.type === 'pattern');
  if (rule == null || typeof rule.value !== 'string' || rule.value === '') {
    return null;
  }
  try {
    const regex = new RegExp(rule.value);
    if (!regex.test(value)) {
      if (rule.message != null && rule.message !== '') {
        return rule.message;
      }
      return `${field.label} does not match the expected format`;
    }
  } catch {
    return null;
  }
  return null;
}
