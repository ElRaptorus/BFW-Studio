import { DmnModdle } from 'dmn-moddle';
import { readFileSync } from 'fs';
import { beforeAll, describe, expect, it } from 'vitest';

import { type ModdleParseWarning, analyzeDmnSanitizableIssues } from '../../../src/modules/dmn-core/sanitizer';
import { buildDmnSanitizerFixCommands } from '../../../src/modules/dmn-core/sanitizer/DmnSanitizerFixer';
import type { DmnSanitizableIssue } from '../../../src/modules/dmn-core/sanitizer/sanitizerTypes';

const mockElementRegistry = {
  get: (_id: string) => null,
};

describe('DmnSanitizerFixer', () => {
  let definitions: any;
  let issues: DmnSanitizableIssue[];

  beforeAll(async () => {
    const xml = readFileSync('test/fixtures/test-solution-sanitizer/haunted-dmn.dmn', 'utf-8');
    const moddle = new DmnModdle();
    const result = await moddle.fromXML(xml);
    definitions = result.rootElement;
    const parseWarnings = (result.warnings ?? []) as ModdleParseWarning[];
    issues = analyzeDmnSanitizableIssues(definitions, undefined, parseWarnings);
  });

  it('produces a MultiCommandHandler batch for all issues', () => {
    const nonDanglingIssues = issues.filter((issue) => issue.category !== 'dangling-reference');
    const batch = buildDmnSanitizerFixCommands(nonDanglingIssues, definitions, mockElementRegistry);

    expect(batch.cmd).toBe('MultiCommandHandler');
    expect(Array.isArray(batch.context)).toBe(true);
    expect(batch.context.length).toBeGreaterThan(0);
  });

  it('generates remove commands for shapeless DRG elements', () => {
    const ghostIssues = issues.filter((issue) => issue.category === 'ghost-element');
    expect(ghostIssues.length).toBeGreaterThan(0);

    const batch = buildDmnSanitizerFixCommands(ghostIssues, definitions, mockElementRegistry);
    const commands = batch.context as { cmd: string; context: any }[];

    const removeCommands = commands.filter((command) => command.cmd === 'UpdateBusinessObjectListHandler');
    expect(removeCommands.length).toBeGreaterThan(0);

    const drgRemoves = removeCommands.filter((command) => command.context.propertyName === 'drgElement');
    expect(drgRemoves.length).toBeGreaterThan(0);
  });

  it('generates remove commands for zombie DI elements', () => {
    const zombieIssues = issues.filter((issue) => issue.category === 'zombie-element');
    expect(zombieIssues.length).toBeGreaterThan(0);

    const batch = buildDmnSanitizerFixCommands(zombieIssues, definitions, mockElementRegistry);
    const commands = batch.context as { cmd: string; context: any }[];

    const removeCommands = commands.filter((command) => command.cmd === 'UpdateBusinessObjectListHandler');
    expect(removeCommands.length).toBeGreaterThan(0);
  });

  it('generates remove commands for unreferenced definitions', () => {
    const orphanIssues = issues.filter((issue) => issue.category === 'unreferenced-definition');
    expect(orphanIssues.length).toBeGreaterThan(0);

    const batch = buildDmnSanitizerFixCommands(orphanIssues, definitions, mockElementRegistry);
    const commands = batch.context as { cmd: string; context: any }[];

    const removeCommands = commands.filter((command) => command.cmd === 'UpdateBusinessObjectListHandler');
    expect(removeCommands.length).toBeGreaterThan(0);

    const itemDefRemoves = removeCommands.filter((command) => command.context.propertyName === 'itemDefinition');
    const importRemoves = removeCommands.filter((command) => command.context.propertyName === 'import');
    expect(itemDefRemoves.length + importRemoves.length).toBeGreaterThan(0);
  });

  it('generates update commands for empty extension elements', () => {
    const emptyIssues = issues.filter((issue) => issue.type === 'empty-extension-elements');
    expect(emptyIssues.length).toBeGreaterThan(0);

    const batch = buildDmnSanitizerFixCommands(emptyIssues, definitions, mockElementRegistry);
    const commands = batch.context as { cmd: string; context: any }[];

    const updateCommands = commands.filter((command) => command.cmd === 'UpdateBusinessObjectHandler');
    expect(updateCommands.length).toBeGreaterThan(0);
    expect(updateCommands[0].context.properties.extensionElements).toBeUndefined();
  });

  it('generates commands for dangling requirement fixes', () => {
    const danglingIssues = issues.filter((issue) => issue.type === 'dangling-requirement-ref');
    expect(danglingIssues.length).toBeGreaterThan(0);

    const batch = buildDmnSanitizerFixCommands(danglingIssues, definitions, mockElementRegistry);
    const commands = batch.context as { cmd: string; context: any }[];

    expect(commands.length).toBeGreaterThan(0);
  });

  it('produces an empty batch for an empty issue list', () => {
    const batch = buildDmnSanitizerFixCommands([], definitions, mockElementRegistry);
    expect(batch.cmd).toBe('MultiCommandHandler');
    expect(batch.context).toHaveLength(0);
  });

  it('produces a single undo step for multiple issues', () => {
    const nonDanglingIssues = issues.filter((issue) => issue.category !== 'dangling-reference');
    const batch = buildDmnSanitizerFixCommands(nonDanglingIssues, definitions, mockElementRegistry);

    expect(batch.cmd).toBe('MultiCommandHandler');
    expect(Array.isArray(batch.context)).toBe(true);
  });
});
