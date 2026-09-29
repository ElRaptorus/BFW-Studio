import type { FormFieldDefinition } from '#modules/bpmn-core/form-renderer/FormModel';
import {
  createDefaultField,
  fieldsForStorage,
  patternValue,
  withPattern,
} from '#modules/bpmn-editor/form-builder/constants';
import assert from 'node:assert';
import { describe, it } from 'vitest';

describe('form builder serialisation', () => {
  it('writes dropdown, toggle, and section_header with required set', () => {
    for (const type of ['dropdown', 'toggle', 'section_header'] as const) {
      const field = createDefaultField(type);
      assert.equal(field.type, type);
      assert.equal(field.required, false);
    }
  });

  it('writes a pattern as a validation rule and reads that rule back', () => {
    const field = withPattern(createDefaultField('text'), '^[a-z]+$');
    assert.deepEqual(field.validationRules, [{ type: 'pattern', value: '^[a-z]+$' }]);
    assert.equal(patternValue(field), '^[a-z]+$');
    assert.equal(field.required, false);
  });

  it('always stores required', () => {
    const requiredField = { ...createDefaultField('text'), required: true };
    assert.equal(fieldsForStorage([requiredField])[0]?.required, true);

    const missingRequired = {
      id: 'field_name',
      type: 'text',
      label: 'Name',
      required: undefined,
    } as unknown as FormFieldDefinition;
    assert.equal(fieldsForStorage([missingRequired])[0]?.required, false);
  });
});
