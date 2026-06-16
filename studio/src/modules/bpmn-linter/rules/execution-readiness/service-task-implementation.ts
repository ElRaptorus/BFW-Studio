import { is } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleNode } from '../../types';

function hasImplementationHint(node: ModdleNode): boolean {
  if (node.implementation as string | undefined) {
    return true;
  }
  const attrs = node.$attrs;
  if (attrs) {
    for (const key of Object.keys(attrs)) {
      if (/^(camunda|flowable|zeebe):/i.test(key) || /type|delegate|class|topic/i.test(key)) {
        return true;
      }
    }
  }
  const ext = (node.extensionElements as { values?: ModdleNode[] } | undefined)?.values;
  if (ext?.length) {
    return true;
  }
  return false;
}

export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!is(node, 'bpmn:ServiceTask')) {
      return;
    }
    if (!hasImplementationHint(node)) {
      reporter.report(node.id, 'Service task should declare an implementation or connector configuration (EXR-003)');
    }
  }

  return { check };
}
