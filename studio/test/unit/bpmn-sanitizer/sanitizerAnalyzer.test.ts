import { BpmnModdle } from 'bpmn-moddle';
import { readFileSync } from 'fs';
import { beforeAll, describe, expect, it } from 'vitest';

import bfwPlatformModdleDescriptor from '../../../src/modules/bpmn-core/bpmn-js/moddle/bfw-platform.json';
import { type ModdleParseWarning, analyzeSanitizableIssues } from '../../../src/modules/bpmn-core/sanitizer';

describe('BpmnSanitizerAnalyzer', () => {
  let definitions: any;
  let parseWarnings: ModdleParseWarning[];

  beforeAll(async () => {
    const xml = readFileSync('test/fixtures/test-solution-sanitizer/haunted-house.bpmn', 'utf-8');
    const moddle = new BpmnModdle({ bfw: bfwPlatformModdleDescriptor });
    const result = await moddle.fromXML(xml);
    definitions = result.rootElement;
    parseWarnings = (result.warnings ?? []) as ModdleParseWarning[];
  });

  const EXPECTED_ISSUES = [
    {
      type: 'shapeless-flow-node',
      elementId: 'Task_ghost',
      elementName: 'Ghost Task',
      elementType: 'bpmn:Task',
      category: 'ghost-element',
      severity: 'error',
    },
    {
      type: 'shapeless-participant',
      elementId: 'Participant_ghost',
      elementName: 'Ghost Pool',
      elementType: 'bpmn:Participant',
      category: 'ghost-element',
      severity: 'error',
    },
    {
      type: 'shapeless-sequence-flow',
      elementId: 'Flow_ghost_in',
      elementName: undefined,
      elementType: 'bpmn:SequenceFlow',
      category: 'ghost-element',
      severity: 'error',
    },
    {
      type: 'shapeless-message-flow',
      elementId: 'MsgFlow_ghost',
      elementName: undefined,
      elementType: 'bpmn:MessageFlow',
      category: 'ghost-element',
      severity: 'error',
    },
    {
      type: 'unreferenced-message',
      elementId: 'Message_orphan',
      elementName: 'Orphaned Order',
      elementType: 'bpmn:Message',
      category: 'unreferenced-global',
      severity: 'info',
    },
    {
      type: 'unreferenced-error',
      elementId: 'Error_orphan',
      elementName: 'Orphaned Timeout',
      elementType: 'bpmn:Error',
      category: 'unreferenced-global',
      severity: 'info',
    },
    {
      type: 'unreferenced-signal',
      elementId: 'Signal_orphan',
      elementName: 'Orphaned Abort',
      elementType: 'bpmn:Signal',
      category: 'unreferenced-global',
      severity: 'info',
    },
    {
      type: 'unreferenced-escalation',
      elementId: 'Escalation_orphan',
      elementName: 'Orphaned Esc',
      elementType: 'bpmn:Escalation',
      category: 'unreferenced-global',
      severity: 'info',
    },
    {
      type: 'dangling-message-ref',
      elementId: 'Event_danglingMsg',
      elementName: 'Dangling Msg',
      elementType: 'bpmn:IntermediateCatchEvent',
      category: 'dangling-reference',
      severity: 'warning',
    },
    {
      type: 'dangling-error-ref',
      elementId: 'Event_danglingErr',
      elementName: 'Dangling Err',
      elementType: 'bpmn:EndEvent',
      category: 'dangling-reference',
      severity: 'warning',
    },
    {
      type: 'dangling-signal-ref',
      elementId: 'Event_danglingSig',
      elementName: 'Dangling Sig',
      elementType: 'bpmn:IntermediateThrowEvent',
      category: 'dangling-reference',
      severity: 'warning',
    },
    {
      type: 'dangling-escalation-ref',
      elementId: 'Event_danglingEsc',
      elementName: 'Dangling Esc',
      elementType: 'bpmn:EndEvent',
      category: 'dangling-reference',
      severity: 'warning',
    },
    {
      type: 'empty-extension-elements',
      elementId: 'Task_emptyExt',
      elementName: 'Empty Extensions',
      elementType: 'bpmn:Task',
      category: 'empty-container',
      severity: 'warning',
    },
    {
      type: 'shapeless-flow-node',
      elementId: 'Event_sub_ghost_boundary',
      elementName: undefined,
      elementType: 'bpmn:BoundaryEvent',
      category: 'ghost-element',
      severity: 'error',
    },
    {
      type: 'shapeless-flow-node',
      elementId: 'Event_sub_ghost_end',
      elementName: 'Ghost End',
      elementType: 'bpmn:EndEvent',
      category: 'ghost-element',
      severity: 'error',
    },
    {
      type: 'zombie-shape',
      elementId: 'Zombie_task_di',
      elementName: undefined,
      elementType: 'bpmndi:BPMNShape',
      category: 'zombie-element',
      severity: 'warning',
    },
    {
      type: 'zombie-edge',
      elementId: 'Zombie_flow_di',
      elementName: undefined,
      elementType: 'bpmndi:BPMNEdge',
      category: 'zombie-element',
      severity: 'warning',
    },
    {
      type: 'empty-bfw-properties',
      elementId: 'Definitions_1',
      elementName: undefined,
      elementType: 'bpmn:Definitions',
      category: 'empty-container',
      severity: 'warning',
    },
  ] as const;

  it('detects exactly the expected issues — no more, no less', () => {
    const issues = analyzeSanitizableIssues(definitions, undefined, parseWarnings);

    expect(issues).toHaveLength(EXPECTED_ISSUES.length);

    for (const expected of EXPECTED_ISSUES) {
      const found = issues.find((i) => i.type === expected.type && i.elementId === expected.elementId);
      expect(found, `expected issue ${expected.type} on ${expected.elementId}`).toBeDefined();
      expect(found!.elementType).toBe(expected.elementType);
      expect(found!.category).toBe(expected.category);
      expect(found!.severity).toBe(expected.severity);
      if (expected.elementName != null) {
        expect(found!.elementName).toBe(expected.elementName);
      }
    }
  });

  it('assigns correct severity per issue type', () => {
    const issues = analyzeSanitizableIssues(definitions, undefined, parseWarnings);

    for (const issue of issues) {
      if (issue.category === 'ghost-element') {
        expect(issue.severity).toBe('error');
      }
      if (issue.category === 'unreferenced-global') {
        expect(issue.severity).toBe('info');
      }
      if (issue.category === 'dangling-reference') {
        expect(issue.severity).toBe('warning');
      }
      if (issue.category === 'zombie-element') {
        expect(issue.severity).toBe('warning');
      }
      if (issue.category === 'empty-container') {
        expect(issue.severity).toBe('warning');
      }
    }
  });

  it('does not report false positives on clean elements', () => {
    const issues = analyzeSanitizableIssues(definitions, undefined, parseWarnings);
    const cleanIds = [
      'StartEvent_clean',
      'Task_clean',
      'EndEvent_clean',
      'Flow_clean_1',
      'Flow_clean_2',
      'TextAnnotation_process',
      'Association_process',
    ];

    for (const id of cleanIds) {
      expect(
        issues.find((i) => i.elementId === id),
        `false positive on ${id}`,
      ).toBeUndefined();
    }
  });
});

describe('BpmnSanitizerAnalyzer with ad-hoc and transaction containers', () => {
  async function analyze(innerTaskShapes: string): Promise<ReturnType<typeof analyzeSanitizableIssues>> {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" id="Definitions_1" targetNamespace="https://bifrostforge.world/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="true">
    <bpmn:adHocSubProcess id="AdHoc_1"><bpmn:userTask id="Task_adhoc" /></bpmn:adHocSubProcess>
    <bpmn:transaction id="Transaction_1"><bpmn:task id="Task_transaction" /></bpmn:transaction>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diagram_1">
    <bpmndi:BPMNPlane id="Plane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="Shape_AdHoc_1" bpmnElement="AdHoc_1"><dc:Bounds x="0" y="0" width="300" height="200" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_Transaction_1" bpmnElement="Transaction_1"><dc:Bounds x="400" y="0" width="300" height="200" /></bpmndi:BPMNShape>
      ${innerTaskShapes}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
    const { rootElement } = await new BpmnModdle().fromXML(xml);
    return analyzeSanitizableIssues(rootElement);
  }

  it('does not report shapes of elements inside the containers as zombies', async () => {
    const issues = await analyze(`
      <bpmndi:BPMNShape id="Shape_Task_adhoc" bpmnElement="Task_adhoc"><dc:Bounds x="20" y="20" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_Task_transaction" bpmnElement="Task_transaction"><dc:Bounds x="420" y="20" width="100" height="80" /></bpmndi:BPMNShape>`);
    expect(issues).toEqual([]);
  });

  it('reports elements inside the containers that have no shape', async () => {
    const issues = await analyze('');
    expect(issues.map((issue) => [issue.type, issue.elementId])).toEqual([
      ['shapeless-flow-node', 'Task_adhoc'],
      ['shapeless-flow-node', 'Task_transaction'],
    ]);
  });
});

describe('BpmnSanitizerAnalyzer element coverage', () => {
  const NAMESPACES =
    'xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"';

  async function parse(processBody: string, shapes: string, rootElements = '') {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions ${NAMESPACES} id="Definitions_1" targetNamespace="https://bifrostforge.world/schema/bpmn">
  ${rootElements}
  <bpmn:process id="Process_1" isExecutable="true">${processBody}</bpmn:process>
  <bpmndi:BPMNDiagram id="Diagram_1"><bpmndi:BPMNPlane id="Plane_1" bpmnElement="Process_1">${shapes}</bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`;
    const result = await new BpmnModdle().fromXML(xml);
    return { definitions: result.rootElement as any, warnings: (result.warnings ?? []) as ModdleParseWarning[] };
  }

  function shape(elementId: string): string {
    return `<bpmndi:BPMNShape id="Shape_${elementId}" bpmnElement="${elementId}"><dc:Bounds x="0" y="0" width="100" height="80" /></bpmndi:BPMNShape>`;
  }

  it('analyzes diagrams with child lanes and does not report their shapes as zombies', async () => {
    const { definitions } = await parse(
      `<bpmn:laneSet id="LaneSet_1"><bpmn:lane id="Lane_parent"><bpmn:childLaneSet id="LaneSet_child">
         <bpmn:lane id="Lane_child"><bpmn:flowNodeRef>Task_1</bpmn:flowNodeRef></bpmn:lane>
       </bpmn:childLaneSet></bpmn:lane></bpmn:laneSet><bpmn:task id="Task_1" />`,
      shape('Lane_parent') + shape('Lane_child') + shape('Task_1'),
    );
    expect(analyzeSanitizableIssues(definitions)).toEqual([]);
  });

  it('does not report shapes of process-level data inputs and outputs as zombies', async () => {
    const { definitions } = await parse(
      `<bpmn:ioSpecification id="IoSpecification_1"><bpmn:dataInput id="DataInput_1" /><bpmn:dataOutput id="DataOutput_1" />
         <bpmn:inputSet id="InputSet_1" /><bpmn:outputSet id="OutputSet_1" /></bpmn:ioSpecification>`,
      shape('DataInput_1') + shape('DataOutput_1'),
    );
    expect(analyzeSanitizableIssues(definitions)).toEqual([]);
  });

  it('reports a dangling messageRef on a receive task against the task, not the process', async () => {
    const { definitions, warnings } = await parse(
      '<bpmn:receiveTask id="Receive_1" messageRef="Missing" />',
      shape('Receive_1'),
    );
    const issues = analyzeSanitizableIssues(definitions, undefined, warnings);
    expect(issues.map((issue) => [issue.type, issue.elementId])).toEqual([['dangling-message-ref', 'Receive_1']]);
  });

  it('drops a dangling-reference warning once the reference is set again', async () => {
    const { definitions, warnings } = await parse(
      '<bpmn:receiveTask id="Receive_1" messageRef="Missing" />',
      shape('Receive_1'),
      '<bpmn:message id="Message_1" name="order" />',
    );
    const message = definitions.rootElements.find((element: any) => element.id === 'Message_1');
    definitions.rootElements.find((element: any) => element.id === 'Process_1').flowElements[0].messageRef = message;
    expect(analyzeSanitizableIssues(definitions, undefined, warnings)).toEqual([]);
  });

  it('ignores warnings and empty containers of elements removed from the model', async () => {
    const { definitions, warnings } = await parse(
      '<bpmn:receiveTask id="Receive_1" messageRef="Missing"><bpmn:extensionElements /></bpmn:receiveTask>',
      '',
    );
    definitions.rootElements.find((element: any) => element.id === 'Process_1').flowElements = [];
    expect(analyzeSanitizableIssues(definitions, undefined, warnings)).toEqual([]);
  });

  const subProcessBody = `<bpmn:subProcess id="Sub_1"><bpmn:startEvent id="Inner_start"><bpmn:outgoing>Inner_flow</bpmn:outgoing></bpmn:startEvent>
     <bpmn:endEvent id="Inner_end"><bpmn:incoming>Inner_flow</bpmn:incoming></bpmn:endEvent>
     <bpmn:sequenceFlow id="Inner_flow" sourceRef="Inner_start" targetRef="Inner_end" /></bpmn:subProcess>`;

  it('marks shapeless children of a collapsed sub-process as manual-fix-only', async () => {
    const { definitions } = await parse(subProcessBody, shape('Sub_1'));
    const issues = analyzeSanitizableIssues(definitions);
    expect(issues.map((issue) => [issue.elementId, issue.manualFixOnly])).toEqual([
      ['Inner_start', true],
      ['Inner_end', true],
      ['Inner_flow', true],
    ]);
  });

  it('keeps shapeless children of an expanded sub-process automatically fixable', async () => {
    const { definitions } = await parse(
      subProcessBody,
      '<bpmndi:BPMNShape id="Shape_Sub_1" bpmnElement="Sub_1" isExpanded="true"><dc:Bounds x="0" y="0" width="350" height="200" /></bpmndi:BPMNShape>',
    );
    const issues = analyzeSanitizableIssues(definitions);
    expect(issues.map((issue) => issue.elementId)).toEqual(['Inner_start', 'Inner_end', 'Inner_flow']);
    expect(issues.every((issue) => issue.manualFixOnly === undefined)).toBe(true);
  });

  it('reports data object and data store references without a shape', async () => {
    const { definitions } = await parse(
      `<bpmn:dataObject id="DataObject_1" /><bpmn:dataObjectReference id="DataObjectRef_1" dataObjectRef="DataObject_1" />
       <bpmn:dataStoreReference id="DataStoreRef_1" />`,
      '',
    );
    const issues = analyzeSanitizableIssues(definitions);
    expect(issues.map((issue) => [issue.type, issue.elementId])).toEqual([
      ['shapeless-flow-node', 'DataObjectRef_1'],
      ['shapeless-flow-node', 'DataStoreRef_1'],
    ]);
  });
});
