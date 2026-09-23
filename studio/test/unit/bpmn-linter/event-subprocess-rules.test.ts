import assert from 'node:assert';
import { describe, it } from 'vitest';

import eventSubprocessSingleStartEvent from '../../../src/modules/bpmn-linter/rules/bpmn-spec/event-subprocess-single-start-event';
import eventSubprocessStartEventType from '../../../src/modules/bpmn-linter/rules/bpmn-spec/event-subprocess-start-event-type';
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

function startEvent(id: string, eventDefinitionType?: string, isInterrupting?: boolean): ModdleNode {
  return {
    $type: 'bpmn:StartEvent',
    id,
    eventDefinitions: eventDefinitionType ? [{ $type: eventDefinitionType }] : undefined,
    isInterrupting,
  } as unknown as ModdleNode;
}

function eventSubProcess(id: string, startEvents: ModdleNode[]): ModdleNode {
  return {
    $type: 'bpmn:SubProcess',
    id,
    triggeredByEvent: true,
    flowElements: startEvents,
  } as unknown as ModdleNode;
}

describe('event-subprocess-single-start-event', () => {
  it('passes for exactly one start event', () => {
    const node = eventSubProcess('ESP_1', [startEvent('Start_1', 'bpmn:MessageEventDefinition')]);
    assert.equal(collectReports(eventSubprocessSingleStartEvent, node).length, 0);
  });

  it('reports when there are zero start events', () => {
    const node = eventSubProcess('ESP_1', []);
    const reports = collectReports(eventSubprocessSingleStartEvent, node);
    assert.equal(reports.length, 1);
    assert.equal(reports[0].id, 'ESP_1');
    assert.match(reports[0].message, /none/i);
  });

  it('reports when there are multiple start events', () => {
    const node = eventSubProcess('ESP_1', [
      startEvent('Start_1', 'bpmn:MessageEventDefinition'),
      startEvent('Start_2', 'bpmn:TimerEventDefinition'),
    ]);
    const reports = collectReports(eventSubprocessSingleStartEvent, node);
    assert.equal(reports.length, 1);
    assert.match(reports[0].message, /2/);
  });

  it('ignores non-event subprocesses', () => {
    const node = {
      $type: 'bpmn:SubProcess',
      id: 'SP_1',
      triggeredByEvent: false,
      flowElements: [],
    } as unknown as ModdleNode;
    assert.equal(collectReports(eventSubprocessSingleStartEvent, node).length, 0);
  });
});

describe('event-subprocess-start-event-type', () => {
  function espStart(eventDefinitionType?: string, isInterrupting?: boolean): ModdleNode {
    const start = startEvent('Start_1', eventDefinitionType, isInterrupting);
    (start as { $parent?: ModdleNode }).$parent = {
      $type: 'bpmn:SubProcess',
      id: 'ESP_1',
      triggeredByEvent: true,
    } as unknown as ModdleNode;
    return start;
  }

  it('passes for a supported interrupting trigger (message)', () => {
    assert.equal(collectReports(eventSubprocessStartEventType, espStart('bpmn:MessageEventDefinition')).length, 0);
  });

  it('passes for a supported non-interrupting trigger (escalation)', () => {
    assert.equal(
      collectReports(eventSubprocessStartEventType, espStart('bpmn:EscalationEventDefinition', false)).length,
      0,
    );
  });

  it('passes for a compensation start', () => {
    assert.equal(collectReports(eventSubprocessStartEventType, espStart('bpmn:CompensateEventDefinition')).length, 0);
  });

  it('reports an unsupported trigger type (link)', () => {
    const reports = collectReports(eventSubprocessStartEventType, espStart('bpmn:LinkEventDefinition'));
    assert.equal(reports.length, 1);
    assert.match(reports[0].message, /unsupported trigger type/i);
  });

  it('passes for an interrupting error start (default isInterrupting)', () => {
    assert.equal(collectReports(eventSubprocessStartEventType, espStart('bpmn:ErrorEventDefinition')).length, 0);
  });

  it('reports a non-interrupting error start', () => {
    const reports = collectReports(eventSubprocessStartEventType, espStart('bpmn:ErrorEventDefinition', false));
    assert.equal(reports.length, 1);
    assert.match(reports[0].message, /must be interrupting/i);
  });

  it('defers the blank/untyped start to the built-in rule (no report)', () => {
    assert.equal(collectReports(eventSubprocessStartEventType, espStart(undefined)).length, 0);
  });

  it('ignores start events that are not inside an event subprocess', () => {
    const start = startEvent('Start_1', 'bpmn:CompensateEventDefinition');
    (start as { $parent?: ModdleNode }).$parent = {
      $type: 'bpmn:SubProcess',
      id: 'SP_1',
      triggeredByEvent: false,
    } as unknown as ModdleNode;
    assert.equal(collectReports(eventSubprocessStartEventType, start).length, 0);
  });
});
