import { is } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleNode } from '../../types';

function hasAssignment(node: ModdleNode): boolean {
  const assignee = node.assignee as string | undefined;
  const candidateUsers = node.candidateUsers as string | undefined;
  const candidateGroups = node.candidateGroups as string | undefined;
  if (assignee || candidateUsers || candidateGroups) {
    return true;
  }
  const resources = node.resources as ModdleNode[] | undefined;
  if (resources && resources.length > 0) {
    return true;
  }
  const attrs = node.$attrs;
  if (attrs) {
    for (const key of Object.keys(attrs)) {
      if (/assignee|candidateUsers|candidateGroups/i.test(key) && attrs[key]) {
        return true;
      }
    }
  }
  return false;
}

export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!is(node, 'bpmn:UserTask')) {
      return;
    }
    if (!hasAssignment(node)) {
      reporter.report(
        node.id,
        'User task should specify assignee, candidate users/groups, or human resources (EXR-004)',
      );
    }
  }

  return { check };
}
