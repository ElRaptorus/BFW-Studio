import { is } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleNode } from '../../types';

function getExtensionBody(parent: ModdleNode, type: string): string | undefined {
  const extEl = parent.extensionElements as { values?: ModdleNode[] } | undefined;
  const extensions = extEl?.values;
  if (!extensions) {
    return undefined;
  }
  const match = extensions.find((ext) => ext.$type === type);
  const body = match?.body;
  if (body == null) {
    return undefined;
  }
  return String(body);
}

function implementationText(node: ModdleNode): string {
  return node.implementation != null ? String(node.implementation).trim() : '';
}

/**
 * Completion of an ad-hoc subprocess: a completion condition, or an implementation
 * for plugin-managed completion. An empty implementation attribute is rejected.
 */
export function adhocSubprocessCompletion() {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!is(node, 'bpmn:AdHocSubProcess')) {
      return;
    }

    const completionCondition = node.completionCondition as ModdleNode | undefined;
    const completionConditionBody = completionCondition?.body != null ? String(completionCondition.body).trim() : '';
    const implementation = implementationText(node);

    if (completionConditionBody === '' && implementation === '') {
      reporter.report(
        node.id,
        'Ad-hoc subprocess has no completion condition and no implementation — it will complete when all activities have been performed (EXR-014)',
      );
    }

    if (node.implementation != null && implementation === '') {
      reporter.report(node.id, 'Ad-hoc subprocess has an empty implementation attribute (EXR-014)');
    }
  }

  return { check };
}

/**
 * Activation order of an ad-hoc subprocess. Omitted ordering defaults to Parallel.
 * Sequential engine-managed mode needs bfw:ActiveElements.
 */
export function adhocSubprocessOrdering() {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!is(node, 'bpmn:AdHocSubProcess')) {
      return;
    }

    const implementation = implementationText(node);
    const activeElements = getExtensionBody(node, 'bfw:ActiveElements');
    const hasActiveElements = activeElements != null && activeElements.trim() !== '';
    const ordering = node.ordering != null ? String(node.ordering) : undefined;

    if (ordering === 'Sequential' && implementation === '' && !hasActiveElements) {
      reporter.report(
        node.id,
        'Sequential ad-hoc subprocess requires an bfw:ActiveElements expression to determine execution order (or set an implementation for plugin-managed mode) (EXR-014)',
      );
    }

    if (ordering == null) {
      reporter.report(node.id, 'Ad-hoc subprocess has no explicit ordering — defaults to Parallel (EXR-014)');
    }
  }

  return { check };
}
