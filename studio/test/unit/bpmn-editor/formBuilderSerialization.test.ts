import { FormActionPreset } from '#modules/bpmn-core/form-renderer/FormModel';
import {
  ACTION_PRESET_DEFAULTS,
  createDefaultAction,
  createDefaultField,
} from '#modules/bpmn-editor/form-builder/ToolboxSidebar';
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
});
