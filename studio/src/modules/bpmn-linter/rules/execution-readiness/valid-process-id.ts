import { is } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleNode } from '../../types';

const SEPARATOR = /[_\-.]/;
const CAMEL_BOUNDARY = /(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/;
const ALPHA_WORD = /^[a-zA-Z]{3,}$/;
const MIN_WORD_COUNT = 2;

function countMeaningfulWords(id: string): number {
  let count = 0;
  for (const part of id.split(SEPARATOR)) {
    for (const segment of part.split(CAMEL_BOUNDARY)) {
      if (ALPHA_WORD.test(segment)) {
        count++;
      }
    }
  }
  return count;
}

export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!is(node, 'bpmn:Process')) {
      return;
    }
    const id = node.id;
    if (!id || countMeaningfulWords(id) < MIN_WORD_COUNT) {
      reporter.report(node.id ?? 'process', 'Process should have a stable, non-generic identifier (EXR-002)');
    }
  }

  return { check };
}
