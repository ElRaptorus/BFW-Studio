import { is } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleNode } from '../../types';

function hasAssignees(node: ModdleNode): boolean {
  const extensions = (node.extensionElements as { values?: ModdleNode[] } | undefined)?.values;
  const assigneesBody = extensions?.find((extension) => extension.$type === 'bfw:Assignees')?.body;
  return assigneesBody != null && String(assigneesBody).trim() !== '';
}

export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!is(node, 'bpmn:UserTask')) {
      return;
    }
    if (!hasAssignees(node)) {
      reporter.report(node.id, 'User task should specify bfw:assignees (EXR-004)');
    }
  }

  return { check };
}
