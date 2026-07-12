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

function hasCompensableActivity(transaction: ModdleNode): boolean {
  const flowElements: ModdleNode[] = transaction.flowElements ?? [];
  const parentFlowElements: ModdleNode[] = transaction.$parent?.flowElements ?? [];

  const activityIds = new Set(
    flowElements.filter((el) => is(el, 'bpmn:Activity') && !is(el, 'bpmn:SubProcess')).map((el) => el.id),
  );

  return parentFlowElements.some(
    (el) =>
      is(el, 'bpmn:BoundaryEvent') &&
      activityIds.has(el.attachedToRef?.id ?? '') &&
      (el.eventDefinitions ?? []).some((ed: ModdleEventDefinition) => is(ed, 'bpmn:CompensateEventDefinition')),
  );
}

/**
 * Warns when a Transaction subprocess has a Cancel End Event inside it but no
 * activities with compensation boundary events. Cancel will trigger automatic
 * LIFO compensation, but with nothing to compensate the Cancel End has no
 * rollback effect — likely a modelling oversight.
 */
export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!is(node, 'bpmn:Transaction')) {
      return;
    }

    if (!hasCancelEndEvent(node)) {
      return;
    }

    if (!hasCompensableActivity(node)) {
      reporter.report(
        node.id,
        'Transaction has a Cancel End Event but no compensable activities inside — compensation on cancel will have no effect (BSC-020)',
      );
    }
  }

  return { check };
}
