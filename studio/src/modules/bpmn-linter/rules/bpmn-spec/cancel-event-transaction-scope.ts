import { is } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleNode } from '../../types';

const CANCEL_EVENT_DEFINITION_TYPE = 'bpmn:CancelEventDefinition';

function hasCancelEventDefinition(node: ModdleNode): boolean {
  const eventDefinitions = node.eventDefinitions ?? [];
  return eventDefinitions.length > 0 && eventDefinitions[0].$type === CANCEL_EVENT_DEFINITION_TYPE;
}

/**
 * Flags Cancel events outside a transaction scope. A Cancel End Event must sit
 * directly inside a transaction sub-process, and a Cancel Boundary Event must be
 * attached to one.
 */
export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (is(node, 'bpmn:EndEvent') && hasCancelEventDefinition(node)) {
      if (!node.$parent || !is(node.$parent, 'bpmn:Transaction')) {
        reporter.report(node.id, 'Cancel end events are only allowed inside a transaction sub-process (BSC-017)');
      }
      return;
    }

    if (is(node, 'bpmn:BoundaryEvent') && hasCancelEventDefinition(node)) {
      const host = node.attachedToRef;
      if (!host || !is(host, 'bpmn:Transaction')) {
        reporter.report(node.id, 'Cancel boundary events are only allowed on a transaction sub-process (BSC-018)');
      }
    }
  }

  return { check };
}
