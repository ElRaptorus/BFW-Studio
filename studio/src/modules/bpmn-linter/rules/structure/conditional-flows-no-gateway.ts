import { is, isAny } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleNode } from '../../types';

const GATEWAY_TYPES = [
  'bpmn:ExclusiveGateway',
  'bpmn:InclusiveGateway',
  'bpmn:ParallelGateway',
  'bpmn:ComplexGateway',
  'bpmn:EventBasedGateway',
];

export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!is(node, 'bpmn:SequenceFlow')) {
      return;
    }
    if (!node.conditionExpression) {
      return;
    }
    const source = node.sourceRef;
    if (source && !isAny(source, GATEWAY_TYPES)) {
      reporter.report(
        node.id,
        'Conditional sequence flow should originate from a gateway, not directly from this element (AST-019)',
      );
    }
  }

  return { check };
}
