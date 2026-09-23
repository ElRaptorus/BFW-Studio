import assert from 'node:assert';
import { describe, it } from 'vitest';

import { parseBpmnDefinitionsFromXml } from '../../../src/modules/bpmn-core/diff/bpmnModdleForDiff';
import { ProcessModelAnalyzer } from '../../../src/modules/bpmn-linter/rules/ProcessModelAnalyzer';
import eventGatewayReceiveTaskBoundary from '../../../src/modules/bpmn-linter/rules/bpmn-spec/event-gateway-receive-task-boundary';
import nestedTransaction from '../../../src/modules/bpmn-linter/rules/bpmn-spec/nested-transaction';
import businessRuleTaskConfig from '../../../src/modules/bpmn-linter/rules/execution-readiness/business-rule-task-config';
import {
  complexGatewayJoinCondition,
  complexGatewayRegion,
} from '../../../src/modules/bpmn-linter/rules/execution-readiness/complex-gateway-join';
import {
  conditionalEventCondition,
  intermediateTimerCycle,
  linkEventName,
  linkEventPairing,
  signalEventReference,
} from '../../../src/modules/bpmn-linter/rules/execution-readiness/event-definition-config';
import checkInfiniteLoop from '../../../src/modules/bpmn-linter/rules/logic-patterns/infinite-loop';
import conditionalFlowsNoGateway from '../../../src/modules/bpmn-linter/rules/structure/conditional-flows-no-gateway';
import noDeadEnd from '../../../src/modules/bpmn-linter/rules/structure/no-dead-end';
import type { BpmnlintRuleFactory, ModdleNode } from '../../../src/modules/bpmn-linter/types';

type CapturedReport = { id: string; message: string };

function collectReports(factory: BpmnlintRuleFactory, node: ModdleNode): CapturedReport[] {
  const reports: CapturedReport[] = [];
  const check = factory().check;
  if (typeof check !== 'function') {
    throw new Error('Expected a function check for these rules');
  }
  check(node, { report: (id, message) => reports.push({ id, message }) });
  return reports;
}

function moddleNode(properties: Record<string, unknown>): ModdleNode {
  return properties as unknown as ModdleNode;
}

function definitionsXml(processBody: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bfw="https://bifrostforge.world/schema/bpmn"
  id="Definitions_1" targetNamespace="https://bifrostforge.world/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="true">${processBody}</bpmn:process>
</bpmn:definitions>`;
}

function flows(...pairs: [string, string][]): string {
  return pairs
    .map(
      ([source, target]) =>
        `<bpmn:sequenceFlow id="Flow_${source}_${target}" sourceRef="${source}" targetRef="${target}" />`,
    )
    .join('');
}

/** Runs a bpmnlint rule over every element of a parsed diagram, like the bpmnlint traversal does. */
async function lintXml(factory: BpmnlintRuleFactory, processBody: string): Promise<CapturedReport[]> {
  const definitions = await parseBpmnDefinitionsFromXml(definitionsXml(processBody));
  const reports: CapturedReport[] = [];
  const check = factory().check;
  if (typeof check !== 'function') {
    throw new Error('Expected a function check for these rules');
  }
  const visited = new Set<unknown>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (value == null || typeof value !== 'object' || !('$type' in value) || visited.has(value)) {
      return;
    }
    visited.add(value);
    check(value as ModdleNode, { report: (id, message) => reports.push({ id, message }) });
    for (const [key, child] of Object.entries(value)) {
      if (key !== '$parent' && key !== '$attrs') {
        visit(child);
      }
    }
  };
  visit(definitions);
  return reports;
}

async function infiniteLoopFindings(processBody: string) {
  const definitions = await parseBpmnDefinitionsFromXml(definitionsXml(processBody));
  return checkInfiniteLoop(new ProcessModelAnalyzer(definitions), 'error');
}

const ACTIVATION_CONDITION =
  '<bpmn:activationCondition xsi:type="bpmn:tFormalExpression">activatedCount = incomingCount</bpmn:activationCondition>';

function complexGateway(id: string, isJoin = false): string {
  return `<bpmn:complexGateway id="${id}">${isJoin ? ACTIVATION_CONDITION : ''}</bpmn:complexGateway>`;
}

// ---------------------------------------------------------------------------
// Event definitions (EXR-016, EXR-017, EXR-018, EXR-022, EXR-023)
// ---------------------------------------------------------------------------

function eventDefinition(type: string, parentType: string, properties: Record<string, unknown> = {}): ModdleNode {
  return moddleNode({ $type: type, $parent: moddleNode({ $type: parentType, id: 'Event_1' }), ...properties });
}

describe('signal-event-reference', () => {
  it('reports a signal event without signalRef on its event', () => {
    const reports = collectReports(
      signalEventReference,
      eventDefinition('bpmn:SignalEventDefinition', 'bpmn:IntermediateCatchEvent'),
    );
    assert.deepEqual(reports, [{ id: 'Event_1', message: 'Signal event must reference a signal (EXR-016)' }]);
  });

  it('passes a signal event with signalRef', () => {
    const definition = eventDefinition('bpmn:SignalEventDefinition', 'bpmn:EndEvent', {
      signalRef: moddleNode({ $type: 'bpmn:Signal', id: 'Signal_1' }),
    });
    assert.equal(collectReports(signalEventReference, definition).length, 0);
  });
});

describe('conditional-event-condition', () => {
  it('reports a conditional event with a blank condition', () => {
    const definition = eventDefinition('bpmn:ConditionalEventDefinition', 'bpmn:BoundaryEvent', {
      condition: moddleNode({ $type: 'bpmn:FormalExpression', body: '  ' }),
    });
    assert.equal(collectReports(conditionalEventCondition, definition).length, 1);
  });

  it('passes a conditional event with a condition', () => {
    const definition = eventDefinition('bpmn:ConditionalEventDefinition', 'bpmn:BoundaryEvent', {
      condition: moddleNode({ $type: 'bpmn:FormalExpression', body: 'token.ready' }),
    });
    assert.equal(collectReports(conditionalEventCondition, definition).length, 0);
  });
});

describe('link-event-name', () => {
  it('reports a link event without a name', () => {
    const reports = collectReports(
      linkEventName,
      eventDefinition('bpmn:LinkEventDefinition', 'bpmn:IntermediateThrowEvent'),
    );
    assert.deepEqual(reports, [{ id: 'Event_1', message: 'Link event must have a name (EXR-018)' }]);
  });

  it('passes a named link event', () => {
    const definition = eventDefinition('bpmn:LinkEventDefinition', 'bpmn:IntermediateThrowEvent', { name: 'A' });
    assert.equal(collectReports(linkEventName, definition).length, 0);
  });
});

describe('link-event-pairing', () => {
  function linkEvent(type: string, id: string, name: string): ModdleNode {
    return moddleNode({ $type: type, id, eventDefinitions: [moddleNode({ $type: 'bpmn:LinkEventDefinition', name })] });
  }

  function processWithCatches(catchCount: number): ModdleNode {
    const catches = Array.from({ length: catchCount }, (_, index) =>
      linkEvent('bpmn:IntermediateCatchEvent', `Catch_${index}`, 'A'),
    );
    return moddleNode({
      $type: 'bpmn:Process',
      id: 'Process_1',
      flowElements: [linkEvent('bpmn:IntermediateThrowEvent', 'Throw_1', 'A'), ...catches],
    });
  }

  it('reports a link throw without a matching catch', () => {
    const reports = collectReports(linkEventPairing, processWithCatches(0));
    assert.equal(reports.length, 1);
    assert.equal(reports[0].id, 'Throw_1');
    assert.match(reports[0].message, /has no Link catch/);
  });

  it('passes a link throw with exactly one matching catch', () => {
    assert.equal(collectReports(linkEventPairing, processWithCatches(1)).length, 0);
  });

  it('reports a link throw with two matching catches', () => {
    const reports = collectReports(linkEventPairing, processWithCatches(2));
    assert.equal(reports.length, 1);
    assert.match(reports[0].message, /matches 2 Link catches/);
  });

  it('does not match a catch in a nested sub-process', () => {
    const subProcess = moddleNode({
      $type: 'bpmn:SubProcess',
      id: 'Sub_1',
      flowElements: [linkEvent('bpmn:IntermediateCatchEvent', 'Catch_inner', 'A')],
    });
    const process = moddleNode({
      $type: 'bpmn:Process',
      id: 'Process_1',
      flowElements: [linkEvent('bpmn:IntermediateThrowEvent', 'Throw_1', 'A'), subProcess],
    });
    assert.equal(collectReports(linkEventPairing, process).length, 1);
  });
});

describe('intermediate-timer-cycle', () => {
  const cycle = moddleNode({ $type: 'bpmn:FormalExpression', body: 'R/PT1H' });

  it('reports a timeCycle on an intermediate catch event', () => {
    const definition = eventDefinition('bpmn:TimerEventDefinition', 'bpmn:IntermediateCatchEvent', {
      timeCycle: cycle,
    });
    assert.equal(collectReports(intermediateTimerCycle, definition).length, 1);
  });

  it('passes a timeCycle on a boundary event', () => {
    const definition = eventDefinition('bpmn:TimerEventDefinition', 'bpmn:BoundaryEvent', { timeCycle: cycle });
    assert.equal(collectReports(intermediateTimerCycle, definition).length, 0);
  });
});

// ---------------------------------------------------------------------------
// business-rule-task-config (EXR-019)
// ---------------------------------------------------------------------------

describe('business-rule-task-config', () => {
  function businessRuleTask(properties: Record<string, unknown>): ModdleNode {
    return moddleNode({ $type: 'bpmn:BusinessRuleTask', id: 'Rule_1', ...properties });
  }

  it('reports a missing implementation', () => {
    const reports = collectReports(businessRuleTaskConfig, businessRuleTask({}));
    assert.match(reports[0].message, /must be "feel" or "dmn"/);
  });

  it('reports an unsupported implementation', () => {
    assert.equal(collectReports(businessRuleTaskConfig, businessRuleTask({ implementation: 'drools' })).length, 1);
  });

  it('reports an implementation padded with whitespace, which the Engine does not trim', () => {
    const node = businessRuleTask({ implementation: ' feel ', script: '{ discount: 0.1 }' });
    assert.match(collectReports(businessRuleTaskConfig, node)[0].message, /must be "feel" or "dmn"/);
  });

  it('reports feel without a script', () => {
    const reports = collectReports(businessRuleTaskConfig, businessRuleTask({ implementation: 'feel', script: ' ' }));
    assert.match(reports[0].message, /must declare a script/);
  });

  it('passes feel with a script', () => {
    const node = businessRuleTask({ implementation: 'feel', script: '{ discount: 0.1 }' });
    assert.equal(collectReports(businessRuleTaskConfig, node).length, 0);
  });

  it('reports dmn without bfw:DecisionRef', () => {
    const reports = collectReports(businessRuleTaskConfig, businessRuleTask({ implementation: 'dmn' }));
    assert.match(reports[0].message, /bfw:decisionRef/);
  });

  it('passes dmn with bfw:DecisionRef', () => {
    const node = businessRuleTask({
      implementation: 'dmn',
      extensionElements: { values: [moddleNode({ $type: 'bfw:DecisionRef', body: 'discount-rules' })] },
    });
    assert.equal(collectReports(businessRuleTaskConfig, node).length, 0);
  });
});

// ---------------------------------------------------------------------------
// Complex gateway joins (EXR-020, EXR-021)
// ---------------------------------------------------------------------------

describe('complex-gateway-join-condition', () => {
  const flow = moddleNode({ $type: 'bpmn:SequenceFlow' });

  it('reports a complex join without activationCondition', () => {
    const node = moddleNode({ $type: 'bpmn:ComplexGateway', id: 'Join_1', incoming: [flow, flow], outgoing: [flow] });
    assert.deepEqual(collectReports(complexGatewayJoinCondition, node), [
      { id: 'Join_1', message: 'Complex join must define an activationCondition (EXR-020)' },
    ]);
  });

  it('passes a complex join with activationCondition', () => {
    const node = moddleNode({
      $type: 'bpmn:ComplexGateway',
      id: 'Join_1',
      incoming: [flow, flow],
      outgoing: [flow],
      activationCondition: moddleNode({ $type: 'bpmn:FormalExpression', body: 'activatedCount >= 1' }),
    });
    assert.equal(collectReports(complexGatewayJoinCondition, node).length, 0);
  });

  it('ignores a complex split', () => {
    const node = moddleNode({ $type: 'bpmn:ComplexGateway', id: 'Split_1', incoming: [flow], outgoing: [flow, flow] });
    assert.equal(collectReports(complexGatewayJoinCondition, node).length, 0);
  });
});

describe('complex-gateway-region', () => {
  it('passes a clean nested split/join pair', async () => {
    const reports = await lintXml(
      complexGatewayRegion,
      `<bpmn:startEvent id="Start" />${complexGateway('Split_outer')}${complexGateway('Split_inner')}
       <bpmn:task id="B" /><bpmn:task id="C" /><bpmn:task id="D" />
       ${complexGateway('Join_inner', true)}${complexGateway('Join_outer', true)}<bpmn:endEvent id="End" />
       ${flows(
         ['Start', 'Split_outer'],
         ['Split_outer', 'Split_inner'],
         ['Split_outer', 'B'],
         ['Split_inner', 'C'],
         ['Split_inner', 'D'],
         ['C', 'Join_inner'],
         ['D', 'Join_inner'],
         ['Join_inner', 'Join_outer'],
         ['B', 'Join_outer'],
         ['Join_outer', 'End'],
       )}`,
    );
    assert.deepEqual(reports, []);
  });

  it('passes two disjoint regions in sequence', async () => {
    const reports = await lintXml(
      complexGatewayRegion,
      `<bpmn:startEvent id="Start" />${complexGateway('Split_1')}${complexGateway('Join_1', true)}
       ${complexGateway('Split_2')}${complexGateway('Join_2', true)}
       <bpmn:task id="A" /><bpmn:task id="B" /><bpmn:task id="Handover" /><bpmn:task id="C" /><bpmn:task id="D" />
       <bpmn:endEvent id="End" />
       ${flows(
         ['Start', 'Split_1'],
         ['Split_1', 'A'],
         ['Split_1', 'B'],
         ['A', 'Join_1'],
         ['B', 'Join_1'],
         ['Join_1', 'Handover'],
         ['Handover', 'Split_2'],
         ['Split_2', 'C'],
         ['Split_2', 'D'],
         ['C', 'Join_2'],
         ['D', 'Join_2'],
         ['Join_2', 'End'],
       )}`,
    );
    assert.deepEqual(reports, []);
  });

  it('reports a complex join without a paired complex split', async () => {
    const reports = await lintXml(
      complexGatewayRegion,
      `<bpmn:startEvent id="Start" /><bpmn:parallelGateway id="Fork" /><bpmn:task id="A" /><bpmn:task id="B" />
       ${complexGateway('Join_1', true)}<bpmn:endEvent id="End" />
       ${flows(['Start', 'Fork'], ['Fork', 'A'], ['Fork', 'B'], ['A', 'Join_1'], ['B', 'Join_1'], ['Join_1', 'End'])}`,
    );
    assert.equal(reports.length, 1);
    assert.equal(reports[0].id, 'Join_1');
    assert.match(reports[0].message, /no dominating Complex split/);
  });

  it('reports a flow leaking out of the region', async () => {
    const reports = await lintXml(
      complexGatewayRegion,
      `<bpmn:startEvent id="Start" />${complexGateway('Split_1')}<bpmn:task id="A" /><bpmn:task id="B" />
       <bpmn:parallelGateway id="Fork" />${complexGateway('Join_1', true)}
       <bpmn:endEvent id="End" /><bpmn:endEvent id="Escape" />
       ${flows(
         ['Start', 'Split_1'],
         ['Split_1', 'A'],
         ['Split_1', 'B'],
         ['A', 'Fork'],
         ['Fork', 'Join_1'],
         ['Fork', 'Escape'],
         ['B', 'Join_1'],
         ['Join_1', 'End'],
       )}`,
    );
    assert.equal(reports.length, 1);
    assert.equal(reports[0].id, 'Join_1');
    assert.match(reports[0].message, /leaks to "Escape"/);
  });

  it('reports a flow entering the region from outside', async () => {
    const reports = await lintXml(
      complexGatewayRegion,
      `<bpmn:startEvent id="Start" />${complexGateway('Split_1')}<bpmn:task id="A" /><bpmn:task id="B" />
       ${complexGateway('Join_1', true)}<bpmn:exclusiveGateway id="Again" /><bpmn:endEvent id="End" />
       ${flows(
         ['Start', 'Split_1'],
         ['Split_1', 'A'],
         ['Split_1', 'B'],
         ['A', 'Join_1'],
         ['B', 'Join_1'],
         ['Join_1', 'Again'],
         ['Again', 'B'],
         ['Again', 'End'],
       )}`,
    );
    assert.equal(reports.length, 1);
    assert.equal(reports[0].id, 'Join_1');
    assert.match(reports[0].message, /entered from "Again"/);
  });
});

// ---------------------------------------------------------------------------
// nested-transaction (BSC-023), event-gateway-receive-task-boundary (BSC-024)
// ---------------------------------------------------------------------------

describe('nested-transaction', () => {
  it('reports a transaction directly inside a transaction', () => {
    const node = moddleNode({
      $type: 'bpmn:Transaction',
      id: 'Inner',
      $parent: moddleNode({ $type: 'bpmn:Transaction' }),
    });
    assert.equal(collectReports(nestedTransaction, node).length, 1);
  });

  it('passes a transaction inside an embedded sub-process', () => {
    const node = moddleNode({
      $type: 'bpmn:Transaction',
      id: 'Inner',
      $parent: moddleNode({ $type: 'bpmn:SubProcess' }),
    });
    assert.equal(collectReports(nestedTransaction, node).length, 0);
  });
});

describe('event-gateway-receive-task-boundary', () => {
  function receiveTaskAfter(sourceType: string, withBoundary: boolean): ModdleNode {
    const receiveTask = moddleNode({
      $type: 'bpmn:ReceiveTask',
      id: 'Receive_1',
      incoming: [moddleNode({ $type: 'bpmn:SequenceFlow', sourceRef: moddleNode({ $type: sourceType }) })],
    });
    const boundary = moddleNode({ $type: 'bpmn:BoundaryEvent', id: 'Boundary_1', attachedToRef: receiveTask });
    (receiveTask as Record<string, unknown>).$parent = moddleNode({
      $type: 'bpmn:Process',
      flowElements: withBoundary ? [receiveTask, boundary] : [receiveTask],
    });
    return receiveTask;
  }

  it('reports a receive task after an event-based gateway with a boundary event', () => {
    assert.equal(
      collectReports(eventGatewayReceiveTaskBoundary, receiveTaskAfter('bpmn:EventBasedGateway', true)).length,
      1,
    );
  });

  it('passes without a boundary event', () => {
    assert.equal(
      collectReports(eventGatewayReceiveTaskBoundary, receiveTaskAfter('bpmn:EventBasedGateway', false)).length,
      0,
    );
  });

  it('passes a receive task with a boundary event that does not follow an event-based gateway', () => {
    assert.equal(collectReports(eventGatewayReceiveTaskBoundary, receiveTaskAfter('bpmn:Task', true)).length, 0);
  });
});

// ---------------------------------------------------------------------------
// no-dead-end (AST-021)
// ---------------------------------------------------------------------------

describe('no-dead-end', () => {
  it('reports a task without an outgoing flow', async () => {
    const reports = await lintXml(
      noDeadEnd,
      `<bpmn:startEvent id="Start" /><bpmn:task id="Dead" />${flows(['Start', 'Dead'])}`,
    );
    assert.deepEqual(reports, [
      {
        id: 'Dead',
        message: 'Element has no outgoing flow — the Engine fails the instance when it completes (AST-021)',
      },
    ]);
  });

  it('exempts end events, link throws, compensation handlers and boundaries, event sub-processes, and ad-hoc children', async () => {
    const reports = await lintXml(
      noDeadEnd,
      `<bpmn:startEvent id="Start" /><bpmn:task id="Booking" /><bpmn:intermediateThrowEvent id="Link_throw">
         <bpmn:linkEventDefinition name="A" /></bpmn:intermediateThrowEvent>
       <bpmn:boundaryEvent id="Compensation_boundary" attachedToRef="Booking"><bpmn:compensateEventDefinition /></bpmn:boundaryEvent>
       <bpmn:task id="Undo_booking" isForCompensation="true" />
       <bpmn:subProcess id="Event_sub" triggeredByEvent="true">
         <bpmn:startEvent id="Event_sub_start"><bpmn:signalEventDefinition /></bpmn:startEvent>
         <bpmn:endEvent id="Event_sub_end" />${flows(['Event_sub_start', 'Event_sub_end'])}
       </bpmn:subProcess>
       <bpmn:adHocSubProcess id="Ad_hoc"><bpmn:task id="Ad_hoc_task" /></bpmn:adHocSubProcess>
       <bpmn:endEvent id="End" />
       ${flows(['Start', 'Booking'], ['Booking', 'Link_throw'], ['Ad_hoc', 'End'])}`,
    );
    assert.deepEqual(reports, []);
  });

  it('reports a non-compensation boundary event without an outgoing flow', async () => {
    const reports = await lintXml(
      noDeadEnd,
      `<bpmn:startEvent id="Start" /><bpmn:task id="Work" /><bpmn:endEvent id="End" />
       <bpmn:boundaryEvent id="Timeout" attachedToRef="Work"><bpmn:timerEventDefinition /></bpmn:boundaryEvent>
       ${flows(['Start', 'Work'], ['Work', 'End'])}`,
    );
    assert.deepEqual(
      reports.map((report) => report.id),
      ['Timeout'],
    );
  });
});

// ---------------------------------------------------------------------------
// infinite-loop (AST-208)
// ---------------------------------------------------------------------------

describe('infinite-loop', () => {
  it('has no finding for a loop that exits through a complex split', async () => {
    const findings = await infiniteLoopFindings(
      `<bpmn:startEvent id="Start" /><bpmn:task id="Work" />${complexGateway('Decide')}<bpmn:endEvent id="End" />
       ${flows(['Start', 'Work'], ['Work', 'Decide'], ['Decide', 'Work'], ['Decide', 'End'])}`,
    );
    assert.deepEqual(findings, []);
  });

  it('has no finding for a loop with an error boundary that leaves the cycle', async () => {
    const findings = await infiniteLoopFindings(
      `<bpmn:startEvent id="Start" /><bpmn:exclusiveGateway id="Merge" /><bpmn:task id="Work" /><bpmn:endEvent id="End" />
       <bpmn:boundaryEvent id="Failure" attachedToRef="Work"><bpmn:errorEventDefinition /></bpmn:boundaryEvent>
       ${flows(['Start', 'Merge'], ['Merge', 'Work'], ['Work', 'Merge'], ['Failure', 'End'])}`,
    );
    assert.deepEqual(findings, []);
  });

  it('reports a loop whose only boundary event is a compensation boundary', async () => {
    const findings = await infiniteLoopFindings(
      `<bpmn:startEvent id="Start" /><bpmn:exclusiveGateway id="Merge" /><bpmn:task id="Work" />
       <bpmn:boundaryEvent id="Compensation" attachedToRef="Work"><bpmn:compensateEventDefinition /></bpmn:boundaryEvent>
       ${flows(['Start', 'Merge'], ['Merge', 'Work'], ['Work', 'Merge'])}`,
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0].ruleId, 'infinite-loop');
  });
});

describe('ProcessModelAnalyzer.hasCompensationBoundary', () => {
  it('detects a compensation boundary and ignores other boundaries', async () => {
    const definitions = await parseBpmnDefinitionsFromXml(
      definitionsXml(
        `<bpmn:task id="Booked" /><bpmn:task id="Timed" />
         <bpmn:boundaryEvent id="Compensation" attachedToRef="Booked"><bpmn:compensateEventDefinition /></bpmn:boundaryEvent>
         <bpmn:boundaryEvent id="Timeout" attachedToRef="Timed"><bpmn:timerEventDefinition /></bpmn:boundaryEvent>`,
      ),
    );
    const analyzer = new ProcessModelAnalyzer(definitions);
    assert.equal(analyzer.hasCompensationBoundary('Booked'), true);
    assert.equal(analyzer.hasCompensationBoundary('Timed'), false);
  });
});

// ---------------------------------------------------------------------------
// conditional-flows-no-gateway (AST-019)
// ---------------------------------------------------------------------------

describe('conditional-flows-no-gateway', () => {
  function conditionalFlowFrom(sourceType: string, incomingCount: number): ModdleNode {
    return moddleNode({
      $type: 'bpmn:SequenceFlow',
      id: 'Flow_1',
      conditionExpression: moddleNode({ $type: 'bpmn:FormalExpression', body: 'token.approved' }),
      sourceRef: moddleNode({ $type: sourceType, incoming: Array.from({ length: incomingCount }, () => ({})) }),
    });
  }

  it('reports a condition on a flow leaving a parallel gateway', () => {
    const reports = collectReports(conditionalFlowsNoGateway, conditionalFlowFrom('bpmn:ParallelGateway', 1));
    assert.equal(reports.length, 1);
    assert.match(reports[0].message, /ignored by the Engine/);
  });

  it('reports a condition on a flow leaving an exclusive join', () => {
    assert.equal(collectReports(conditionalFlowsNoGateway, conditionalFlowFrom('bpmn:ExclusiveGateway', 2)).length, 1);
  });

  it('reports a condition on a flow leaving a task', () => {
    assert.equal(collectReports(conditionalFlowsNoGateway, conditionalFlowFrom('bpmn:Task', 1)).length, 1);
  });

  it('passes a condition on a flow leaving an exclusive split', () => {
    assert.equal(collectReports(conditionalFlowsNoGateway, conditionalFlowFrom('bpmn:ExclusiveGateway', 1)).length, 0);
  });

  it('passes a condition on a flow leaving a complex split', () => {
    assert.equal(collectReports(conditionalFlowsNoGateway, conditionalFlowFrom('bpmn:ComplexGateway', 0)).length, 0);
  });
});
