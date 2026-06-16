import type { BpmnlintReporter, ModdleNode } from '../../types';

export default function () {
  function check(_node: ModdleNode, _reporter: BpmnlintReporter) {
    // NMQ-008: placeholder — inconsistent flow label comparison deferred.
  }

  return { check };
}
