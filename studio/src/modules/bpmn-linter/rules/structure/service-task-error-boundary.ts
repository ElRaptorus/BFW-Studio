import { is, isAny } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleEventDefinition, ModdleNode } from '../../types';

function hasErrorBoundary(host: ModdleNode, container: ModdleNode): boolean {
  const attached = (host as ModdleNode & { attachedBoundaryEvents?: ModdleNode[] }).attachedBoundaryEvents;
  if (attached?.length) {
    for (const be of attached) {
      const defs = be.eventDefinitions || [];
      if (defs.some((ed: ModdleEventDefinition) => is(ed, 'bpmn:ErrorEventDefinition'))) {
        return true;
      }
    }
  }
  for (const el of container.flowElements || []) {
    if (is(el, 'bpmn:BoundaryEvent') && el.attachedToRef === host) {
      const defs = el.eventDefinitions || [];
      if (defs.some((ed: ModdleEventDefinition) => is(ed, 'bpmn:ErrorEventDefinition'))) {
        return true;
      }
    }
  }
  return false;
}

function scopeHasErrorEventSubprocess(container: ModdleNode): boolean {
  for (const el of container.flowElements || []) {
    if (
      is(el, 'bpmn:SubProcess') &&
      el.triggeredByEvent &&
      (el.flowElements || []).some(
        (child: ModdleNode) =>
          is(child, 'bpmn:StartEvent') &&
          (child.eventDefinitions || []).some((ed: ModdleEventDefinition) => is(ed, 'bpmn:ErrorEventDefinition')),
      )
    ) {
      return true;
    }
  }
  return false;
}

export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!is(node, 'bpmn:ServiceTask')) {
      return;
    }
    let container: ModdleNode | undefined = node.$parent;
    while (container && !isAny(container, ['bpmn:Process', 'bpmn:SubProcess'])) {
      container = container.$parent;
    }
    if (!container) {
      return;
    }
    if (hasErrorBoundary(node, container)) {
      return;
    }
    if (scopeHasErrorEventSubprocess(container)) {
      return;
    }
    reporter.report(node.id, 'Service task should have a boundary error event for failure handling (AST-003)');
  }

  return { check };
}
