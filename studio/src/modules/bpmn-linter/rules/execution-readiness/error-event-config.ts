import { is } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleNode } from '../../types';

export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!is(node, 'bpmn:ErrorEventDefinition')) {
      return;
    }
    if (!(node.errorRef as ModdleNode | undefined)) {
      const parent = node.$parent;
      reporter.report(parent?.id ?? node.id, 'Error event definition should reference an error (EXR-006)');
    }
  }

  return { check };
}
