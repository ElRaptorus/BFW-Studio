import { DmnModdle } from 'dmn-moddle';
import { readFileSync } from 'fs';
import { beforeAll, describe, expect, it } from 'vitest';

import { type ModdleParseWarning, analyzeDmnSanitizableIssues } from '../../../src/modules/dmn-core/sanitizer';

describe('DmnSanitizerAnalyzer', () => {
  let definitions: any;
  let parseWarnings: ModdleParseWarning[];

  beforeAll(async () => {
    const xml = readFileSync('test/fixtures/test-solution-sanitizer/haunted-dmn.dmn', 'utf-8');
    const moddle = new DmnModdle();
    const result = await moddle.fromXML(xml);
    definitions = result.rootElement;
    parseWarnings = (result.warnings ?? []) as ModdleParseWarning[];
  });

  const EXPECTED_ISSUES = [
    {
      type: 'shapeless-decision',
      elementId: 'Decision_ghost',
      elementName: 'Ghost Decision',
      elementType: 'dmn:Decision',
      category: 'ghost-element',
      severity: 'error',
    },
    {
      type: 'shapeless-input-data',
      elementId: 'InputData_ghost',
      elementName: 'Ghost Input',
      elementType: 'dmn:InputData',
      category: 'ghost-element',
      severity: 'error',
    },
    {
      type: 'zombie-shape',
      elementId: 'Shape_zombie',
      elementType: 'dmndi:DMNShape',
      category: 'zombie-element',
      severity: 'warning',
    },
    {
      type: 'zombie-edge',
      elementId: 'Edge_zombie',
      elementType: 'dmndi:DMNEdge',
      category: 'zombie-element',
      severity: 'warning',
    },
    {
      type: 'unreferenced-item-definition',
      elementId: 'ItemDef_orphan',
      elementName: 'tOrphanType',
      elementType: 'dmn:ItemDefinition',
      category: 'unreferenced-definition',
      severity: 'info',
    },
    {
      type: 'unreferenced-import',
      elementName: 'UnusedImport',
      elementType: 'dmn:Import',
      category: 'unreferenced-definition',
      severity: 'info',
    },
    {
      type: 'dangling-requirement-ref',
      elementId: 'Decision_dangling',
      elementName: 'Dangling Refs Decision',
      elementType: 'dmn:Decision',
      category: 'dangling-reference',
      severity: 'warning',
    },
    {
      type: 'empty-extension-elements',
      elementId: 'Decision_empty_ext',
      elementName: 'Empty Extensions Decision',
      elementType: 'dmn:Decision',
      category: 'empty-container',
      severity: 'warning',
    },
  ] as const;

  it('detects all expected issue types from the haunted DMN fixture', () => {
    const issues = analyzeDmnSanitizableIssues(definitions, undefined, parseWarnings);

    for (const expected of EXPECTED_ISSUES) {
      const matchBy = expected.elementId ?? expected.elementName;
      const found = issues.find(
        (issue) => issue.type === expected.type && (issue.elementId === matchBy || issue.elementName === matchBy),
      );
      expect(found, `expected issue ${expected.type} on ${matchBy}`).toBeDefined();
      expect(found!.elementType).toBe(expected.elementType);
      expect(found!.category).toBe(expected.category);
      expect(found!.severity).toBe(expected.severity);
      if (expected.elementName != null) {
        expect(found!.elementName).toBe(expected.elementName);
      }
    }
  });

  it('assigns correct severity per category', () => {
    const issues = analyzeDmnSanitizableIssues(definitions, undefined, parseWarnings);

    for (const issue of issues) {
      if (issue.category === 'ghost-element') {
        expect(issue.severity).toBe('error');
      }
      if (issue.category === 'unreferenced-definition') {
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
    const issues = analyzeDmnSanitizableIssues(definitions, undefined, parseWarnings);
    const cleanIds = ['Decision_visible', 'InputData_visible', 'ItemDef_used'];

    for (const id of cleanIds) {
      expect(
        issues.find((issue) => issue.elementId === id),
        `false positive on ${id}`,
      ).toBeUndefined();
    }
  });

  it('returns no issues for a clean DMN file', async () => {
    const cleanXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/"
  xmlns:dmndi="https://www.omg.org/spec/DMN/20191111/DMNDI/"
  xmlns:dc="http://www.omg.org/spec/DMN/20180521/DC/"
  id="Definitions_clean" name="Clean DMN" namespace="https://bifrostforge.world/test">
  <decision id="Decision_1" name="Simple Decision">
    <variable id="Var_1" name="result" typeRef="string" />
    <literalExpression id="LE_1"><text>"ok"</text></literalExpression>
  </decision>
  <dmndi:DMNDI>
    <dmndi:DMNDiagram id="DMNDiagram_1">
      <dmndi:DMNShape id="Shape_1" dmnElementRef="Decision_1">
        <dc:Bounds x="100" y="100" width="180" height="80" />
      </dmndi:DMNShape>
    </dmndi:DMNDiagram>
  </dmndi:DMNDI>
</definitions>`;

    const moddle = new DmnModdle();
    const result = await moddle.fromXML(cleanXml);
    const cleanDefs = result.rootElement;
    const cleanWarnings = (result.warnings ?? []) as ModdleParseWarning[];

    const issues = analyzeDmnSanitizableIssues(cleanDefs, undefined, cleanWarnings);
    expect(issues).toHaveLength(0);
  });

  it('returns empty array for null/undefined definitions', () => {
    expect(analyzeDmnSanitizableIssues(null)).toHaveLength(0);
    expect(analyzeDmnSanitizableIssues(undefined)).toHaveLength(0);
  });
});
