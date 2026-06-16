import { is } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleNode } from '../../types';

const GENERIC = /^(End|Ende|Done|Fertig|Abgeschlossen|Finished)$/i;

export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!is(node, 'bpmn:EndEvent')) {
      return;
    }
    const name = (node.name || '').trim();
    if (name && GENERIC.test(name)) {
      reporter.report(node.id, 'End event label is generic; use a specific outcome name (NMQ-004)');
    }
  }

  return { check };
}
