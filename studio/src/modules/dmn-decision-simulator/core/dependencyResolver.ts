import type { DmnDecision, DmnDefinitions } from '@elraptorus/bfw_engine_sdk';

import { isImportedReference } from '../../dmn-core/qualifiedReference';
import { SimulationError } from './types';

function localRequiredDecisionIds(decision: DmnDecision): string[] {
  return decision.informationRequirements
    .map((requirement) => requirement.requiredDecisionId)
    .filter((identifier): identifier is string => identifier != null && !isImportedReference(identifier));
}

/**
 * Topological evaluation order for a target decision and its local upstream decisions (dependencies first).
 * Qualified requirements (`namespace#id`) are not part of the local graph; they are evaluated by the import step.
 */
export function resolveEvaluationOrder(definitions: DmnDefinitions, targetId: string): DmnDecision[] {
  const decisionsById = new Map(definitions.decisions.map((decision) => [decision.id, decision]));
  const ordered: DmnDecision[] = [];
  const finished = new Set<string>();
  const visiting: string[] = [];

  const visit = (decisionId: string, requiredBy: string | null): void => {
    if (finished.has(decisionId)) {
      return;
    }
    const decision = decisionsById.get(decisionId);
    if (decision == null) {
      throw new SimulationError(
        'missing_required_decision',
        `Decision '${requiredBy ?? decisionId}' requires decision '${decisionId}', which does not exist in this model.`,
        { decisionId, requiredBy },
      );
    }
    if (visiting.includes(decisionId)) {
      const cycle = [...visiting.slice(visiting.indexOf(decisionId)), decisionId];
      throw new SimulationError(
        'drg_cycle',
        `The decision requirements graph contains a cycle: ${cycle.join(' → ')}.`,
        { cycle },
      );
    }
    visiting.push(decisionId);
    localRequiredDecisionIds(decision).forEach((requiredId) => visit(requiredId, decisionId));
    visiting.pop();
    finished.add(decisionId);
    ordered.push(decision);
  };

  visit(targetId, null);
  return ordered;
}
