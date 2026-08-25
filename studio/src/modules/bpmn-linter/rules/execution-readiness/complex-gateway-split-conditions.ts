import { is } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleNode } from '../../types';

function isDefaultOutgoing(flow: ModdleNode, defaultFlow: ModdleNode | undefined): boolean {
  if (!defaultFlow) {
    return false;
  }
  if (flow === defaultFlow) {
    return true;
  }
  return Boolean(flow.id && defaultFlow.id && flow.id === defaultFlow.id);
}

export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!is(node, 'bpmn:ComplexGateway')) {
      return;
    }
    const outgoing = node.outgoing || [];
    if (outgoing.length <= 1) {
      return;
    }
    const defaultFlow = node.default;
    for (const flow of outgoing) {
      if (isDefaultOutgoing(flow, defaultFlow)) {
        continue;
      }
      if (!flow?.conditionExpression) {
        reporter.report(
          flow.id ?? node.id,
          'Complex gateway split outgoing flow must have a condition or be the default flow (EXR-015)',
        );
      }
    }
  }

  return { check };
}
