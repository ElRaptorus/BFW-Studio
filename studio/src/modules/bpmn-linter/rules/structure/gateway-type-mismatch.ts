import { is } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleNode } from '../../types';

/**
 * Phase 3 simplified: if a converging parallel gateway exists but no diverging
 * parallel gateway exists anywhere in the process, report on the converging gateway.
 */
function collectFlowElements(container: ModdleNode): ModdleNode[] {
  const out: ModdleNode[] = [];
  const fe = container?.flowElements;
  if (!fe) {
    return out;
  }
  for (const el of fe) {
    out.push(el);
    if (is(el, 'bpmn:SubProcess') && !el.triggeredByEvent) {
      out.push(...collectFlowElements(el));
    }
  }
  return out;
}

function isDivergingParallel(gw: ModdleNode): boolean {
  if (!is(gw, 'bpmn:ParallelGateway')) {
    return false;
  }
  const outgoing = gw.outgoing?.length ?? 0;
  const direction = gw.gatewayDirection as string | undefined;
  if (direction === 'Diverging' || outgoing > 1) {
    return true;
  }
  return false;
}

function isConvergingParallel(gw: ModdleNode): boolean {
  if (!is(gw, 'bpmn:ParallelGateway')) {
    return false;
  }
  const incoming = gw.incoming?.length ?? 0;
  const direction = gw.gatewayDirection as string | undefined;
  if (direction === 'Converging' || incoming > 1) {
    return true;
  }
  return false;
}

export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!is(node, 'bpmn:Process')) {
      return;
    }
    const all = collectFlowElements(node);
    const hasDivergingParallel = all.some(isDivergingParallel);
    if (hasDivergingParallel) {
      return;
    }
    for (const el of all) {
      if (isConvergingParallel(el)) {
        reporter.report(
          el.id,
          'Converging parallel gateway found but no diverging parallel gateway in process (AST-020, simplified)',
        );
      }
    }
  }

  return { check };
}
