import { is } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleNode } from '../../types';

export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!is(node, 'bpmn:SubProcess') || !node.triggeredByEvent) {
      return;
    }
    const incoming = node.incoming?.length ?? 0;
    const outgoing = node.outgoing?.length ?? 0;
    if (incoming > 0 || outgoing > 0) {
      reporter.report(
        node.id,
        'Event sub-process must not have incoming or outgoing sequence flows crossing its boundary (BSC-005)',
      );
    }
  }

  return { check };
}
