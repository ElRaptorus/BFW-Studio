import assert from 'node:assert';
import { describe, it } from 'vitest';

import complexGatewaySplitConditions from '../../../src/modules/bpmn-linter/rules/execution-readiness/complex-gateway-split-conditions';
import xorGatewayConditions from '../../../src/modules/bpmn-linter/rules/execution-readiness/xor-gateway-conditions';
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

function makeSequenceFlow(id: string, opts: { condition?: string } = {}): ModdleNode {
  return {
    $type: 'bpmn:SequenceFlow',
    id,
    conditionExpression: opts.condition ? { $type: 'bpmn:FormalExpression', body: opts.condition } : undefined,
  } as unknown as ModdleNode;
}

function makeGateway(
  type: 'bpmn:ExclusiveGateway' | 'bpmn:ComplexGateway',
  outgoing: ModdleNode[],
  defaultFlow?: ModdleNode,
): ModdleNode {
  return {
    $type: type,
    id: 'Gateway_1',
    outgoing,
    default: defaultFlow,
  } as unknown as ModdleNode;
}

describe('xor-gateway-conditions', () => {
  it('ignores a gateway with a single outgoing flow', () => {
    const flow = makeSequenceFlow('Flow_1');
    const reports = collectReports(xorGatewayConditions, makeGateway('bpmn:ExclusiveGateway', [flow]));
    assert.equal(reports.length, 0);
  });

  it('reports every unmarked non-default outgoing even when a default exists', () => {
    const defaultFlow = makeSequenceFlow('Flow_default');
    const unmarked = makeSequenceFlow('Flow_unmarked');
    const conditioned = makeSequenceFlow('Flow_ok', { condition: 'token.ok = true' });
    const reports = collectReports(
      xorGatewayConditions,
      makeGateway('bpmn:ExclusiveGateway', [conditioned, unmarked, defaultFlow], defaultFlow),
    );
    assert.equal(reports.length, 1);
    assert.equal(reports[0].id, 'Flow_unmarked');
    assert.match(reports[0].message, /EXR-011/);
  });

  it('reports when there is no default and a flow lacks a condition', () => {
    const sequenceFlowA = makeSequenceFlow('Flow_a', { condition: 'true' });
    const sequenceFlowB = makeSequenceFlow('Flow_b');
    const reports = collectReports(
      xorGatewayConditions,
      makeGateway('bpmn:ExclusiveGateway', [sequenceFlowA, sequenceFlowB]),
    );
    assert.equal(reports.length, 1);
    assert.equal(reports[0].id, 'Flow_b');
  });

  it('passes when every non-default outgoing is conditioned', () => {
    const defaultFlow = makeSequenceFlow('Flow_default');
    const sequenceFlowA = makeSequenceFlow('Flow_a', { condition: 'token.a = true' });
    const reports = collectReports(
      xorGatewayConditions,
      makeGateway('bpmn:ExclusiveGateway', [sequenceFlowA, defaultFlow], defaultFlow),
    );
    assert.equal(reports.length, 0);
  });
});

describe('complex-gateway-split-conditions', () => {
  it('ignores a join (single outgoing)', () => {
    const flow = makeSequenceFlow('Flow_1');
    const reports = collectReports(complexGatewaySplitConditions, makeGateway('bpmn:ComplexGateway', [flow]));
    assert.equal(reports.length, 0);
  });

  it('reports every unmarked non-default split outgoing even when a default exists', () => {
    const defaultFlow = makeSequenceFlow('Flow_default');
    const unmarked = makeSequenceFlow('Flow_unmarked');
    const conditioned = makeSequenceFlow('Flow_ok', { condition: 'token.ok = true' });
    const reports = collectReports(
      complexGatewaySplitConditions,
      makeGateway('bpmn:ComplexGateway', [conditioned, unmarked, defaultFlow], defaultFlow),
    );
    assert.equal(reports.length, 1);
    assert.equal(reports[0].id, 'Flow_unmarked');
    assert.match(reports[0].message, /EXR-015/);
  });

  it('does not report exclusive gateways', () => {
    const sequenceFlowA = makeSequenceFlow('Flow_a');
    const sequenceFlowB = makeSequenceFlow('Flow_b');
    const reports = collectReports(
      complexGatewaySplitConditions,
      makeGateway('bpmn:ExclusiveGateway', [sequenceFlowA, sequenceFlowB]),
    );
    assert.equal(reports.length, 0);
  });
});
