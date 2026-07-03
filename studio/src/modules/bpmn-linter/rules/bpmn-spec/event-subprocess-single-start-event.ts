import { is } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleNode } from '../../types';

/**
 * An Event Sub-Process must have exactly one Start Event (engine rules
 * `event_subprocess_no_start_event` / `event_subprocess_multiple_start_events`).
 */
export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!is(node, 'bpmn:SubProcess') || !node.triggeredByEvent) {
      return;
    }

    const startEvents = (node.flowElements ?? []).filter((element) => is(element, 'bpmn:StartEvent'));

    if (startEvents.length === 0) {
      reporter.report(node.id, 'Event sub-process must have exactly one start event but has none (BSC-013)');
      return;
    }

    if (startEvents.length > 1) {
      reporter.report(
        node.id,
        `Event sub-process must have exactly one start event but has ${startEvents.length} (BSC-013)`,
      );
    }
  }

  return { check };
}
