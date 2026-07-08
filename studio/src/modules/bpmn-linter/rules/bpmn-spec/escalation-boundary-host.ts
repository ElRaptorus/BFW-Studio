import { is } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleNode } from '../../types';

/**
 * Flags an Escalation Boundary Event attached to a host that cannot raise an
 * escalation from an inner scope. Escalations bubble up from a child scope, so
 * an escalation boundary is only meaningful on a Call Activity or a Sub-Process
 * (which includes Transaction and Ad-Hoc sub-processes via moddle inheritance).
 */
export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!is(node, 'bpmn:BoundaryEvent')) {
      return;
    }

    const eventDefinitions = node.eventDefinitions ?? [];
    if (eventDefinitions.length === 0 || eventDefinitions[0].$type !== 'bpmn:EscalationEventDefinition') {
      return;
    }

    const host = node.attachedToRef;
    if (host && (is(host, 'bpmn:CallActivity') || is(host, 'bpmn:SubProcess'))) {
      return;
    }

    reporter.report(node.id, 'Escalation boundary events are only allowed on a call activity or sub-process (BSC-016)');
  }

  return { check };
}
