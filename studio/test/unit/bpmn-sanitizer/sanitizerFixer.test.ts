import { BpmnModdle } from 'bpmn-moddle';
import { readFileSync } from 'fs';
import { beforeAll, describe, expect, it } from 'vitest';

import bfwPlatformModdleDescriptor from '../../../src/modules/bpmn-core/bpmn-js/moddle/bfw-platform.json';
import {
  type ModdleParseWarning,
  type SanitizableIssue,
  analyzeSanitizableIssues,
  buildSanitizerFixCommands,
} from '../../../src/modules/bpmn-core/sanitizer';

const stubRegistry = {
  get(_id: string) {
    return undefined;
  },
};

describe('BpmnSanitizerFixer', () => {
  let definitions: any;
  let parseWarnings: ModdleParseWarning[];
  let issues: SanitizableIssue[];

  beforeAll(async () => {
    const xml = readFileSync('test/fixtures/test-solution-sanitizer/haunted-house.bpmn', 'utf-8');
    const moddle = new BpmnModdle({ bfw: bfwPlatformModdleDescriptor });
    const result = await moddle.fromXML(xml);
    definitions = result.rootElement;
    parseWarnings = (result.warnings ?? []) as ModdleParseWarning[];
    issues = analyzeSanitizableIssues(definitions, undefined, parseWarnings);
  });

  it('produces non-empty fix commands for a top-level ghost flow node', () => {
    const issue = issues.find((i) => i.elementId === 'Task_ghost');
    expect(issue).toBeDefined();

    const batch = buildSanitizerFixCommands([issue!], definitions, stubRegistry);
    expect(batch.cmd).toBe('MultiCommandHandler');
    expect(batch.context.length).toBeGreaterThan(0);
  });

  it('produces non-empty fix commands for a ghost element nested inside a subprocess', () => {
    const issue = issues.find((i) => i.elementId === 'Event_sub_ghost_end');
    expect(issue).toBeDefined();

    const batch = buildSanitizerFixCommands([issue!], definitions, stubRegistry);
    expect(batch.cmd).toBe('MultiCommandHandler');
    expect(batch.context.length).toBeGreaterThan(0);
  });

  it('produces non-empty fix commands for a ghost boundary event nested inside a subprocess', () => {
    const issue = issues.find((i) => i.elementId === 'Event_sub_ghost_boundary');
    expect(issue).toBeDefined();

    const batch = buildSanitizerFixCommands([issue!], definitions, stubRegistry);
    expect(batch.cmd).toBe('MultiCommandHandler');
    expect(batch.context.length).toBeGreaterThan(0);
  });

  it('targets the subprocess (not the root process) when fixing nested ghosts', () => {
    const issue = issues.find((i) => i.elementId === 'Event_sub_ghost_end');
    expect(issue).toBeDefined();

    const batch = buildSanitizerFixCommands([issue!], definitions, stubRegistry);
    const removeCmd = batch.context.find(
      (command: any) => command.context.objectsToRemove[0].id === 'Event_sub_ghost_end',
    );
    expect(removeCmd.context.currentObject.id).toBe('SubProcess_haunt');
    expect(removeCmd.context.propertyName).toBe('flowElements');
  });

  it('produces fix commands for all ghost issues when batched via Fix All', () => {
    const ghostIssues = issues.filter((i) => i.category === 'ghost-element');
    expect(ghostIssues.length).toBeGreaterThanOrEqual(6);

    const batch = buildSanitizerFixCommands(ghostIssues, definitions, stubRegistry);
    expect(batch.cmd).toBe('MultiCommandHandler');
    expect(batch.context.length).toBeGreaterThanOrEqual(ghostIssues.length);
  });

  it('produces non-empty fix commands for a zombie shape', () => {
    const issue = issues.find((i) => i.elementId === 'Zombie_task_di');
    expect(issue).toBeDefined();
    expect(issue!.type).toBe('zombie-shape');

    const batch = buildSanitizerFixCommands([issue!], definitions, stubRegistry);
    expect(batch.cmd).toBe('MultiCommandHandler');
    expect(batch.context.length).toBeGreaterThan(0);
  });

  it('produces non-empty fix commands for a zombie edge', () => {
    const issue = issues.find((i) => i.elementId === 'Zombie_flow_di');
    expect(issue).toBeDefined();
    expect(issue!.type).toBe('zombie-edge');

    const batch = buildSanitizerFixCommands([issue!], definitions, stubRegistry);
    expect(batch.cmd).toBe('MultiCommandHandler');
    expect(batch.context.length).toBeGreaterThan(0);
  });

  it('removes zombie DI elements from the plane, not from semantic model', () => {
    const issue = issues.find((i) => i.elementId === 'Zombie_task_di');
    expect(issue).toBeDefined();

    const batch = buildSanitizerFixCommands([issue!], definitions, stubRegistry);
    const removeCmd = batch.context[0];
    expect(removeCmd.context.propertyName).toBe('planeElement');
    expect(removeCmd.context.objectsToRemove[0].id).toBe('Zombie_task_di');
  });
});

describe('BpmnSanitizerFixer dependent cleanup', () => {
  const NAMESPACES =
    'xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI"';

  async function parseDefinitions(rootElements: string, planeElement: string, planeBody: string): Promise<any> {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions ${NAMESPACES} id="Definitions_1" targetNamespace="https://bifrostforge.world/schema/bpmn">
  ${rootElements}
  <bpmndi:BPMNDiagram id="Diagram_1"><bpmndi:BPMNPlane id="Plane_1" bpmnElement="${planeElement}">${planeBody}</bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`;
    return (await new BpmnModdle().fromXML(xml)).rootElement;
  }

  function parse(processBody: string, planeBody = ''): Promise<any> {
    return parseDefinitions(
      `<bpmn:process id="Process_1" isExecutable="true">${processBody}</bpmn:process>`,
      'Process_1',
      planeBody,
    );
  }

  function removals(batch: any): string[] {
    return batch.context.map(
      (command: any) =>
        `${command.context.currentObject.id}.${command.context.propertyName}-${command.context.objectsToRemove
          .map((object: any) => object.id)
          .join(',')}`,
    );
  }

  function shapelessIssue(elementId: string, extra: Partial<SanitizableIssue> = {}): SanitizableIssue {
    return {
      type: 'shapeless-flow-node',
      category: 'ghost-element',
      severity: 'error',
      label: elementId,
      elementId,
      elementType: 'bpmn:Task',
      ...extra,
    } as SanitizableIssue;
  }

  const wiredTask = `<bpmn:laneSet id="LaneSet_1"><bpmn:lane id="Lane_1">
       <bpmn:flowNodeRef>Start_1</bpmn:flowNodeRef><bpmn:flowNodeRef>Task_ghost</bpmn:flowNodeRef>
     </bpmn:lane></bpmn:laneSet>
     <bpmn:startEvent id="Start_1"><bpmn:outgoing>Flow_1</bpmn:outgoing></bpmn:startEvent>
     <bpmn:task id="Task_ghost"><bpmn:incoming>Flow_1</bpmn:incoming></bpmn:task>
     <bpmn:boundaryEvent id="Boundary_1" attachedToRef="Task_ghost" />
     <bpmn:sequenceFlow id="Flow_1" sourceRef="Start_1" targetRef="Task_ghost" />`;

  it('removes lane references, connected flows with neighbour lists, and attached boundary events', async () => {
    const definitions = await parse(wiredTask);
    const batch = buildSanitizerFixCommands([shapelessIssue('Task_ghost')], definitions, stubRegistry);
    expect(removals(batch)).toEqual([
      'Lane_1.flowNodeRef-Task_ghost',
      'Start_1.outgoing-Flow_1',
      'Process_1.flowElements-Flow_1',
      'Process_1.flowElements-Boundary_1',
      'Process_1.flowElements-Task_ghost',
    ]);
  });

  it('does not remove a flow twice when Fix All also carries its own issue', async () => {
    const definitions = await parse(wiredTask);
    const flowIssue = {
      ...shapelessIssue('Flow_1'),
      type: 'shapeless-sequence-flow',
      elementType: 'bpmn:SequenceFlow',
    } as SanitizableIssue;
    const batch = buildSanitizerFixCommands([shapelessIssue('Task_ghost'), flowIssue], definitions, stubRegistry);
    expect(removals(batch).filter((removal) => removal.endsWith('-Flow_1'))).toHaveLength(2);
    expect(removals(batch)).not.toContain('Task_ghost.incoming-Flow_1');
  });

  it('removes data associations that point at a removed data reference', async () => {
    const definitions = await parse(
      `<bpmn:dataObject id="DataObject_1" /><bpmn:dataObjectReference id="DataRef_1" dataObjectRef="DataObject_1" />
       <bpmn:task id="Task_1">
         <bpmn:dataInputAssociation id="Input_1"><bpmn:sourceRef>DataRef_1</bpmn:sourceRef></bpmn:dataInputAssociation>
         <bpmn:dataOutputAssociation id="Output_1"><bpmn:targetRef>DataRef_1</bpmn:targetRef></bpmn:dataOutputAssociation>
       </bpmn:task>`,
    );
    const issue = shapelessIssue('DataRef_1', { elementType: 'bpmn:DataObjectReference' });
    expect(removals(buildSanitizerFixCommands([issue], definitions, stubRegistry))).toEqual([
      'Task_1.dataInputAssociations-Input_1',
      'Task_1.dataOutputAssociations-Output_1',
      'Process_1.flowElements-DataRef_1',
    ]);
  });

  it('removes the DI of dependents that were drawn although their host was not', async () => {
    const definitions = await parse(
      wiredTask,
      `<bpmndi:BPMNShape id="Shape_Start_1" bpmnElement="Start_1"><dc:Bounds x="0" y="0" width="36" height="36" /></bpmndi:BPMNShape>
       <bpmndi:BPMNShape id="Shape_Boundary_1" bpmnElement="Boundary_1"><dc:Bounds x="0" y="0" width="36" height="36" /></bpmndi:BPMNShape>`,
    );
    const batch = buildSanitizerFixCommands([shapelessIssue('Task_ghost')], definitions, stubRegistry);
    expect(removals(batch).at(-1)).toBe('Plane_1.planeElement-Shape_Boundary_1');
  });

  it('removes the association and its DI edge when a compensation handler is removed', async () => {
    const definitions = await parse(
      `<bpmn:task id="Task_host" />
       <bpmn:boundaryEvent id="Boundary_compensation" attachedToRef="Task_host"><bpmn:compensateEventDefinition /></bpmn:boundaryEvent>
       <bpmn:task id="Task_handler" isForCompensation="true" />
       <bpmn:association id="Assoc_1" sourceRef="Boundary_compensation" targetRef="Task_handler" />`,
      `<bpmndi:BPMNEdge id="Edge_Assoc_1" bpmnElement="Assoc_1"><di:waypoint x="0" y="0" /><di:waypoint x="10" y="10" /></bpmndi:BPMNEdge>`,
    );
    expect(removals(buildSanitizerFixCommands([shapelessIssue('Task_handler')], definitions, stubRegistry))).toEqual([
      'Process_1.flowElements-Task_handler',
      'Process_1.artifacts-Assoc_1',
      'Plane_1.planeElement-Edge_Assoc_1',
    ]);
  });

  describe('message flows', () => {
    const collaboration = `<bpmn:collaboration id="Collaboration_1">
        <bpmn:participant id="Participant_1" processRef="Process_1" />
        <bpmn:participant id="Participant_2" />
        <bpmn:messageFlow id="MessageFlow_task" sourceRef="Task_ghost" targetRef="Participant_2" />
        <bpmn:messageFlow id="MessageFlow_pool" sourceRef="Start_1" targetRef="Participant_2" />
      </bpmn:collaboration>
      <bpmn:process id="Process_1" isExecutable="true">${wiredTask}</bpmn:process>`;

    const parseCollaboration = () => parseDefinitions(collaboration, 'Collaboration_1', '');

    it('removes a message flow whose flow node is removed', async () => {
      const batch = buildSanitizerFixCommands([shapelessIssue('Task_ghost')], await parseCollaboration(), stubRegistry);
      expect(removals(batch)).toContain('Collaboration_1.messageFlows-MessageFlow_task');
      expect(removals(batch).join()).not.toContain('MessageFlow_pool');
    });

    it('removes every message flow to a removed participant', async () => {
      const issue = {
        ...shapelessIssue('Participant_2'),
        type: 'shapeless-participant',
        elementType: 'bpmn:Participant',
      } as SanitizableIssue;
      expect(removals(buildSanitizerFixCommands([issue], await parseCollaboration(), stubRegistry))).toEqual([
        'Collaboration_1.participants-Participant_2',
        'Collaboration_1.messageFlows-MessageFlow_task,MessageFlow_pool',
      ]);
    });

    it('removes a message flow only once when Fix All also carries its own issue', async () => {
      const messageFlowIssue = {
        ...shapelessIssue('MessageFlow_task'),
        type: 'shapeless-message-flow',
        elementType: 'bpmn:MessageFlow',
      } as SanitizableIssue;
      const batch = buildSanitizerFixCommands(
        [shapelessIssue('Task_ghost'), messageFlowIssue],
        await parseCollaboration(),
        stubRegistry,
      );
      expect(removals(batch).filter((removal) => removal.includes('.messageFlows-'))).toEqual([
        'Collaboration_1.messageFlows-MessageFlow_task',
      ]);
    });
  });

  it('removes an association to a removed sequence flow but keeps the text annotation', async () => {
    const definitions = await parse(
      `${wiredTask}
       <bpmn:textAnnotation id="Annotation_1"><bpmn:text>note</bpmn:text></bpmn:textAnnotation>
       <bpmn:association id="Assoc_flow" sourceRef="Annotation_1" targetRef="Flow_1" />`,
    );
    const flowIssue = {
      ...shapelessIssue('Flow_1'),
      type: 'shapeless-sequence-flow',
      elementType: 'bpmn:SequenceFlow',
    } as SanitizableIssue;
    const batch = removals(buildSanitizerFixCommands([flowIssue], definitions, stubRegistry));
    expect(batch).toContain('Process_1.artifacts-Assoc_flow');
    expect(batch.join()).not.toContain('Annotation_1');
  });

  it('produces no commands for a manual-fix-only issue', async () => {
    const definitions = await parse(wiredTask);
    const issue = shapelessIssue('Task_ghost', { manualFixOnly: true });
    expect(buildSanitizerFixCommands([issue], definitions, stubRegistry).context).toEqual([]);
  });
});
