import assert from 'node:assert';
import { describe, it } from 'vitest';

import multiInstanceConfig from '../../../src/modules/bpmn-linter/rules/execution-readiness/multi-instance-config';
import standardLoopConfig from '../../../src/modules/bpmn-linter/rules/execution-readiness/standard-loop-config';
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

function makeExtension(type: string, body?: string): ModdleNode {
  return { $type: type, body } as unknown as ModdleNode;
}

function makeServiceTaskWithMI(opts: {
  inputCollection?: string;
  inputDataItem?: boolean;
  loopDataInputRef?: boolean;
  loopCardinality?: boolean;
  maxIterations?: string;
  camundaCollection?: string;
}): ModdleNode {
  const extensions: ModdleNode[] = [];
  if (opts.inputCollection != null) {
    extensions.push(makeExtension('evil:InputCollection', opts.inputCollection));
  }
  if (opts.maxIterations != null) {
    extensions.push(makeExtension('evil:MaxIterations', opts.maxIterations));
  }

  const loop: Record<string, unknown> = {
    $type: 'bpmn:MultiInstanceLoopCharacteristics',
    extensionElements: extensions.length > 0 ? { values: extensions } : undefined,
  };
  if (opts.inputDataItem) {
    loop.inputDataItem = { $type: 'bpmn:DataInput', id: 'di_1' };
  }
  if (opts.loopDataInputRef) {
    loop.loopDataInputRef = { $type: 'bpmn:DataInput', id: 'ldi_1' };
  }
  if (opts.loopCardinality) {
    loop.loopCardinality = { $type: 'bpmn:FormalExpression', body: '5' };
  }
  if (opts.camundaCollection) {
    loop.$attrs = { 'camunda:collection': opts.camundaCollection };
  }

  return {
    $type: 'bpmn:ServiceTask',
    id: 'Task_1',
    loopCharacteristics: loop,
  } as unknown as ModdleNode;
}

function makeServiceTaskWithStandardLoop(opts: { loopCondition?: string; loopMaximum?: string }): ModdleNode {
  const loop: Record<string, unknown> = {
    $type: 'bpmn:StandardLoopCharacteristics',
  };
  if (opts.loopCondition != null) {
    loop.loopCondition = { $type: 'bpmn:FormalExpression', body: opts.loopCondition };
  }
  if (opts.loopMaximum !== undefined) {
    loop.loopMaximum = opts.loopMaximum;
  }

  return {
    $type: 'bpmn:ServiceTask',
    id: 'Task_1',
    loopCharacteristics: loop,
  } as unknown as ModdleNode;
}

// ---------------------------------------------------------------------------
// multi-instance-config (EXR-010)
// ---------------------------------------------------------------------------

describe('multi-instance-config', () => {
  it('reports when no collection source is defined', () => {
    const node = makeServiceTaskWithMI({});
    const reports = collectReports(multiInstanceConfig, node);
    assert.equal(reports.length, 1);
    assert.match(reports[0].message, /Input Collection/);
  });

  it('passes with evil:InputCollection', () => {
    const node = makeServiceTaskWithMI({ inputCollection: 'token.items' });
    const reports = collectReports(multiInstanceConfig, node);
    assert.equal(reports.length, 0);
  });

  it('passes with inputDataItem', () => {
    const node = makeServiceTaskWithMI({ inputDataItem: true });
    const reports = collectReports(multiInstanceConfig, node);
    assert.equal(reports.length, 0);
  });

  it('passes with loopDataInputRef', () => {
    const node = makeServiceTaskWithMI({ loopDataInputRef: true });
    const reports = collectReports(multiInstanceConfig, node);
    assert.equal(reports.length, 0);
  });

  it('passes with camunda:collection', () => {
    const node = makeServiceTaskWithMI({ camundaCollection: '${items}' });
    const reports = collectReports(multiInstanceConfig, node);
    assert.equal(reports.length, 0);
  });

  it('reports deprecation when loopCardinality is present', () => {
    const node = makeServiceTaskWithMI({ inputCollection: 'token.items', loopCardinality: true });
    const reports = collectReports(multiInstanceConfig, node);
    assert.equal(reports.length, 1);
    assert.match(reports[0].message, /loopCardinality/);
  });

  it('reports when maxIterations is not a positive integer', () => {
    const node = makeServiceTaskWithMI({ inputCollection: 'token.items', maxIterations: '-5' });
    const reports = collectReports(multiInstanceConfig, node);
    assert.equal(reports.length, 1);
    assert.match(reports[0].message, /maxIterations/);
  });

  it('reports when maxIterations is not a number', () => {
    const node = makeServiceTaskWithMI({ inputCollection: 'token.items', maxIterations: 'abc' });
    const reports = collectReports(multiInstanceConfig, node);
    assert.equal(reports.length, 1);
    assert.match(reports[0].message, /maxIterations/);
  });

  it('passes with a valid maxIterations value', () => {
    const node = makeServiceTaskWithMI({ inputCollection: 'token.items', maxIterations: '100' });
    const reports = collectReports(multiInstanceConfig, node);
    assert.equal(reports.length, 0);
  });

  it('ignores non-activity types', () => {
    const node = {
      $type: 'bpmn:ExclusiveGateway',
      id: 'GW_1',
      loopCharacteristics: { $type: 'bpmn:MultiInstanceLoopCharacteristics' },
    } as unknown as ModdleNode;
    const reports = collectReports(multiInstanceConfig, node);
    assert.equal(reports.length, 0);
  });

  it('ignores activities without MI loop characteristics', () => {
    const node = {
      $type: 'bpmn:ServiceTask',
      id: 'Task_1',
    } as unknown as ModdleNode;
    const reports = collectReports(multiInstanceConfig, node);
    assert.equal(reports.length, 0);
  });
});

// ---------------------------------------------------------------------------
// standard-loop-config (EXR-013)
// ---------------------------------------------------------------------------

describe('standard-loop-config', () => {
  it('reports when no loop condition is defined', () => {
    const node = makeServiceTaskWithStandardLoop({});
    const reports = collectReports(standardLoopConfig, node);
    const conditionReport = reports.find((report) => report.message.includes('loop condition'));
    assert.ok(conditionReport, 'Expected a report about missing loop condition');
  });

  it('reports when loop condition is empty', () => {
    const node = makeServiceTaskWithStandardLoop({ loopCondition: '   ' });
    const reports = collectReports(standardLoopConfig, node);
    const conditionReport = reports.find((report) => report.message.includes('loop condition'));
    assert.ok(conditionReport, 'Expected a report about missing loop condition');
  });

  it('passes with a valid loop condition', () => {
    const node = makeServiceTaskWithStandardLoop({ loopCondition: 'loop.completed < 5' });
    const reports = collectReports(standardLoopConfig, node);
    const conditionReport = reports.find((report) => report.message.includes('loop condition'));
    assert.equal(conditionReport, undefined, 'Should not report missing loop condition');
  });

  it('reports advisory when loopMaximum is absent', () => {
    const node = makeServiceTaskWithStandardLoop({ loopCondition: 'loop.completed < 5' });
    const reports = collectReports(standardLoopConfig, node);
    const maxReport = reports.find((report) => report.message.includes('maximum iteration limit'));
    assert.ok(maxReport, 'Expected an advisory about missing loopMaximum');
  });

  it('passes with a valid loopMaximum', () => {
    const node = makeServiceTaskWithStandardLoop({ loopCondition: 'loop.completed < 5', loopMaximum: '10' });
    const reports = collectReports(standardLoopConfig, node);
    assert.equal(reports.length, 0);
  });

  it('reports when loopMaximum is not a positive integer', () => {
    const node = makeServiceTaskWithStandardLoop({ loopCondition: 'loop.completed < 5', loopMaximum: '0' });
    const reports = collectReports(standardLoopConfig, node);
    const maxReport = reports.find((report) => report.message.includes('loopMaximum'));
    assert.ok(maxReport, 'Expected a report about invalid loopMaximum');
  });

  it('reports when loopMaximum is not a number', () => {
    const node = makeServiceTaskWithStandardLoop({ loopCondition: 'loop.completed < 5', loopMaximum: 'xyz' });
    const reports = collectReports(standardLoopConfig, node);
    const maxReport = reports.find((report) => report.message.includes('loopMaximum'));
    assert.ok(maxReport, 'Expected a report about invalid loopMaximum');
  });

  it('ignores non-activity types', () => {
    const node = {
      $type: 'bpmn:ExclusiveGateway',
      id: 'GW_1',
      loopCharacteristics: { $type: 'bpmn:StandardLoopCharacteristics' },
    } as unknown as ModdleNode;
    const reports = collectReports(standardLoopConfig, node);
    assert.equal(reports.length, 0);
  });

  it('ignores activities without standard loop characteristics', () => {
    const node = {
      $type: 'bpmn:ServiceTask',
      id: 'Task_1',
    } as unknown as ModdleNode;
    const reports = collectReports(standardLoopConfig, node);
    assert.equal(reports.length, 0);
  });
});
