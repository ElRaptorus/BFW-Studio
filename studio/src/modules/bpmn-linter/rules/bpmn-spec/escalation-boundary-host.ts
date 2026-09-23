import { is } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleNode } from '../../types';

function humanizeElementType(elementType: string): string {
  return elementType
    .replace(/^bpmn:/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase();
}

/**
 * Hints at an Escalation Boundary Event attached to a host other than a Call
 * Activity or a Sub-Process (which includes Transaction and Ad-Hoc sub-processes
 * via moddle inheritance). Modeled escalations bubble up only from a child scope,
 * so on other hosts the boundary fires only on an escalation injected through the
 * REST API or a plugin.
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
    if (!host || is(host, 'bpmn:CallActivity') || is(host, 'bpmn:SubProcess')) {
      return;
    }

    reporter.report(
      node.id,
      `Escalation boundary on a ${humanizeElementType(host.$type)} can only be fired by an escalation injected through the REST API or a plugin (BSC-016)`,
    );
  }

  return { check };
}
