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

function adHocRule(report: (node: ModdleNode, reporter: BpmnlintReporter, flowElements: ModdleNode[]) => void) {
  return function () {
    function check(node: ModdleNode, reporter: BpmnlintReporter) {
      if (!is(node, 'bpmn:AdHocSubProcess')) {
        return;
      }
      report(node, reporter, node.flowElements ?? []);
    }
    return { check };
  };
}

export const adhocSubprocessFlowEvents = adHocRule((node, reporter, flowElements) => {
  const hasStartOrEnd = flowElements.some((element) => is(element, 'bpmn:StartEvent') || is(element, 'bpmn:EndEvent'));
  if (hasStartOrEnd) {
    reporter.report(node.id, 'Ad-hoc subprocess must not contain Start or End Events (BSC-021)');
  }
});

export const adhocSubprocessActivities = adHocRule((node, reporter, flowElements) => {
  const activities = flowElements.filter(
    (element) =>
      !is(element, 'bpmn:SequenceFlow') &&
      !is(element, 'bpmn:StartEvent') &&
      !is(element, 'bpmn:EndEvent') &&
      !is(element, 'bpmn:BoundaryEvent'),
  );
  if (activities.length === 0) {
    reporter.report(node.id, 'Ad-hoc subprocess must contain at least one activity (BSC-021)');
  }
});

export const adhocSubprocessNesting = adHocRule((node, reporter, flowElements) => {
  if (flowElements.some((element) => is(element, 'bpmn:AdHocSubProcess'))) {
    reporter.report(node.id, 'Ad-hoc subprocesses cannot be nested (BSC-021)');
  }
});

export const adhocSubprocessEventScope = adHocRule((node, reporter) => {
  if (isInsideEventSubprocess(node)) {
    reporter.report(node.id, 'Ad-hoc subprocesses are not supported inside an event subprocess (BSC-021)');
  }
});
