import type {
  FormAction,
  FormFieldDefinition,
  FormFieldType,
  FormFieldValidationRule,
} from '#modules/bpmn-core/form-renderer/FormModel';
import { FormActionPreset } from '#modules/bpmn-core/form-renderer/FormModel';

export type FieldTypeDescriptor = {
  type: FormFieldType;
  label: string;
  icon: string;
  category: 'input' | 'toggle' | 'choice' | 'decorative';
};

export const FIELD_TYPE_DESCRIPTORS: FieldTypeDescriptor[] = [
  { type: 'text', label: 'Text', icon: 'ph ph-text-aa', category: 'input' },
  { type: 'number', label: 'Number', icon: 'ph ph-hash', category: 'input' },
  { type: 'date', label: 'Date', icon: 'ph ph-calendar', category: 'input' },
  { type: 'checkbox', label: 'Checkbox', icon: 'ph ph-check-square', category: 'toggle' },
  { type: 'dropdown', label: 'Dropdown', icon: 'ph ph-caret-down', category: 'choice' },
  { type: 'radio', label: 'Radio Group', icon: 'ph ph-radio-button', category: 'choice' },
  { type: 'textarea', label: 'Multi-line', icon: 'ph ph-text-align-left', category: 'input' },
  { type: 'file', label: 'File Upload', icon: 'ph ph-upload', category: 'input' },
  { type: 'toggle', label: 'Toggle', icon: 'ph ph-toggle-right', category: 'toggle' },
  { type: 'section_header', label: 'Section Header', icon: 'ph ph-text-h', category: 'decorative' },
];

export const ACTION_PRESET_DEFAULTS: Record<FormActionPreset, Omit<FormAction, 'id'>> = {
  [FormActionPreset.Confirm]: {
    label: 'Confirm',
    preset: FormActionPreset.Confirm,
    submitsForm: true,
    isDefault: true,
  },
  [FormActionPreset.Ok]: { label: 'OK', preset: FormActionPreset.Ok, submitsForm: true, isDefault: true },
  [FormActionPreset.Yes]: { label: 'Yes', preset: FormActionPreset.Yes, submitsForm: true, isDefault: false },
  [FormActionPreset.No]: { label: 'No', preset: FormActionPreset.No, submitsForm: false, isDefault: false },
  [FormActionPreset.Cancel]: { label: 'Cancel', preset: FormActionPreset.Cancel, submitsForm: false, isDefault: false },
  [FormActionPreset.Custom]: { label: 'Custom', preset: FormActionPreset.Custom, submitsForm: true, isDefault: false },
};

let fieldIdCounter = 0;

export function createDefaultField(type: FormFieldType): FormFieldDefinition {
  fieldIdCounter += 1;
  const descriptor = FIELD_TYPE_DESCRIPTORS.find((descriptorEntry) => descriptorEntry.type === type);
  return {
    id: `field_${type}_${Date.now()}_${fieldIdCounter}`,
    type,
    label: descriptor?.label ?? 'Field',
    required: false,
  };
}

export function fieldsForStorage(fields: FormFieldDefinition[]): FormFieldDefinition[] {
  return fields.map((field) => ({
    ...field,
    required: typeof field.required === 'boolean' ? field.required : false,
  }));
}

export function patternValue(field: FormFieldDefinition): string {
  const rule = field.validationRules?.find((entry) => entry.type === 'pattern');
  return typeof rule?.value === 'string' ? rule.value : '';
}

export function withPattern(field: FormFieldDefinition, pattern: string): FormFieldDefinition {
  const remainingRules = (field.validationRules ?? []).filter((entry) => entry.type !== 'pattern');
  const patternRule: FormFieldValidationRule[] = pattern === '' ? [] : [{ type: 'pattern', value: pattern }];
  const validationRules = [...remainingRules, ...patternRule];
  return {
    ...field,
    required: typeof field.required === 'boolean' ? field.required : false,
    validationRules: validationRules.length > 0 ? validationRules : undefined,
  };
}

let actionIdCounter = 0;

export function createDefaultAction(preset: FormActionPreset): FormAction {
  actionIdCounter += 1;
  const defaults = ACTION_PRESET_DEFAULTS[preset];
  return {
    id: `action_${preset}_${Date.now()}_${actionIdCounter}`,
    ...defaults,
  };
}
