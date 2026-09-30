import type { FormFieldDefinition } from '#modules/bpmn-core/form-renderer/FormModel';
import {
  preferRuntimeEntries,
  readFormActions,
  readFormFields,
  readSubmittedFormValues,
} from '#modules/engine-debugger/task-viewer/readTaskForm';
import assert from 'node:assert';
import { describe, it } from 'vitest';

const canonicalFields: FormFieldDefinition[] = [{ id: 'approved', type: 'toggle', label: 'Approved', required: false }];

describe('dynamic UI form adapter', () => {
  it('passes a canonical field array through unchanged', () => {
    assert.deepEqual(readFormFields(canonicalFields), canonicalFields);
  });

  it('drops null, non-record and incomplete field entries', () => {
    const malformed = [null, 'text', 42, { id: 'noType' }, { type: 'text' }, canonicalFields[0]];
    assert.deepEqual(readFormFields(malformed), canonicalFields);
  });

  it('drops null, non-record and id-less action entries', () => {
    const action = { id: 'ok', label: 'OK', effect: 'submit' };
    assert.deepEqual(readFormActions([null, 'ok', { label: 'no id' }, action]), [action]);
  });

  it('falls back to the definition only when the runtime list is empty', () => {
    assert.deepEqual(preferRuntimeEntries(['runtime'], ['definition']), ['runtime']);
    assert.deepEqual(preferRuntimeEntries([], ['definition']), ['definition']);
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
