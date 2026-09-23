import { is, isAny } from 'bpmnlint-utils';

import type { ModdleDefinitions, ModdleEventDefinition, ModdleNode } from '../types';

const TASK_TYPES = [
  'bpmn:Task',
  'bpmn:ServiceTask',
  'bpmn:UserTask',
  'bpmn:ScriptTask',
  'bpmn:BusinessRuleTask',
  'bpmn:ManualTask',
  'bpmn:SendTask',
  'bpmn:ReceiveTask',
  'bpmn:CallActivity',
];

const GATEWAY_TYPES = [
  'bpmn:ExclusiveGateway',
  'bpmn:InclusiveGateway',
  'bpmn:ParallelGateway',
  'bpmn:ComplexGateway',
  'bpmn:EventBasedGateway',
];

const EVENT_TYPES = ['bpmn:StartEvent', 'bpmn:EndEvent', 'bpmn:IntermediateCatchEvent', 'bpmn:IntermediateThrowEvent'];

export type AnalyzerElement = {
  id: string;
  name: string | null;
  type: string;
  node: ModdleNode;
};

export type AnalyzerSequenceFlow = {
  id: string;
  sourceId: string;
  targetId: string;
  name: string | null;
  conditionExpression: string | null;
  node: ModdleNode;
};

export type AnalyzerDataAssociation = {
  direction: 'input' | 'output';
  elementId: string;
};

/**
 * Provides pre-computed graph analysis for process-wide lint rules.
 * Instantiated once per lint run; expensive operations are lazily computed and cached.
 */
export class ProcessModelAnalyzer {
  private elementMap: Map<string, AnalyzerElement> = new Map();
  private flowElements: AnalyzerElement[] = [];
  private sequenceFlows: AnalyzerSequenceFlow[] = [];
  private boundaryEvents: Map<string, ModdleNode[]> = new Map();
  private outgoingMap: Map<string, AnalyzerSequenceFlow[]> = new Map();
  private incomingMap: Map<string, AnalyzerSequenceFlow[]> = new Map();
  private dataAssociations: AnalyzerDataAssociation[] = [];
  private subprocesses: ModdleNode[] = [];

  private cachedChains: string[][] | null = null;
  private cachedCycles: string[][] | null = null;
  private cachedCfc: number | null = null;
  private cachedElementCount: number | null = null;
  private cachedNestingDepth: number | null = null;

  constructor(definitions: ModdleDefinitions) {
    this.buildFromDefinitions(definitions);
  }

  private buildFromDefinitions(definitions: ModdleDefinitions): void {
    const processes = (definitions.rootElements ?? []).filter((el) => is(el, 'bpmn:Process'));
    for (const process of processes) {
      this.flattenFlowElements(process);
    }

    for (const flow of this.sequenceFlows) {
      if (!this.outgoingMap.has(flow.sourceId)) {
        this.outgoingMap.set(flow.sourceId, []);
      }
      this.outgoingMap.get(flow.sourceId)!.push(flow);

      if (!this.incomingMap.has(flow.targetId)) {
        this.incomingMap.set(flow.targetId, []);
      }
      this.incomingMap.get(flow.targetId)!.push(flow);
    }
  }

  private flattenFlowElements(container: ModdleNode): void {
    const elements = container.flowElements ?? [];
    for (const el of elements) {
      if (is(el, 'bpmn:SequenceFlow')) {
        const sourceId = el.sourceRef?.id;
        const targetId = el.targetRef?.id;
        if (sourceId && targetId) {
          this.sequenceFlows.push({
            id: el.id,
            sourceId,
            targetId,
            name: el.name ?? null,
            conditionExpression: el.conditionExpression?.body ?? null,
            node: el,
          });
        }
        continue;
      }

      if (is(el, 'bpmn:BoundaryEvent')) {
        const attachedToId = el.attachedToRef?.id;
        if (attachedToId) {
          if (!this.boundaryEvents.has(attachedToId)) {
            this.boundaryEvents.set(attachedToId, []);
          }
          this.boundaryEvents.get(attachedToId)!.push(el);
        }
        continue;
      }

      const entry: AnalyzerElement = {
        id: el.id,
        name: el.name ?? null,
        type: el.$type,
        node: el,
      };
      this.elementMap.set(el.id, entry);
      this.flowElements.push(entry);

      if (isAny(el, TASK_TYPES)) {
        this.collectDataAssociations(el);
      }

      if (is(el, 'bpmn:SubProcess') || is(el, 'bpmn:AdHocSubProcess')) {
        this.subprocesses.push(el);
        this.flattenFlowElements(el);
      }
    }
  }

  private collectDataAssociations(taskNode: ModdleNode): void {
    const inputAssocs = (taskNode.dataInputAssociations as ModdleNode[] | undefined) ?? [];
    for (const _assoc of inputAssocs) {
      this.dataAssociations.push({ direction: 'input', elementId: taskNode.id });
    }
    const outputAssocs = (taskNode.dataOutputAssociations as ModdleNode[] | undefined) ?? [];
    for (const _assoc of outputAssocs) {
      this.dataAssociations.push({ direction: 'output', elementId: taskNode.id });
    }
  }

  getFlowElements(): AnalyzerElement[] {
    return this.flowElements;
  }

  getElement(elementId: string): AnalyzerElement | undefined {
    return this.elementMap.get(elementId);
  }

  getSequenceFlows(): AnalyzerSequenceFlow[] {
    return this.sequenceFlows;
  }

  getOutgoingFlows(elementId: string): AnalyzerSequenceFlow[] {
    return this.outgoingMap.get(elementId) ?? [];
  }

  getIncomingFlows(elementId: string): AnalyzerSequenceFlow[] {
    return this.incomingMap.get(elementId) ?? [];
  }

  getSuccessors(elementId: string): AnalyzerElement[] {
    return this.getOutgoingFlows(elementId)
      .map((flow) => this.elementMap.get(flow.targetId))
      .filter((el): el is AnalyzerElement => el != null);
  }

  getBoundaryEvents(elementId: string): ModdleNode[] {
    return this.boundaryEvents.get(elementId) ?? [];
  }

  hasTimerBoundary(elementId: string): boolean {
    return this.getBoundaryEvents(elementId).some((be) =>
      (be.eventDefinitions ?? []).some((ed: ModdleEventDefinition) => is(ed, 'bpmn:TimerEventDefinition')),
    );
  }

  hasCompensationBoundary(elementId: string): boolean {
    return this.getBoundaryEvents(elementId).some((be) =>
      (be.eventDefinitions ?? []).some((ed: ModdleEventDefinition) => is(ed, 'bpmn:CompensateEventDefinition')),
    );
  }

  hasErrorBoundary(elementId: string): boolean {
    return this.getBoundaryEvents(elementId).some((be) =>
      (be.eventDefinitions ?? []).some((ed: ModdleEventDefinition) => is(ed, 'bpmn:ErrorEventDefinition')),
    );
  }

  getTasksByType(type: string): AnalyzerElement[] {
    return this.flowElements.filter((el) => el.type === type);
  }

  getTasks(): AnalyzerElement[] {
    return this.flowElements.filter((el) => isAny(el.node, TASK_TYPES));
  }

  getGateways(): AnalyzerElement[] {
    return this.flowElements.filter((el) => isAny(el.node, GATEWAY_TYPES));
  }

  getGatewaysByType(type: string): AnalyzerElement[] {
    return this.flowElements.filter((el) => el.type === type);
  }

  getEvents(): AnalyzerElement[] {
    return this.flowElements.filter((el) => isAny(el.node, EVENT_TYPES));
  }

  getSubprocesses(): ModdleNode[] {
    return this.subprocesses;
  }

  getDataAssociations(): AnalyzerDataAssociation[] {
    return this.dataAssociations;
  }

  hasDataOutputAssociation(elementId: string): boolean {
    return this.dataAssociations.some((da) => da.direction === 'output' && da.elementId === elementId);
  }

  hasDataInputAssociation(elementId: string): boolean {
    return this.dataAssociations.some((da) => da.direction === 'input' && da.elementId === elementId);
  }

  /**
   * Finds chains of tasks connected by single outgoing flows (no branching).
   * Only extends through nodes with exactly one outgoing flow targeting another task.
   */
  findSequentialChains(): string[][] {
    if (this.cachedChains) {
      return this.cachedChains;
    }

    const taskIds = new Set(this.getTasks().map((el) => el.id));
    const visited = new Set<string>();
    const chains: string[][] = [];

    for (const taskId of taskIds) {
      if (visited.has(taskId)) {
        continue;
      }

      const chain = [taskId];
      visited.add(taskId);
      let currentId = taskId;

      while (true) {
        const outgoing = this.getOutgoingFlows(currentId);
        if (outgoing.length !== 1) {
          break;
        }
        const nextId = outgoing[0].targetId;
        if (!taskIds.has(nextId) || visited.has(nextId)) {
          break;
        }
        chain.push(nextId);
        visited.add(nextId);
        currentId = nextId;
      }

      if (chain.length > 1) {
        chains.push(chain);
      }
    }

    this.cachedChains = chains;
    return chains;
  }

  /**
   * DFS-based cycle detection. Returns arrays of element IDs forming cycles.
   */
  findCycles(): string[][] {
    if (this.cachedCycles) {
      return this.cachedCycles;
    }

    const allIds = this.flowElements.map((el) => el.id);
    const visited = new Set<string>();
    const globalVisited = new Set<string>();
    const cycles: string[][] = [];
    const seenCycleSets = new Set<string>();

    for (const startId of allIds) {
      if (globalVisited.has(startId)) {
        continue;
      }
      this.dfsCycles(startId, [], new Set<string>(), visited, globalVisited, cycles, seenCycleSets);
    }

    this.cachedCycles = cycles;
    return cycles;
  }

  private dfsCycles(
    nodeId: string,
    path: string[],
    visiting: Set<string>,
    visited: Set<string>,
    globalVisited: Set<string>,
    cycles: string[][],
    seenCycleSets: Set<string>,
  ): void {
    if (visited.has(nodeId)) {
      return;
    }

    if (visiting.has(nodeId)) {
      const cycleStart = path.indexOf(nodeId);
      if (cycleStart >= 0) {
        const cycle = path.slice(cycleStart);
        const key = [...cycle].sort().join(',');
        if (!seenCycleSets.has(key) && cycle.length > 1) {
          seenCycleSets.add(key);
          cycles.push(cycle);
        }
      }
      return;
    }

    visiting.add(nodeId);
    path.push(nodeId);

    for (const flow of this.getOutgoingFlows(nodeId)) {
      this.dfsCycles(flow.targetId, path, visiting, visited, globalVisited, cycles, seenCycleSets);
    }

    path.pop();
    visiting.delete(nodeId);
    visited.add(nodeId);
    globalVisited.add(nodeId);
  }

  /**
   * Sum of outgoing-degree for all gateways with more than 1 outgoing flow.
   */
  getControlFlowComplexity(): number {
    if (this.cachedCfc != null) {
      return this.cachedCfc;
    }

    let cfc = 0;
    for (const gateway of this.getGateways()) {
      const outCount = this.getOutgoingFlows(gateway.id).length;
      if (outCount > 1) {
        cfc += outCount;
      }
    }

    this.cachedCfc = cfc;
    return cfc;
  }

  /**
   * Count of tasks + gateways + events + subprocesses.
   */
  getElementCount(): number {
    if (this.cachedElementCount != null) {
      return this.cachedElementCount;
    }

    this.cachedElementCount = this.flowElements.length;
    return this.cachedElementCount;
  }

  /**
   * True recursive nesting depth by walking the subprocess containment tree.
   */
  getNestingDepth(): number {
    if (this.cachedNestingDepth != null) {
      return this.cachedNestingDepth;
    }

    this.cachedNestingDepth = this.computeNestingDepth();
    return this.cachedNestingDepth;
  }

  private computeNestingDepth(): number {
    let maxDepth = 0;

    function walkContainer(container: ModdleNode, depth: number): void {
      for (const el of container.flowElements ?? []) {
        if ((is(el, 'bpmn:SubProcess') || is(el, 'bpmn:AdHocSubProcess')) && !el.triggeredByEvent) {
          const childDepth = depth + 1;
          if (childDepth > maxDepth) {
            maxDepth = childDepth;
          }
          walkContainer(el, childDepth);
        }
      }
    }

    for (const subprocess of this.subprocesses) {
      if (!subprocess.triggeredByEvent) {
        walkContainer(subprocess, 1);
        if (maxDepth === 0) {
          maxDepth = 1;
        }
      }
    }

    return maxDepth;
  }
}
