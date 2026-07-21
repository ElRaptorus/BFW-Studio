import { is } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleNode } from '../../types';

function isInsideEventSubprocess(node: ModdleNode): boolean {
  let current = node.$parent;
  while (current != null) {
    if (is(current, 'bpmn:SubProcess') && current.triggeredByEvent) {
      return true;
    }
    current = current.$parent;
  }
  return false;
}

/**
 * Ad-hoc sub-processes have no sequence flows between their inner activities, so
 * Start/End Events (which only make sense as flow anchors) are meaningless inside
 * one, nesting is not supported, and an ad-hoc sub-process must contain at least
 * one activity to have anything to activate.
 */
export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!is(node, 'bpmn:AdHocSubProcess')) {
      return;
    }

    const flowElements = node.flowElements ?? [];

    const startEvents = flowElements.filter((element) => is(element, 'bpmn:StartEvent'));
    if (startEvents.length > 0) {
      reporter.report(node.id, 'Ad-hoc sub-processes must not contain Start Events (BSC-021)');
    }

    const endEvents = flowElements.filter((element) => is(element, 'bpmn:EndEvent'));
    if (endEvents.length > 0) {
      reporter.report(node.id, 'Ad-hoc sub-processes must not contain End Events (BSC-021)');
    }

    const activities = flowElements.filter(
      (element) =>
        !is(element, 'bpmn:SequenceFlow') &&
        !is(element, 'bpmn:StartEvent') &&
        !is(element, 'bpmn:EndEvent') &&
        !is(element, 'bpmn:BoundaryEvent'),
    );
    if (activities.length === 0) {
      reporter.report(node.id, 'Ad-hoc sub-process must contain at least one activity (BSC-021)');
    }

    const nestedAdHoc = flowElements.filter((element) => is(element, 'bpmn:AdHocSubProcess'));
    if (nestedAdHoc.length > 0) {
      reporter.report(node.id, 'Ad-hoc sub-processes cannot be nested (BSC-021)');
    }

    if (isInsideEventSubprocess(node)) {
      reporter.report(node.id, 'Ad-hoc sub-processes are not supported inside event sub-processes (BSC-021)');
    }
  }

  return { check };
}
