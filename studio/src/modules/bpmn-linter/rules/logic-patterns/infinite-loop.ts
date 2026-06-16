import { type LintFinding, type RuleSeverityConfig, mapToLintSeverity } from '../../types';
import type { ProcessModelAnalyzer } from '../ProcessModelAnalyzer';

const EXIT_GATEWAY_TYPES = new Set(['bpmn:ExclusiveGateway', 'bpmn:InclusiveGateway', 'bpmn:EventBasedGateway']);

export default function checkInfiniteLoop(analyzer: ProcessModelAnalyzer, severity: RuleSeverityConfig): LintFinding[] {
  const findings: LintFinding[] = [];
  const cycles = analyzer.findCycles();

  for (const cycle of cycles) {
    if (hasExitCondition(analyzer, cycle)) {
      continue;
    }

    const firstElement = analyzer.getElement(cycle[0]);
    findings.push({
      ruleId: 'infinite-loop',
      severity: mapToLintSeverity(severity),
      elementId: cycle[0],
      elementName: firstElement?.name ?? null,
      message: `Cycle detected without exit condition (${cycle.length} elements) (AST-208)`,
      why: 'A cycle without an exit condition can loop indefinitely, consuming engine resources and blocking process completion.',
      suggestion:
        'Add a conditional exit via an exclusive gateway with a termination condition. Alternatively, add a timer boundary event for automatic abort after a timeout, or enforce a maximum loop count.',
      category: 'logic-patterns',
    });
  }

  return findings;
}

function hasExitCondition(analyzer: ProcessModelAnalyzer, cycle: string[]): boolean {
  const cycleSet = new Set(cycle);

  for (const nodeId of cycle) {
    const element = analyzer.getElement(nodeId);
    if (element && EXIT_GATEWAY_TYPES.has(element.type)) {
      const outgoing = analyzer.getOutgoingFlows(nodeId);
      const hasExitEdge = outgoing.some((flow) => !cycleSet.has(flow.targetId));
      if (hasExitEdge) {
        return true;
      }
    }

    if (analyzer.hasTimerBoundary(nodeId)) {
      return true;
    }
  }

  return false;
}
