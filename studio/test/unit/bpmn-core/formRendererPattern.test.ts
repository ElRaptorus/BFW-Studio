import type { FormFieldDefinition } from '#modules/bpmn-core/form-renderer/FormModel';
import { patternValidationMessage } from '#modules/bpmn-core/form-renderer/patternValidationMessage';
import assert from 'node:assert';
import { describe, it } from 'vitest';

function textField(validationRules: FormFieldDefinition['validationRules']): FormFieldDefinition {
  return {
    id: 'code',
    type: 'text',
    label: 'Code',
    required: false,
    validationRules,
  };
}

describe('form renderer pattern validation', () => {
  const field = textField([{ type: 'pattern', value: '^[a-z]+$' }]);

  it('ignores validation rules that are not an array', () => {
    const malformed = textField({
      type: 'pattern',
      value: '^[a-z]+$',
    } as unknown as FormFieldDefinition['validationRules']);
    assert.equal(patternValidationMessage(malformed, 'ABC'), null);
  });

  it('accepts a value that matches the pattern', () => {
    assert.equal(patternValidationMessage(field, 'abc'), null);
  });

  it('uses the field label when the rule has no message', () => {
    assert.equal(patternValidationMessage(field, 'ABC'), 'Code does not match the expected format');
  });

  it('shows the rule message when one is present', () => {
    const fieldWithMessage = textField([{ type: 'pattern', value: '^[a-z]+$', message: 'Letters only' }]);
    assert.equal(patternValidationMessage(fieldWithMessage, 'ABC'), 'Letters only');
  });
});
