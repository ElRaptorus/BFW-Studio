import { is, isAny } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleEventDefinition, ModdleNode } from '../../types';

function collectFlowElements(container: ModdleNode): ModdleNode[] {
  const out: ModdleNode[] = [];
  const fe = container?.flowElements;
  if (!fe) {
    return out;
  }
  for (const el of fe) {
    out.push(el);
    if (isAny(el, ['bpmn:SubProcess', 'bpmn:AdHocSubProcess']) && !el.triggeredByEvent) {
      out.push(...collectFlowElements(el));
    }
  }
  return out;
}

export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!is(node, 'bpmn:Process')) {
      return;
    }
    const all = collectFlowElements(node);
    const hasServiceTask = all.some((el) => is(el, 'bpmn:ServiceTask'));
    if (!hasServiceTask) {
      return;
    }
    const hasAnyErrorBoundary = all.some(
      (el) =>
        is(el, 'bpmn:BoundaryEvent') &&
        (el.eventDefinitions || []).some((ed: ModdleEventDefinition) => is(ed, 'bpmn:ErrorEventDefinition')),
    );
    const hasErrorEventSubprocess = all.some(
      (el) =>
        is(el, 'bpmn:SubProcess') &&
        el.triggeredByEvent &&
        (el.flowElements || []).some(
          (child: ModdleNode) =>
            is(child, 'bpmn:StartEvent') &&
            (child.eventDefinitions || []).some((ed: ModdleEventDefinition) => is(ed, 'bpmn:ErrorEventDefinition')),
        ),
    );
    if (!hasAnyErrorBoundary && !hasErrorEventSubprocess) {
      reporter.report(
        node.id,
        'Process with service tasks should define error handling (e.g. error boundary events) (AST-006)',
      );
    }
  }

  return { check };
}
