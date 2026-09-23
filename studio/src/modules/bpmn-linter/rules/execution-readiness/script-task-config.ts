import { is } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleNode } from '../../types';

function getExtensionBody(parent: ModdleNode, type: string): string | undefined {
  const extensions = (parent.extensionElements as { values?: ModdleNode[] } | undefined)?.values;
  const body = extensions?.find((extension) => extension.$type === type)?.body;
  return body == null ? undefined : String(body);
}

export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!is(node, 'bpmn:ScriptTask')) {
      return;
    }
    const script = node.script as string | undefined;
    if (script?.trim() || getExtensionBody(node, 'bfw:ScriptRef')?.trim()) {
      return;
    }
    reporter.report(node.id, 'Script task must declare a script or a bfw:scriptRef (EXR-008)');
  }

  return { check };
}
