import type { FormFieldDefinition } from '#modules/bpmn-core/form-renderer/FormModel';
import {
  initialText,
  initiallyChecked,
  optionInitiallyChecked,
} from '#modules/bpmn-core/form-renderer/formFieldInitialValue';
import assert from 'node:assert';
import { describe, it } from 'vitest';

function field(type: FormFieldDefinition['type'], defaultValue?: unknown): FormFieldDefinition {
  return { id: 'field', type, label: 'Field', required: false, defaultValue: defaultValue as string | undefined };
}

describe('form field initial values', () => {
  it('uses a string default and ignores a non-string default', () => {
    assert.equal(initialText(field('text', 'abc')), 'abc');
    assert.equal(initialText(field('text', 5)), '');
    assert.equal(initialText(field('text')), '');
  });

  it('prefers a runtime value over the default', () => {
    assert.equal(initialText(field('text', 'abc'), 'submitted'), 'submitted');
    assert.equal(initialText(field('number', '1'), 7), '7');
  });

  it('reads checked state from booleans and the string "true"', () => {
    assert.equal(initiallyChecked(field('toggle', 'true')), true);
    assert.equal(initiallyChecked(field('toggle', 'false')), false);
    assert.equal(initiallyChecked(field('toggle', true)), false);
    assert.equal(initiallyChecked(field('toggle', 'true'), false), false);
    assert.equal(initiallyChecked(field('toggle'), true), true);
    assert.equal(initiallyChecked(field('toggle'), 'true'), true);
  });

  it('checks checkbox group options from an array of submitted values', () => {
    const group = field('checkbox');
    assert.equal(optionInitiallyChecked(group, { value: 'a', label: 'A' }, ['a', 'b']), true);
    assert.equal(optionInitiallyChecked(group, { value: 'c', label: 'C' }, ['a', 'b']), false);
  });

  it('checks a radio option from a submitted string or the default', () => {
    const radio = field('radio', 'x');
    assert.equal(optionInitiallyChecked(radio, { value: 'y', label: 'Y' }, 'y'), true);
    assert.equal(optionInitiallyChecked(radio, { value: 'x', label: 'X' }, 'y'), false);
    assert.equal(optionInitiallyChecked(radio, { value: 'x', label: 'X' }), true);
  });

  it('shows a submitted null as empty instead of the default', () => {
    assert.equal(initialText(field('text', 'abc'), null), '');
    assert.equal(initiallyChecked(field('toggle', 'true'), null), false);
    assert.equal(optionInitiallyChecked(field('radio', 'x'), { value: 'x', label: 'X' }, null), false);
  });
});
