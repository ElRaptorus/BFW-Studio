import { FormActionPreset } from '#modules/bpmn-core/form-renderer/FormModel';
import type { FormFieldDefinition } from '#modules/bpmn-core/form-renderer/FormModel';
import {
  ACTION_PRESET_DEFAULTS,
  createDefaultAction,
  createDefaultField,
} from '#modules/bpmn-editor/form-builder/ToolboxSidebar';
import { isValidActionId } from '#modules/bpmn-editor/form-builder/panes/PropertiesFormBuilderAction';
import { withEffect } from '#modules/bpmn-editor/form-builder/panes/PropertiesFormBuilderActionBehavior';
import { patternValue, withPattern } from '#modules/bpmn-editor/form-builder/panes/PropertiesFormBuilderField';
import { fieldsForStorage } from '#modules/bpmn-editor/form-builder/useBpmnFormBuilderState';
import assert from 'node:assert';
import { describe, it, vi } from 'vitest';

// BpmnDocumentModel loads bpmn-js, which does not run in Node.
vi.mock('#modules/bpmn-editor/BpmnDocumentModel', () => ({ default: class {} }));

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

  it('stores each preset effect', () => {
    assert.equal(ACTION_PRESET_DEFAULTS[FormActionPreset.Confirm].effect, 'submit');
    assert.equal(ACTION_PRESET_DEFAULTS[FormActionPreset.Ok].effect, 'submit');
    assert.equal(ACTION_PRESET_DEFAULTS[FormActionPreset.Yes].effect, 'submit');
    assert.equal(ACTION_PRESET_DEFAULTS[FormActionPreset.No].effect, 'submit');
    assert.equal(ACTION_PRESET_DEFAULTS[FormActionPreset.No].skipsValidation, true);
    assert.equal(ACTION_PRESET_DEFAULTS[FormActionPreset.Cancel].effect, 'dismiss');
    assert.equal(ACTION_PRESET_DEFAULTS[FormActionPreset.Abort].effect, 'abort');
    assert.equal(ACTION_PRESET_DEFAULTS[FormActionPreset.Abort].isDanger, true);
    assert.equal(ACTION_PRESET_DEFAULTS[FormActionPreset.Custom].effect, 'submit');
    assert.equal(createDefaultAction(FormActionPreset.Abort).isDanger, true);
  });

  it('withEffect removes skipsValidation except for submit', () => {
    const action = createDefaultAction(FormActionPreset.No);
    assert.equal(withEffect(action, 'dismiss').skipsValidation, undefined);
    assert.equal(withEffect(action, 'abort').skipsValidation, undefined);
    assert.equal(withEffect(action, 'submit').skipsValidation, true);
  });

  it('accepts only non-blank, unique action ids of at most 255 characters', () => {
    const approve = createDefaultAction(FormActionPreset.Confirm);
    const reject = createDefaultAction(FormActionPreset.No);
    const actions = [approve, reject];

    assert.equal(isValidActionId('approve', approve.id, actions), true);
    assert.equal(isValidActionId(approve.id, approve.id, actions), true);
    assert.equal(isValidActionId('   ', approve.id, actions), false);
    assert.equal(isValidActionId('a'.repeat(256), approve.id, actions), false);
    assert.equal(isValidActionId(reject.id, approve.id, actions), false);
  });
});
