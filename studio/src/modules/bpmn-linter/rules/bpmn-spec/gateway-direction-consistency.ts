import { isAny } from 'bpmnlint-utils';

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
    if (!isAny(node, GATEWAY_TYPES)) {
      return;
    }
    const incoming = node.incoming?.length ?? 0;
    const outgoing = node.outgoing?.length ?? 0;
    const direction = node.gatewayDirection as string | undefined;

    if (incoming > 1 && outgoing > 1) {
      reporter.report(node.id, 'Gateway must not both join and fork (mixed incoming and outgoing) (BSC-012)');
      return;
    }
    if (direction === 'Converging' && outgoing > 1) {
      reporter.report(node.id, 'Converging gateway must have at most one outgoing flow (BSC-012)');
    }
    if (direction === 'Diverging' && incoming > 1) {
      reporter.report(node.id, 'Diverging gateway must have at most one incoming flow (BSC-012)');
    }
  }

  return { check };
}
