export type ScopeState = 'running' | 'completed' | 'destroyed';

let scopeCounter = 0;

export class Scope {
  readonly id: string;
  readonly element: any;
  readonly parent: Scope | null;
  readonly children: Scope[] = [];
  private readonly activeTokenCounts = new Map<string, number>();

  /** Connections that tokens are currently travelling along, keyed by animation id */
  private readonly inFlightConnections = new Map<number, any>();

  /** Pending timer ids per element id, cancelled together with the element */
  readonly elementTimers = new Map<string, Set<number>>();

  /** Completed activities that have a compensation handler, oldest first */
  compensationRegistry: any[] = [];

  /** Called instead of exiting the host when the scope completes */
  onComplete?: () => void;

  /** Activities of a sequential ad-hoc subprocess still to start, each once the scope is quiescent */
  pendingSequentialActivities: any[] = [];

  state: ScopeState = 'running';

  /** Tracks how many tokens have arrived at each parallel join gateway */
  private joinCounters = new Map<string, number>();

  /** The incoming-flow id of every arrival at each inclusive join, in arrival order */
  private satisfiedJoinFlows = new Map<string, string[]>();

  /** Tracks sequential/loop iteration progress per element */
  private loopCounters = new Map<string, number>();

  /** Tracks parallel MI child scope completion counts per element */
  private parallelMiCounters = new Map<string, { expected: number; completed: number }>();

  constructor(element: any, parent: Scope | null = null) {
    this.id = `scope_${++scopeCounter}`;
    this.element = element;
    this.parent = parent;
    parent?.children.push(this);
  }

  addToken(elementId: string): void {
    const count = this.activeTokenCounts.get(elementId) ?? 0;
    this.activeTokenCounts.set(elementId, count + 1);
  }

  removeToken(elementId: string): void {
    const count = this.activeTokenCounts.get(elementId) ?? 0;
    if (count <= 1) {
      this.activeTokenCounts.delete(elementId);
    } else {
      this.activeTokenCounts.set(elementId, count - 1);
    }
  }

  getTokenCount(elementId: string): number {
    return this.activeTokenCounts.get(elementId) ?? 0;
  }

  addInFlight(animationId: number, connection: any): void {
    this.inFlightConnections.set(animationId, connection);
  }

  removeInFlight(animationId: number): boolean {
    return this.inFlightConnections.delete(animationId);
  }

  takeInFlight(predicate: (connection: any) => boolean): { animationId: number; connection: any }[] {
    const taken: { animationId: number; connection: any }[] = [];
    for (const [animationId, connection] of this.inFlightConnections) {
      if (predicate(connection)) {
        this.inFlightConnections.delete(animationId);
        taken.push({ animationId, connection });
      }
    }
    return taken;
  }

  isQuiescent(): boolean {
    return (
      this.activeTokenCounts.size === 0 &&
      this.inFlightConnections.size === 0 &&
      !this.children.some((child) => child.state === 'running')
    );
  }

  collectActiveTokens(): Set<string> {
    const tokens = new Set(this.activeTokenCounts.keys());
    // The source, not the target: a token on a flow into an inclusive join must count as upstream of that join.
    for (const connection of this.inFlightConnections.values()) {
      if (connection.source) {
        tokens.add(connection.source.id);
      }
    }
    for (const child of this.children) {
      if (child.state === 'running') {
        for (const id of child.collectActiveTokens()) {
          tokens.add(id);
        }
      }
    }
    return tokens;
  }

  incrementJoinCounter(gatewayId: string): number {
    const current = this.joinCounters.get(gatewayId) ?? 0;
    const next = current + 1;
    this.joinCounters.set(gatewayId, next);
    return next;
  }

  getJoinCounter(gatewayId: string): number {
    return this.joinCounters.get(gatewayId) ?? 0;
  }

  resetJoinCounter(gatewayId: string): void {
    this.joinCounters.delete(gatewayId);
  }

  addSatisfiedJoinFlow(gatewayId: string, flowId: string): void {
    this.satisfiedJoinFlows.set(gatewayId, [...this.getSatisfiedJoinFlows(gatewayId), flowId]);
  }

  getSatisfiedJoinFlows(gatewayId: string): string[] {
    return this.satisfiedJoinFlows.get(gatewayId) ?? [];
  }

  /** Removes the first arrival of every incoming flow and returns how many arrivals were removed */
  consumeSatisfiedJoinFlows(gatewayId: string): number {
    const arrivals = this.getSatisfiedJoinFlows(gatewayId);
    const leftoverArrivals = arrivals.filter((flowId, index) => arrivals.indexOf(flowId) !== index);
    this.satisfiedJoinFlows.set(gatewayId, leftoverArrivals);
    return arrivals.length - leftoverArrivals.length;
  }

  resetSatisfiedJoinFlows(gatewayId: string): void {
    this.satisfiedJoinFlows.delete(gatewayId);
  }

  hasLoopCounter(elementId: string): boolean {
    return this.loopCounters.has(elementId);
  }

  setLoopCounter(elementId: string, count: number): void {
    this.loopCounters.set(elementId, count);
  }

  getLoopCounter(elementId: string): number {
    return this.loopCounters.get(elementId) ?? 0;
  }

  incrementLoopCounter(elementId: string): number {
    const current = this.loopCounters.get(elementId) ?? 0;
    const next = current + 1;
    this.loopCounters.set(elementId, next);
    return next;
  }

  resetLoopCounter(elementId: string): void {
    this.loopCounters.delete(elementId);
  }

  setParallelMiExpected(elementId: string, expectedCount: number): void {
    this.parallelMiCounters.set(elementId, { expected: expectedCount, completed: 0 });
  }

  incrementParallelMiCompleted(elementId: string): number {
    const entry = this.parallelMiCounters.get(elementId);
    if (!entry) {
      return 0;
    }
    entry.completed++;
    return entry.completed;
  }

  isParallelMiComplete(elementId: string): boolean {
    const entry = this.parallelMiCounters.get(elementId);
    if (!entry) {
      return true;
    }
    return entry.completed >= entry.expected;
  }

  resetParallelMi(elementId: string): void {
    this.parallelMiCounters.delete(elementId);
  }

  complete(): void {
    this.state = 'completed';
  }

  destroy(): void {
    this.state = 'destroyed';
    this.activeTokenCounts.clear();
    this.inFlightConnections.clear();
    this.elementTimers.clear();
    this.joinCounters.clear();
    this.compensationRegistry = [];
    this.pendingSequentialActivities = [];
    this.satisfiedJoinFlows.clear();
    this.loopCounters.clear();
    this.parallelMiCounters.clear();
    for (const child of this.children) {
      if (child.state === 'running') {
        child.destroy();
      }
    }
  }
}

export function resetScopeCounter(): void {
  scopeCounter = 0;
}
