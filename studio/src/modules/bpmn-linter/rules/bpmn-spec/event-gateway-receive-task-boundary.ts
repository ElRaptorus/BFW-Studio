import { is } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleNode } from '../../types';

export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!is(node, 'bpmn:ReceiveTask')) {
      return;
    }
    const followsEventBasedGateway = ((node.incoming as ModdleNode[] | undefined) ?? []).some(
      (flow) => flow.sourceRef && is(flow.sourceRef, 'bpmn:EventBasedGateway'),
    );
    if (!followsEventBasedGateway) {
      return;
    }
    const siblings = (node.$parent?.flowElements as ModdleNode[] | undefined) ?? [];
    const hasBoundaryEvent = siblings.some(
      (element) => is(element, 'bpmn:BoundaryEvent') && element.attachedToRef?.id === node.id,
    );
    if (hasBoundaryEvent) {
      reporter.report(
        node.id,
        'Receive task after an event-based gateway must not have boundary events attached (BSC-024)',
      );
    }
  }

  return { check };
}
