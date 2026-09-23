import { is } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleNode } from '../../types';

function getExtensionBody(parent: ModdleNode, type: string): string | undefined {
  const extensions = (parent.extensionElements as { values?: ModdleNode[] } | undefined)?.values;
  const body = extensions?.find((extension) => extension.$type === type)?.body;
  return body == null ? undefined : String(body);
}

/**
 * The Engine rejects a Business Rule Task whose implementation is not exactly
 * `feel` or `dmn`, a `feel` task without a script, and a `dmn` task without
 * bfw:decisionRef.
 */
export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!is(node, 'bpmn:BusinessRuleTask')) {
      return;
    }
    const implementation = node.implementation != null ? String(node.implementation) : '';
    if (implementation === 'feel') {
      if (!(node.script as string | undefined)?.trim()) {
        reporter.report(node.id, 'Business rule task with implementation "feel" must declare a script (EXR-019)');
      }
    } else if (implementation === 'dmn') {
      if (!getExtensionBody(node, 'bfw:DecisionRef')?.trim()) {
        reporter.report(
          node.id,
          'Business rule task with implementation "dmn" must declare a bfw:decisionRef (EXR-019)',
        );
      }
    } else {
      reporter.report(node.id, 'Business rule task implementation must be "feel" or "dmn" (EXR-019)');
    }
  }

  return { check };
}
