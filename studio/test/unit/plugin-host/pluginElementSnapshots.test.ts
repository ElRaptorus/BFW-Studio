import { BpmnElementType } from '#modules/bpmn-editor/BpmnElementTypes';
import type { BpmnElement } from '#modules/bpmn-editor/BpmnElementTypes';
import assert from 'node:assert';
import { describe, it } from 'vitest';

import { PluginBpmnElementType, PluginDmnElementType } from '@evil/bifrost_fw_sdk';

import { toBpmnElementDetailSnapshots } from '../../../src/bifrost/electron-renderer/plugin-host/PluginOverlayStore';

function userTaskStub(overrides: Partial<BpmnElement> = {}): BpmnElement {
  return {
    __internalModdleId: 'moddle-1',
    id: 'UserTask_1',
    name: 'Review Order',
    documentation: '',
    customProperties: null,
    incomingFlows: [],
    outgoingFlows: [],
    attachedElements: [],
    type: BpmnElementType.UserTask,
    ...overrides,
  } as BpmnElement;
}

describe('plugin BPMN/DMN element identification', () => {
  it('getElement-equivalent snapshot uses Studio-semantic UserTask, not a diagram-js QName', () => {
    const [snapshot] = toBpmnElementDetailSnapshots([userTaskStub()]);

    assert.strictEqual(snapshot.type, PluginBpmnElementType.UserTask);
    assert.strictEqual(snapshot.type, 'UserTask');
    assert.notStrictEqual(snapshot.type, 'bpmn:UserTask');
    assert.strictEqual(snapshot.id, 'UserTask_1');
    assert.strictEqual(snapshot.name, 'Review Order');
  });

  it('PluginBpmnElementType matches BpmnElementType.UserTask', () => {
    assert.strictEqual(PluginBpmnElementType.UserTask, BpmnElementType.UserTask);
  });

  it('PluginDmnElementType matches the typed DMN document-model vocabulary', () => {
    assert.strictEqual(PluginDmnElementType.Decision, 'dmn:Decision');
    assert.notStrictEqual(PluginDmnElementType.Decision, 'Decision');
  });
});
