import { Scope, resetScopeCounter } from './Scope';
import type { Behavior } from './behaviors';
import {
  findEventSubProcessStart,
  getCompensationHandler,
  getMessageFlows,
  getMessageName,
  getSignalName,
  getTimerCycleRepetitions,
  isCompensateEvent,
  isConditionalEvent,
  isEventSubProcess,
  isInterruptingStart,
  isMessageEvent,
  isSignalEvent,
  isTimerCycle,
  isTimerEvent,
  selectStartEvents,
} from './eventDefUtils';
import type { EventCatch } from './eventResolver';

export type SimulationMode = 'auto' | 'step';

export interface Wait {
  id: number;
  kind: 'catch' | 'boundary' | 'event-subprocess-start' | 'event-gateway';
  element: any;
  scope: Scope;
  host?: any;
  candidates?: any[];
  repeatable: boolean;
  fireCount: number;
  timerId?: number;
}

export type SimulationEvent =
  | { type: 'token:enter'; element: any; scope: Scope }
  | { type: 'token:exit'; element: any; scope: Scope }
  | { type: 'flow:animate'; connection: any; scope: Scope; animationId: number; done: () => void }
  | { type: 'element:waiting'; element: any; scope: Scope }
  | { type: 'gateway:choice'; element: any; scope: Scope; outgoing: any[] }
  | { type: 'gateway:auto'; element: any; scope: Scope; outgoing: any[]; chosenFlow: any; cancel: () => void }
  | { type: 'gateway:inclusive-choice'; element: any; scope: Scope; outgoing: any[] }
  | { type: 'gateway:inclusive-auto'; element: any; scope: Scope; outgoing: any[]; cancel: () => void }
  | { type: 'event-gateway:chosen'; element: any; scope: Scope; flow: any }
  | { type: 'message:send'; element: any; scope: Scope; messageFlows: any[]; targets: any[] }
  | { type: 'signal:broadcast'; element: any; scope: Scope; signalName: string; targets: any[] }
  | { type: 'wait:armed'; wait: Wait }
  | { type: 'wait:disarmed'; wait: Wait }
  | { type: 'element:interrupted'; element: any; scope: Scope }
  | { type: 'flows:cancelled'; connections: any[]; animationIds: number[] }
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
  handle: ReturnType<typeof setTimeout>;
  callback: () => void;
  delayMs: number;
  startedAt: number;
  remainingMs: number;
}

export class SimulationEngine {
  readonly elementRegistry: any;
  private behaviors = new Map<string, Behavior>();
  private listeners: EventHandler[] = [];

  private jobQueue: Job[] = [];
  private processing = false;
  private paused = false;
  private rootScope: Scope | null = null;
  private _generation = 0;
  private nextTimerId = 0;
  private nextAnimationId = 0;
  private activeTimers = new Map<number, ScheduledTimer>();
  private multiInstanceCounts = new Map<string, number>();
  private complexJoinThresholds = new Map<string, number>();
  private nextWaitId = 0;
  private armedWaits = new Map<number, Wait>();
  private throwerNames = new Set<string>();
  private boundaryAutoFire = new Set<string>();

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
    this.throwerNames = this.collectThrowerNames(processElement);
    this.emit({ type: 'simulation:start' });

    const startEvents = selectStartEvents(processElement);
    if (startEvents.length === 0) {
      this.emit({ type: 'simulation:complete' });
      return;
    }

    // Only after simulation:start, where the controller re-sends the auto-fire checkboxes its armed starts read.
    const rootScope = this.createScope(processElement, null);
    this.rootScope = rootScope;
    for (const startEvent of startEvents) {
      this.enter(startEvent, rootScope);
    }
  }

  startFromElement(processElement: any, startEvent: any): void {
    this.reset();
    resetScopeCounter();
    this.throwerNames = this.collectThrowerNames(processElement);
    this.emit({ type: 'simulation:start' });
    this.rootScope = this.createScope(processElement, null);
    this.enter(startEvent, this.rootScope);
  }

  /** Creates a scope and arms the message, signal, timer and conditional starts of its event subprocesses. */
  createScope(element: any, parent: Scope | null): Scope {
    const scope = new Scope(element, parent);
    for (const child of element.children || []) {
      const startEvent = isEventSubProcess(child) ? findEventSubProcessStart(child, this.elementRegistry) : undefined;
      if (
        !startEvent ||
        !(
          isTimerEvent(startEvent) ||
          isMessageEvent(startEvent) ||
          isSignalEvent(startEvent) ||
          isConditionalEvent(startEvent)
        )
      ) {
        continue;
      }
      const repeatable = !isInterruptingStart(startEvent) && (!isTimerEvent(startEvent) || isTimerCycle(startEvent));
      this.armWait({ kind: 'event-subprocess-start', element: startEvent, scope, host: child, repeatable });
    }
    return scope;
  }

  enter(element: any, scope: Scope, viaFlow?: any): void {
    this.enqueue(() => this.enterImmediately(element, scope, viaFlow));
  }

  private enterImmediately(element: any, scope: Scope, viaFlow?: any): void {
    if (scope.state !== 'running') {
      return;
    }

    scope.addToken(element.id);
    this.emit({ type: 'token:enter', element, scope });
    // Armed before the behavior runs, so an auto-fire timer precedes the host's own timer of the same delay.
    if (scope.getTokenCount(element.id) === 1) {
      this.armBoundaries(element, scope);
    }

    const behavior = this.resolveBehavior(element);
    if (behavior) {
      behavior.enter(element, scope, this, viaFlow);
    }
  }

  exit(element: any, scope: Scope): void {
    if (scope.state !== 'running') {
      return;
    }
    if (scope.getTokenCount(element.id) === 0) {
      return;
    }

    scope.removeToken(element.id);
    if (scope.getTokenCount(element.id) === 0) {
      this.disarmWaits((wait) => wait.kind === 'boundary' && wait.scope === scope && wait.host === element);
    }
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
   * still need to signal the visual layer to clean up. Removes `tokenCount`
   * tokens of the element, all of them by default.
   */
  emitTokenExit(element: any, scope: Scope, tokenCount = scope.getTokenCount(element.id)): void {
    for (let i = 0; i < tokenCount; i++) {
      scope.removeToken(element.id);
    }
    this.emit({ type: 'token:exit', element, scope });
  }

  /** Remove one token of the element without a token:exit, so its visual stays, then check completion. */
  consumeToken(element: any, scope: Scope): void {
    scope.removeToken(element.id);
    this.tryCompleteScope(scope);
  }

  /**
   * Routes a token through outgoing sequence flows from the given element.
   * Each sequence flow is animated; on animation completion the target element is entered.
   */
  routeToOutgoing(element: any, scope: Scope): void {
    if (this.findCompensationHandler(element)) {
      scope.compensationRegistry = [...scope.compensationRegistry.filter((activity) => activity !== element), element];
    }

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

  /**
   * Deliver the element's message by name: fires every armed catch, Receive Task,
   * message boundary and event-gateway candidate with that name; only when there
   * is none, every armed event-subprocess message start. Emits a message:send
   * event for the visual layer to animate message flows and pulse the targets.
   */
  deliverMessage(element: any, scope: Scope): void {
    const messageName = getMessageName(element);
    const armedWaits = messageName ? this.getArmedWaits() : [];
    const isMatch = (candidate: any) => getMessageName(candidate) === messageName;

    let targets = this.fireMatchingWaits(
      armedWaits.filter((wait) => wait.kind !== 'event-subprocess-start'),
      isMatch,
    );
    if (targets.length === 0) {
      targets = this.fireMatchingWaits(
        armedWaits.filter((wait) => wait.kind === 'event-subprocess-start'),
        isMatch,
      );
    }

    this.emit({ type: 'message:send', element, scope, messageFlows: getMessageFlows(element), targets });
  }

  /**
   * Broadcast a BPMN signal from the given element: fires every armed waiting
   * point with the same signal name at once. Emits a signal:broadcast event
   * for the visual layer (ripple animation).
   */
  broadcastSignal(element: any, scope: Scope): void {
    const signalName = getSignalName(element) ?? '';
    const targets = signalName
      ? this.fireMatchingWaits(this.getArmedWaits(), (candidate) => getSignalName(candidate) === signalName)
      : [];

    this.emit({ type: 'signal:broadcast', element, scope, signalName, targets });
  }

  /** Fires each wait whose element or one of whose candidates matches; returns the matched elements. */
  private fireMatchingWaits(waits: Wait[], isMatch: (candidate: any) => boolean): any[] {
    const targets: any[] = [];
    for (const wait of waits) {
      const target = [wait.element, ...(wait.candidates ?? [])].find(isMatch);
      if (this.armedWaits.has(wait.id) && target) {
        targets.push(target);
        this.fireWait(wait.id, target);
      }
    }
    return targets;
  }

  armWait(properties: Omit<Wait, 'id' | 'timerId' | 'fireCount'>): void {
    const wait: Wait = { ...properties, id: ++this.nextWaitId, fireCount: 0 };
    this.armedWaits.set(wait.id, wait);
    this.scheduleAutoFire(wait);
    this.emit({ type: 'wait:armed', wait });
  }

  private scheduleAutoFire(wait: Wait): void {
    if (this.mode !== 'auto' || wait.timerId !== undefined || !this.canAutoFire(wait)) {
      return;
    }
    wait.timerId = this.scheduleElementDelay(
      wait.element,
      wait.scope,
      () => {
        wait.timerId = undefined;
        const autoFireCandidates = this.getAutoFireCandidates(wait);
        this.fireWait(wait.id, autoFireCandidates[Math.floor(Math.random() * autoFireCandidates.length)]);
      },
      this.getTaskDelay(),
    );
  }

  private cancelAutoFire(wait: Wait): void {
    if (wait.timerId === undefined) {
      return;
    }
    this.cancelDelay(wait.timerId);
    wait.scope.elementTimers.get(wait.element.id)?.delete(wait.timerId);
    wait.timerId = undefined;
  }

  /** `candidate` selects the successor of an event-gateway waiting point; other kinds ignore it. */
  fireWait(waitId: number, candidate?: any): void {
    const wait = this.armedWaits.get(waitId);
    if (!wait) {
      return;
    }
    const chosenFlow = this.getOutgoingSequenceFlows(wait.element).find(
      (connection: any) => connection.target === candidate,
    );
    if (wait.kind === 'event-gateway' && !chosenFlow) {
      return;
    }
    const scopeRunning = wait.scope.state === 'running';
    if (!wait.repeatable || !scopeRunning) {
      this.disarmWait(waitId);
    }
    if (!scopeRunning) {
      return;
    }
    if (wait.repeatable) {
      wait.fireCount++;
      const repetitions = getTimerCycleRepetitions(wait.element);
      if (repetitions !== undefined && wait.fireCount >= repetitions) {
        this.disarmWait(waitId);
      } else {
        this.scheduleAutoFire(wait);
      }
    }

    if (wait.kind === 'catch') {
      this.exit(wait.element, wait.scope);
      return;
    }

    if (wait.kind === 'event-gateway') {
      this.emit({ type: 'event-gateway:chosen', element: wait.element, scope: wait.scope, flow: chosenFlow });
      this.emitTokenExit(wait.element, wait.scope, 1);
      this.animateFlow(chosenFlow, wait.scope, () => this.enter(candidate, wait.scope, chosenFlow));
      return;
    }

    if (wait.kind === 'event-subprocess-start') {
      this.enterCatch({ element: wait.host, scope: wait.scope, interrupting: isInterruptingStart(wait.element) });
      return;
    }

    this.enterCatch({
      element: wait.element,
      scope: wait.scope,
      host: wait.host,
      interrupting: wait.element.businessObject?.cancelActivity !== false,
    });
  }

  /**
   * Enters a boundary or an event subprocess. An interrupting one then interrupts its host, or
   * the rest of its scope together with the scope's other event-subprocess starts, except
   * `keepElementIds`.
   */
  enterCatch(eventCatch: EventCatch, keepElementIds = new Set<string>()): void {
    const { element, scope, host, interrupting } = eventCatch;
    this.enter(element, scope);
    if (!interrupting) {
      return;
    }
    if (host) {
      this.interruptElement(host, scope);
      return;
    }
    this.disarmWaits((wait) => wait.kind === 'event-subprocess-start' && wait.scope === scope);
    this.interruptAllInScope(scope, new Set([element.id, ...keepElementIds]));
  }

  disarmWait(waitId: number): void {
    const wait = this.armedWaits.get(waitId);
    if (!wait) {
      return;
    }
    this.armedWaits.delete(waitId);
    this.cancelAutoFire(wait);
    this.emit({ type: 'wait:disarmed', wait });
  }

  getArmedWaits(): Wait[] {
    return [...this.armedWaits.values()].filter((wait) => wait.scope.state === 'running');
  }

  setBoundaryAutoFire(elementId: string, enabled: boolean): void {
    if (enabled) {
      this.boundaryAutoFire.add(elementId);
    } else {
      this.boundaryAutoFire.delete(elementId);
    }
    for (const wait of this.armedWaits.values()) {
      if (wait.element.id !== elementId) {
        continue;
      }
      if (enabled) {
        this.scheduleAutoFire(wait);
      } else {
        this.cancelAutoFire(wait);
      }
    }
  }

  private canAutoFire(wait: Wait): boolean {
    if (wait.kind === 'boundary' || wait.kind === 'event-subprocess-start') {
      return this.boundaryAutoFire.has(wait.element.id);
    }
    if (wait.kind === 'event-gateway') {
      return this.getAutoFireCandidates(wait).length > 0;
    }
    return this.canCatchAutoFire(wait.element);
  }

  private getAutoFireCandidates(wait: Wait): any[] {
    return (wait.candidates ?? []).filter((candidate) => this.canCatchAutoFire(candidate));
  }

  private canCatchAutoFire(element: any): boolean {
    const throwerName = this.getThrowerName(element);
    return !(throwerName && this.throwerNames.has(throwerName));
  }

  /** Signal and message names share one index, so each is prefixed with its kind. */
  private getThrowerName(element: any): string | undefined {
    const signalName = isSignalEvent(element) ? getSignalName(element) : undefined;
    if (signalName) {
      return `signal:${signalName}`;
    }
    const messageName = getMessageName(element);
    return messageName ? `message:${messageName}` : undefined;
  }

  private armBoundaries(host: any, scope: Scope): void {
    const attachers: any[] = host.attachers || [];
    for (const boundary of attachers) {
      if (
        boundary.type !== 'bpmn:BoundaryEvent' ||
        !(isTimerEvent(boundary) || isMessageEvent(boundary) || isSignalEvent(boundary) || isConditionalEvent(boundary))
      ) {
        continue;
      }
      const repeatable =
        boundary.businessObject?.cancelActivity === false &&
        (isTimerCycle(boundary) || isMessageEvent(boundary) || isSignalEvent(boundary));
      this.armWait({ kind: 'boundary', element: boundary, scope, host, repeatable });
    }
  }

  private disarmWaits(predicate: (wait: Wait) => boolean): void {
    for (const wait of [...this.armedWaits.values()]) {
      if (predicate(wait)) {
        this.disarmWait(wait.id);
      }
    }
  }

  private collectThrowerNames(container: any, names = new Set<string>()): Set<string> {
    const children: any[] = container.children || [];
    for (const child of children) {
      const isThrower =
        child.type === 'bpmn:IntermediateThrowEvent' ||
        child.type === 'bpmn:EndEvent' ||
        child.type === 'bpmn:SendTask';
      const throwerName = isThrower ? this.getThrowerName(child) : undefined;
      if (throwerName) {
        names.add(throwerName);
      }
      this.collectThrowerNames(child, names);
    }
    return names;
  }

  /**
   * Removes every token of the element together with its timers, waiting points,
   * child scopes and loop, multi-instance and join state. Checks completion right
   * away, so a replacement token must be routed before calling this.
   */
  interruptElement(element: any, scope: Scope): void {
    this.clearElement(element, scope);
    this.tryCompleteScope(scope);
  }

  /** Interrupts every token-holding element and every token on a flow in the scope. */
  interruptAllInScope(scope: Scope, keepElementIds: Set<string>): void {
    this.interruptMatching(scope, (id) => !keepElementIds.has(id));
  }

  /** Interrupts the token-holding elements and the tokens on flows of the scope whose ids are in the region. */
  interruptRegion(scope: Scope, regionIds: Set<string>): void {
    this.interruptMatching(scope, (id) => regionIds.has(id));
  }

  private interruptMatching(scope: Scope, isInterrupted: (id: string) => boolean): void {
    for (const element of this.getTokenHoldingElements(scope)) {
      if (isInterrupted(element.id)) {
        this.clearElement(element, scope);
      }
    }
    // Compensation helper scopes hang off the throwing scope without a token-holding element of their own there.
    for (const child of [...scope.children]) {
      if (child.state === 'running' && child.onComplete && isInterrupted(child.element.id)) {
        this.interruptScope(child);
      }
    }
    this.emitFlowsCancelled(scope.takeInFlight((connection) => isInterrupted(connection.id)));
    this.tryCompleteScope(scope);
  }

  private interruptScope(scope: Scope): void {
    for (const element of this.getTokenHoldingElements(scope)) {
      this.clearElement(element, scope);
    }
    for (const child of [...scope.children]) {
      if (child.state === 'running') {
        this.interruptScope(child);
      }
    }
    this.emitFlowsCancelled(scope.takeInFlight(() => true));
    this.disarmWaits((wait) => wait.scope === scope);
    scope.destroy();
  }

  private emitFlowsCancelled(cancelled: { animationId: number; connection: any }[]): void {
    this.emit({
      type: 'flows:cancelled',
      connections: cancelled.map((entry) => entry.connection),
      animationIds: cancelled.map((entry) => entry.animationId),
    });
  }

  private clearElement(element: any, scope: Scope): void {
    while (scope.getTokenCount(element.id) > 0) {
      scope.removeToken(element.id);
    }
    for (const timerId of scope.elementTimers.get(element.id) ?? []) {
      this.cancelDelay(timerId);
    }
    scope.elementTimers.delete(element.id);
    this.disarmWaits((wait) => wait.scope === scope && (wait.element === element || wait.host === element));
    for (const child of scope.children) {
      if (child.element === element && child.state === 'running') {
        this.interruptScope(child);
      }
    }
    scope.resetLoopCounter(element.id);
    scope.resetParallelMi(element.id);
    scope.resetJoinCounter(element.id);
    scope.resetSatisfiedJoinFlows(element.id);
    this.emit({ type: 'element:interrupted', element, scope });
  }

  /** Includes the scope's own element, which holds the handler's token in a compensation helper scope. */
  private getTokenHoldingElements(scope: Scope): any[] {
    const children: any[] = scope.element.children || [];
    return [scope.element, ...children].filter((child: any) => scope.getTokenCount(child.id) > 0);
  }

  /** Signal termination of all tokens in a scope. Halts the engine immediately. */
  signalTerminated(scope: Scope): void {
    this.cancelAllTimers();
    this.jobQueue = [];
    this.emit({ type: 'simulation:terminated', scope });
  }

  /** Signal error termination (unhandled error end event at root level). Halts the engine. */
  signalErrorTerminated(scope: Scope, element: any): void {
    this.cancelAllTimers();
    this.jobQueue = [];
    this.emit({ type: 'simulation:error-terminated', scope, element });
  }

  animateFlow(connection: any, scope: Scope, done: () => void): void {
    const animationId = ++this.nextAnimationId;
    scope.addInFlight(animationId, connection);
    this.emit({
      type: 'flow:animate',
      connection,
      scope,
      animationId,
      done: () => {
        if (scope.removeInFlight(animationId) && scope.state === 'running') {
          done();
        }
      },
    });
  }

  /** Queued so that routing still in progress within the same step finishes first. */
  tryCompleteScope(scope: Scope): void {
    this.enqueue(() => {
      if (scope.state !== 'running' || !scope.isQuiescent()) {
        return;
      }

      const nextActivity = scope.pendingSequentialActivities.shift();
      if (nextActivity) {
        // Not queued: a second completion check already waiting in the queue must see the scope busy.
        this.enterImmediately(nextActivity, scope);
        return;
      }

      scope.complete();
      this.disarmWaits((wait) => wait.scope === scope);
      this.emit({ type: 'scope:complete', scope });
      if (scope.onComplete) {
        scope.onComplete();
      } else if (scope.parent) {
        this.exit(scope.element, scope.parent);
      } else {
        this.emit({ type: 'simulation:complete' });
      }
    });
  }

  /**
   * Compensates the scope's completed activities last in, first out, only the one with id
   * `activityReference` when given, each at most once. Every handler runs in a helper child
   * scope, which keeps `scope` from completing; `onDone` follows the last handler.
   */
  runCompensation(scope: Scope, activityReference: string | undefined, onDone: () => void): void {
    const activity = scope.compensationRegistry.findLast(
      (entry) => activityReference === undefined || entry.id === activityReference,
    );
    if (!activity) {
      onDone();
      // The throwing token may have been interrupted meanwhile, and then nothing else re-checks the scope.
      this.tryCompleteScope(scope);
      return;
    }
    scope.compensationRegistry = scope.compensationRegistry.filter((entry) => entry !== activity);

    const handler = this.findCompensationHandler(activity);
    const enterHandler = () => {
      const helperScope = this.createScope(handler, scope);
      helperScope.onComplete = () => this.runCompensation(scope, activityReference, onDone);
      this.enter(handler, helperScope);
    };
    const association = (handler.incoming || []).find((connection: any) => connection.type === 'bpmn:Association');
    if (association) {
      this.animateFlow(association, scope, enterHandler);
    } else {
      enterHandler();
    }
  }

  /** The compensation event subprocess of an expanded subprocess, else the handler of the activity's compensation boundary. */
  private findCompensationHandler(activity: any): any | undefined {
    const eventSubProcess = (activity.children || []).find((child: any) => {
      const startEvent = isEventSubProcess(child) ? findEventSubProcessStart(child, this.elementRegistry) : undefined;
      return startEvent !== undefined && isCompensateEvent(startEvent);
    });
    if (eventSubProcess) {
      return eventSubProcess;
    }
    const boundary = (activity.attachers || []).find(
      (attacher: any) => attacher.type === 'bpmn:BoundaryEvent' && isCompensateEvent(attacher),
    );
    return boundary ? getCompensationHandler(boundary) : undefined;
  }

  /**
   * Schedule a delayed callback that respects pause/resume/reset.
   * Returns a handle that can be passed to `cancelDelay()`.
   */
  scheduleDelay(callback: () => void, delayMs: number): number {
    const id = ++this.nextTimerId;
    const gen = this._generation;
    const timer: ScheduledTimer = {
      handle: setTimeout(() => {
        this.activeTimers.delete(id);
        if (this._generation !== gen) {
          return;
        }
        callback();
      }, delayMs),
      callback,
      delayMs,
      startedAt: performance.now(),
      remainingMs: delayMs,
    };
    this.activeTimers.set(id, timer);
    return id;
  }

  /** Like `scheduleDelay`, but the timer is cancelled together with the element by `interruptElement`. */
  scheduleElementDelay(element: any, scope: Scope, callback: () => void, delayMs: number): number {
    const timerIds = scope.elementTimers.get(element.id) ?? new Set<number>();
    scope.elementTimers.set(element.id, timerIds);
    const timerId = this.scheduleDelay(() => {
      timerIds.delete(timerId);
      callback();
    }, delayMs);
    timerIds.add(timerId);
    return timerId;
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
      timer.handle = setTimeout(() => {
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
    this.multiInstanceCounts.clear();
    this.complexJoinThresholds.clear();
    this.armedWaits.clear();
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

  setComplexJoinThreshold(elementId: string, threshold: number): void {
    this.complexJoinThresholds.set(elementId, threshold);
  }

  /** Number of arrivals a Complex join waits for: all incoming flows by default, clamped to 1..incoming count. */
  getComplexJoinThreshold(element: any): number {
    const incomingCount = (element.incoming || []).filter((conn: any) => conn.type === 'bpmn:SequenceFlow').length;
    return Math.min(Math.max(this.complexJoinThresholds.get(element.id) ?? incomingCount, 1), incomingCount);
  }

  /** Acts only on waiting points; task and gateway delays already running still finish. */
  setMode(mode: SimulationMode): void {
    this.mode = mode;
    for (const wait of this.armedWaits.values()) {
      if (mode === 'auto') {
        this.scheduleAutoFire(wait);
      } else {
        this.cancelAutoFire(wait);
      }
    }
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

  private getOutgoingSequenceFlows(element: any): any[] {
    const outgoing: any[] = element.outgoing || [];
    return outgoing.filter((conn: any) => conn.type === 'bpmn:SequenceFlow');
  }
}
