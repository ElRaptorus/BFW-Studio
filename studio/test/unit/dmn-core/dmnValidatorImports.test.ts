import { describe, expect, it } from 'vitest';

import type { DmnImportIndex, DmnImportedElementType } from '../../../src/modules/dmn-core/validation/DmnValidator';
import { DmnValidator } from '../../../src/modules/dmn-core/validation/DmnValidator';

const NAMESPACE = 'https://example.test/helper';

type RequirementKind = 'requiredDecision' | 'requiredInput' | 'requiredKnowledge';

function createDefinitions(
  href: string,
  declaredNamespaces: string[] = [NAMESPACE],
  kind: RequirementKind = 'requiredDecision',
) {
  const requirement = { [kind]: { href } };
  return {
    import: declaredNamespaces.map((namespace, index) => ({ id: `Import_${index}`, namespace })),
    drgElement: [
      {
        $type: 'dmn:Decision',
        id: 'Decision_a',
        name: 'A',
        expression: { $type: 'dmn:LiteralExpression', text: '1' },
        informationRequirement: kind === 'requiredKnowledge' ? [] : [requirement],
        knowledgeRequirement: kind === 'requiredKnowledge' ? [requirement] : [],
      },
    ],
  };
}

const createIndex = (namespace: string, elements: Record<string, DmnImportedElementType>): DmnImportIndex =>
  new Map([[namespace, new Map(Object.entries(elements))]]);

const importViolations = (definitions: ReturnType<typeof createDefinitions>, index?: DmnImportIndex) =>
  new DmnValidator().validate(definitions, index).filter((violation) => violation.category === 'import');

describe('DmnValidator import resolution', () => {
  it('does nothing without an import index', () => {
    expect(importViolations(createDefinitions(`${NAMESPACE}#Missing`))).toEqual([]);
  });

  it('warns about a declared import that no solution file provides', () => {
    const violations = importViolations(createDefinitions(`${NAMESPACE}#Imported`), new Map());
    expect(violations.map((violation) => violation.elementType)).toContain('Import');
    expect(violations.find((violation) => violation.elementType === 'Import')?.message).toContain(NAMESPACE);
  });

  it('warns about a reference into an undeclared namespace', () => {
    const violations = importViolations(
      createDefinitions(`${NAMESPACE}#Imported`, []),
      createIndex(NAMESPACE, { Imported: 'decision' }),
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('not declared as an import');
  });

  it('warns about a missing target element and accepts an existing one', () => {
    const index = createIndex(NAMESPACE, { Present: 'decision' });
    expect(importViolations(createDefinitions(`${NAMESPACE}#Present`), index)).toEqual([]);
    expect(importViolations(createDefinitions(`${NAMESPACE}#Missing`), index)[0].message).toContain(
      'has no element "Missing"',
    );
  });

  it('treats an element that is only a decision service as missing, like the Engine', () => {
    // Decision services are not in the index, so they cannot be found.
    const index = createIndex(NAMESPACE, { Other: 'decision' });
    expect(
      importViolations(createDefinitions(`${NAMESPACE}#Service`, [NAMESPACE], 'requiredKnowledge'), index)[0].message,
    ).toContain('has no element "Service"');
  });

  it('warns when the imported element has the wrong type for the requirement', () => {
    const index = createIndex(NAMESPACE, {
      Decision_x: 'decision',
      Input_x: 'inputData',
      Bkm_x: 'businessKnowledgeModel',
    });

    const knowledgeOnDecision = importViolations(
      createDefinitions(`${NAMESPACE}#Decision_x`, [NAMESPACE], 'requiredKnowledge'),
      index,
    );
    expect(knowledgeOnDecision).toHaveLength(1);
    expect(knowledgeOnDecision[0].message).toContain('which is a decision; it must be a business knowledge model');

    const decisionOnInput = importViolations(createDefinitions(`${NAMESPACE}#Input_x`), index);
    expect(decisionOnInput[0].message).toContain('which is a input data; it must be a decision');

    expect(importViolations(createDefinitions(`${NAMESPACE}#Bkm_x`, [NAMESPACE], 'requiredKnowledge'), index)).toEqual(
      [],
    );
    expect(importViolations(createDefinitions(`${NAMESPACE}#Input_x`, [NAMESPACE], 'requiredInput'), index)).toEqual(
      [],
    );
  });

  it('splits on the first # like the Engine', () => {
    const index = createIndex('https://example.test/with', { 'fragment#Item': 'decision' });
    const violations = importViolations(
      createDefinitions('https://example.test/with#fragment#Item', ['https://example.test/with']),
      index,
    );
    // First '#': namespace "https://example.test/with", element "fragment#Item" (present in the index).
    expect(violations).toEqual([]);
  });
});
