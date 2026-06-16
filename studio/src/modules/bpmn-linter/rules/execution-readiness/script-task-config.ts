import { is } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleNode } from '../../types';

export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!is(node, 'bpmn:ScriptTask')) {
      return;
    }
    const parts: string[] = [];
    if (!(node.scriptFormat as string | undefined)) {
      parts.push('scriptFormat');
    }
    if (!(node.script as string | undefined)) {
      parts.push('script');
    }
    if (parts.length) {
      reporter.report(node.id, `Script task should declare ${parts.join(' and ')} (EXR-008)`);
    }
  }

  return { check };
}
