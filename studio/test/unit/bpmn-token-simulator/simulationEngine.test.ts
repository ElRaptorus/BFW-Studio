import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SimulationEngine,
  type SimulationEvent,
} from '../../../src/modules/bpmn-token-simulator/core/SimulationEngine';
import { registerAllBehaviors } from '../../../src/modules/bpmn-token-simulator/core/behaviors';
import { resolveError } from '../../../src/modules/bpmn-token-simulator/core/eventResolver';
import { selectInclusiveFlows } from '../../../src/modules/bpmn-token-simulator/core/graphUtils';
import { getIterationCount } from '../../../src/modules/bpmn-token-simulator/core/loopUtils';

function createShape(id: string, type: string, parent?: any): any {
  const shape = { id, type, businessObject: { id, $type: type }, incoming: [], outgoing: [], children: [], parent };
  parent?.children.push(shape);
  return shape;
}

function createEvent(id: string, type: string, parent: any, definitionType: string, definition: any = {}): any {
  const shape = createShape(id, type, parent);
  shape.businessObject.eventDefinitions = [{ $type: definitionType, ...definition }];
  return shape;
}

function attachBoundary(
  id: string,
  host: any,
  definitionType: string,
  definition: any = {},
  cancelActivity = true,
): any {
  const boundary = createEvent(id, 'bpmn:BoundaryEvent', host.parent, definitionType, definition);
  boundary.businessObject.cancelActivity = cancelActivity;
  boundary.host = host;
  host.attachers = [...(host.attachers ?? []), boundary];
  return boundary;
}

function connect(source: any, target: any): any {
  const id = `${source.id}_to_${target.id}`;
  const connection = {
    id,
    type: 'bpmn:SequenceFlow',
    businessObject: { id },
    source,
    target,
    waypoints: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ],
  };
  source.outgoing.push(connection);
  target.incoming.push(connection);
  return connection;
}

/**
 * Runs the headless engine. Flow animations finish asynchronously after 1 ms of
 * fake time, like real animations, except on connections listed in
 * `heldConnectionIds`, which finish on `releaseFlow`. `settle` lets every
 * pending animation chain finish without reaching any task delay.
 */
function createHarness(heldConnectionIds: string[] = []) {
  const engine = new SimulationEngine({ get: () => undefined });
  registerAllBehaviors(engine);
  const events: SimulationEvent[] = [];
  const heldAnimations = new Map<string, () => void>();

  engine.on((event) => {
    events.push(event);
    if (event.type !== 'flow:animate') {
      return;
    }
    if (heldConnectionIds.includes(event.connection.id)) {
      heldAnimations.set(event.connection.id, event.done);
    } else {
      setTimeout(event.done, 1);
    }
  });

  const eventsFor = (type: SimulationEvent['type'], elementId?: string): SimulationEvent[] =>
    events.filter(
      (event) => event.type === type && (elementId === undefined || (event as any).element?.id === elementId),
    );

  const settle = (): void => {
    vi.advanceTimersByTime(50);
  };

  const releaseFlow = (connectionId: string): void => {
    const done = heldAnimations.get(connectionId);
    heldAnimations.delete(connectionId);
    done?.();
    settle();
  };

  return { engine, events, eventsFor, releaseFlow, settle };
}

describe('SimulationEngine live-token accounting', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('completes a subprocess scope only when no token remains anywhere in it, exiting its host once', () => {
    const process = createShape('Process', 'bpmn:Process');
    const start = createShape('Start', 'bpmn:StartEvent', process);
    const subProcess = createShape('SubProcess', 'bpmn:SubProcess', process);
    const end = createShape('End', 'bpmn:EndEvent', process);
    connect(start, subProcess);
    connect(subProcess, end);
    const innerStart = createShape('InnerStart', 'bpmn:StartEvent', subProcess);
    const fork = createShape('Fork', 'bpmn:ParallelGateway', subProcess);
    const endA = createShape('EndA', 'bpmn:EndEvent', subProcess);
    const endB = createShape('EndB', 'bpmn:EndEvent', subProcess);
    connect(innerStart, fork);
    connect(fork, endA);
    const flowToEndB = connect(fork, endB);

    const { engine, events, eventsFor, releaseFlow, settle } = createHarness([flowToEndB.id]);
    engine.start(process);
    settle();

    expect(eventsFor('token:enter', 'EndA')).toHaveLength(1);
    expect(eventsFor('token:exit', 'SubProcess')).toHaveLength(0);
    expect(eventsFor('simulation:complete')).toHaveLength(0);

    releaseFlow(flowToEndB.id);

    const hostExits = eventsFor('token:exit', 'SubProcess');
    expect(hostExits).toHaveLength(1);
    expect(events.indexOf(hostExits[0])).toBeGreaterThan(events.indexOf(eventsFor('token:enter', 'EndB')[0]));
    expect(eventsFor('token:enter', 'End')).toHaveLength(1);
    expect(eventsFor('simulation:complete')).toHaveLength(1);
  });

  it('does not complete the root while a task waits in step mode', () => {
    const process = createShape('Process', 'bpmn:Process');
    const start = createShape('Start', 'bpmn:StartEvent', process);
    const fork = createShape('Fork', 'bpmn:ParallelGateway', process);
    const task = createShape('Task', 'bpmn:Task', process);
    const endAfterTask = createShape('EndAfterTask', 'bpmn:EndEvent', process);
    const endDirect = createShape('EndDirect', 'bpmn:EndEvent', process);
    connect(start, fork);
    connect(fork, task);
    connect(fork, endDirect);
    connect(task, endAfterTask);

    const { engine, eventsFor, settle } = createHarness();
    engine.setMode('step');
    engine.start(process);
    vi.advanceTimersByTime(10_000);

    expect(eventsFor('token:enter', 'EndDirect')).toHaveLength(1);
    expect(eventsFor('simulation:complete')).toHaveLength(0);

    const waiting = eventsFor('element:waiting', 'Task')[0] as Extract<SimulationEvent, { type: 'element:waiting' }>;
    engine.trigger(task, waiting.scope);
    settle();

    expect(eventsFor('token:enter', 'EndAfterTask')).toHaveLength(1);
    expect(eventsFor('simulation:complete')).toHaveLength(1);
  });

  it('never lets a timer of an interrupted element act on a later visit of that element', () => {
    const process = createShape('Process', 'bpmn:Process');
    const start = createShape('Start', 'bpmn:StartEvent', process);
    const fork = createShape('Fork', 'bpmn:ParallelGateway', process);
    const task = createShape('Task', 'bpmn:Task', process);
    const end = createShape('End', 'bpmn:EndEvent', process);
    const holdEnd = createShape('HoldEnd', 'bpmn:EndEvent', process);
    connect(start, fork);
    connect(fork, task);
    const heldFlow = connect(fork, holdEnd);
    connect(task, end);

    const { engine, eventsFor, releaseFlow, settle } = createHarness([heldFlow.id]);
    const taskDelay = engine.getTaskDelay();
    engine.start(process);
    settle();
    const scope = (eventsFor('token:enter', 'Task')[0] as Extract<SimulationEvent, { type: 'token:enter' }>).scope;

    vi.advanceTimersByTime(taskDelay / 2);
    engine.interruptElement(task, scope);
    engine.enter(task, scope);

    vi.advanceTimersByTime(taskDelay / 2);
    expect(eventsFor('token:exit', 'Task')).toHaveLength(0);
    expect(scope.getTokenCount('Task')).toBe(1);
    expect(eventsFor('token:enter', 'End')).toHaveLength(0);

    vi.advanceTimersByTime(taskDelay / 2);
    settle();
    expect(eventsFor('token:exit', 'Task')).toHaveLength(1);
    expect(eventsFor('token:enter', 'End')).toHaveLength(1);

    releaseFlow(heldFlow.id);
    expect(eventsFor('simulation:complete')).toHaveLength(1);
  });

  it('holds an inclusive join while a token still travels along a flow towards an unsatisfied branch', () => {
    const process = createShape('Process', 'bpmn:Process');
    const start = createShape('Start', 'bpmn:StartEvent', process);
    const split = createShape('Split', 'bpmn:InclusiveGateway', process);
    const task = createShape('Task', 'bpmn:Task', process);
    const join = createShape('Join', 'bpmn:InclusiveGateway', process);
    const end = createShape('End', 'bpmn:EndEvent', process);
    connect(start, split);
    const flowToJoin = connect(split, join);
    const flowToTask = connect(split, task);
    connect(task, join);
    connect(join, end);

    const { engine, eventsFor, releaseFlow, settle } = createHarness([flowToJoin.id, flowToTask.id]);
    const taskDelay = engine.getTaskDelay();
    engine.start(process);
    settle();
    vi.advanceTimersByTime(taskDelay);
    releaseFlow(flowToJoin.id);

    expect(eventsFor('token:enter', 'Join')).toHaveLength(1);
    vi.advanceTimersByTime(10_000);
    expect(eventsFor('token:exit', 'Join')).toHaveLength(0);
    expect(eventsFor('token:enter', 'End')).toHaveLength(0);

    releaseFlow(flowToTask.id);
    vi.advanceTimersByTime(taskDelay);
    settle();

    expect(eventsFor('token:enter', 'Join')).toHaveLength(2);
    expect(eventsFor('token:exit', 'Join')).toHaveLength(1);
    expect(eventsFor('token:enter', 'End')).toHaveLength(1);
  });

  it('holds an inclusive join while the last token travels along its own flow into the join', () => {
    const process = createShape('Process', 'bpmn:Process');
    const start = createShape('Start', 'bpmn:StartEvent', process);
    const split = createShape('Split', 'bpmn:InclusiveGateway', process);
    const task = createShape('Task', 'bpmn:Task', process);
    const join = createShape('Join', 'bpmn:InclusiveGateway', process);
    const end = createShape('End', 'bpmn:EndEvent', process);
    connect(start, split);
    const flowToJoin = connect(split, join);
    const flowToTask = connect(split, task);
    const flowFromTaskToJoin = connect(task, join);
    connect(join, end);

    const { engine, eventsFor, releaseFlow, settle } = createHarness([
      flowToJoin.id,
      flowToTask.id,
      flowFromTaskToJoin.id,
    ]);
    engine.start(process);
    settle();
    vi.advanceTimersByTime(engine.getTaskDelay());
    releaseFlow(flowToJoin.id);
    releaseFlow(flowToTask.id);
    vi.advanceTimersByTime(10_000);
    expect(eventsFor('token:exit', 'Task')).toHaveLength(1);
    expect(eventsFor('token:enter', 'End')).toHaveLength(0);

    releaseFlow(flowFromTaskToJoin.id);
    vi.advanceTimersByTime(10_000);
    expect(eventsFor('token:exit', 'Join')).toHaveLength(1);
    expect(eventsFor('token:enter', 'End')).toHaveLength(1);
  });
});

const SIGNAL = 'bpmn:SignalEventDefinition';
const TIMER = 'bpmn:TimerEventDefinition';

describe('SimulationEngine waiting points, boundaries and signals', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('removes the host token and its timer when an interrupting boundary fires, so the host never exits', () => {
    const process = createShape('Process', 'bpmn:Process');
    const start = createShape('Start', 'bpmn:StartEvent', process);
    const task = createShape('Task', 'bpmn:Task', process);
    const end = createShape('End', 'bpmn:EndEvent', process);
    const boundaryEnd = createShape('BoundaryEnd', 'bpmn:EndEvent', process);
    connect(start, task);
    connect(task, end);
    const boundary = attachBoundary('Boundary', task, TIMER, { timeDuration: {} });
    connect(boundary, boundaryEnd);

    const { engine, eventsFor, settle } = createHarness();
    const taskDelay = engine.getTaskDelay();
    engine.start(process);
    settle();
    const [boundaryWait] = engine.getArmedWaits();
    expect(boundaryWait.element).toBe(boundary);

    vi.advanceTimersByTime(taskDelay / 2);
    engine.fireWait(boundaryWait.id);
    vi.advanceTimersByTime(10_000);

    expect(eventsFor('element:interrupted', 'Task')).toHaveLength(1);
    expect(eventsFor('token:exit', 'Task')).toHaveLength(0);
    expect(eventsFor('token:enter', 'End')).toHaveLength(0);
    expect(eventsFor('token:enter', 'BoundaryEnd')).toHaveLength(1);
    expect(engine.getArmedWaits()).toHaveLength(0);
    expect(eventsFor('simulation:complete')).toHaveLength(1);
  });

  it('auto-fires a boundary only when its checkbox is enabled', () => {
    const buildProcess = () => {
      const process = createShape('Process', 'bpmn:Process');
      const start = createShape('Start', 'bpmn:StartEvent', process);
      const task = createShape('Task', 'bpmn:Task', process);
      const end = createShape('End', 'bpmn:EndEvent', process);
      const boundaryEnd = createShape('BoundaryEnd', 'bpmn:EndEvent', process);
      connect(start, task);
      connect(task, end);
      connect(attachBoundary('Boundary', task, TIMER, { timeDuration: {} }), boundaryEnd);
      return process;
    };

    const unchecked = createHarness();
    unchecked.engine.start(buildProcess());
    vi.advanceTimersByTime(10_000);
    expect(unchecked.eventsFor('token:enter', 'BoundaryEnd')).toHaveLength(0);
    expect(unchecked.eventsFor('token:enter', 'End')).toHaveLength(1);

    const checked = createHarness();
    checked.engine.setBoundaryAutoFire('Boundary', true);
    checked.engine.start(buildProcess());
    vi.advanceTimersByTime(10_000);
    expect(checked.eventsFor('token:enter', 'BoundaryEnd')).toHaveLength(1);
    expect(checked.eventsFor('token:enter', 'End')).toHaveLength(0);
  });

  it('keeps a repeatable non-interrupting boundary armed after firing, while an interrupting one disarms all of its host', () => {
    const process = createShape('Process', 'bpmn:Process');
    const start = createShape('Start', 'bpmn:StartEvent', process);
    const task = createShape('Task', 'bpmn:Task', process);
    const end = createShape('End', 'bpmn:EndEvent', process);
    connect(start, task);
    connect(task, end);
    const repeating = attachBoundary('Repeating', task, SIGNAL, { signalRef: { name: 'Alarm' } }, false);
    const oneShot = attachBoundary('OneShot', task, TIMER, { timeDuration: {} }, false);
    const interrupting = attachBoundary('Interrupting', task, TIMER, { timeDuration: {} });
    for (const boundary of [repeating, oneShot, interrupting]) {
      connect(boundary, createShape(`${boundary.id}End`, 'bpmn:EndEvent', process));
    }

    const { engine, eventsFor, settle } = createHarness();
    engine.setMode('step');
    engine.start(process);
    settle();
    const waitFor = (element: any) => engine.getArmedWaits().find((wait) => wait.element === element);

    engine.fireWait(waitFor(repeating)!.id);
    engine.fireWait(waitFor(repeating)!.id);
    settle();
    expect(eventsFor('token:enter', 'RepeatingEnd')).toHaveLength(2);
    expect(waitFor(repeating)).toBeDefined();

    engine.fireWait(waitFor(oneShot)!.id);
    settle();
    expect(eventsFor('token:enter', 'OneShotEnd')).toHaveLength(1);
    expect(waitFor(oneShot)).toBeUndefined();

    const taskScope = waitFor(interrupting)!.scope;
    expect(taskScope.getTokenCount('Task')).toBe(1);
    engine.fireWait(waitFor(interrupting)!.id);
    settle();
    expect(eventsFor('token:enter', 'InterruptingEnd')).toHaveLength(1);
    expect(taskScope.getTokenCount('Task')).toBe(0);
    expect(engine.getArmedWaits()).toHaveLength(0);
    expect(eventsFor('simulation:complete')).toHaveLength(1);
  });

  it('fires a waiting catch exactly once when a signal arrives before its auto timer', () => {
    const process = createShape('Process', 'bpmn:Process');
    const start = createShape('Start', 'bpmn:StartEvent', process);
    const signalCatch = createEvent('Catch', 'bpmn:IntermediateCatchEvent', process, SIGNAL, {
      signalRef: { name: 'Go' },
    });
    const end = createShape('End', 'bpmn:EndEvent', process);
    connect(start, signalCatch);
    connect(signalCatch, end);
    const externalThrow = createEvent('ExternalThrow', 'bpmn:IntermediateThrowEvent', undefined, SIGNAL, {
      signalRef: { name: 'Go' },
    });

    const { engine, eventsFor, settle } = createHarness();
    engine.start(process);
    settle();
    const scope = (eventsFor('token:enter', 'Catch')[0] as Extract<SimulationEvent, { type: 'token:enter' }>).scope;

    vi.advanceTimersByTime(engine.getTaskDelay() / 2);
    engine.broadcastSignal(externalThrow, scope);
    vi.advanceTimersByTime(10_000);

    expect(eventsFor('token:exit', 'Catch')).toHaveLength(1);
    expect(eventsFor('token:enter', 'End')).toHaveLength(1);
    const broadcast = eventsFor('signal:broadcast')[0] as Extract<SimulationEvent, { type: 'signal:broadcast' }>;
    expect(broadcast.targets).toEqual([signalCatch]);
  });

  it('auto-fires a signal catch only when no thrower of its signal exists in the pool', () => {
    const process = createShape('Process', 'bpmn:Process');
    const start = createShape('Start', 'bpmn:StartEvent', process);
    const fork = createShape('Fork', 'bpmn:ParallelGateway', process);
    const catchWithThrower = createEvent('CatchWithThrower', 'bpmn:IntermediateCatchEvent', process, SIGNAL, {
      signalRef: { name: 'Go' },
    });
    const catchWithoutThrower = createEvent('CatchWithoutThrower', 'bpmn:IntermediateCatchEvent', process, SIGNAL, {
      signalRef: { name: 'Other' },
    });
    createEvent('UnreachedThrow', 'bpmn:IntermediateThrowEvent', process, SIGNAL, { signalRef: { name: 'Go' } });
    connect(start, fork);
    connect(fork, catchWithThrower);
    connect(fork, catchWithoutThrower);
    connect(catchWithThrower, createShape('EndA', 'bpmn:EndEvent', process));
    connect(catchWithoutThrower, createShape('EndB', 'bpmn:EndEvent', process));

    const { engine, eventsFor } = createHarness();
    engine.start(process);
    vi.advanceTimersByTime(10_000);

    expect(eventsFor('token:exit', 'CatchWithoutThrower')).toHaveLength(1);
    expect(eventsFor('token:exit', 'CatchWithThrower')).toHaveLength(0);
    expect(engine.getArmedWaits().map((wait) => wait.element)).toEqual([catchWithThrower]);
    expect(eventsFor('simulation:complete')).toHaveLength(0);
  });

  it('delivers a signal to waiting catches in different scopes at the same time', () => {
    const process = createShape('Process', 'bpmn:Process');
    const start = createShape('Start', 'bpmn:StartEvent', process);
    const fork = createShape('Fork', 'bpmn:ParallelGateway', process);
    const subProcess = createShape('SubProcess', 'bpmn:SubProcess', process);
    const rootCatch = createEvent('RootCatch', 'bpmn:IntermediateCatchEvent', process, SIGNAL, {
      signalRef: { name: 'Go' },
    });
    const task = createShape('Task', 'bpmn:Task', process);
    const signalThrow = createEvent('Throw', 'bpmn:IntermediateThrowEvent', process, SIGNAL, {
      signalRef: { name: 'Go' },
    });
    connect(start, fork);
    connect(fork, subProcess);
    connect(fork, rootCatch);
    connect(fork, task);
    connect(task, signalThrow);
    connect(subProcess, createShape('EndSub', 'bpmn:EndEvent', process));
    connect(rootCatch, createShape('EndRoot', 'bpmn:EndEvent', process));
    connect(signalThrow, createShape('EndThrow', 'bpmn:EndEvent', process));
    const innerStart = createShape('InnerStart', 'bpmn:StartEvent', subProcess);
    const innerCatch = createEvent('InnerCatch', 'bpmn:IntermediateCatchEvent', subProcess, SIGNAL, {
      signalRef: { name: 'Go' },
    });
    connect(innerStart, innerCatch);
    connect(innerCatch, createShape('InnerEnd', 'bpmn:EndEvent', subProcess));

    const { engine, eventsFor, settle } = createHarness();
    engine.start(process);
    settle();
    expect(engine.getArmedWaits()).toHaveLength(2);

    vi.advanceTimersByTime(engine.getTaskDelay());
    settle();

    const broadcast = eventsFor('signal:broadcast')[0] as Extract<SimulationEvent, { type: 'signal:broadcast' }>;
    expect(new Set(broadcast.targets)).toEqual(new Set([innerCatch, rootCatch]));
    expect(eventsFor('token:exit', 'InnerCatch')).toHaveLength(1);
    expect(eventsFor('token:exit', 'RootCatch')).toHaveLength(1);
    expect(eventsFor('token:enter', 'InnerEnd')).toHaveLength(1);
    expect(eventsFor('token:enter', 'EndRoot')).toHaveLength(1);
    expect(engine.getArmedWaits()).toHaveLength(0);
    expect(eventsFor('simulation:complete')).toHaveLength(1);
  });
});

const MESSAGE = 'bpmn:MessageEventDefinition';

describe('SimulationEngine start events and transactions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('enters only the untyped start events of the process when any exist, and all start events otherwise', () => {
    const mixedProcess = createShape('MixedProcess', 'bpmn:Process');
    const untypedStart = createShape('UntypedStart', 'bpmn:StartEvent', mixedProcess);
    const messageStart = createEvent('MessageStart', 'bpmn:StartEvent', mixedProcess, MESSAGE, {
      messageRef: { name: 'Order' },
    });
    connect(untypedStart, createShape('EndUntyped', 'bpmn:EndEvent', mixedProcess));
    connect(messageStart, createShape('EndMessage', 'bpmn:EndEvent', mixedProcess));

    const mixed = createHarness();
    mixed.engine.start(mixedProcess);
    mixed.settle();
    expect(mixed.eventsFor('token:enter', 'UntypedStart')).toHaveLength(1);
    expect(mixed.eventsFor('token:enter', 'MessageStart')).toHaveLength(0);
    expect(mixed.eventsFor('simulation:complete')).toHaveLength(1);

    const typedProcess = createShape('TypedProcess', 'bpmn:Process');
    const firstTypedStart = createEvent('MessageStart', 'bpmn:StartEvent', typedProcess, MESSAGE, {
      messageRef: { name: 'Order' },
    });
    const secondTypedStart = createEvent('SignalStart', 'bpmn:StartEvent', typedProcess, SIGNAL, {
      signalRef: { name: 'Go' },
    });
    connect(firstTypedStart, createShape('EndMessage', 'bpmn:EndEvent', typedProcess));
    connect(secondTypedStart, createShape('EndSignal', 'bpmn:EndEvent', typedProcess));

    const typed = createHarness();
    typed.engine.start(typedProcess);
    typed.settle();
    expect(typed.eventsFor('token:enter', 'MessageStart')).toHaveLength(1);
    expect(typed.eventsFor('token:enter', 'SignalStart')).toHaveLength(1);
    expect(typed.eventsFor('simulation:complete')).toHaveLength(1);
  });

  it('enters only the untyped start events of an expanded subprocess', () => {
    const process = createShape('Process', 'bpmn:Process');
    const start = createShape('Start', 'bpmn:StartEvent', process);
    const subProcess = createShape('SubProcess', 'bpmn:SubProcess', process);
    connect(start, subProcess);
    connect(subProcess, createShape('End', 'bpmn:EndEvent', process));
    const innerUntypedStart = createShape('InnerUntypedStart', 'bpmn:StartEvent', subProcess);
    const innerTimerStart = createEvent('InnerTimerStart', 'bpmn:StartEvent', subProcess, TIMER, {
      timeDuration: {},
    });
    connect(innerUntypedStart, createShape('InnerEndUntyped', 'bpmn:EndEvent', subProcess));
    connect(innerTimerStart, createShape('InnerEndTimer', 'bpmn:EndEvent', subProcess));

    const { engine, eventsFor, settle } = createHarness();
    engine.start(process);
    settle();

    expect(eventsFor('token:enter', 'InnerUntypedStart')).toHaveLength(1);
    expect(eventsFor('token:enter', 'InnerTimerStart')).toHaveLength(0);
    expect(eventsFor('token:exit', 'SubProcess')).toHaveLength(1);
    expect(eventsFor('simulation:complete')).toHaveLength(1);
  });

  it('holds a root timer start with a date or duration as a waiting point, while a cycle timer start passes through', () => {
    const process = createShape('Process', 'bpmn:Process');
    const durationStart = createEvent('DurationStart', 'bpmn:StartEvent', process, TIMER, { timeDuration: {} });
    const dateStart = createEvent('DateStart', 'bpmn:StartEvent', process, TIMER, { timeDate: {} });
    const cycleStart = createEvent('CycleStart', 'bpmn:StartEvent', process, TIMER, { timeCycle: {} });
    connect(durationStart, createShape('EndDuration', 'bpmn:EndEvent', process));
    connect(dateStart, createShape('EndDate', 'bpmn:EndEvent', process));
    connect(cycleStart, createShape('EndCycle', 'bpmn:EndEvent', process));

    const { engine, eventsFor, settle } = createHarness();
    engine.setMode('step');
    engine.start(process);
    vi.advanceTimersByTime(10_000);

    expect(eventsFor('token:exit', 'CycleStart')).toHaveLength(1);
    expect(eventsFor('token:enter', 'EndCycle')).toHaveLength(1);
    expect(eventsFor('token:exit', 'DurationStart')).toHaveLength(0);
    expect(eventsFor('token:exit', 'DateStart')).toHaveLength(0);
    expect(new Set(engine.getArmedWaits().map((wait) => wait.element))).toEqual(new Set([durationStart, dateStart]));
    expect(eventsFor('simulation:complete')).toHaveLength(0);

    for (const wait of engine.getArmedWaits()) {
      engine.fireWait(wait.id);
    }
    settle();

    expect(eventsFor('token:enter', 'EndDuration')).toHaveLength(1);
    expect(eventsFor('token:enter', 'EndDate')).toHaveLength(1);
    expect(eventsFor('simulation:complete')).toHaveLength(1);
  });

  it('runs the inner flow of an expanded transaction and exits the transaction once', () => {
    const process = createShape('Process', 'bpmn:Process');
    const start = createShape('Start', 'bpmn:StartEvent', process);
    const transaction = createShape('Transaction', 'bpmn:Transaction', process);
    connect(start, transaction);
    connect(transaction, createShape('End', 'bpmn:EndEvent', process));
    const innerStart = createShape('InnerStart', 'bpmn:StartEvent', transaction);
    const fork = createShape('Fork', 'bpmn:ParallelGateway', transaction);
    connect(innerStart, fork);
    connect(fork, createShape('InnerEndA', 'bpmn:EndEvent', transaction));
    connect(fork, createShape('InnerEndB', 'bpmn:EndEvent', transaction));

    const { engine, eventsFor, settle } = createHarness();
    engine.start(process);
    settle();

    expect(eventsFor('token:enter', 'InnerEndA')).toHaveLength(1);
    expect(eventsFor('token:enter', 'InnerEndB')).toHaveLength(1);
    expect(eventsFor('token:exit', 'Transaction')).toHaveLength(1);
    expect(eventsFor('token:enter', 'End')).toHaveLength(1);
    expect(eventsFor('simulation:complete')).toHaveLength(1);
  });
});

describe('SimulationEngine gateways', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('takes every non-default flow on an inclusive auto fork, and the default flow only when it is the sole flow', () => {
    const process = createShape('Process', 'bpmn:Process');
    const start = createShape('Start', 'bpmn:StartEvent', process);
    const split = createShape('Split', 'bpmn:InclusiveGateway', process);
    connect(start, split);
    connect(split, createShape('EndA', 'bpmn:EndEvent', process));
    connect(split, createShape('EndB', 'bpmn:EndEvent', process));
    const defaultFlow = connect(split, createShape('EndDefault', 'bpmn:EndEvent', process));
    split.businessObject.default = defaultFlow.businessObject;

    const { engine, eventsFor, settle } = createHarness();
    engine.start(process);
    settle();
    vi.advanceTimersByTime(engine.getTaskDelay());
    settle();

    expect(eventsFor('token:enter', 'EndA')).toHaveLength(1);
    expect(eventsFor('token:enter', 'EndB')).toHaveLength(1);
    expect(eventsFor('token:enter', 'EndDefault')).toHaveLength(0);
    expect(eventsFor('simulation:complete')).toHaveLength(1);

    const onlyDefaultSplit = createShape('OnlyDefaultSplit', 'bpmn:InclusiveGateway');
    const soleDefaultFlow = connect(onlyDefaultSplit, createShape('SoleEnd', 'bpmn:EndEvent'));
    onlyDefaultSplit.businessObject.default = soleDefaultFlow.businessObject;
    expect(selectInclusiveFlows(onlyDefaultSplit, [soleDefaultFlow])).toEqual([soleDefaultFlow]);
  });

  it('completes an inclusive diamond exactly once, leaving no token on the join', () => {
    const process = createShape('Process', 'bpmn:Process');
    const start = createShape('Start', 'bpmn:StartEvent', process);
    const split = createShape('Split', 'bpmn:InclusiveGateway', process);
    const taskA = createShape('TaskA', 'bpmn:Task', process);
    const taskB = createShape('TaskB', 'bpmn:Task', process);
    const join = createShape('Join', 'bpmn:InclusiveGateway', process);
    connect(start, split);
    connect(split, taskA);
    connect(split, taskB);
    connect(taskA, join);
    connect(taskB, join);
    connect(join, createShape('End', 'bpmn:EndEvent', process));

    const { engine, eventsFor } = createHarness();
    engine.start(process);
    vi.advanceTimersByTime(10_000);

    const joinScope = (eventsFor('token:enter', 'Join')[0] as Extract<SimulationEvent, { type: 'token:enter' }>).scope;
    expect(eventsFor('token:enter', 'Join')).toHaveLength(2);
    expect(joinScope.getTokenCount('Join')).toBe(0);
    expect(eventsFor('token:enter', 'End')).toHaveLength(1);
    expect(eventsFor('simulation:complete')).toHaveLength(1);
  });

  it('keeps a repeated arrival on the same incoming flow of an inclusive join for its next firing', () => {
    const process = createShape('Process', 'bpmn:Process');
    const start = createShape('Start', 'bpmn:StartEvent', process);
    const fork = createShape('Fork', 'bpmn:ParallelGateway', process);
    const mergeA = createShape('MergeA', 'bpmn:ExclusiveGateway', process);
    const mergeB = createShape('MergeB', 'bpmn:ExclusiveGateway', process);
    const taskB1 = createShape('TaskB1', 'bpmn:Task', process);
    const taskB2 = createShape('TaskB2', 'bpmn:Task', process);
    const join = createShape('Join', 'bpmn:InclusiveGateway', process);
    connect(start, fork);
    for (const relayId of ['RelayA1', 'RelayA2']) {
      const relay = createShape(relayId, 'bpmn:ExclusiveGateway', process);
      connect(fork, relay);
      connect(relay, mergeA);
    }
    connect(fork, taskB1);
    connect(fork, taskB2);
    connect(taskB1, mergeB);
    connect(taskB2, mergeB);
    connect(mergeA, join);
    connect(mergeB, join);
    connect(join, createShape('End', 'bpmn:EndEvent', process));

    const { engine, eventsFor, settle } = createHarness();
    engine.setMode('step');
    engine.start(process);
    settle();
    const scope = (eventsFor('token:enter', 'Join')[0] as Extract<SimulationEvent, { type: 'token:enter' }>).scope;
    expect(eventsFor('token:enter', 'Join')).toHaveLength(2);
    expect(eventsFor('token:enter', 'End')).toHaveLength(0);

    engine.trigger(taskB1, scope);
    settle();
    expect(eventsFor('token:enter', 'End')).toHaveLength(1);
    expect(scope.getTokenCount('Join')).toBe(1);
    expect(eventsFor('simulation:complete')).toHaveLength(0);

    engine.trigger(taskB2, scope);
    settle();
    expect(eventsFor('token:enter', 'End')).toHaveLength(2);
    expect(scope.getTokenCount('Join')).toBe(0);
    expect(eventsFor('simulation:complete')).toHaveLength(1);
  });

  it('routes each of two staggered tokens on an exclusive gateway in auto mode before completing', () => {
    const process = createShape('Process', 'bpmn:Process');
    const start = createShape('Start', 'bpmn:StartEvent', process);
    const fork = createShape('Fork', 'bpmn:ParallelGateway', process);
    const exclusive = createShape('Exclusive', 'bpmn:ExclusiveGateway', process);
    connect(start, fork);
    connect(fork, exclusive);
    const heldFlow = connect(fork, createShape('Relay', 'bpmn:ExclusiveGateway', process));
    connect(heldFlow.target, exclusive);
    connect(exclusive, createShape('EndA', 'bpmn:EndEvent', process));
    connect(exclusive, createShape('EndB', 'bpmn:EndEvent', process));

    const { engine, eventsFor, releaseFlow, settle } = createHarness([heldFlow.id]);
    engine.start(process);
    settle();
    vi.advanceTimersByTime(engine.getTaskDelay() / 2);
    releaseFlow(heldFlow.id);
    vi.advanceTimersByTime(engine.getTaskDelay() / 2);
    settle();
    expect(eventsFor('token:enter', 'EndA')).toHaveLength(1);
    expect(eventsFor('simulation:complete')).toHaveLength(0);

    vi.advanceTimersByTime(10_000);
    expect(eventsFor('token:enter', 'EndA')).toHaveLength(2);
    expect(eventsFor('simulation:complete')).toHaveLength(1);
  });

  it('routes one token per step-mode decision on an exclusive gateway holding two tokens', () => {
    const process = createShape('Process', 'bpmn:Process');
    const start = createShape('Start', 'bpmn:StartEvent', process);
    const fork = createShape('Fork', 'bpmn:ParallelGateway', process);
    const exclusive = createShape('Exclusive', 'bpmn:ExclusiveGateway', process);
    connect(start, fork);
    connect(fork, exclusive);
    connect(fork, exclusive);
    const flowToEndA = connect(exclusive, createShape('EndA', 'bpmn:EndEvent', process));
    connect(exclusive, createShape('EndB', 'bpmn:EndEvent', process));

    const { engine, eventsFor, settle } = createHarness();
    engine.setMode('step');
    engine.start(process);
    settle();
    const choices = eventsFor('gateway:choice', 'Exclusive') as Extract<SimulationEvent, { type: 'gateway:choice' }>[];
    expect(choices).toHaveLength(2);

    engine.trigger(exclusive, choices[0].scope, { chosenFlow: flowToEndA });
    settle();
    expect(choices[0].scope.getTokenCount('Exclusive')).toBe(1);
    expect(eventsFor('token:enter', 'EndA')).toHaveLength(1);
    expect(eventsFor('simulation:complete')).toHaveLength(0);

    engine.trigger(exclusive, choices[1].scope, { chosenFlow: flowToEndA });
    settle();
    expect(eventsFor('token:enter', 'EndA')).toHaveLength(2);
    expect(eventsFor('simulation:complete')).toHaveLength(1);
  });

  it('fires a Complex join set to 1 of 2 once and interrupts the other branch inside its region only', () => {
    const process = createShape('Process', 'bpmn:Process');
    const start = createShape('Start', 'bpmn:StartEvent', process);
    const fork = createShape('Fork', 'bpmn:ParallelGateway', process);
    const outside = createShape('Outside', 'bpmn:Task', process);
    const split = createShape('Split', 'bpmn:ComplexGateway', process);
    const taskA = createShape('TaskA', 'bpmn:Task', process);
    const taskB = createShape('TaskB', 'bpmn:Task', process);
    const taskC = createShape('TaskC', 'bpmn:Task', process);
    const join = createShape('Join', 'bpmn:ComplexGateway', process);
    connect(start, fork);
    const flowToOutside = connect(fork, outside);
    connect(outside, createShape('OutsideEnd', 'bpmn:EndEvent', process));
    connect(fork, split);
    connect(split, taskA);
    connect(split, taskB);
    const flowFromBToC = connect(taskB, taskC);
    connect(taskA, join);
    connect(taskC, join);
    connect(join, createShape('End', 'bpmn:EndEvent', process));

    const { engine, events, eventsFor, releaseFlow, settle } = createHarness([flowToOutside.id, flowFromBToC.id]);
    engine.on((event) => {
      if (event.type === 'simulation:start') {
        engine.setComplexJoinThreshold('Join', 1);
      }
    });
    engine.start(process);
    vi.advanceTimersByTime(10_000);

    expect(eventsFor('token:exit', 'Join')).toHaveLength(1);
    expect(eventsFor('token:enter', 'End')).toHaveLength(1);
    const cancelledConnections = events.flatMap((event) => (event.type === 'flows:cancelled' ? event.connections : []));
    expect(cancelledConnections).toEqual([flowFromBToC]);

    releaseFlow(flowFromBToC.id);
    expect(eventsFor('token:enter', 'TaskC')).toHaveLength(0);
    expect(eventsFor('simulation:complete')).toHaveLength(0);

    releaseFlow(flowToOutside.id);
    vi.advanceTimersByTime(engine.getTaskDelay());
    settle();
    expect(eventsFor('token:enter', 'OutsideEnd')).toHaveLength(1);
    expect(eventsFor('simulation:complete')).toHaveLength(1);
  });

  it('holds a Complex join with the default threshold until every incoming branch has arrived', () => {
    const process = createShape('Process', 'bpmn:Process');
    const start = createShape('Start', 'bpmn:StartEvent', process);
    const split = createShape('Split', 'bpmn:ComplexGateway', process);
    const taskA = createShape('TaskA', 'bpmn:Task', process);
    const taskB = createShape('TaskB', 'bpmn:Task', process);
    const join = createShape('Join', 'bpmn:ComplexGateway', process);
    connect(start, split);
    connect(split, taskA);
    connect(split, taskB);
    connect(taskA, join);
    const flowFromBToJoin = connect(taskB, join);
    connect(join, createShape('End', 'bpmn:EndEvent', process));

    const { engine, eventsFor, releaseFlow } = createHarness([flowFromBToJoin.id]);
    engine.start(process);
    vi.advanceTimersByTime(10_000);

    expect(eventsFor('token:enter', 'Join')).toHaveLength(1);
    expect(eventsFor('token:exit', 'Join')).toHaveLength(0);
    expect(eventsFor('token:enter', 'End')).toHaveLength(0);

    releaseFlow(flowFromBToJoin.id);
    expect(eventsFor('token:exit', 'Join')).toHaveLength(1);
    expect(eventsFor('token:enter', 'End')).toHaveLength(1);
    expect(eventsFor('simulation:complete')).toHaveLength(1);
  });

  it('fires exactly one successor of an event-based gateway, and waits in auto mode when every successor is a signal catch with a thrower', () => {
    const process = createShape('Process', 'bpmn:Process');
    const start = createShape('Start', 'bpmn:StartEvent', process);
    const gateway = createShape('Gateway', 'bpmn:EventBasedGateway', process);
    const timerCatch = createEvent('TimerCatch', 'bpmn:IntermediateCatchEvent', process, TIMER, { timeDuration: {} });
    const messageCatch = createEvent('MessageCatch', 'bpmn:IntermediateCatchEvent', process, MESSAGE, {
      messageRef: { name: 'Order' },
    });
    connect(start, gateway);
    connect(gateway, timerCatch);
    connect(gateway, messageCatch);
    connect(timerCatch, createShape('EndTimer', 'bpmn:EndEvent', process));
    connect(messageCatch, createShape('EndMessage', 'bpmn:EndEvent', process));

    const racing = createHarness();
    racing.engine.start(process);
    racing.settle();
    const [gatewayWait] = racing.engine.getArmedWaits();
    expect(gatewayWait.kind).toBe('event-gateway');
    expect(gatewayWait.scope.getTokenCount('Gateway')).toBe(1);

    vi.advanceTimersByTime(10_000);
    const firedCatches = [timerCatch, messageCatch].filter(
      (candidate) => racing.eventsFor('token:enter', candidate.id).length > 0,
    );
    expect(firedCatches).toHaveLength(1);
    expect(racing.eventsFor('token:exit', firedCatches[0].id)).toHaveLength(1);
    expect(gatewayWait.scope.getTokenCount('Gateway')).toBe(0);

    racing.engine.fireWait(gatewayWait.id, firedCatches[0] === timerCatch ? messageCatch : timerCatch);
    racing.settle();
    expect(
      racing.eventsFor('token:enter', 'TimerCatch').length + racing.eventsFor('token:enter', 'MessageCatch').length,
    ).toBe(1);
    expect(racing.eventsFor('simulation:complete')).toHaveLength(1);

    const blockedProcess = createShape('BlockedProcess', 'bpmn:Process');
    const blockedStart = createShape('BlockedStart', 'bpmn:StartEvent', blockedProcess);
    const blockedGateway = createShape('BlockedGateway', 'bpmn:EventBasedGateway', blockedProcess);
    const goCatch = createEvent('GoCatch', 'bpmn:IntermediateCatchEvent', blockedProcess, SIGNAL, {
      signalRef: { name: 'Go' },
    });
    const stopCatch = createEvent('StopCatch', 'bpmn:IntermediateCatchEvent', blockedProcess, SIGNAL, {
      signalRef: { name: 'Stop' },
    });
    const goThrow = createEvent('GoThrow', 'bpmn:IntermediateThrowEvent', blockedProcess, SIGNAL, {
      signalRef: { name: 'Go' },
    });
    createEvent('StopThrow', 'bpmn:IntermediateThrowEvent', blockedProcess, SIGNAL, { signalRef: { name: 'Stop' } });
    connect(blockedStart, blockedGateway);
    connect(blockedGateway, goCatch);
    connect(blockedGateway, stopCatch);
    connect(goCatch, createShape('GoEnd', 'bpmn:EndEvent', blockedProcess));
    connect(stopCatch, createShape('StopEnd', 'bpmn:EndEvent', blockedProcess));

    const blocked = createHarness();
    blocked.engine.start(blockedProcess);
    vi.advanceTimersByTime(10_000);

    const [blockedWait] = blocked.engine.getArmedWaits();
    expect(blockedWait.element).toBe(blockedGateway);
    expect(blockedWait.scope.getTokenCount('BlockedGateway')).toBe(1);
    expect(blocked.eventsFor('token:enter', 'GoCatch')).toHaveLength(0);
    expect(blocked.eventsFor('token:enter', 'StopCatch')).toHaveLength(0);

    blocked.engine.broadcastSignal(goThrow, blockedWait.scope);
    vi.advanceTimersByTime(blocked.engine.getTaskDelay());
    blocked.settle();

    expect(blocked.eventsFor('token:exit', 'GoCatch')).toHaveLength(1);
    expect(blocked.eventsFor('token:enter', 'StopCatch')).toHaveLength(0);
    expect(blocked.eventsFor('token:enter', 'GoEnd')).toHaveLength(1);
    expect(blocked.engine.getArmedWaits()).toHaveLength(0);
    expect(blocked.eventsFor('simulation:complete')).toHaveLength(1);
  });
});

function createReceiveOrSendTask(id: string, type: 'bpmn:ReceiveTask' | 'bpmn:SendTask', parent: any, name: string) {
  const task = createShape(id, type, parent);
  task.businessObject.messageRef = { name };
  return task;
}

describe('SimulationEngine messages, Send Task and Receive Task', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('delivers a message throw to every waiting catch and Receive Task with that name, and to no other', () => {
    const process = createShape('Process', 'bpmn:Process');
    const start = createShape('Start', 'bpmn:StartEvent', process);
    const fork = createShape('Fork', 'bpmn:ParallelGateway', process);
    const orderCatch = createEvent('OrderCatch', 'bpmn:IntermediateCatchEvent', process, MESSAGE, {
      messageRef: { name: 'Order' },
    });
    const orderReceive = createReceiveOrSendTask('OrderReceive', 'bpmn:ReceiveTask', process, 'Order');
    const otherCatch = createEvent('OtherCatch', 'bpmn:IntermediateCatchEvent', process, MESSAGE, {
      messageRef: { name: 'Other' },
    });
    const task = createShape('Task', 'bpmn:Task', process);
    const messageThrow = createEvent('Throw', 'bpmn:IntermediateThrowEvent', process, MESSAGE, {
      messageRef: { name: 'Order' },
    });
    connect(start, fork);
    for (const branch of [orderCatch, orderReceive, otherCatch, task]) {
      connect(fork, branch);
    }
    connect(task, messageThrow);
    connect(messageThrow, createShape('ThrowEnd', 'bpmn:EndEvent', process));
    connect(orderCatch, createShape('OrderCatchEnd', 'bpmn:EndEvent', process));
    connect(orderReceive, createShape('OrderReceiveEnd', 'bpmn:EndEvent', process));
    connect(otherCatch, createShape('OtherCatchEnd', 'bpmn:EndEvent', process));

    const { engine, eventsFor, settle } = createHarness();
    engine.setMode('step');
    engine.start(process);
    settle();
    expect(engine.getArmedWaits()).toHaveLength(3);

    const scope = (eventsFor('token:enter', 'Task')[0] as Extract<SimulationEvent, { type: 'token:enter' }>).scope;
    engine.trigger(task, scope);
    settle();

    const send = eventsFor('message:send', 'Throw')[0] as Extract<SimulationEvent, { type: 'message:send' }>;
    expect(new Set(send.targets)).toEqual(new Set([orderCatch, orderReceive]));
    expect(eventsFor('token:exit', 'OrderCatch')).toHaveLength(1);
    expect(eventsFor('token:exit', 'OrderReceive')).toHaveLength(1);
    expect(eventsFor('token:enter', 'OrderReceiveEnd')).toHaveLength(1);
    expect(eventsFor('token:exit', 'OtherCatch')).toHaveLength(0);
    expect(engine.getArmedWaits().map((wait) => wait.element)).toEqual([otherCatch]);
    expect(eventsFor('simulation:complete')).toHaveLength(0);
  });

  it('delivers the message of a Send Task when the Send Task exits', () => {
    const process = createShape('Process', 'bpmn:Process');
    const start = createShape('Start', 'bpmn:StartEvent', process);
    const fork = createShape('Fork', 'bpmn:ParallelGateway', process);
    const orderCatch = createEvent('OrderCatch', 'bpmn:IntermediateCatchEvent', process, MESSAGE, {
      messageRef: { name: 'Order' },
    });
    const sendTask = createReceiveOrSendTask('Send', 'bpmn:SendTask', process, 'Order');
    connect(start, fork);
    connect(fork, orderCatch);
    connect(fork, sendTask);
    connect(orderCatch, createShape('CatchEnd', 'bpmn:EndEvent', process));
    connect(sendTask, createShape('SendEnd', 'bpmn:EndEvent', process));

    const { engine, events, eventsFor, settle } = createHarness();
    engine.setMode('step');
    engine.start(process);
    settle();
    expect(eventsFor('message:send')).toHaveLength(0);
    expect(engine.getArmedWaits().map((wait) => wait.element)).toEqual([orderCatch]);

    const scope = (eventsFor('token:enter', 'Send')[0] as Extract<SimulationEvent, { type: 'token:enter' }>).scope;
    engine.trigger(sendTask, scope);
    settle();

    const send = eventsFor('message:send', 'Send')[0] as Extract<SimulationEvent, { type: 'message:send' }>;
    expect(send.targets).toEqual([orderCatch]);
    expect(events.indexOf(send)).toBeGreaterThan(events.indexOf(eventsFor('token:exit', 'Send')[0]));
    expect(eventsFor('token:exit', 'OrderCatch')).toHaveLength(1);
    expect(eventsFor('token:enter', 'CatchEnd')).toHaveLength(1);
    expect(eventsFor('simulation:complete')).toHaveLength(1);
  });

  it('holds a Receive Task in auto mode when its message has a thrower in the pool, and completes it otherwise', () => {
    const process = createShape('Process', 'bpmn:Process');
    const start = createShape('Start', 'bpmn:StartEvent', process);
    const fork = createShape('Fork', 'bpmn:ParallelGateway', process);
    const receiveWithThrower = createReceiveOrSendTask('ReceiveWithThrower', 'bpmn:ReceiveTask', process, 'Order');
    const receiveWithoutThrower = createReceiveOrSendTask(
      'ReceiveWithoutThrower',
      'bpmn:ReceiveTask',
      process,
      'Other',
    );
    createReceiveOrSendTask('UnreachedSend', 'bpmn:SendTask', process, 'Order');
    connect(start, fork);
    connect(fork, receiveWithThrower);
    connect(fork, receiveWithoutThrower);
    connect(receiveWithThrower, createShape('EndA', 'bpmn:EndEvent', process));
    connect(receiveWithoutThrower, createShape('EndB', 'bpmn:EndEvent', process));

    const { engine, eventsFor } = createHarness();
    engine.start(process);
    vi.advanceTimersByTime(10_000);

    expect(eventsFor('token:exit', 'ReceiveWithoutThrower')).toHaveLength(1);
    expect(eventsFor('token:enter', 'EndB')).toHaveLength(1);
    expect(eventsFor('token:exit', 'ReceiveWithThrower')).toHaveLength(0);
    expect(engine.getArmedWaits().map((wait) => wait.element)).toEqual([receiveWithThrower]);
    expect(eventsFor('simulation:complete')).toHaveLength(0);
  });

  it('exits a Receive Task chosen by an event-based gateway after the task delay without waiting for its message', () => {
    const process = createShape('Process', 'bpmn:Process');
    const start = createShape('Start', 'bpmn:StartEvent', process);
    const gateway = createShape('Gateway', 'bpmn:EventBasedGateway', process);
    const receive = createReceiveOrSendTask('Receive', 'bpmn:ReceiveTask', process, 'Order');
    const timerCatch = createEvent('TimerCatch', 'bpmn:IntermediateCatchEvent', process, TIMER, { timeDuration: {} });
    createReceiveOrSendTask('UnreachedSend', 'bpmn:SendTask', process, 'Order');
    connect(start, gateway);
    connect(gateway, receive);
    connect(gateway, timerCatch);
    connect(receive, createShape('ReceiveEnd', 'bpmn:EndEvent', process));
    connect(timerCatch, createShape('TimerEnd', 'bpmn:EndEvent', process));

    const { engine, eventsFor, settle } = createHarness();
    engine.setMode('step');
    engine.start(process);
    settle();
    const [gatewayWait] = engine.getArmedWaits();
    expect(gatewayWait.candidates).toEqual([receive, timerCatch]);

    engine.fireWait(gatewayWait.id, receive);
    settle();
    expect(eventsFor('token:enter', 'Receive')).toHaveLength(1);
    expect(engine.getArmedWaits()).toHaveLength(0);
    expect(eventsFor('element:waiting', 'Receive')).toHaveLength(0);

    vi.advanceTimersByTime(engine.getTaskDelay());
    settle();
    expect(eventsFor('token:exit', 'Receive')).toHaveLength(1);
    expect(eventsFor('token:enter', 'ReceiveEnd')).toHaveLength(1);
    expect(eventsFor('simulation:complete')).toHaveLength(1);
  });
});

const ERROR = 'bpmn:ErrorEventDefinition';
const ESCALATION = 'bpmn:EscalationEventDefinition';
const TERMINATE = 'bpmn:TerminateEventDefinition';

function createEventSubProcess(
  id: string,
  parent: any,
  definitionType: string,
  definition: any = {},
  isInterrupting = true,
): { eventSubProcess: any; startEvent: any } {
  const eventSubProcess = createShape(id, 'bpmn:SubProcess', parent);
  eventSubProcess.businessObject.triggeredByEvent = true;
  const startEvent = createEvent(`${id}Start`, 'bpmn:StartEvent', eventSubProcess, definitionType, definition);
  startEvent.businessObject.isInterrupting = isInterrupting;
  return { eventSubProcess, startEvent };
}

describe('SimulationEngine errors, escalation, terminate and event subprocesses', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('catches an error with the boundary of matching code before a catch-all boundary, removing the whole host', () => {
    const process = createShape('Process', 'bpmn:Process');
    const start = createShape('Start', 'bpmn:StartEvent', process);
    const subProcess = createShape('SubProcess', 'bpmn:SubProcess', process);
    connect(start, subProcess);
    connect(subProcess, createShape('End', 'bpmn:EndEvent', process));
    const catchAll = attachBoundary('CatchAll', subProcess, ERROR);
    const specific = attachBoundary('Specific', subProcess, ERROR, { errorRef: { errorCode: 'E1' } });
    connect(catchAll, createShape('CatchAllEnd', 'bpmn:EndEvent', process));
    connect(specific, createShape('SpecificEnd', 'bpmn:EndEvent', process));
    const innerStart = createShape('InnerStart', 'bpmn:StartEvent', subProcess);
    const innerFork = createShape('InnerFork', 'bpmn:ParallelGateway', subProcess);
    const innerTask = createShape('InnerTask', 'bpmn:Task', subProcess);
    const errorEnd = createEvent('ErrorEnd', 'bpmn:EndEvent', subProcess, ERROR, {
      extensionElements: { values: [{ $type: 'bfw:ErrorCode', body: 'E1' }] },
    });
    connect(innerStart, innerFork);
    connect(innerFork, innerTask);
    connect(innerFork, errorEnd);
    connect(innerTask, createShape('InnerEnd', 'bpmn:EndEvent', subProcess));

    const { engine, eventsFor } = createHarness();
    engine.start(process);
    vi.advanceTimersByTime(10_000);

    expect(eventsFor('token:enter', 'SpecificEnd')).toHaveLength(1);
    expect(eventsFor('token:enter', 'CatchAllEnd')).toHaveLength(0);
    expect(eventsFor('element:interrupted', 'SubProcess')).toHaveLength(1);
    expect(eventsFor('token:exit', 'InnerTask')).toHaveLength(0);
    expect(eventsFor('token:exit', 'SubProcess')).toHaveLength(0);
    expect(eventsFor('token:enter', 'End')).toHaveLength(0);
    expect(eventsFor('simulation:complete')).toHaveLength(1);

    const innerScope = (eventsFor('token:enter', 'InnerStart')[0] as Extract<SimulationEvent, { type: 'token:enter' }>)
      .scope;
    expect(resolveError(innerScope, 'E2', engine.elementRegistry)?.element).toBe(catchAll);
    expect(resolveError(innerScope, undefined, engine.elementRegistry)?.element).toBe(catchAll);
  });

  it('ends the run in the error state when no boundary or event subprocess catches an error inside a subprocess', () => {
    const process = createShape('Process', 'bpmn:Process');
    const start = createShape('Start', 'bpmn:StartEvent', process);
    const subProcess = createShape('SubProcess', 'bpmn:SubProcess', process);
    connect(start, subProcess);
    connect(subProcess, createShape('End', 'bpmn:EndEvent', process));
    connect(
      attachBoundary('OtherCode', subProcess, ERROR, { errorRef: { errorCode: 'Other' } }),
      createShape('OtherEnd', 'bpmn:EndEvent', process),
    );
    const innerStart = createShape('InnerStart', 'bpmn:StartEvent', subProcess);
    const errorEnd = createEvent('ErrorEnd', 'bpmn:EndEvent', subProcess, ERROR, { errorRef: { errorCode: 'E1' } });
    connect(innerStart, errorEnd);

    const { engine, eventsFor } = createHarness();
    engine.start(process);
    vi.advanceTimersByTime(10_000);

    const terminated = eventsFor('simulation:error-terminated') as Extract<
      SimulationEvent,
      { type: 'simulation:error-terminated' }
    >[];
    expect(terminated).toHaveLength(1);
    expect(terminated[0].element).toBe(errorEnd);
    expect(terminated[0].scope.parent).toBeNull();
    expect(eventsFor('token:enter', 'OtherEnd')).toHaveLength(0);
    expect(eventsFor('token:enter', 'End')).toHaveLength(0);
    expect(eventsFor('simulation:complete')).toHaveLength(0);
  });

  it('lets an error event subprocess in the throwing scope win over the host boundary', () => {
    const process = createShape('Process', 'bpmn:Process');
    const start = createShape('Start', 'bpmn:StartEvent', process);
    const subProcess = createShape('SubProcess', 'bpmn:SubProcess', process);
    connect(start, subProcess);
    connect(subProcess, createShape('End', 'bpmn:EndEvent', process));
    connect(
      attachBoundary('Boundary', subProcess, ERROR, { errorRef: { errorCode: 'E1' } }),
      createShape('BoundaryEnd', 'bpmn:EndEvent', process),
    );
    const innerStart = createShape('InnerStart', 'bpmn:StartEvent', subProcess);
    connect(innerStart, createEvent('ErrorEnd', 'bpmn:EndEvent', subProcess, ERROR, { errorRef: { errorCode: 'E1' } }));
    const { eventSubProcess, startEvent } = createEventSubProcess('ErrorHandler', subProcess, ERROR);
    connect(startEvent, createShape('HandlerEnd', 'bpmn:EndEvent', eventSubProcess));

    const { engine, eventsFor } = createHarness();
    engine.start(process);
    vi.advanceTimersByTime(10_000);

    expect(eventsFor('token:enter', 'ErrorHandler')).toHaveLength(1);
    expect(eventsFor('token:enter', 'ErrorHandlerStart')).toHaveLength(1);
    expect(eventsFor('token:enter', 'HandlerEnd')).toHaveLength(1);
    expect(eventsFor('token:enter', 'BoundaryEnd')).toHaveLength(0);
    expect(eventsFor('token:exit', 'SubProcess')).toHaveLength(1);
    expect(eventsFor('token:enter', 'End')).toHaveLength(1);
    expect(eventsFor('simulation:complete')).toHaveLength(1);
  });

  it('interrupts the siblings of an escalation End Event, while an escalation throw continues its token', () => {
    const buildProcess = (throwType: 'bpmn:EndEvent' | 'bpmn:IntermediateThrowEvent') => {
      const process = createShape('Process', 'bpmn:Process');
      const start = createShape('Start', 'bpmn:StartEvent', process);
      const subProcess = createShape('SubProcess', 'bpmn:SubProcess', process);
      connect(start, subProcess);
      connect(subProcess, createShape('End', 'bpmn:EndEvent', process));
      connect(
        attachBoundary('Boundary', subProcess, ESCALATION, { escalationRef: { escalationCode: 'Late' } }, false),
        createShape('BoundaryEnd', 'bpmn:EndEvent', process),
      );
      const innerStart = createShape('InnerStart', 'bpmn:StartEvent', subProcess);
      const innerFork = createShape('InnerFork', 'bpmn:ParallelGateway', subProcess);
      const innerTask = createShape('InnerTask', 'bpmn:Task', subProcess);
      const escalation = createEvent('Escalation', throwType, subProcess, ESCALATION, {
        escalationRef: { escalationCode: 'Late' },
      });
      connect(innerStart, innerFork);
      connect(innerFork, innerTask);
      connect(innerFork, escalation);
      connect(innerTask, createShape('InnerTaskEnd', 'bpmn:EndEvent', subProcess));
      if (throwType === 'bpmn:IntermediateThrowEvent') {
        connect(escalation, createShape('AfterThrowEnd', 'bpmn:EndEvent', subProcess));
      }
      return process;
    };

    const endEvent = createHarness();
    endEvent.engine.start(buildProcess('bpmn:EndEvent'));
    vi.advanceTimersByTime(10_000);
    expect(endEvent.eventsFor('token:enter', 'BoundaryEnd')).toHaveLength(1);
    expect(endEvent.eventsFor('element:interrupted', 'InnerTask')).toHaveLength(1);
    expect(endEvent.eventsFor('token:exit', 'InnerTask')).toHaveLength(0);
    expect(endEvent.eventsFor('token:exit', 'SubProcess')).toHaveLength(1);
    expect(endEvent.eventsFor('token:enter', 'End')).toHaveLength(1);
    expect(endEvent.eventsFor('simulation:complete')).toHaveLength(1);

    const intermediateThrow = createHarness();
    intermediateThrow.engine.start(buildProcess('bpmn:IntermediateThrowEvent'));
    vi.advanceTimersByTime(10_000);
    expect(intermediateThrow.eventsFor('token:enter', 'BoundaryEnd')).toHaveLength(1);
    expect(intermediateThrow.eventsFor('token:exit', 'Escalation')).toHaveLength(1);
    expect(intermediateThrow.eventsFor('token:enter', 'AfterThrowEnd')).toHaveLength(1);
    expect(intermediateThrow.eventsFor('element:interrupted')).toHaveLength(0);
    expect(intermediateThrow.eventsFor('token:exit', 'InnerTask')).toHaveLength(1);
    expect(intermediateThrow.eventsFor('token:exit', 'SubProcess')).toHaveLength(1);
    expect(intermediateThrow.eventsFor('simulation:complete')).toHaveLength(1);
  });

  it('interrupts only its own subprocess on a Terminate End Event, whose host then continues', () => {
    const process = createShape('Process', 'bpmn:Process');
    const start = createShape('Start', 'bpmn:StartEvent', process);
    const fork = createShape('Fork', 'bpmn:ParallelGateway', process);
    const subProcess = createShape('SubProcess', 'bpmn:SubProcess', process);
    const outerTask = createShape('OuterTask', 'bpmn:Task', process);
    connect(start, fork);
    connect(fork, subProcess);
    connect(fork, outerTask);
    connect(subProcess, createShape('End', 'bpmn:EndEvent', process));
    connect(outerTask, createShape('OuterEnd', 'bpmn:EndEvent', process));
    const innerStart = createShape('InnerStart', 'bpmn:StartEvent', subProcess);
    const innerFork = createShape('InnerFork', 'bpmn:ParallelGateway', subProcess);
    const innerTask = createShape('InnerTask', 'bpmn:Task', subProcess);
    connect(innerStart, innerFork);
    connect(innerFork, innerTask);
    connect(innerFork, createEvent('TerminateEnd', 'bpmn:EndEvent', subProcess, TERMINATE));
    connect(innerTask, createShape('InnerEnd', 'bpmn:EndEvent', subProcess));

    const { engine, eventsFor, settle } = createHarness();
    engine.start(process);
    settle();

    expect(eventsFor('element:interrupted', 'InnerTask')).toHaveLength(1);
    expect(eventsFor('token:exit', 'SubProcess')).toHaveLength(1);
    expect(eventsFor('token:enter', 'End')).toHaveLength(1);
    expect(eventsFor('element:interrupted', 'OuterTask')).toHaveLength(0);
    expect(eventsFor('simulation:complete')).toHaveLength(0);

    vi.advanceTimersByTime(10_000);
    expect(eventsFor('token:exit', 'InnerTask')).toHaveLength(0);
    expect(eventsFor('token:enter', 'OuterEnd')).toHaveLength(1);
    expect(eventsFor('simulation:terminated')).toHaveLength(0);
    expect(eventsFor('simulation:complete')).toHaveLength(1);
  });

  it('interrupts the rest of its scope when a message throw triggers an interrupting event-subprocess message start', () => {
    const process = createShape('Process', 'bpmn:Process');
    const start = createShape('Start', 'bpmn:StartEvent', process);
    const fork = createShape('Fork', 'bpmn:ParallelGateway', process);
    const task = createShape('Task', 'bpmn:Task', process);
    const messageThrow = createEvent('Throw', 'bpmn:IntermediateThrowEvent', process, MESSAGE, {
      messageRef: { name: 'Cancel' },
    });
    connect(start, fork);
    connect(fork, task);
    const flowToThrow = connect(fork, messageThrow);
    connect(task, createShape('TaskEnd', 'bpmn:EndEvent', process));
    connect(messageThrow, createShape('ThrowEnd', 'bpmn:EndEvent', process));
    const { eventSubProcess, startEvent } = createEventSubProcess('CancelHandler', process, MESSAGE, {
      messageRef: { name: 'Cancel' },
    });
    connect(startEvent, createShape('HandlerEnd', 'bpmn:EndEvent', eventSubProcess));

    const { engine, eventsFor, releaseFlow, settle } = createHarness([flowToThrow.id]);
    engine.setMode('step');
    engine.start(process);
    settle();
    const [startWait] = engine.getArmedWaits();
    expect(startWait.kind).toBe('event-subprocess-start');
    expect(startWait.element).toBe(startEvent);
    const scope = startWait.scope;
    expect(scope.getTokenCount('Task')).toBe(1);

    releaseFlow(flowToThrow.id);

    const send = eventsFor('message:send', 'Throw')[0] as Extract<SimulationEvent, { type: 'message:send' }>;
    expect(send.targets).toEqual([startEvent]);
    expect(eventsFor('element:interrupted', 'Task')).toHaveLength(1);
    expect(scope.getTokenCount('Task')).toBe(0);
    expect(eventsFor('token:enter', 'ThrowEnd')).toHaveLength(0);
    expect(eventsFor('token:enter', 'HandlerEnd')).toHaveLength(1);
    expect(engine.getArmedWaits()).toHaveLength(0);
    expect(eventsFor('simulation:complete')).toHaveLength(1);
  });

  it('keeps its scope running while a non-interrupting event subprocess runs, and stays armed for the next trigger', () => {
    const process = createShape('Process', 'bpmn:Process');
    const start = createShape('Start', 'bpmn:StartEvent', process);
    const task = createShape('Task', 'bpmn:Task', process);
    connect(start, task);
    connect(task, createShape('End', 'bpmn:EndEvent', process));
    const { eventSubProcess, startEvent } = createEventSubProcess(
      'PingHandler',
      process,
      SIGNAL,
      { signalRef: { name: 'Ping' } },
      false,
    );
    const handlerFlow = connect(startEvent, createShape('HandlerEnd', 'bpmn:EndEvent', eventSubProcess));

    const { engine, eventsFor, releaseFlow, settle } = createHarness([handlerFlow.id]);
    engine.setMode('step');
    engine.start(process);
    settle();
    const [startWait] = engine.getArmedWaits();
    const scope = startWait.scope;

    engine.fireWait(startWait.id);
    releaseFlow(handlerFlow.id);
    expect(eventsFor('token:enter', 'PingHandlerStart')).toHaveLength(1);
    expect(eventsFor('token:exit', 'PingHandler')).toHaveLength(1);
    expect(eventsFor('element:interrupted')).toHaveLength(0);
    expect(scope.getTokenCount('Task')).toBe(1);
    expect(engine.getArmedWaits()).toEqual([startWait]);

    engine.fireWait(startWait.id);
    settle();
    engine.trigger(task, scope);
    settle();
    expect(eventsFor('token:enter', 'End')).toHaveLength(1);
    expect(scope.getTokenCount('PingHandler')).toBe(1);
    expect(eventsFor('simulation:complete')).toHaveLength(0);

    releaseFlow(handlerFlow.id);
    expect(eventsFor('token:exit', 'PingHandler')).toHaveLength(2);
    expect(eventsFor('simulation:complete')).toHaveLength(1);
    expect(
      eventsFor('wait:disarmed').map((event) => (event as Extract<SimulationEvent, { type: 'wait:disarmed' }>).wait),
    ).toEqual([startWait]);
  });
});

const COMPENSATE = 'bpmn:CompensateEventDefinition';
const CANCEL = 'bpmn:CancelEventDefinition';

/** Attaches a compensation boundary to the host and associates it with the handler, as bpmn-js exposes it. */
function associateCompensationHandler(host: any, handler: any): any {
  const boundary = attachBoundary(`${host.id}Compensation`, host, COMPENSATE);
  handler.businessObject.isForCompensation = true;
  const id = `${boundary.id}_to_${handler.id}`;
  const association = {
    id,
    type: 'bpmn:Association',
    businessObject: { id },
    source: boundary,
    target: handler,
    waypoints: [
      { x: 0, y: 0 },
      { x: 0, y: 100 },
    ],
  };
  boundary.outgoing.push(association);
  handler.incoming.push(association);
  return association;
}

describe('SimulationEngine compensation and transactions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('compensates only the throwing scope, last in, first out and one handler at a time, before the throw continues', () => {
    const process = createShape('Process', 'bpmn:Process');
    const start = createShape('Start', 'bpmn:StartEvent', process);
    const outerTask = createShape('OuterTask', 'bpmn:Task', process);
    const subProcess = createShape('SubProcess', 'bpmn:SubProcess', process);
    connect(start, outerTask);
    connect(outerTask, subProcess);
    connect(subProcess, createShape('End', 'bpmn:EndEvent', process));
    associateCompensationHandler(outerTask, createShape('UndoOuter', 'bpmn:Task', process));
    const innerStart = createShape('InnerStart', 'bpmn:StartEvent', subProcess);
    const taskA = createShape('TaskA', 'bpmn:Task', subProcess);
    const taskB = createShape('TaskB', 'bpmn:Task', subProcess);
    const compensationThrow = createEvent('Throw', 'bpmn:IntermediateThrowEvent', subProcess, COMPENSATE);
    connect(innerStart, taskA);
    connect(taskA, taskB);
    connect(taskB, compensationThrow);
    connect(compensationThrow, createShape('InnerEnd', 'bpmn:EndEvent', subProcess));
    const associationA = associateCompensationHandler(taskA, createShape('UndoA', 'bpmn:Task', subProcess));
    const associationB = associateCompensationHandler(taskB, createShape('UndoB', 'bpmn:Task', subProcess));

    const { engine, events, eventsFor } = createHarness();
    engine.start(process);
    vi.advanceTimersByTime(10_000);
    const indexOf = (type: SimulationEvent['type'], elementId: string) => events.indexOf(eventsFor(type, elementId)[0]);

    expect(eventsFor('token:enter', 'UndoB')).toHaveLength(1);
    expect(eventsFor('token:enter', 'UndoA')).toHaveLength(1);
    expect(eventsFor('token:enter', 'UndoOuter')).toHaveLength(0);
    expect(indexOf('token:exit', 'UndoB')).toBeLessThan(indexOf('token:enter', 'UndoA'));
    expect(indexOf('token:exit', 'UndoA')).toBeLessThan(indexOf('token:exit', 'Throw'));
    const animatedAssociations = events.flatMap((event) =>
      event.type === 'flow:animate' && event.connection.type === 'bpmn:Association' ? [event.connection] : [],
    );
    expect(animatedAssociations).toEqual([associationB, associationA]);
    expect(eventsFor('token:enter', 'InnerEnd')).toHaveLength(1);
    expect(eventsFor('token:exit', 'SubProcess')).toHaveLength(1);
    expect(eventsFor('simulation:complete')).toHaveLength(1);
  });

  it('runs only the handler of the referenced activity on a targeted compensation', () => {
    const process = createShape('Process', 'bpmn:Process');
    const start = createShape('Start', 'bpmn:StartEvent', process);
    const taskA = createShape('TaskA', 'bpmn:Task', process);
    const taskB = createShape('TaskB', 'bpmn:Task', process);
    const compensationThrow = createEvent('Throw', 'bpmn:IntermediateThrowEvent', process, COMPENSATE, {
      activityRef: { id: 'TaskA' },
    });
    connect(start, taskA);
    connect(taskA, taskB);
    connect(taskB, compensationThrow);
    connect(compensationThrow, createShape('End', 'bpmn:EndEvent', process));
    associateCompensationHandler(taskA, createShape('UndoA', 'bpmn:Task', process));
    associateCompensationHandler(taskB, createShape('UndoB', 'bpmn:Task', process));

    const { engine, eventsFor } = createHarness();
    engine.start(process);
    vi.advanceTimersByTime(10_000);

    expect(eventsFor('token:enter', 'UndoA')).toHaveLength(1);
    expect(eventsFor('token:enter', 'UndoB')).toHaveLength(0);
    expect(eventsFor('token:enter', 'End')).toHaveLength(1);
    expect(eventsFor('simulation:complete')).toHaveLength(1);
  });

  it('compensates an activity at most once, and a Compensate End Event holds its token until its handlers finish', () => {
    const process = createShape('Process', 'bpmn:Process');
    const start = createShape('Start', 'bpmn:StartEvent', process);
    const taskA = createShape('TaskA', 'bpmn:Task', process);
    const taskB = createShape('TaskB', 'bpmn:Task', process);
    const compensationThrow = createEvent('Throw', 'bpmn:IntermediateThrowEvent', process, COMPENSATE);
    const compensationEnd = createEvent('CompensationEnd', 'bpmn:EndEvent', process, COMPENSATE);
    connect(start, taskA);
    connect(taskA, compensationThrow);
    connect(compensationThrow, taskB);
    connect(taskB, compensationEnd);
    associateCompensationHandler(taskA, createShape('UndoA', 'bpmn:Task', process));
    associateCompensationHandler(taskB, createShape('UndoB', 'bpmn:Task', process));

    const { engine, events, eventsFor } = createHarness();
    engine.start(process);
    vi.advanceTimersByTime(10_000);

    expect(eventsFor('token:enter', 'UndoA')).toHaveLength(1);
    expect(eventsFor('token:enter', 'UndoB')).toHaveLength(1);
    expect(events.indexOf(eventsFor('token:enter', 'UndoB')[0])).toBeGreaterThan(
      events.indexOf(eventsFor('token:exit', 'Throw')[0]),
    );
    expect(eventsFor('token:exit', 'CompensationEnd')).toHaveLength(0);
    const [complete] = eventsFor('simulation:complete');
    expect(eventsFor('simulation:complete')).toHaveLength(1);
    expect(events.indexOf(complete)).toBeGreaterThan(events.indexOf(eventsFor('token:exit', 'UndoB')[0]));
  });

  it('interrupts a transaction on a Cancel End Event, compensates it, and continues on its Cancel boundary', () => {
    const process = createShape('Process', 'bpmn:Process');
    const start = createShape('Start', 'bpmn:StartEvent', process);
    const transaction = createShape('Transaction', 'bpmn:Transaction', process);
    connect(start, transaction);
    connect(transaction, createShape('End', 'bpmn:EndEvent', process));
    connect(
      attachBoundary('CancelBoundary', transaction, CANCEL),
      createShape('CancelledEnd', 'bpmn:EndEvent', process),
    );
    const innerStart = createShape('InnerStart', 'bpmn:StartEvent', transaction);
    const fork = createShape('Fork', 'bpmn:ParallelGateway', transaction);
    const taskA = createShape('TaskA', 'bpmn:Task', transaction);
    const otherTask = createShape('OtherTask', 'bpmn:Task', transaction);
    connect(innerStart, fork);
    connect(fork, taskA);
    const flowToOtherTask = connect(fork, otherTask);
    connect(taskA, createEvent('CancelEnd', 'bpmn:EndEvent', transaction, CANCEL));
    connect(otherTask, createShape('InnerEnd', 'bpmn:EndEvent', transaction));
    associateCompensationHandler(taskA, createShape('UndoA', 'bpmn:Task', transaction));

    const { engine, events, eventsFor } = createHarness([flowToOtherTask.id]);
    engine.start(process);
    vi.advanceTimersByTime(10_000);
    const indexOf = (type: SimulationEvent['type'], elementId: string) => events.indexOf(eventsFor(type, elementId)[0]);

    const cancelledConnections = events.flatMap((event) => (event.type === 'flows:cancelled' ? event.connections : []));
    expect(cancelledConnections).toEqual([flowToOtherTask]);
    expect(events.findIndex((event) => event.type === 'flows:cancelled')).toBeLessThan(indexOf('token:enter', 'UndoA'));
    expect(indexOf('token:exit', 'UndoA')).toBeLessThan(indexOf('token:enter', 'CancelBoundary'));
    expect(eventsFor('element:interrupted', 'Transaction')).toHaveLength(1);
    expect(eventsFor('token:exit', 'Transaction')).toHaveLength(0);
    expect(eventsFor('token:enter', 'OtherTask')).toHaveLength(0);
    expect(eventsFor('token:enter', 'End')).toHaveLength(0);
    expect(eventsFor('token:enter', 'CancelledEnd')).toHaveLength(1);
    expect(eventsFor('simulation:complete')).toHaveLength(1);
  });

  it('ends the run in the error state after compensating when a cancelled transaction has no Cancel boundary', () => {
    const process = createShape('Process', 'bpmn:Process');
    const start = createShape('Start', 'bpmn:StartEvent', process);
    const transaction = createShape('Transaction', 'bpmn:Transaction', process);
    connect(start, transaction);
    connect(transaction, createShape('End', 'bpmn:EndEvent', process));
    const innerStart = createShape('InnerStart', 'bpmn:StartEvent', transaction);
    const taskA = createShape('TaskA', 'bpmn:Task', transaction);
    const cancelEnd = createEvent('CancelEnd', 'bpmn:EndEvent', transaction, CANCEL);
    connect(innerStart, taskA);
    connect(taskA, cancelEnd);
    associateCompensationHandler(taskA, createShape('UndoA', 'bpmn:Task', transaction));

    const { engine, events, eventsFor } = createHarness();
    engine.start(process);
    vi.advanceTimersByTime(10_000);

    const terminated = eventsFor('simulation:error-terminated') as Extract<
      SimulationEvent,
      { type: 'simulation:error-terminated' }
    >[];
    expect(terminated).toHaveLength(1);
    expect(terminated[0].element).toBe(cancelEnd);
    expect(terminated[0].scope.parent).toBeNull();
    expect(events.indexOf(terminated[0])).toBeGreaterThan(events.indexOf(eventsFor('token:exit', 'UndoA')[0]));
    expect(eventsFor('token:enter', 'End')).toHaveLength(0);
    expect(eventsFor('simulation:complete')).toHaveLength(0);
  });
});

describe('SimulationEngine ad-hoc subprocesses and loop caps', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs every activity without an incoming flow of a sequential ad-hoc subprocess exactly once, one at a time in model order, then exits', () => {
    const process = createShape('Process', 'bpmn:Process');
    const start = createShape('Start', 'bpmn:StartEvent', process);
    const adHoc = createShape('AdHoc', 'bpmn:AdHocSubProcess', process);
    adHoc.businessObject.ordering = 'Sequential';
    connect(start, adHoc);
    connect(adHoc, createShape('End', 'bpmn:EndEvent', process));
    const taskA = createShape('TaskA', 'bpmn:Task', adHoc);
    const chainedTask = createShape('ChainedTask', 'bpmn:Task', adHoc);
    const innerSubProcess = createShape('InnerSubProcess', 'bpmn:SubProcess', adHoc);
    createShape('UserTask', 'bpmn:UserTask', adHoc);
    connect(taskA, chainedTask);
    connect(
      createShape('InnerStart', 'bpmn:StartEvent', innerSubProcess),
      createShape('InnerEnd', 'bpmn:EndEvent', innerSubProcess),
    );
    associateCompensationHandler(taskA, createShape('UndoA', 'bpmn:Task', adHoc));

    const { engine, events, eventsFor, settle } = createHarness();
    engine.start(process);
    settle();
    const adHocScope = (eventsFor('token:enter', 'TaskA')[0] as Extract<SimulationEvent, { type: 'token:enter' }>)
      .scope;
    expect(adHocScope.getTokenCount('InnerSubProcess')).toBe(0);
    expect(adHocScope.getTokenCount('UserTask')).toBe(0);

    vi.advanceTimersByTime(10_000);
    const indexOf = (type: SimulationEvent['type'], elementId: string) => events.indexOf(eventsFor(type, elementId)[0]);

    for (const activityId of ['TaskA', 'ChainedTask', 'InnerSubProcess', 'UserTask']) {
      expect(eventsFor('token:enter', activityId)).toHaveLength(1);
    }
    expect(eventsFor('token:enter', 'UndoA')).toHaveLength(0);
    expect(indexOf('token:exit', 'ChainedTask')).toBeLessThan(indexOf('token:enter', 'InnerSubProcess'));
    expect(indexOf('token:exit', 'InnerSubProcess')).toBeLessThan(indexOf('token:enter', 'UserTask'));
    expect(eventsFor('token:exit', 'AdHoc')).toHaveLength(1);
    expect(indexOf('token:exit', 'UserTask')).toBeLessThan(indexOf('token:exit', 'AdHoc'));
    expect(eventsFor('token:enter', 'End')).toHaveLength(1);
    expect(eventsFor('simulation:complete')).toHaveLength(1);
  });

  it('starts every activity without an incoming flow of a parallel ad-hoc subprocess at once, and runs chained activities after their predecessor', () => {
    const process = createShape('Process', 'bpmn:Process');
    const start = createShape('Start', 'bpmn:StartEvent', process);
    const adHoc = createShape('AdHoc', 'bpmn:AdHocSubProcess', process);
    connect(start, adHoc);
    connect(adHoc, createShape('End', 'bpmn:EndEvent', process));
    const taskA = createShape('TaskA', 'bpmn:Task', adHoc);
    const taskB = createShape('TaskB', 'bpmn:ServiceTask', adHoc);
    const chainedTask = createShape('ChainedTask', 'bpmn:Task', adHoc);
    connect(taskA, chainedTask);
    const { eventSubProcess, startEvent } = createEventSubProcess('PingHandler', adHoc, SIGNAL, {
      signalRef: { name: 'Ping' },
    });
    connect(startEvent, createShape('HandlerEnd', 'bpmn:EndEvent', eventSubProcess));

    const { engine, eventsFor, settle } = createHarness();
    engine.setMode('step');
    engine.start(process);
    settle();
    const adHocScope = (eventsFor('token:enter', 'TaskA')[0] as Extract<SimulationEvent, { type: 'token:enter' }>)
      .scope;
    expect(adHocScope.getTokenCount('TaskA')).toBe(1);
    expect(adHocScope.getTokenCount('TaskB')).toBe(1);
    expect(eventsFor('token:enter', 'ChainedTask')).toHaveLength(0);
    expect(eventsFor('token:enter', 'PingHandler')).toHaveLength(0);

    engine.trigger(taskA, adHocScope);
    settle();
    expect(adHocScope.getTokenCount('ChainedTask')).toBe(1);
    expect(eventsFor('token:exit', 'AdHoc')).toHaveLength(0);

    engine.trigger(taskB, adHocScope);
    engine.trigger(chainedTask, adHocScope);
    settle();
    for (const activityId of ['TaskA', 'TaskB', 'ChainedTask']) {
      expect(eventsFor('token:enter', activityId)).toHaveLength(1);
    }
    expect(eventsFor('token:exit', 'AdHoc')).toHaveLength(1);
    expect(eventsFor('token:enter', 'End')).toHaveLength(1);
    expect(eventsFor('simulation:complete')).toHaveLength(1);
  });

  it('runs a collapsed ad-hoc subprocess as one black-box delay, ignoring a loop marker on its shell', () => {
    const process = createShape('Process', 'bpmn:Process');
    const start = createShape('Start', 'bpmn:StartEvent', process);
    const adHoc = createShape('AdHoc', 'bpmn:AdHocSubProcess', process);
    adHoc.collapsed = true;
    adHoc.businessObject.loopCharacteristics = { $type: 'bpmn:MultiInstanceLoopCharacteristics', isSequential: true };
    connect(start, adHoc);
    connect(adHoc, createShape('End', 'bpmn:EndEvent', process));
    createShape('HiddenTask', 'bpmn:Task', adHoc);

    const { engine, eventsFor, settle } = createHarness();
    engine.start(process);
    settle();
    expect(eventsFor('token:enter', 'AdHoc')).toHaveLength(1);
    expect(eventsFor('token:exit', 'AdHoc')).toHaveLength(0);

    vi.advanceTimersByTime(10_000);
    expect(eventsFor('token:enter', 'HiddenTask')).toHaveLength(0);
    expect(eventsFor('token:enter', 'AdHoc')).toHaveLength(1);
    expect(eventsFor('token:exit', 'AdHoc')).toHaveLength(1);
    expect(eventsFor('token:enter', 'End')).toHaveLength(1);
    expect(eventsFor('simulation:complete')).toHaveLength(1);
  });

  it('never runs more iterations than loopMaximum or bfw:MaxIterations allow', () => {
    const process = createShape('Process', 'bpmn:Process');
    const start = createShape('Start', 'bpmn:StartEvent', process);
    const fork = createShape('Fork', 'bpmn:ParallelGateway', process);
    const standardLoop = createShape('StandardLoop', 'bpmn:Task', process);
    standardLoop.businessObject.loopCharacteristics = { $type: 'bpmn:StandardLoopCharacteristics', loopMaximum: 2 };
    const cappedMultiInstance = createShape('CappedMultiInstance', 'bpmn:Task', process);
    cappedMultiInstance.businessObject.loopCharacteristics = {
      $type: 'bpmn:MultiInstanceLoopCharacteristics',
      isSequential: true,
      extensionElements: { values: [{ $type: 'bfw:MaxIterations', body: 3 }] },
    };
    const uncappedMultiInstance = createShape('UncappedMultiInstance', 'bpmn:Task', process);
    uncappedMultiInstance.businessObject.loopCharacteristics = {
      $type: 'bpmn:MultiInstanceLoopCharacteristics',
      isSequential: true,
      extensionElements: { values: [{ $type: 'bfw:MaxIterations', body: 10 }] },
    };
    connect(start, fork);
    for (const loopingTask of [standardLoop, cappedMultiInstance, uncappedMultiInstance]) {
      connect(fork, loopingTask);
      connect(loopingTask, createShape(`${loopingTask.id}End`, 'bpmn:EndEvent', process));
    }

    const { engine, eventsFor } = createHarness();
    engine.on((event) => {
      if (event.type === 'simulation:start') {
        for (const loopingTask of [standardLoop, cappedMultiInstance, uncappedMultiInstance]) {
          engine.setMultiInstanceCount(loopingTask.id, 5);
        }
      }
    });
    engine.start(process);
    vi.advanceTimersByTime(10_000);

    expect(eventsFor('token:enter', 'StandardLoop')).toHaveLength(2);
    expect(eventsFor('token:enter', 'CappedMultiInstance')).toHaveLength(3);
    expect(eventsFor('token:enter', 'UncappedMultiInstance')).toHaveLength(5);
    expect(getIterationCount(standardLoop, engine)).toBe(2);
    expect(eventsFor('simulation:complete')).toHaveLength(1);
  });
});

describe('SimulationEngine auto-fire timers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const buildProcessWithTimerEventSubProcess = () => {
    const process = createShape('Process', 'bpmn:Process');
    const task = createShape('Task', 'bpmn:Task', process);
    connect(createShape('Start', 'bpmn:StartEvent', process), task);
    connect(task, createShape('End', 'bpmn:EndEvent', process));
    const { eventSubProcess, startEvent } = createEventSubProcess(
      'Handler',
      process,
      TIMER,
      { timeDuration: {} },
      false,
    );
    connect(startEvent, createShape('HandlerEnd', 'bpmn:EndEvent', eventSubProcess));
    return process;
  };

  it('auto-fires a ticked timer event-subprocess start next to the running main flow', () => {
    const { engine, eventsFor } = createHarness();
    engine.setBoundaryAutoFire('HandlerStart', true);
    engine.start(buildProcessWithTimerEventSubProcess());
    vi.advanceTimersByTime(10_000);

    expect(eventsFor('token:enter', 'HandlerEnd')).toHaveLength(1);
    expect(eventsFor('token:enter', 'End')).toHaveLength(1);
    expect(eventsFor('simulation:complete')).toHaveLength(1);
  });

  it('applies a checkbox change to a waiting point that is already armed', () => {
    const checkedLater = createHarness();
    checkedLater.engine.start(buildProcessWithTimerEventSubProcess());
    checkedLater.engine.setBoundaryAutoFire('HandlerStart', true);
    vi.advanceTimersByTime(10_000);
    expect(checkedLater.eventsFor('token:enter', 'Handler')).toHaveLength(1);
    expect(checkedLater.eventsFor('simulation:complete')).toHaveLength(1);

    const uncheckedLater = createHarness();
    uncheckedLater.engine.setBoundaryAutoFire('HandlerStart', true);
    uncheckedLater.engine.start(buildProcessWithTimerEventSubProcess());
    uncheckedLater.engine.setBoundaryAutoFire('HandlerStart', false);
    vi.advanceTimersByTime(10_000);
    expect(uncheckedLater.eventsFor('token:enter', 'Handler')).toHaveLength(0);
    expect(uncheckedLater.eventsFor('simulation:complete')).toHaveLength(1);
  });

  it('stops auto-firing waiting points in step mode and resumes when switched back to auto', () => {
    const process = createShape('Process', 'bpmn:Process');
    const timerCatch = createEvent('Catch', 'bpmn:IntermediateCatchEvent', process, TIMER, { timeDuration: {} });
    connect(createShape('Start', 'bpmn:StartEvent', process), timerCatch);
    connect(timerCatch, createShape('End', 'bpmn:EndEvent', process));

    const { engine, eventsFor, settle } = createHarness();
    engine.start(process);
    settle();
    engine.setMode('step');
    vi.advanceTimersByTime(10_000);
    expect(eventsFor('token:enter', 'End')).toHaveLength(0);

    engine.setMode('auto');
    vi.advanceTimersByTime(10_000);
    expect(eventsFor('token:enter', 'End')).toHaveLength(1);
    expect(eventsFor('simulation:complete')).toHaveLength(1);
  });

  const buildWaitingHostWithCycleBoundary = (timeCycle: string) => {
    const process = createShape('Process', 'bpmn:Process');
    const receive = createReceiveOrSendTask('Receive', 'bpmn:ReceiveTask', process, 'Order');
    connect(createShape('Start', 'bpmn:StartEvent', process), receive);
    connect(receive, createShape('End', 'bpmn:EndEvent', process));
    createEvent('UnreachedThrow', 'bpmn:IntermediateThrowEvent', process, MESSAGE, { messageRef: { name: 'Order' } });
    const cycle = attachBoundary('Cycle', receive, TIMER, { timeCycle: { body: timeCycle } }, false);
    connect(cycle, createShape('CycleEnd', 'bpmn:EndEvent', process));
    return process;
  };

  it('auto-fires a repeatable boundary as often as its R<n> cycle allows, then disarms it', () => {
    const { engine, eventsFor } = createHarness();
    engine.setBoundaryAutoFire('Cycle', true);
    engine.start(buildWaitingHostWithCycleBoundary('R3/PT1S'));
    vi.advanceTimersByTime(10_000);

    expect(eventsFor('token:enter', 'CycleEnd')).toHaveLength(3);
    expect(engine.getArmedWaits().map((wait) => wait.element.id)).toEqual(['Receive']);
    expect(eventsFor('simulation:complete')).toHaveLength(0);
  });

  it('keeps auto-firing an unbounded repeatable boundary until its host leaves', () => {
    const { engine, eventsFor } = createHarness();
    engine.setBoundaryAutoFire('Cycle', true);
    engine.start(buildWaitingHostWithCycleBoundary('R/PT1S'));
    vi.advanceTimersByTime(10_000);
    const firesBeforeMessage = eventsFor('token:enter', 'CycleEnd').length;
    expect(firesBeforeMessage).toBeGreaterThanOrEqual(4);

    const scope = (eventsFor('token:enter', 'Receive')[0] as Extract<SimulationEvent, { type: 'token:enter' }>).scope;
    const externalThrow = createEvent('ExternalThrow', 'bpmn:IntermediateThrowEvent', undefined, MESSAGE, {
      messageRef: { name: 'Order' },
    });
    engine.deliverMessage(externalThrow, scope);
    vi.advanceTimersByTime(10_000);

    expect(eventsFor('token:enter', 'CycleEnd')).toHaveLength(firesBeforeMessage);
    expect(eventsFor('token:exit', 'Receive')).toHaveLength(1);
    expect(engine.getArmedWaits()).toHaveLength(0);
    expect(eventsFor('simulation:complete')).toHaveLength(1);
  });
});

describe('SimulationEngine interrupt cleanup', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps the token of an Error End Event caught by an event subprocess of its own scope', () => {
    const process = createShape('Process', 'bpmn:Process');
    connect(
      createShape('Start', 'bpmn:StartEvent', process),
      createEvent('ErrorEnd', 'bpmn:EndEvent', process, ERROR, { errorRef: { errorCode: 'E1' } }),
    );
    const { eventSubProcess, startEvent } = createEventSubProcess('Handler', process, ERROR, {
      errorRef: { errorCode: 'E1' },
    });
    connect(startEvent, createShape('HandlerEnd', 'bpmn:EndEvent', eventSubProcess));

    const { engine, eventsFor } = createHarness();
    engine.start(process);
    vi.advanceTimersByTime(10_000);

    expect(eventsFor('element:interrupted', 'ErrorEnd')).toHaveLength(0);
    expect(eventsFor('token:enter', 'HandlerEnd')).toHaveLength(1);
    expect(eventsFor('simulation:complete')).toHaveLength(1);
  });

  it('names the cancelled flow animations by the ids they were announced with', () => {
    const process = createShape('Process', 'bpmn:Process');
    const subProcess = createShape('SubProcess', 'bpmn:SubProcess', process);
    connect(createShape('Start', 'bpmn:StartEvent', process), subProcess);
    connect(subProcess, createShape('End', 'bpmn:EndEvent', process));
    const boundary = attachBoundary('Boundary', subProcess, SIGNAL, { signalRef: { name: 'Stop' } });
    connect(boundary, createShape('BoundaryEnd', 'bpmn:EndEvent', process));
    const heldFlow = connect(
      createShape('InnerStart', 'bpmn:StartEvent', subProcess),
      createShape('InnerTask', 'bpmn:Task', subProcess),
    );

    const { engine, events, settle } = createHarness([heldFlow.id]);
    engine.start(process);
    settle();
    const heldAnimation = events.find(
      (event) => event.type === 'flow:animate' && event.connection === heldFlow,
    ) as Extract<SimulationEvent, { type: 'flow:animate' }>;
    engine.fireWait(engine.getArmedWaits().find((wait) => wait.element === boundary)!.id);
    settle();

    const cancelled = events.filter((event) => event.type === 'flows:cancelled') as Extract<
      SimulationEvent,
      { type: 'flows:cancelled' }
    >[];
    expect(cancelled.flatMap((event) => event.animationIds)).toEqual([heldAnimation.animationId]);
    expect(cancelled.flatMap((event) => event.connections)).toEqual([heldFlow]);
  });

  it('interrupts a running compensation handler together with its scope, without continuing the throw', () => {
    const process = createShape('Process', 'bpmn:Process');
    const subProcess = createShape('SubProcess', 'bpmn:SubProcess', process);
    connect(createShape('Start', 'bpmn:StartEvent', process), subProcess);
    connect(subProcess, createShape('End', 'bpmn:EndEvent', process));
    const fork = createShape('Fork', 'bpmn:ParallelGateway', subProcess);
    const taskA = createShape('TaskA', 'bpmn:Task', subProcess);
    const compensationThrow = createEvent('Throw', 'bpmn:IntermediateThrowEvent', subProcess, COMPENSATE);
    connect(createShape('InnerStart', 'bpmn:StartEvent', subProcess), fork);
    connect(fork, taskA);
    connect(taskA, compensationThrow);
    connect(compensationThrow, createShape('InnerEnd', 'bpmn:EndEvent', subProcess));
    const heldFlow = connect(fork, createEvent('TerminateEnd', 'bpmn:EndEvent', subProcess, TERMINATE));
    associateCompensationHandler(taskA, createShape('UndoA', 'bpmn:Task', subProcess));

    const { engine, eventsFor, releaseFlow, settle } = createHarness([heldFlow.id]);
    engine.start(process);
    settle();
    vi.advanceTimersByTime(engine.getTaskDelay() * 1.25);
    expect(eventsFor('token:enter', 'UndoA')).toHaveLength(1);
    expect(eventsFor('token:exit', 'UndoA')).toHaveLength(0);

    releaseFlow(heldFlow.id);
    vi.advanceTimersByTime(10_000);

    expect(eventsFor('element:interrupted', 'UndoA')).toHaveLength(1);
    expect(eventsFor('token:exit', 'UndoA')).toHaveLength(0);
    expect(eventsFor('token:exit', 'Throw')).toHaveLength(0);
    expect(eventsFor('token:enter', 'InnerEnd')).toHaveLength(0);
    expect(eventsFor('token:exit', 'SubProcess')).toHaveLength(1);
    expect(eventsFor('simulation:complete')).toHaveLength(1);
  });

  it('resets a parallel join counter when the join is interrupted, so a later arrival does not fire it', () => {
    const process = createShape('Process', 'bpmn:Process');
    const fork = createShape('Fork', 'bpmn:ParallelGateway', process);
    const join = createShape('Join', 'bpmn:ParallelGateway', process);
    connect(createShape('Start', 'bpmn:StartEvent', process), fork);
    connect(fork, join);
    const heldFlow = connect(fork, createShape('Relay', 'bpmn:ExclusiveGateway', process));
    connect(heldFlow.target, join);
    connect(join, createShape('End', 'bpmn:EndEvent', process));

    const { engine, eventsFor, releaseFlow, settle } = createHarness([heldFlow.id]);
    engine.start(process);
    settle();
    const scope = (eventsFor('token:enter', 'Join')[0] as Extract<SimulationEvent, { type: 'token:enter' }>).scope;
    engine.interruptElement(join, scope);
    releaseFlow(heldFlow.id);
    vi.advanceTimersByTime(10_000);

    expect(eventsFor('token:enter', 'Join')).toHaveLength(2);
    expect(eventsFor('token:exit', 'Join')).toHaveLength(0);
    expect(eventsFor('token:enter', 'End')).toHaveLength(0);
  });
});

describe('SimulationEngine coverage of remaining elements and controls', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('interrupts a task through its message boundary when a parallel branch throws that message', () => {
    const process = createShape('Process', 'bpmn:Process');
    const fork = createShape('Fork', 'bpmn:ParallelGateway', process);
    const task = createShape('Task', 'bpmn:Task', process);
    const messageThrow = createEvent('Throw', 'bpmn:IntermediateThrowEvent', process, MESSAGE, {
      messageRef: { name: 'Ping' },
    });
    connect(createShape('Start', 'bpmn:StartEvent', process), fork);
    connect(fork, task);
    connect(fork, messageThrow);
    connect(task, createShape('End', 'bpmn:EndEvent', process));
    connect(messageThrow, createShape('ThrowEnd', 'bpmn:EndEvent', process));
    const boundary = attachBoundary('Boundary', task, MESSAGE, { messageRef: { name: 'Ping' } });
    connect(boundary, createShape('BoundaryEnd', 'bpmn:EndEvent', process));

    const { engine, eventsFor } = createHarness();
    engine.start(process);
    vi.advanceTimersByTime(10_000);

    expect(eventsFor('element:interrupted', 'Task')).toHaveLength(1);
    expect(eventsFor('token:enter', 'BoundaryEnd')).toHaveLength(1);
    expect(eventsFor('token:enter', 'End')).toHaveLength(0);
    expect(eventsFor('simulation:complete')).toHaveLength(1);
  });

  it('holds a task delay while paused and finishes it after resume', () => {
    const process = createShape('Process', 'bpmn:Process');
    const task = createShape('Task', 'bpmn:Task', process);
    connect(createShape('Start', 'bpmn:StartEvent', process), task);
    connect(task, createShape('End', 'bpmn:EndEvent', process));

    const { engine, eventsFor, settle } = createHarness();
    engine.start(process);
    settle();
    engine.pause();
    vi.advanceTimersByTime(10_000);
    expect(eventsFor('token:exit', 'Task')).toHaveLength(0);

    engine.resume();
    vi.advanceTimersByTime(engine.getTaskDelay());
    settle();
    expect(eventsFor('token:exit', 'Task')).toHaveLength(1);
    expect(eventsFor('simulation:complete')).toHaveLength(1);
  });

  it('passes a conditional catch after the auto delay', () => {
    const process = createShape('Process', 'bpmn:Process');
    const conditionalCatch = createEvent(
      'Catch',
      'bpmn:IntermediateCatchEvent',
      process,
      'bpmn:ConditionalEventDefinition',
    );
    connect(createShape('Start', 'bpmn:StartEvent', process), conditionalCatch);
    connect(conditionalCatch, createShape('End', 'bpmn:EndEvent', process));

    const { engine, eventsFor, settle } = createHarness();
    engine.start(process);
    settle();
    expect(eventsFor('token:exit', 'Catch')).toHaveLength(0);

    vi.advanceTimersByTime(engine.getTaskDelay());
    settle();
    expect(eventsFor('token:exit', 'Catch')).toHaveLength(1);
    expect(eventsFor('simulation:complete')).toHaveLength(1);
  });

  it('routes a parallel multi-instance expanded subprocess on once, after every iteration', () => {
    const process = createShape('Process', 'bpmn:Process');
    const subProcess = createShape('SubProcess', 'bpmn:SubProcess', process);
    subProcess.businessObject.loopCharacteristics = {
      $type: 'bpmn:MultiInstanceLoopCharacteristics',
      isSequential: false,
    };
    connect(createShape('Start', 'bpmn:StartEvent', process), subProcess);
    connect(subProcess, createShape('End', 'bpmn:EndEvent', process));
    const innerTask = createShape('InnerTask', 'bpmn:Task', subProcess);
    connect(createShape('InnerStart', 'bpmn:StartEvent', subProcess), innerTask);
    connect(innerTask, createShape('InnerEnd', 'bpmn:EndEvent', subProcess));

    const { engine, events, eventsFor } = createHarness();
    engine.on((event) => {
      if (event.type === 'simulation:start') {
        engine.setMultiInstanceCount('SubProcess', 3);
      }
    });
    engine.start(process);
    vi.advanceTimersByTime(10_000);

    expect(eventsFor('token:enter', 'InnerEnd')).toHaveLength(3);
    expect(eventsFor('token:exit', 'SubProcess')).toHaveLength(3);
    expect(events.indexOf(eventsFor('token:enter', 'End')[0])).toBeGreaterThan(
      events.indexOf(eventsFor('token:enter', 'InnerEnd')[2]),
    );
    expect(eventsFor('token:enter', 'End')).toHaveLength(1);
    expect(eventsFor('simulation:complete')).toHaveLength(1);
  });

  it('does not jump from a link throw inside a subprocess to a same-name link catch outside it', () => {
    const link = 'bpmn:LinkEventDefinition';
    const process = createShape('Process', 'bpmn:Process');
    const subProcess = createShape('SubProcess', 'bpmn:SubProcess', process);
    connect(createShape('Start', 'bpmn:StartEvent', process), subProcess);
    connect(subProcess, createShape('End', 'bpmn:EndEvent', process));
    const outerCatch = createEvent('OuterCatch', 'bpmn:IntermediateCatchEvent', process, link, { name: 'Jump' });
    connect(outerCatch, createShape('OuterEnd', 'bpmn:EndEvent', process));
    connect(
      createShape('InnerStart', 'bpmn:StartEvent', subProcess),
      createEvent('InnerThrow', 'bpmn:IntermediateThrowEvent', subProcess, link, { name: 'Jump' }),
    );

    const { engine, eventsFor } = createHarness();
    engine.start(process);
    vi.advanceTimersByTime(10_000);

    expect(eventsFor('token:enter', 'OuterCatch')).toHaveLength(0);
    expect(eventsFor('token:exit', 'SubProcess')).toHaveLength(1);
    expect(eventsFor('simulation:complete')).toHaveLength(1);
  });
});
