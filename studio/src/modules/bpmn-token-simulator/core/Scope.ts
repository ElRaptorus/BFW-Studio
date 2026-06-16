export type ScopeState = 'running' | 'completed' | 'destroyed';

let scopeCounter = 0;

export class Scope {
  readonly id: string;
  readonly element: any;
  readonly parent: Scope | null;
  readonly children: Scope[] = [];
  private readonly activeTokenCounts = new Map<string, number>();

  state: ScopeState = 'running';

  /** Tracks how many tokens have arrived at each parallel join gateway */
  private joinCounters = new Map<string, number>();

  /** Tracks which outgoing flows were activated at an inclusive gateway fork */
  private activatedBranches = new Map<string, Set<string>>();

  /** Tracks which incoming flows have delivered tokens to each inclusive join */
  private satisfiedJoinFlows = new Map<string, Set<string>>();

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

  collectActiveTokens(): Set<string> {
    const tokens = new Set(this.activeTokenCounts.keys());
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
    let flows = this.satisfiedJoinFlows.get(gatewayId);
    if (!flows) {
      flows = new Set();
      this.satisfiedJoinFlows.set(gatewayId, flows);
    }
    flows.add(flowId);
  }

  getSatisfiedJoinFlows(gatewayId: string): Set<string> {
    return this.satisfiedJoinFlows.get(gatewayId) ?? new Set();
  }

  resetSatisfiedJoinFlows(gatewayId: string): void {
    this.satisfiedJoinFlows.delete(gatewayId);
  }

  setActivatedBranches(gatewayId: string, flowIds: Set<string>): void {
    this.activatedBranches.set(gatewayId, flowIds);
  }

  getActivatedBranches(gatewayId: string): Set<string> | undefined {
    return this.activatedBranches.get(gatewayId);
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

  hasActiveWork(): boolean {
    for (const count of this.joinCounters.values()) {
      if (count > 0) {
        return true;
      }
    }
    for (const flows of this.satisfiedJoinFlows.values()) {
      if (flows.size > 0) {
        return true;
      }
    }
    return this.children.some((child) => child.state === 'running');
  }

  complete(): void {
    this.state = 'completed';
  }

  destroy(): void {
    this.state = 'destroyed';
    this.activeTokenCounts.clear();
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
