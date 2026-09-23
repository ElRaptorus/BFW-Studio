import assert from 'node:assert';
import { describe, it } from 'vitest';

import {
  adhocSubprocessActivities,
  adhocSubprocessEventScope,
  adhocSubprocessFlowEvents,
  adhocSubprocessNesting,
} from '../../../src/modules/bpmn-linter/rules/bpmn-spec/adhoc-subprocess-structure';
import {
  adhocSubprocessCompletion,
  adhocSubprocessOrdering,
} from '../../../src/modules/bpmn-linter/rules/execution-readiness/adhoc-subprocess-config';
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

const structureRules = [
  adhocSubprocessFlowEvents,
  adhocSubprocessActivities,
  adhocSubprocessNesting,
  adhocSubprocessEventScope,
];

describe('adhoc subprocess structure', () => {
  it('passes for a valid ad-hoc subprocess with one activity', () => {
    const node = adHocSubProcess('AdHoc_1', [task('Task_1')]);
    for (const rule of structureRules) {
      assert.equal(collectReports(rule, node).length, 0);
    }
  });

  it('reports a Start Event inside the ad-hoc subprocess', () => {
    const node = adHocSubProcess('AdHoc_1', [task('Task_1'), startEvent('Start_1')]);
    const reports = collectReports(adhocSubprocessFlowEvents, node);
    assert.equal(reports.length, 1);
    assert.match(reports[0].message, /must not contain Start or End Events/i);
  });

  it('reports an End Event inside the ad-hoc subprocess', () => {
    const node = adHocSubProcess('AdHoc_1', [task('Task_1'), endEvent('End_1')]);
    const reports = collectReports(adhocSubprocessFlowEvents, node);
    assert.equal(reports.length, 1);
    assert.match(reports[0].message, /must not contain Start or End Events/i);
  });

  it('reports an empty ad-hoc subprocess (no activities)', () => {
    const node = adHocSubProcess('AdHoc_1', []);
    const reports = collectReports(adhocSubprocessActivities, node);
    assert.equal(reports.length, 1);
    assert.match(reports[0].message, /at least one activity/i);
  });

  it('reports a nested ad-hoc subprocess', () => {
    const inner = adHocSubProcess('AdHoc_inner', [task('Task_1')]);
    const node = adHocSubProcess('AdHoc_outer', [task('Task_2'), inner]);
    const reports = collectReports(adhocSubprocessNesting, node);
    assert.equal(reports.length, 1);
    assert.match(reports[0].message, /cannot be nested/i);
  });

  it('reports an ad-hoc subprocess inside an event subprocess', () => {
    const espParent = eventSubProcess('ESP_1', []);
    const node = adHocSubProcess('AdHoc_1', [task('Task_1')], {}, espParent);
    const reports = collectReports(adhocSubprocessEventScope, node);
    assert.equal(reports.length, 1);
    assert.match(reports[0].message, /not supported inside an event subprocess/i);
  });

  it('ignores non-ad-hoc subprocesses', () => {
    const node = { $type: 'bpmn:SubProcess', id: 'SP_1', flowElements: [] } as unknown as ModdleNode;
    for (const rule of structureRules) {
      assert.equal(collectReports(rule, node).length, 0);
    }
  });
});

describe('adhoc-subprocess-completion', () => {
  it('passes for a fully configured parallel ad-hoc subprocess', () => {
    const node = adHocSubProcess('AdHoc_1', [task('Task_1')], {
      ordering: 'Parallel',
      completionCondition: { $type: 'bpmn:FormalExpression', body: 'activeCount = 0' },
    });
    assert.equal(collectReports(adhocSubprocessCompletion, node).length, 0);
    assert.equal(collectReports(adhocSubprocessOrdering, node).length, 0);
  });

  it('reports a missing completion condition and implementation', () => {
    const node = adHocSubProcess('AdHoc_1', [task('Task_1')], { ordering: 'Parallel' });
    const reports = collectReports(adhocSubprocessCompletion, node);
    assert.equal(reports.length, 1);
    assert.ok(reports.some((report) => /no completion condition and no implementation/i.test(report.message)));
    assert.equal(collectReports(adhocSubprocessOrdering, node).length, 0);
  });

  it('reports an empty implementation attribute', () => {
    const node = adHocSubProcess('AdHoc_1', [task('Task_1')], { ordering: 'Parallel', implementation: '' });
    const reports = collectReports(adhocSubprocessCompletion, node);
    assert.ok(reports.some((report) => /empty implementation attribute/i.test(report.message)));
  });

  it('ignores non-ad-hoc subprocesses', () => {
    const node = { $type: 'bpmn:SubProcess', id: 'SP_1' } as unknown as ModdleNode;
    assert.equal(collectReports(adhocSubprocessCompletion, node).length, 0);
  });
});

describe('adhoc-subprocess-ordering', () => {
  it('reports missing bfw:ActiveElements for sequential engine-managed mode', () => {
    const node = adHocSubProcess('AdHoc_1', [task('Task_1')], { ordering: 'Sequential' });
    const reports = collectReports(adhocSubprocessOrdering, node);
    assert.equal(reports.length, 1);
    assert.ok(reports.some((report) => /requires an bfw:ActiveElements expression/i.test(report.message)));
  });

  it('passes sequential mode when bfw:ActiveElements is present', () => {
    const node = adHocSubProcess('AdHoc_1', [task('Task_1')], {
      ordering: 'Sequential',
      completionCondition: { $type: 'bpmn:FormalExpression', body: 'activeCount = 0' },
      extensionElements: {
        values: [{ $type: 'bfw:ActiveElements', body: '["Task_1"]' }],
      },
    });
    const reports = collectReports(adhocSubprocessOrdering, node);
    assert.ok(!reports.some((report) => /requires an bfw:ActiveElements expression/i.test(report.message)));
  });

  it('passes sequential mode when an implementation is set (plugin-managed)', () => {
    const node = adHocSubProcess('AdHoc_1', [task('Task_1')], {
      ordering: 'Sequential',
      completionCondition: { $type: 'bpmn:FormalExpression', body: 'activeCount = 0' },
      implementation: 'my-plugin',
    });
    const reports = collectReports(adhocSubprocessOrdering, node);
    assert.ok(!reports.some((report) => /requires an bfw:ActiveElements expression/i.test(report.message)));
  });

  it('reports when ordering is not explicitly set', () => {
    const node = adHocSubProcess('AdHoc_1', [task('Task_1')], {
      completionCondition: { $type: 'bpmn:FormalExpression', body: 'activeCount = 0' },
    });
    const reports = collectReports(adhocSubprocessOrdering, node);
    assert.equal(reports.length, 1);
    assert.ok(reports.some((report) => /no explicit ordering/i.test(report.message)));
    assert.equal(collectReports(adhocSubprocessCompletion, node).length, 0);
  });

  it('ignores non-ad-hoc subprocesses', () => {
    const node = { $type: 'bpmn:SubProcess', id: 'SP_1' } as unknown as ModdleNode;
    assert.equal(collectReports(adhocSubprocessOrdering, node).length, 0);
  });
});
