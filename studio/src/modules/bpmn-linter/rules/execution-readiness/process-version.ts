import { is } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleNode } from '../../types';

export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!is(node, 'bpmn:Process')) {
      return;
    }
    const extensions = (node.extensionElements as { values?: ModdleNode[] } | undefined)?.values;
    const versionElement = extensions?.find((ext) => ext.$type === 'evil:Version');
    if (!(versionElement?.body as string | undefined)?.trim()) {
      reporter.report(node.id, 'Process should have a version (EXR-012)');
    }
  }

  return { check };
}
