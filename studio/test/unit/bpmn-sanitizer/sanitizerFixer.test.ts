import { BpmnModdle } from 'bpmn-moddle';
import { readFileSync } from 'fs';
import { beforeAll, describe, expect, it } from 'vitest';

import evilPlatformModdleDescriptor from '../../../src/modules/bpmn-core/bpmn-js/moddle/evil-platform.json';
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
    const moddle = new BpmnModdle({ evil: evilPlatformModdleDescriptor });
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
    const removeCmd = batch.context[0];
    expect(removeCmd.context.currentObject.id).toBe('SubProcess_haunt');
    expect(removeCmd.context.objectsToRemove[0].id).toBe('Event_sub_ghost_end');
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
