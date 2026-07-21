import assert from 'node:assert';
import { describe, it } from 'vitest';

import adhocSubprocessStructure from '../../../src/modules/bpmn-linter/rules/bpmn-spec/adhoc-subprocess-structure';
import adhocSubprocessConfig from '../../../src/modules/bpmn-linter/rules/execution-readiness/adhoc-subprocess-config';
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

function adHocSubProcess(
  id: string,
  flowElements: ModdleNode[],
  extra?: Partial<ModdleNode>,
  parent?: ModdleNode,
): ModdleNode {
  return {
    $type: 'bpmn:AdHocSubProcess',
    id,
    flowElements,
    $parent: parent,
    ...extra,
  } as unknown as ModdleNode;
}

function eventSubProcess(id: string, flowElements: ModdleNode[]): ModdleNode {
  return {
    $type: 'bpmn:SubProcess',
    id,
    triggeredByEvent: true,
    flowElements,
  } as unknown as ModdleNode;
}

describe('adhoc-subprocess-structure', () => {
  it('passes for a valid ad-hoc subprocess with one activity', () => {
    const node = adHocSubProcess('AdHoc_1', [task('Task_1')]);
    assert.equal(collectReports(adhocSubprocessStructure, node).length, 0);
  });

  it('reports a Start Event inside the ad-hoc subprocess', () => {
    const node = adHocSubProcess('AdHoc_1', [task('Task_1'), startEvent('Start_1')]);
    const reports = collectReports(adhocSubprocessStructure, node);
    assert.ok(reports.some((report) => /must not contain Start Events/i.test(report.message)));
  });

  it('reports an End Event inside the ad-hoc subprocess', () => {
    const node = adHocSubProcess('AdHoc_1', [task('Task_1'), endEvent('End_1')]);
    const reports = collectReports(adhocSubprocessStructure, node);
    assert.ok(reports.some((report) => /must not contain End Events/i.test(report.message)));
  });

  it('reports an empty ad-hoc subprocess (no activities)', () => {
    const node = adHocSubProcess('AdHoc_1', []);
    const reports = collectReports(adhocSubprocessStructure, node);
    assert.ok(reports.some((report) => /at least one activity/i.test(report.message)));
  });

  it('reports a nested ad-hoc subprocess', () => {
    const inner = adHocSubProcess('AdHoc_inner', [task('Task_1')]);
    const node = adHocSubProcess('AdHoc_outer', [task('Task_2'), inner]);
    const reports = collectReports(adhocSubprocessStructure, node);
    assert.ok(reports.some((report) => /cannot be nested/i.test(report.message)));
  });

  it('reports an ad-hoc subprocess inside an event subprocess', () => {
    const espParent = eventSubProcess('ESP_1', []);
    const node = adHocSubProcess('AdHoc_1', [task('Task_1')], {}, espParent);
    const reports = collectReports(adhocSubprocessStructure, node);
    assert.ok(reports.some((report) => /not supported inside event sub-processes/i.test(report.message)));
  });

  it('ignores non-ad-hoc subprocesses', () => {
    const node = { $type: 'bpmn:SubProcess', id: 'SP_1', flowElements: [] } as unknown as ModdleNode;
    assert.equal(collectReports(adhocSubprocessStructure, node).length, 0);
  });
});

describe('adhoc-subprocess-config', () => {
  it('passes for a fully configured parallel ad-hoc subprocess', () => {
    const node = adHocSubProcess('AdHoc_1', [task('Task_1')], {
      ordering: 'Parallel',
      completionCondition: { $type: 'bpmn:FormalExpression', body: 'activeCount = 0' },
    });
    assert.equal(collectReports(adhocSubprocessConfig, node).length, 0);
  });

  it('warns when there is no completion condition and no implementation', () => {
    const node = adHocSubProcess('AdHoc_1', [task('Task_1')], { ordering: 'Parallel' });
    const reports = collectReports(adhocSubprocessConfig, node);
    assert.ok(reports.some((report) => /no completion condition and no implementation/i.test(report.message)));
  });

  it('reports an empty implementation attribute', () => {
    const node = adHocSubProcess('AdHoc_1', [task('Task_1')], { ordering: 'Parallel', implementation: '' });
    const reports = collectReports(adhocSubprocessConfig, node);
    assert.ok(reports.some((report) => /empty implementation attribute/i.test(report.message)));
  });

  it('reports missing evil:ActiveElements for sequential engine-managed mode', () => {
    const node = adHocSubProcess('AdHoc_1', [task('Task_1')], { ordering: 'Sequential' });
    const reports = collectReports(adhocSubprocessConfig, node);
    assert.ok(reports.some((report) => /requires an evil:ActiveElements expression/i.test(report.message)));
  });

  it('passes sequential mode when evil:ActiveElements is present', () => {
    const node = adHocSubProcess('AdHoc_1', [task('Task_1')], {
      ordering: 'Sequential',
      completionCondition: { $type: 'bpmn:FormalExpression', body: 'activeCount = 0' },
      extensionElements: {
        values: [{ $type: 'evil:ActiveElements', body: '["Task_1"]' }],
      },
    });
    const reports = collectReports(adhocSubprocessConfig, node);
    assert.ok(!reports.some((report) => /requires an evil:ActiveElements expression/i.test(report.message)));
  });

  it('passes sequential mode when an implementation is set (plugin-managed)', () => {
    const node = adHocSubProcess('AdHoc_1', [task('Task_1')], {
      ordering: 'Sequential',
      completionCondition: { $type: 'bpmn:FormalExpression', body: 'activeCount = 0' },
      implementation: 'my-plugin',
    });
    const reports = collectReports(adhocSubprocessConfig, node);
    assert.ok(!reports.some((report) => /requires an evil:ActiveElements expression/i.test(report.message)));
  });

  it('warns when ordering is not explicitly set', () => {
    const node = adHocSubProcess('AdHoc_1', [task('Task_1')], {
      completionCondition: { $type: 'bpmn:FormalExpression', body: 'activeCount = 0' },
    });
    const reports = collectReports(adhocSubprocessConfig, node);
    assert.ok(reports.some((report) => /no explicit ordering/i.test(report.message)));
  });

  it('ignores non-ad-hoc subprocesses', () => {
    const node = { $type: 'bpmn:SubProcess', id: 'SP_1' } as unknown as ModdleNode;
    assert.equal(collectReports(adhocSubprocessConfig, node).length, 0);
  });
});
