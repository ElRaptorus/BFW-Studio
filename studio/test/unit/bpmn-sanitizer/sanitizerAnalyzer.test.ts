import { BpmnModdle } from 'bpmn-moddle';
import { readFileSync } from 'fs';
import { beforeAll, describe, expect, it } from 'vitest';

import evilPlatformModdleDescriptor from '../../../src/modules/bpmn-core/bpmn-js/moddle/evil-platform.json';
import { type ModdleParseWarning, analyzeSanitizableIssues } from '../../../src/modules/bpmn-core/sanitizer';

describe('BpmnSanitizerAnalyzer', () => {
  let definitions: any;
  let parseWarnings: ModdleParseWarning[];

  beforeAll(async () => {
    const xml = readFileSync('test/fixtures/test-solution-sanitizer/haunted-house.bpmn', 'utf-8');
    const moddle = new BpmnModdle({ evil: evilPlatformModdleDescriptor });
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
      type: 'empty-evil-properties',
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
