import { Scope, resetScopeCounter } from './Scope';
import type { Behavior } from './behaviors';
import { getSignalName, isSignalEvent } from './eventDefUtils';

export type SimulationMode = 'auto' | 'step';

export type SimulationEvent =
  | { type: 'token:enter'; element: any; scope: Scope }
  | { type: 'token:exit'; element: any; scope: Scope }
  | { type: 'flow:animate'; connection: any; scope: Scope; done: () => void }
  | { type: 'element:waiting'; element: any; scope: Scope }
  | { type: 'gateway:choice'; element: any; scope: Scope; outgoing: any[] }
  | { type: 'gateway:auto'; element: any; scope: Scope; outgoing: any[]; chosenFlow: any; cancel: () => void }
  | { type: 'gateway:inclusive-choice'; element: any; scope: Scope; outgoing: any[] }
  | { type: 'gateway:inclusive-auto'; element: any; scope: Scope; outgoing: any[]; cancel: () => void }
  | { type: 'gateway:event-based'; element: any; scope: Scope; catchEvents: any[] }
  | { type: 'message:send'; element: any; scope: Scope; messageFlows: any[] }
  | { type: 'signal:broadcast'; element: any; scope: Scope; signalName: string; targets: any[] }
  | { type: 'simulation:start' }
  | { type: 'simulation:reset' }
  | { type: 'simulation:complete' }
  | { type: 'simulation:terminated'; scope: Scope }
  | { type: 'simulation:error-terminated'; scope: Scope; element: any }
  | { type: 'scope:complete'; scope: Scope }
  | { type: 'simulation:pause' }
  | { type: 'simulation:resume' };

type EventHandler = (event: SimulationEvent) => void;

interface Job {
  execute: () => void;
}

interface ScheduledTimer {
  handle: number;
  callback: () => void;
  delayMs: number;
  startedAt: number;
  remainingMs: number;
  polling?: boolean;
}

export class SimulationEngine {
  private elementRegistry: any;
  private behaviors = new Map<string, Behavior>();
  private listeners: EventHandler[] = [];

  private jobQueue: Job[] = [];
  private processing = false;
  private paused = false;
  private rootScope: Scope | null = null;
  private _generation = 0;
  private nextTimerId = 0;
  private activeTimers = new Map<number, ScheduledTimer>();
  private cancelledElements = new Set<string>();
  private _pendingAnimations = 0;
  private multiInstanceCounts = new Map<string, number>();

  mode: SimulationMode = 'auto';
  speed: number = 1;

  constructor(elementRegistry: any) {
    this.elementRegistry = elementRegistry;
  }

  registerBehavior(type: string, behavior: Behavior): void {
    this.behaviors.set(type, behavior);
  }

  on(handler: EventHandler): void {
    this.listeners.push(handler);
  }

  off(handler: EventHandler): void {
    this.listeners = this.listeners.filter((registeredHandler) => registeredHandler !== handler);
  }

  private emit(event: SimulationEvent): void {
    for (const handler of this.listeners) {
      handler(event);
    }
  }

  start(processElement: any): void {
    this.reset();
    resetScopeCounter();
    this.rootScope = new Scope(processElement);
    this.emit({ type: 'simulation:start' });

    const startEvents = this.getStartEvents(processElement);
    if (startEvents.length === 0) {
      this.emit({ type: 'simulation:complete' });
      return;
    }

    for (const startEvent of startEvents) {
      this.enter(startEvent, this.rootScope);
    }
  }

  startFromElement(processElement: any, startEvent: any): void {
    this.reset();
    resetScopeCounter();
    this.rootScope = new Scope(processElement);
    this.emit({ type: 'simulation:start' });
    this.enter(startEvent, this.rootScope);
  }

  enter(element: any, scope: Scope, viaFlow?: any): void {
    this.enqueue(() => {
      if (scope.state !== 'running') {
        return;
      }

      scope.addToken(element.id);
      this.emit({ type: 'token:enter', element, scope });

      const behavior = this.resolveBehavior(element);
      if (behavior) {
        behavior.enter(element, scope, this, viaFlow);
      }
    });
  }

  exit(element: any, scope: Scope): void {
    if (scope.state !== 'running') {
      return;
    }
    if (this.cancelledElements.delete(element.id)) {
      return;
    }

    scope.removeToken(element.id);
    this.emit({ type: 'token:exit', element, scope });

    const behavior = this.resolveBehavior(element);
    if (behavior?.exit) {
      behavior.exit(element, scope, this);
    } else {
      this.routeToOutgoing(element, scope);
    }
  }

  /**
   * Emit a token:exit event without invoking the behavior's exit() method.
   * Used by behaviors (e.g. gateways) that handle their own routing but
   * still need to signal the visual layer to clean up.
   */
  emitTokenExit(element: any, scope: Scope): void {
    while (scope.getTokenCount(element.id) > 0) {
      scope.removeToken(element.id);
    }
    this.emit({ type: 'token:exit', element, scope });
  }

  /**
   * Routes a token through outgoing sequence flows from the given element.
   * Each sequence flow is animated; on animation completion the target element is entered.
   */
  routeToOutgoing(element: any, scope: Scope): void {
    const outgoing = this.getOutgoingSequenceFlows(element);
    if (outgoing.length === 0) {
      this.tryCompleteScope(scope);
      return;
    }

    for (const connection of outgoing) {
      this.animateFlow(connection, scope, () => {
        this.enter(connection.target, scope, connection);
      });
    }
  }

  /**
   * User interaction: continue from a waiting element (task in step mode)
   * or pick a gateway branch.
   */
  trigger(element: any, scope: Scope, data?: any): void {
    const behavior = this.resolveBehavior(element);
    if (behavior?.signal) {
      behavior.signal(element, scope, this, data);
    }
  }

  /** Signal that an element is waiting for user interaction. */
  signalWaiting(element: any, scope: Scope): void {
    this.emit({ type: 'element:waiting', element, scope });
  }

  /** Signal that a gateway needs user choice. */
  signalGatewayChoice(element: any, scope: Scope, outgoing: any[]): void {
    this.emit({ type: 'gateway:choice', element, scope, outgoing });
  }

  /** Signal that a gateway will auto-route but the user can still intercept. */
  signalGatewayAuto(element: any, scope: Scope, outgoing: any[], chosenFlow: any, cancel: () => void): void {
    this.emit({ type: 'gateway:auto', element, scope, outgoing, chosenFlow, cancel });
  }

  /** Signal that an inclusive gateway needs user multi-select (step mode). */
  signalInclusiveGatewayChoice(element: any, scope: Scope, outgoing: any[]): void {
    this.emit({ type: 'gateway:inclusive-choice', element, scope, outgoing });
  }

  /** Signal that an inclusive gateway will auto-fork but user can intercept. */
  signalInclusiveGatewayAuto(element: any, scope: Scope, outgoing: any[], cancel: () => void): void {
    this.emit({ type: 'gateway:inclusive-auto', element, scope, outgoing, cancel });
  }

  /** Signal that an event-based gateway is waiting for a catch event trigger. */
  signalEventBasedGateway(element: any, scope: Scope, catchEvents: any[]): void {
    this.emit({ type: 'gateway:event-based', element, scope, catchEvents });
  }

  /** Emit a message:send event for the visual layer to animate message flows. */
  emitMessageSend(element: any, scope: Scope, messageFlows: any[]): void {
    this.emit({ type: 'message:send', element, scope, messageFlows });
  }

  /**
   * Broadcast a BPMN signal from the given element. Finds all matching signal
   * catch events within the active process and triggers them. Emits a
   * signal:broadcast event for the visual layer (ripple animation).
   */
  broadcastSignal(element: any, scope: Scope): void {
    const signalName = getSignalName(element);
    if (!signalName) {
      this.emit({ type: 'signal:broadcast', element, scope, signalName: '', targets: [] });
      return;
    }

    const rootScope = this.getRootScope(scope);
    if (!rootScope) {
      this.emit({ type: 'signal:broadcast', element, scope, signalName, targets: [] });
      return;
    }

    const targets: any[] = [];

    this.scanForSignalTargets(rootScope.element, signalName, (target) => {
      if (target.id === element.id) {
        return;
      }

      if (target.type === 'bpmn:IntermediateCatchEvent') {
        const targetScope = this.findScopeWithToken(rootScope, target.id);
        if (targetScope) {
          targets.push(target);
          this.trigger(target, targetScope);
        }
      } else if (target.type === 'bpmn:BoundaryEvent') {
        const hostRef = target.businessObject?.attachedToRef;
        if (!hostRef) {
          return;
        }
        const hostScope = this.findScopeWithToken(rootScope, hostRef.id);
        if (!hostScope) {
          return;
        }
        const hostElement = this.findElementById(rootScope.element, hostRef.id);
        if (!hostElement) {
          return;
        }

        targets.push(target);
        this.fireSignalBoundary(target, hostElement, hostScope);
      }
    });

    this.emit({ type: 'signal:broadcast', element, scope, signalName, targets });
  }

  private fireSignalBoundary(boundaryEvent: any, hostElement: any, hostScope: Scope): void {
    const isInterrupting = boundaryEvent.businessObject?.cancelActivity !== false;

    if (isInterrupting) {
      this.cancelElement(hostElement, hostScope);
    }

    const outgoing = (boundaryEvent.outgoing || []).filter(
      (connection: any) => connection.type === 'bpmn:SequenceFlow',
    );
    for (const connection of outgoing) {
      this.animateFlow(connection, hostScope, () => {
        this.enter(connection.target, hostScope, connection);
      });
    }
  }

  private scanForSignalTargets(container: any, signalName: string, callback: (element: any) => void): void {
    const children: any[] = container.children || [];
    for (const child of children) {
      if (
        (child.type === 'bpmn:IntermediateCatchEvent' || child.type === 'bpmn:BoundaryEvent') &&
        isSignalEvent(child) &&
        getSignalName(child) === signalName
      ) {
        callback(child);
      }
      if (child.children?.length > 0) {
        this.scanForSignalTargets(child, signalName, callback);
      }
    }
  }

  private findScopeWithToken(scope: Scope, elementId: string): Scope | null {
    if (scope.getTokenCount(elementId) > 0) {
      return scope;
    }
    for (const child of scope.children) {
      if (child.state !== 'running') {
        continue;
      }
      const found = this.findScopeWithToken(child, elementId);
      if (found) {
        return found;
      }
    }
    return null;
  }

  private findElementById(container: any, elementId: string): any | null {
    const children: any[] = container.children || [];
    for (const child of children) {
      if (child.businessObject?.id === elementId || child.id === elementId) {
        return child;
      }
      if (child.children?.length > 0) {
        const found = this.findElementById(child, elementId);
        if (found) {
          return found;
        }
      }
    }
    return null;
  }

  private getRootScope(scope: Scope): Scope | null {
    let current = scope;
    while (current.parent) {
      current = current.parent;
    }
    return current;
  }

  /** Cancel an active element: emit token:exit and destroy any child scopes. */
  cancelElement(element: any, scope: Scope): void {
    this.cancelledElements.add(element.id);
    scope.removeToken(element.id);
    this.emit({ type: 'token:exit', element, scope });
    for (const child of scope.children) {
      if (child.element === element && child.state === 'running') {
        child.destroy();
      }
    }
  }

  /** Signal termination of all tokens in a scope. Halts the engine immediately. */
  signalTerminated(scope: Scope): void {
    this.cancelAllTimers();
    this.jobQueue = [];
    this.cancelledElements.clear();
    this._pendingAnimations = 0;
    this.emit({ type: 'simulation:terminated', scope });
  }

  /** Signal error termination (unhandled error end event at root level). Halts the engine. */
  signalErrorTerminated(scope: Scope, element: any): void {
    this.cancelAllTimers();
    this.jobQueue = [];
    this.cancelledElements.clear();
    this._pendingAnimations = 0;
    this.emit({ type: 'simulation:error-terminated', scope, element });
  }

  animateFlow(connection: any, scope: Scope, done: () => void): void {
    this._pendingAnimations++;
    this.emit({
      type: 'flow:animate',
      connection,
      scope,
      done: () => {
        this._pendingAnimations--;
        done();
      },
    });
  }

  tryCompleteScope(scope: Scope): void {
    if (scope.state !== 'running') {
      return;
    }

    if (scope.parent) {
      scope.complete();
      this.emit({ type: 'scope:complete', scope });
      this.exit(scope.element, scope.parent);
    } else {
      this.checkRootCompletion(scope);
    }
  }

  private checkRootCompletion(scope: Scope): void {
    if (scope.state !== 'running') {
      return;
    }
    if (!this.isEngineIdle() || scope.hasActiveWork()) {
      this.scheduleDelay(() => this.checkRootCompletion(scope), 200, true);
      return;
    }
    scope.complete();
    this.emit({ type: 'scope:complete', scope });
    this.emit({ type: 'simulation:complete' });
  }

  /**
   * Schedule a delayed callback that respects pause/resume/reset.
   * Returns a handle that can be passed to `cancelDelay()`.
   */
  scheduleDelay(callback: () => void, delayMs: number, polling = false): number {
    const id = ++this.nextTimerId;
    const gen = this._generation;
    const timer: ScheduledTimer = {
      handle: 0,
      callback,
      delayMs,
      startedAt: performance.now(),
      remainingMs: delayMs,
      polling,
    };
    timer.handle = window.setTimeout(() => {
      this.activeTimers.delete(id);
      if (this._generation !== gen) {
        return;
      }
      callback();
    }, delayMs);
    this.activeTimers.set(id, timer);
    return id;
  }

  isEngineIdle(): boolean {
    if (this._pendingAnimations > 0 || this.jobQueue.length > 0) {
      return false;
    }
    for (const timer of this.activeTimers.values()) {
      if (!timer.polling) {
        return false;
      }
    }
    return true;
  }

  cancelDelay(id: number): void {
    const timer = this.activeTimers.get(id);
    if (timer) {
      clearTimeout(timer.handle);
      this.activeTimers.delete(id);
    }
  }

  private cancelAllTimers(): void {
    for (const timer of this.activeTimers.values()) {
      clearTimeout(timer.handle);
    }
    this.activeTimers.clear();
  }

  private pauseAllTimers(): void {
    const now = performance.now();
    for (const [, timer] of this.activeTimers) {
      clearTimeout(timer.handle);
      timer.remainingMs = Math.max(0, timer.delayMs - (now - timer.startedAt));
    }
  }

  private resumeAllTimers(): void {
    const gen = this._generation;
    for (const [id, timer] of this.activeTimers) {
      timer.startedAt = performance.now();
      timer.delayMs = timer.remainingMs;
      timer.handle = window.setTimeout(() => {
        this.activeTimers.delete(id);
        if (this._generation !== gen) {
          return;
        }
        timer.callback();
      }, timer.remainingMs);
    }
  }

  reset(): void {
    this._generation++;
    this.cancelAllTimers();
    this.cancelledElements.clear();
    this._pendingAnimations = 0;
    this.multiInstanceCounts.clear();
    this.jobQueue = [];
    this.processing = false;
    this.paused = false;
    this.rootScope?.destroy();
    this.rootScope = null;
    this.emit({ type: 'simulation:reset' });
  }

  pause(): void {
    this.paused = true;
    this.pauseAllTimers();
    this.emit({ type: 'simulation:pause' });
  }

  resume(): void {
    this.paused = false;
    this.resumeAllTimers();
    this.emit({ type: 'simulation:resume' });
    this.processQueue();
  }

  setSpeed(multiplier: number): void {
    this.speed = multiplier;
  }

  setMultiInstanceCount(elementId: string, count: number): void {
    this.multiInstanceCounts.set(elementId, count);
  }

  getMultiInstanceCount(elementId: string): number {
    return this.multiInstanceCounts.get(elementId) ?? 3;
  }

  setMode(mode: SimulationMode): void {
    this.mode = mode;
  }

  /** Auto-mode task delay in ms, scaled by speed */
  getTaskDelay(): number {
    return Math.max(200, 800 / this.speed);
  }

  /** Flow animation duration in ms, scaled by speed */
  getFlowDuration(connection: any): number {
    const waypoints: { x: number; y: number }[] = connection.waypoints || [];
    let totalLength = 0;
    for (let i = 1; i < waypoints.length; i++) {
      const dx = waypoints[i].x - waypoints[i - 1].x;
      const dy = waypoints[i].y - waypoints[i - 1].y;
      totalLength += Math.sqrt(dx * dx + dy * dy);
    }
    return Math.max(300, Math.log(Math.max(1, totalLength)) * 200) / this.speed;
  }

  private enqueue(execute: () => void): void {
    this.jobQueue.push({ execute });
    if (!this.processing) {
      this.processQueue();
    }
  }

  private processQueue(): void {
    if (this.paused) {
      return;
    }
    this.processing = true;

    while (this.jobQueue.length > 0 && !this.paused) {
      const job = this.jobQueue.shift()!;
      job.execute();
    }

    this.processing = false;
  }

  private resolveBehavior(element: any): Behavior | undefined {
    const type: string = element.type || '';

    if (this.behaviors.has(type)) {
      return this.behaviors.get(type);
    }

    if (type.includes('Task')) {
      return this.behaviors.get('bpmn:Task');
    }
    if (type.includes('Activity')) {
      return this.behaviors.get('bpmn:Task');
    }
    if (type.includes('Gateway')) {
      return this.behaviors.get(type);
    }

    return undefined;
  }

  private getStartEvents(processElement: any): any[] {
    const children: any[] = processElement.children || [];
    return children.filter((child: any) => child.type === 'bpmn:StartEvent');
  }

  private getOutgoingSequenceFlows(element: any): any[] {
    const outgoing: any[] = element.outgoing || [];
    return outgoing.filter((conn: any) => conn.type === 'bpmn:SequenceFlow');
  }
}
