import assert from 'node:assert';
import { describe, it } from 'vitest';

import unreachableElements from '../../../src/modules/bpmn-linter/rules/structure/unreachable-elements';
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

function task(id: string): ModdleNode {
  return { $type: 'bpmn:Task', id } as unknown as ModdleNode;
}

function startEvent(id: string): ModdleNode {
  return { $type: 'bpmn:StartEvent', id } as unknown as ModdleNode;
}

function endEvent(id: string): ModdleNode {
  return { $type: 'bpmn:EndEvent', id } as unknown as ModdleNode;
}

function sequenceFlow(id: string, source: ModdleNode, target: ModdleNode): ModdleNode {
  return { $type: 'bpmn:SequenceFlow', id, sourceRef: source, targetRef: target } as unknown as ModdleNode;
}

function process(flowElements: ModdleNode[]): ModdleNode {
  return { $type: 'bpmn:Process', id: 'Process_1', flowElements } as unknown as ModdleNode;
}

describe('unreachable-elements', () => {
  it('does not report activities inside an ad-hoc subprocess', () => {
    const innerTask = task('Task_inner');
    const start = startEvent('Start_1');
    const adHoc = {
      $type: 'bpmn:AdHocSubProcess',
      id: 'AdHoc_1',
      flowElements: [innerTask],
    } as unknown as ModdleNode;
    const reports = collectReports(unreachableElements, process([start, adHoc, sequenceFlow('Flow_1', start, adHoc)]));

    assert.equal(
      reports.some((report) => report.id === 'Task_inner'),
      false,
    );
    assert.equal(
      reports.some((report) => report.id === 'AdHoc_1'),
      false,
    );
  });

  it('still reports an ad-hoc subprocess that its parent cannot reach', () => {
    const innerTask = task('Task_inner');
    const start = startEvent('Start_1');
    const end = endEvent('End_1');
    const adHoc = {
      $type: 'bpmn:AdHocSubProcess',
      id: 'AdHoc_1',
      flowElements: [innerTask],
    } as unknown as ModdleNode;
    const reports = collectReports(
      unreachableElements,
      process([start, end, adHoc, sequenceFlow('Flow_1', start, end)]),
    );

    assert.deepEqual(
      reports.map((report) => report.id),
      ['AdHoc_1'],
    );
  });

  it('does not report a compensation handler without sequence flows', () => {
    const start = startEvent('Start_1');
    const end = endEvent('End_1');
    const handler = { $type: 'bpmn:Task', id: 'Task_handler', isForCompensation: true } as unknown as ModdleNode;
    const reports = collectReports(
      unreachableElements,
      process([start, end, handler, sequenceFlow('Flow_1', start, end)]),
    );

    assert.deepEqual(reports, []);
  });

  it('still reports an activity inside an embedded subprocess that the inner scope cannot reach', () => {
    const innerTask = task('Task_inner');
    const start = startEvent('Start_1');
    const subprocess = {
      $type: 'bpmn:SubProcess',
      id: 'Sub_1',
      flowElements: [innerTask],
    } as unknown as ModdleNode;
    const reports = collectReports(
      unreachableElements,
      process([start, subprocess, sequenceFlow('Flow_1', start, subprocess)]),
    );

    assert.deepEqual(
      reports.map((report) => report.id),
      ['Task_inner'],
    );
  });
});
