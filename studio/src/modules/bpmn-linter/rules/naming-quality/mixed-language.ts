import type { BpmnlintReporter, ModdleNode } from '../../types';

export default function () {
  function check(_node: ModdleNode, _reporter: BpmnlintReporter) {
    // NMQ-005: placeholder — mixed-language detection deferred (complex NLP).
  }

  return { check };
}
