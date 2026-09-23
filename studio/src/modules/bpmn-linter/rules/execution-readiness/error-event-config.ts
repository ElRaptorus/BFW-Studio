import { is } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleNode } from '../../types';

function getExtensionBody(parent: ModdleNode, type: string): string | undefined {
  const extensions = (parent.extensionElements as { values?: ModdleNode[] } | undefined)?.values;
  const body = extensions?.find((extension) => extension.$type === type)?.body;
  return body == null ? undefined : String(body);
}

/**
 * Flags an Error End Event that throws no error code: neither an `errorRef` to a
 * global error with an `errorCode` nor an inline `bfw:ErrorCode`. Catch-side
 * error events without a code are catch-all catchers, which the Engine supports
 * deliberately.
 */
export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!is(node, 'bpmn:ErrorEventDefinition')) {
      return;
    }
    const referencedErrorCode = (node.errorRef as ModdleNode | undefined)?.errorCode;
    if (referencedErrorCode != null && String(referencedErrorCode).trim()) {
      return;
    }
    if (getExtensionBody(node, 'bfw:ErrorCode')?.trim()) {
      return;
    }
    const parent = node.$parent;
    if (parent && is(parent, 'bpmn:EndEvent')) {
      reporter.report(
        parent.id,
        'Error end event has no error code — only catch-all error catchers will catch it (EXR-006)',
      );
    }
  }

  return { check };
}
