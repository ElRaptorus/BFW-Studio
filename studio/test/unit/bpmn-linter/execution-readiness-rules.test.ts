import assert from 'node:assert';
import { describe, it } from 'vitest';

import errorEventConfig from '../../../src/modules/bpmn-linter/rules/execution-readiness/error-event-config';
import messageEventReference from '../../../src/modules/bpmn-linter/rules/execution-readiness/message-event-reference';
import processExecutable from '../../../src/modules/bpmn-linter/rules/execution-readiness/process-executable';
import scriptTaskConfig from '../../../src/modules/bpmn-linter/rules/execution-readiness/script-task-config';
import serviceTaskImplementation from '../../../src/modules/bpmn-linter/rules/execution-readiness/service-task-implementation';
import userTaskAssignment from '../../../src/modules/bpmn-linter/rules/execution-readiness/user-task-assignment';
import type { BpmnlintRuleFactory, ModdleNode } from '../../../src/modules/bpmn-linter/types';

type CapturedReport = { id: string; message: string };

function collectReports(factory: BpmnlintRuleFactory, node: ModdleNode): CapturedReport[] {
  const reports: CapturedReport[] = [];
  const check = factory().check;
  if (typeof check !== 'function') {
    throw new Error('Expected a function check for these rules');
  }
  check(node, { report: (id, message) => reports.push({ id, message }) });
  return reports;
}

function moddleNode(properties: Record<string, unknown>): ModdleNode {
  return properties as unknown as ModdleNode;
}

function withExtension(type: string, body: string): { values: ModdleNode[] } {
  return { values: [moddleNode({ $type: type, body })] };
}

function errorDefinition(parentType: string, properties: Record<string, unknown> = {}): ModdleNode {
  return moddleNode({
    $type: 'bpmn:ErrorEventDefinition',
    id: 'ErrorDefinition_1',
    $parent: moddleNode({ $type: parentType, id: 'Event_1' }),
    ...properties,
  });
}

describe('error-event-config', () => {
  it('reports an error end event without errorRef or bfw:ErrorCode', () => {
    const reports = collectReports(errorEventConfig, errorDefinition('bpmn:EndEvent'));
    assert.equal(reports.length, 1);
    assert.equal(reports[0].id, 'Event_1');
    assert.match(reports[0].message, /only catch-all error catchers/);
  });

  it('passes an error end event with an errorRef to an error that has an errorCode', () => {
    const definition = errorDefinition('bpmn:EndEvent', {
      errorRef: moddleNode({ $type: 'bpmn:Error', id: 'E1', errorCode: 'PAYMENT_FAILED' }),
    });
    assert.equal(collectReports(errorEventConfig, definition).length, 0);
  });

  it('reports an error end event whose errorRef points to an error without an errorCode', () => {
    const definition = errorDefinition('bpmn:EndEvent', {
      errorRef: moddleNode({ $type: 'bpmn:Error', id: 'E1', errorCode: ' ' }),
    });
    assert.equal(collectReports(errorEventConfig, definition).length, 1);
  });

  it('passes an error end event with an inline bfw:ErrorCode', () => {
    const definition = errorDefinition('bpmn:EndEvent', {
      extensionElements: withExtension('bfw:ErrorCode', 'VALIDATION_FAILED'),
    });
    assert.equal(collectReports(errorEventConfig, definition).length, 0);
  });

  it('reports an error end event with a blank bfw:ErrorCode', () => {
    const definition = errorDefinition('bpmn:EndEvent', { extensionElements: withExtension('bfw:ErrorCode', '  ') });
    assert.equal(collectReports(errorEventConfig, definition).length, 1);
  });

  it('never reports a catch-all error boundary event', () => {
    assert.equal(collectReports(errorEventConfig, errorDefinition('bpmn:BoundaryEvent')).length, 0);
  });

  it('never reports a catch-all error start event', () => {
    assert.equal(collectReports(errorEventConfig, errorDefinition('bpmn:StartEvent')).length, 0);
  });
});

describe('message-event-reference', () => {
  it('reports a send task without messageRef', () => {
    const reports = collectReports(messageEventReference, moddleNode({ $type: 'bpmn:SendTask', id: 'Send_1' }));
    assert.deepEqual(reports, [{ id: 'Send_1', message: 'Send task must reference a message (EXR-007)' }]);
  });

  it('reports a receive task without messageRef', () => {
    const reports = collectReports(messageEventReference, moddleNode({ $type: 'bpmn:ReceiveTask', id: 'Receive_1' }));
    assert.deepEqual(reports, [{ id: 'Receive_1', message: 'Receive task must reference a message (EXR-007)' }]);
  });

  it('passes a send task with a messageRef', () => {
    const node = moddleNode({
      $type: 'bpmn:SendTask',
      id: 'Send_1',
      messageRef: moddleNode({ $type: 'bpmn:Message' }),
    });
    assert.equal(collectReports(messageEventReference, node).length, 0);
  });

  it('reports a message event definition without messageRef on its event', () => {
    const definition = moddleNode({
      $type: 'bpmn:MessageEventDefinition',
      $parent: moddleNode({ $type: 'bpmn:IntermediateCatchEvent', id: 'Catch_1' }),
    });
    assert.equal(collectReports(messageEventReference, definition)[0].id, 'Catch_1');
  });
});

describe('script-task-config', () => {
  it('reports a script task without script or bfw:ScriptRef', () => {
    const reports = collectReports(scriptTaskConfig, moddleNode({ $type: 'bpmn:ScriptTask', id: 'Script_1' }));
    assert.equal(reports.length, 1);
    assert.match(reports[0].message, /bfw:scriptRef \(EXR-008\)$/);
  });

  it('passes a script task with an inline script and no scriptFormat', () => {
    const node = moddleNode({ $type: 'bpmn:ScriptTask', id: 'Script_1', script: '{ total: 1 }' });
    assert.equal(collectReports(scriptTaskConfig, node).length, 0);
  });

  it('passes a script task with only a bfw:ScriptRef', () => {
    const node = moddleNode({
      $type: 'bpmn:ScriptTask',
      id: 'Script_1',
      extensionElements: withExtension('bfw:ScriptRef', 'my_validation_plugin'),
    });
    assert.equal(collectReports(scriptTaskConfig, node).length, 0);
  });

  it('reports a script task whose script is only whitespace', () => {
    const node = moddleNode({ $type: 'bpmn:ScriptTask', id: 'Script_1', script: '   ' });
    assert.equal(collectReports(scriptTaskConfig, node).length, 1);
  });
});

describe('user-task-assignment', () => {
  it('reports a user task without any assignment', () => {
    const reports = collectReports(userTaskAssignment, moddleNode({ $type: 'bpmn:UserTask', id: 'User_1' }));
    assert.equal(reports.length, 1);
    assert.match(reports[0].message, /bfw:assignees/);
  });

  it('passes a user task with bfw:Assignees', () => {
    const node = moddleNode({
      $type: 'bpmn:UserTask',
      id: 'User_1',
      extensionElements: withExtension('bfw:Assignees', 'identity.groups'),
    });
    assert.equal(collectReports(userTaskAssignment, node).length, 0);
  });

  it('reports a user task with a blank bfw:Assignees', () => {
    const node = moddleNode({
      $type: 'bpmn:UserTask',
      id: 'User_1',
      extensionElements: withExtension('bfw:Assignees', ' '),
    });
    assert.equal(collectReports(userTaskAssignment, node).length, 1);
  });

  it('reports a user task that only has assignments the Engine ignores', () => {
    const node = moddleNode({
      $type: 'bpmn:UserTask',
      id: 'User_1',
      resources: [moddleNode({ $type: 'bpmn:PotentialOwner' })],
      $attrs: { 'camunda:assignee': 'demo' },
    });
    assert.equal(collectReports(userTaskAssignment, node).length, 1);
  });
});

describe('service-task-implementation', () => {
  it('reports a service task without implementation', () => {
    const reports = collectReports(
      serviceTaskImplementation,
      moddleNode({ $type: 'bpmn:ServiceTask', id: 'Service_1' }),
    );
    assert.equal(reports.length, 1);
    assert.equal(reports[0].message, 'Service task must declare an implementation (EXR-003)');
  });

  it('reports a service task that has only foreign attributes and extensions', () => {
    const node = moddleNode({
      $type: 'bpmn:ServiceTask',
      id: 'Service_1',
      $attrs: { 'camunda:type': 'external', 'camunda:topic': 'charge' },
      extensionElements: withExtension('bfw:HttpUrl', 'https://example.com'),
    });
    assert.equal(collectReports(serviceTaskImplementation, node).length, 1);
  });

  it('reports a service task with a blank implementation', () => {
    const node = moddleNode({ $type: 'bpmn:ServiceTask', id: 'Service_1', implementation: '  ' });
    assert.equal(collectReports(serviceTaskImplementation, node).length, 1);
  });

  it('passes a service task with an implementation', () => {
    const node = moddleNode({ $type: 'bpmn:ServiceTask', id: 'Service_1', implementation: 'http' });
    assert.equal(collectReports(serviceTaskImplementation, node).length, 0);
  });
});

describe('process-executable', () => {
  it('reports a process explicitly marked as not executable', () => {
    const reports = collectReports(
      processExecutable,
      moddleNode({ $type: 'bpmn:Process', id: 'Process_1', isExecutable: false }),
    );
    assert.equal(reports.length, 1);
    assert.equal(reports[0].message, 'Process is marked as not executable (EXR-001)');
  });

  it('passes a process without an isExecutable attribute', () => {
    assert.equal(collectReports(processExecutable, moddleNode({ $type: 'bpmn:Process', id: 'Process_1' })).length, 0);
  });

  it('passes a process marked executable', () => {
    const node = moddleNode({ $type: 'bpmn:Process', id: 'Process_1', isExecutable: true });
    assert.equal(collectReports(processExecutable, node).length, 0);
  });
});
