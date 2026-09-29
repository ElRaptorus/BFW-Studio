/**
 * Modeling contract for User Task forms.
 *
 * The BPMN editor authors this shape into `bfw:formFields` and `bfw:formActions`.
 * The Engine stores and returns that JSON. It does not define these types.
 */

export type FormFieldType =
  'text' | 'number' | 'date' | 'checkbox' | 'dropdown' | 'radio' | 'textarea' | 'file' | 'toggle' | 'section_header';

export type FormFieldOption = {
  readonly value: string;
  readonly label: string;
};

/**
 * A validation rule attached to a form field.
 *
 * Known rule `pattern`: `value` is a regular expression the whole input must
 * match; `message` is shown on failure.
 */
export type FormFieldValidationRule = {
  readonly type: string;
  readonly value?: unknown;
  readonly message?: string;
};

export type FormFieldDefinition = {
  readonly id: string;
  readonly type: FormFieldType;
  readonly label: string;
  readonly required: boolean;
  readonly placeholder?: string;
  readonly defaultValue?: string;
  readonly options?: readonly FormFieldOption[];
  readonly validationRules?: readonly FormFieldValidationRule[];
  /** Help text shown with the field. */
  readonly hint?: string;
};

export type FormAction = {
  readonly id: string;
  readonly label: string;
  readonly preset: FormActionPreset;
  readonly submitsForm: boolean;
  readonly isDefault?: boolean;
  readonly isDanger?: boolean;
};

export enum FormActionPreset {
  Confirm = 'confirm',
  Ok = 'ok',
  Yes = 'yes',
  No = 'no',
  Cancel = 'cancel',
  Custom = 'custom',
}
