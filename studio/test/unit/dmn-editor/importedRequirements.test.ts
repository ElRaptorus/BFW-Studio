import { describe, expect, it } from 'vitest';

import {
  allowedImportedRequirementTypes,
  readImportedRequirements,
} from '../../../src/modules/dmn-editor/ImportedRequirements';

describe('readImportedRequirements', () => {
  it('collects only qualified references with their requirement type', () => {
    const businessObject = {
      informationRequirement: [
        { requiredDecision: { href: 'ns#D' } },
        { requiredInput: { href: 'ns#I' } },
        { requiredDecision: { href: '#Local' } },
      ],
      knowledgeRequirement: [{ requiredKnowledge: { href: 'ns#K' } }],
    };

    expect(
      readImportedRequirements(businessObject).map((entry) => [entry.type, entry.namespace, entry.elementId]),
    ).toEqual([
      ['decision', 'ns', 'D'],
      ['input', 'ns', 'I'],
      ['knowledge', 'ns', 'K'],
    ]);
    expect(readImportedRequirements(null)).toEqual([]);
  });
});

describe('allowedImportedRequirementTypes', () => {
  it('lets a business knowledge model require only knowledge', () => {
    expect(allowedImportedRequirementTypes('dmn:BusinessKnowledgeModel')).toEqual(['knowledge']);
    expect(allowedImportedRequirementTypes('dmn:Decision')).toEqual(['decision', 'input', 'knowledge']);
  });
});
