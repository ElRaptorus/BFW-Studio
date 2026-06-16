import type { FormAction, FormFieldDefinition } from '@evil/bifrost_fw_sdk/types/bpmn/BpmnElementTypes';
import { FormActionPreset, FormFieldType } from '@evil/bifrost_fw_sdk/types/bpmn/BpmnElementTypes';

export type FieldTypeDescriptor = {
  type: FormFieldType;
  label: string;
  icon: string;
  category: 'input' | 'toggle' | 'choice' | 'decorative';
};

export const FIELD_TYPE_DESCRIPTORS: FieldTypeDescriptor[] = [
  { type: FormFieldType.Text, label: 'Text', icon: 'ph ph-text-aa', category: 'input' },
  { type: FormFieldType.Number, label: 'Number', icon: 'ph ph-hash', category: 'input' },
  { type: FormFieldType.Date, label: 'Date', icon: 'ph ph-calendar', category: 'input' },
  { type: FormFieldType.Checkbox, label: 'Checkbox', icon: 'ph ph-check-square', category: 'toggle' },
  { type: FormFieldType.Select, label: 'Dropdown', icon: 'ph ph-caret-down', category: 'choice' },
  { type: FormFieldType.Radio, label: 'Radio Group', icon: 'ph ph-radio-button', category: 'choice' },
  { type: FormFieldType.Textarea, label: 'Multi-line', icon: 'ph ph-text-align-left', category: 'input' },
  { type: FormFieldType.File, label: 'File Upload', icon: 'ph ph-upload', category: 'input' },
  { type: FormFieldType.Boolean, label: 'Toggle', icon: 'ph ph-toggle-right', category: 'toggle' },
  { type: FormFieldType.Header, label: 'Section Header', icon: 'ph ph-text-h', category: 'decorative' },
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

let actionIdCounter = 0;

export function createDefaultAction(preset: FormActionPreset): FormAction {
  actionIdCounter += 1;
  const defaults = ACTION_PRESET_DEFAULTS[preset];
  return {
    id: `action_${preset}_${Date.now()}_${actionIdCounter}`,
    ...defaults,
  };
}
