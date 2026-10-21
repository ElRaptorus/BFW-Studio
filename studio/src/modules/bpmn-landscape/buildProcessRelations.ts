import type {
  SolutionBpmnModelEntry,
  SolutionEventNameEntry,
  SolutionProcessEntry,
} from '#modules/bpmn-core/scanSolutionBpmnModels';

/** A process in the solution; the URI tells processes with the same id in different files apart. */
export type LandscapeProcessReference = { uri: string; processId: string };

export type ProcessRelationKind = 'callActivity' | 'message' | 'signal';

export type ProcessRelation = {
  /** `<kind>:<source process id>:<target process id>[:<name>]`, the identifier `hiddenRelations` stores. */
  key: string;
  kind: ProcessRelationKind;
  source: LandscapeProcessReference;
  target: LandscapeProcessReference;
  /** Message or signal name; `null` for call activities. */
  name: string | null;
  /** Call activities, or throwing message and signal elements, in the source process. */
  sourceFlowNodeIds: string[];
  /** Catching message and signal elements in the target process; empty for call activities. */
  targetFlowNodeIds: string[];
};

type LocatedProcess = { reference: LandscapeProcessReference; process: SolutionProcessEntry };

function groupByName(entries: SolutionEventNameEntry[]): Map<string, string[]> {
  const flowNodeIdsByName = new Map<string, string[]>();
  for (const entry of entries) {
    flowNodeIdsByName.set(entry.name, [...(flowNodeIdsByName.get(entry.name) ?? []), entry.flowNodeId]);
  }
  return flowNodeIdsByName;
}

function sameProcess(first: LandscapeProcessReference, second: LandscapeProcessReference): boolean {
  return first.uri === second.uri && first.processId === second.processId;
}

function callRelations(processes: LocatedProcess[]): ProcessRelation[] {
  const relations: ProcessRelation[] = [];
  for (const caller of processes) {
    const callActivityIdsByTarget = new Map<string, string[]>();
    for (const callActivity of caller.process.callActivities) {
      if (callActivity.calledElement == null || callActivity.calledElement === '') {
        continue;
      }
      const ids = callActivityIdsByTarget.get(callActivity.calledElement) ?? [];
      callActivityIdsByTarget.set(callActivity.calledElement, [...ids, callActivity.id]);
    }
    for (const [calledElement, sourceFlowNodeIds] of callActivityIdsByTarget) {
      for (const callee of processes) {
        if (callee.reference.processId !== calledElement || sameProcess(caller.reference, callee.reference)) {
          continue;
        }
        relations.push({
          key: `callActivity:${caller.reference.processId}:${calledElement}`,
          kind: 'callActivity',
          source: caller.reference,
          target: callee.reference,
          name: null,
          sourceFlowNodeIds,
          targetFlowNodeIds: [],
        });
      }
    }
  }
  return relations;
}

function nameRelations(
  processes: LocatedProcess[],
  kind: 'message' | 'signal',
  thrown: (process: SolutionProcessEntry) => SolutionEventNameEntry[],
  caught: (process: SolutionProcessEntry) => SolutionEventNameEntry[],
): ProcessRelation[] {
  const catchers = processes.map((located) => ({ located, flowNodeIdsByName: groupByName(caught(located.process)) }));
  const relations: ProcessRelation[] = [];
  for (const sender of processes) {
    for (const [name, sourceFlowNodeIds] of groupByName(thrown(sender.process))) {
      for (const catcher of catchers) {
        const targetFlowNodeIds = catcher.flowNodeIdsByName.get(name);
        if (targetFlowNodeIds == null || sameProcess(sender.reference, catcher.located.reference)) {
          continue;
        }
        relations.push({
          key: `${kind}:${sender.reference.processId}:${catcher.located.reference.processId}:${name}`,
          kind,
          source: sender.reference,
          target: catcher.located.reference,
          name,
          sourceFlowNodeIds,
          targetFlowNodeIds,
        });
      }
    }
  }
  return relations;
}

/**
 * Derives the relations between the processes of a solution scan: a call activity calls every process with its
 * `calledElement` id; a message or signal name thrown in one process reaches every other process that catches the
 * same name. One relation per kind, process pair and name. Relations of a process with itself are left out, because
 * they never connect two map elements. Sorted by key, then by URI.
 *
 * ponytail: compares every thrower with every catcher, O(processes²) per kind; fine for solutions of a few
 * thousand processes. The upgrade path is an index of catchers by name.
 */
export function buildProcessRelations(entries: SolutionBpmnModelEntry[]): ProcessRelation[] {
  const processes: LocatedProcess[] = entries.flatMap((entry) =>
    entry.kind === 'bpmn'
      ? entry.processes.map((process) => ({ reference: { uri: entry.uri, processId: process.id }, process }))
      : [],
  );
  return [
    ...callRelations(processes),
    ...nameRelations(
      processes,
      'message',
      (process) => process.thrownMessages,
      (process) => process.caughtMessages,
    ),
    ...nameRelations(
      processes,
      'signal',
      (process) => process.thrownSignals,
      (process) => process.caughtSignals,
    ),
  ].sort(
    (first, second) =>
      first.key.localeCompare(second.key) ||
      first.source.uri.localeCompare(second.source.uri) ||
      first.target.uri.localeCompare(second.target.uri),
  );
}
