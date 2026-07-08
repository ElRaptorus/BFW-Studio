import assert from 'node:assert';
import { describe, it } from 'vitest';

import cancelEventTransactionScope from '../../../src/modules/bpmn-linter/rules/bpmn-spec/cancel-event-transaction-scope';
import escalationBoundaryHost from '../../../src/modules/bpmn-linter/rules/bpmn-spec/escalation-boundary-host';
import topLevelStartEventType from '../../../src/modules/bpmn-linter/rules/bpmn-spec/top-level-start-event-type';
import type { BpmnlintRuleFactory, ModdleNode } from '../../../src/modules/bpmn-linter/types';

type CapturedReport = { id: string; message: string };

function collectReports(factory: BpmnlintRuleFactory, node: ModdleNode): CapturedReport[] {
  const reports: CapturedReport[] = [];
  const definition = factory();
  const check = definition.check;
  if (typeof check !== 'function') {
    throw new Error('Expected a function check for these rules');
  }
  check(node, { report: (id, message) => reports.push({ id, message }) });
  return reports;
}

function node(type: string, id: string, eventDefinitionType?: string): ModdleNode {
  return {
    $type: type,
    id,
    eventDefinitions: eventDefinitionType ? [{ $type: eventDefinitionType }] : undefined,
  } as unknown as ModdleNode;
}

function withHost(boundary: ModdleNode, hostType?: string): ModdleNode {
  (boundary as { attachedToRef?: ModdleNode }).attachedToRef = hostType
    ? ({ $type: hostType, id: 'Host_1' } as unknown as ModdleNode)
    : undefined;
  return boundary;
}

function withParent(child: ModdleNode, parentType?: string): ModdleNode {
  (child as { $parent?: ModdleNode }).$parent = parentType
    ? ({ $type: parentType, id: 'Parent_1' } as unknown as ModdleNode)
    : undefined;
  return child;
}

describe('escalation-boundary-host', () => {
  it('reports an escalation boundary attached to a plain task', () => {
    const boundary = withHost(node('bpmn:BoundaryEvent', 'Boundary_1', 'bpmn:EscalationEventDefinition'), 'bpmn:Task');
    const reports = collectReports(escalationBoundaryHost, boundary);
    assert.equal(reports.length, 1);
    assert.equal(reports[0].id, 'Boundary_1');
    assert.match(reports[0].message, /call activity or sub-process/i);
  });

  it('passes for an escalation boundary attached to a call activity', () => {
    const boundary = withHost(
      node('bpmn:BoundaryEvent', 'Boundary_1', 'bpmn:EscalationEventDefinition'),
      'bpmn:CallActivity',
    );
    assert.equal(collectReports(escalationBoundaryHost, boundary).length, 0);
  });

  it('passes for an escalation boundary attached to a sub-process', () => {
    const boundary = withHost(
      node('bpmn:BoundaryEvent', 'Boundary_1', 'bpmn:EscalationEventDefinition'),
      'bpmn:SubProcess',
    );
    assert.equal(collectReports(escalationBoundaryHost, boundary).length, 0);
  });

  it('ignores non-escalation boundary events', () => {
    const boundary = withHost(node('bpmn:BoundaryEvent', 'Boundary_1', 'bpmn:TimerEventDefinition'), 'bpmn:Task');
    assert.equal(collectReports(escalationBoundaryHost, boundary).length, 0);
  });

  it('ignores nodes that are not boundary events', () => {
    const event = node('bpmn:IntermediateThrowEvent', 'Throw_1', 'bpmn:EscalationEventDefinition');
    assert.equal(collectReports(escalationBoundaryHost, event).length, 0);
  });
});

describe('cancel-event-transaction-scope', () => {
  it('reports a cancel end event inside a plain process', () => {
    const end = withParent(node('bpmn:EndEvent', 'End_1', 'bpmn:CancelEventDefinition'), 'bpmn:Process');
    const reports = collectReports(cancelEventTransactionScope, end);
    assert.equal(reports.length, 1);
    assert.equal(reports[0].id, 'End_1');
    assert.match(reports[0].message, /transaction sub-process/i);
  });

  it('passes for a cancel end event inside a transaction sub-process', () => {
    const end = withParent(node('bpmn:EndEvent', 'End_1', 'bpmn:CancelEventDefinition'), 'bpmn:Transaction');
    assert.equal(collectReports(cancelEventTransactionScope, end).length, 0);
  });

  it('reports a cancel boundary event on a non-transaction sub-process', () => {
    const boundary = withHost(
      node('bpmn:BoundaryEvent', 'Boundary_1', 'bpmn:CancelEventDefinition'),
      'bpmn:SubProcess',
    );
    const reports = collectReports(cancelEventTransactionScope, boundary);
    assert.equal(reports.length, 1);
    assert.equal(reports[0].id, 'Boundary_1');
    assert.match(reports[0].message, /transaction sub-process/i);
  });

  it('passes for a cancel boundary event on a transaction sub-process', () => {
    const boundary = withHost(
      node('bpmn:BoundaryEvent', 'Boundary_1', 'bpmn:CancelEventDefinition'),
      'bpmn:Transaction',
    );
    assert.equal(collectReports(cancelEventTransactionScope, boundary).length, 0);
  });

  it('ignores non-cancel end and boundary events', () => {
    const end = withParent(node('bpmn:EndEvent', 'End_1', 'bpmn:TerminateEventDefinition'), 'bpmn:Process');
    assert.equal(collectReports(cancelEventTransactionScope, end).length, 0);
    const boundary = withHost(node('bpmn:BoundaryEvent', 'Boundary_1', 'bpmn:TimerEventDefinition'), 'bpmn:Task');
    assert.equal(collectReports(cancelEventTransactionScope, boundary).length, 0);
  });
});

describe('top-level-start-event-type', () => {
  it('reports an error start event at the process root', () => {
    const start = withParent(node('bpmn:StartEvent', 'Start_1', 'bpmn:ErrorEventDefinition'), 'bpmn:Process');
    const reports = collectReports(topLevelStartEventType, start);
    assert.equal(reports.length, 1);
    assert.match(reports[0].message, /unsupported trigger type/i);
  });

  it('reports an escalation start event at the process root', () => {
    const start = withParent(node('bpmn:StartEvent', 'Start_1', 'bpmn:EscalationEventDefinition'), 'bpmn:Process');
    assert.equal(collectReports(topLevelStartEventType, start).length, 1);
  });

  it('reports a compensation start event at the process root', () => {
    const start = withParent(node('bpmn:StartEvent', 'Start_1', 'bpmn:CompensateEventDefinition'), 'bpmn:Process');
    assert.equal(collectReports(topLevelStartEventType, start).length, 1);
  });

  it('passes for a message start event at the process root', () => {
    const start = withParent(node('bpmn:StartEvent', 'Start_1', 'bpmn:MessageEventDefinition'), 'bpmn:Process');
    assert.equal(collectReports(topLevelStartEventType, start).length, 0);
  });

  it('does not flag a conditional start event at the process root (excluded)', () => {
    const start = withParent(node('bpmn:StartEvent', 'Start_1', 'bpmn:ConditionalEventDefinition'), 'bpmn:Process');
    assert.equal(collectReports(topLevelStartEventType, start).length, 0);
  });

  it('ignores typed start events that are not at the process root', () => {
    const start = withParent(node('bpmn:StartEvent', 'Start_1', 'bpmn:ErrorEventDefinition'), 'bpmn:SubProcess');
    assert.equal(collectReports(topLevelStartEventType, start).length, 0);
  });
});
