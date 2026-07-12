import { is } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleEventDefinition, ModdleNode } from '../../types';

function hasCancelEndEvent(transaction: ModdleNode): boolean {
  const flowElements: ModdleNode[] = transaction.flowElements ?? [];
  return flowElements.some(
    (el) =>
      is(el, 'bpmn:EndEvent') &&
      (el.eventDefinitions ?? []).some((ed: ModdleEventDefinition) => is(ed, 'bpmn:CancelEventDefinition')),
  );
}

function hasCancelBoundaryEvent(transaction: ModdleNode): boolean {
  const parentElements: ModdleNode[] = transaction.$parent?.flowElements ?? [];
  return parentElements.some(
    (el) =>
      is(el, 'bpmn:BoundaryEvent') &&
      el.attachedToRef?.id === transaction.id &&
      (el.eventDefinitions ?? []).some((ed: ModdleEventDefinition) => is(ed, 'bpmn:CancelEventDefinition')),
  );
}

/**
 * Warns when a Transaction subprocess has a Cancel End Event inside it but no
 * Cancel Boundary Event attached to the transaction shell. Without a Cancel
 * Boundary the cancel produces a hazard (fatal) rather than routing the parent
 * process via the cancel path.
 */
export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!is(node, 'bpmn:Transaction')) {
      return;
    }

    if (!hasCancelEndEvent(node)) {
      return;
    }

    if (!hasCancelBoundaryEvent(node)) {
      reporter.report(
        node.id,
        'Transaction has a Cancel End Event but no Cancel Boundary Event on the shell — the cancel will produce a hazard (BSC-019)',
      );
    }
  }

  return { check };
}
