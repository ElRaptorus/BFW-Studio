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

/**
 * Execution-readiness checks for Ad-hoc Sub-Processes. Mirrors the engine's
 * deploy-time validator (AH-D18: sequential engine-managed ad-hoc requires
 * bfw:ActiveElements to establish a deterministic execution order).
 */
export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!is(node, 'bpmn:AdHocSubProcess')) {
      return;
    }

    const completionCondition = node.completionCondition as ModdleNode | undefined;
    const completionConditionBody = completionCondition?.body != null ? String(completionCondition.body).trim() : '';

    const implementation = node.implementation != null ? String(node.implementation).trim() : '';
    const hasImplementationAttr = node.implementation != null;

    const activeElements = getExtensionBody(node, 'bfw:ActiveElements');
    const hasActiveElements = activeElements != null && activeElements.trim() !== '';

    if (completionConditionBody === '' && implementation === '') {
      reporter.report(
        node.id,
        'Ad-hoc subprocess has no completion condition and no implementation — it will complete when all activities have been performed (EXR-014)',
      );
    }

    if (hasImplementationAttr && implementation === '') {
      reporter.report(node.id, 'Ad-hoc subprocess has an empty implementation attribute (EXR-014)');
    }

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
