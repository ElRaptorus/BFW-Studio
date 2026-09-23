import { is } from 'bpmnlint-utils';

import { type LintFinding, type ModdleEventDefinition, type RuleSeverityConfig, mapToLintSeverity } from '../../types';
import type { ProcessModelAnalyzer } from '../ProcessModelAnalyzer';

const EXIT_GATEWAY_TYPES = new Set([
  'bpmn:ExclusiveGateway',
  'bpmn:InclusiveGateway',
  'bpmn:ComplexGateway',
  'bpmn:EventBasedGateway',
]);

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
        'Add a conditional exit via an exclusive, inclusive, or complex gateway, or a boundary event (e.g. a timer or error boundary) that leaves the cycle.',
      category: 'logic-patterns',
    });
  }

  return findings;
}

function hasExitBoundary(analyzer: ProcessModelAnalyzer, nodeId: string): boolean {
  return analyzer
    .getBoundaryEvents(nodeId)
    .some(
      (boundaryEvent) =>
        !(boundaryEvent.eventDefinitions ?? []).some((eventDefinition: ModdleEventDefinition) =>
          is(eventDefinition, 'bpmn:CompensateEventDefinition'),
        ),
    );
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

    if (hasExitBoundary(analyzer, nodeId)) {
      return true;
    }
  }

  return false;
}
