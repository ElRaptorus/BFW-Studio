import type { FormFieldType } from '#modules/bpmn-core/form-renderer/FormModel';

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
