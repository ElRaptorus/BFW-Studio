import type { FormFieldDefinition } from '#modules/bpmn-core/form-renderer/FormModel';
import {
  readFormActions,
  readFormFields,
  readSubmittedFormValues,
} from '#modules/engine-debugger/task-viewer/readTaskForm';
import assert from 'node:assert';
import { describe, it } from 'vitest';

const canonicalFields: FormFieldDefinition[] = [{ id: 'approved', type: 'toggle', label: 'Approved', required: false }];

describe('dynamic UI form adapter', () => {
  it('passes a canonical field array through unchanged', () => {
    assert.equal(readFormFields(canonicalFields), canonicalFields);
  });

  it('does not read the object shape', () => {
    assert.deepEqual(readFormFields({ fields: canonicalFields }), []);
    assert.deepEqual(readFormActions({ actions: [{ id: 'ok', label: 'OK' }] }), []);
  });

  it('reads submitted values from a user task result token', () => {
    assert.deepEqual(readSubmittedFormValues({ actionId: 'approve', values: { approved: true } }), { approved: true });
    assert.deepEqual(readSubmittedFormValues(null), {});
    assert.deepEqual(readSubmittedFormValues({ actionId: null }), {});
    assert.deepEqual(readSubmittedFormValues({ actionId: 'approve', values: 'flat' }), {});
  });
});
