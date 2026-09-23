import { is, isAny } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleNode } from '../../types';

const CONDITION_EVALUATING_GATEWAY_TYPES = ['bpmn:ExclusiveGateway', 'bpmn:InclusiveGateway', 'bpmn:ComplexGateway'];

/**
 * The Engine evaluates sequence-flow conditions only on the split path of an
 * Exclusive, Inclusive, or Complex gateway (at most one incoming flow). Every
 * other condition is ignored and the flow is followed unconditionally.
 */
export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!is(node, 'bpmn:SequenceFlow')) {
      return;
    }
    if (!node.conditionExpression) {
      return;
    }
    const source = node.sourceRef;
    if (!source) {
      return;
    }
    const isSplitGateway = isAny(source, CONDITION_EVALUATING_GATEWAY_TYPES) && (source.incoming?.length ?? 0) <= 1;
    if (!isSplitGateway) {
      reporter.report(
        node.id,
        'Condition is ignored by the Engine: conditions are only evaluated on flows leaving an exclusive, inclusive, or complex split gateway (AST-019)',
      );
    }
  }

  return { check };
}
