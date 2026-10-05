import { splitQualifiedReference } from '../dmn-core/qualifiedReference';

/**
 * Requirements whose `href` is `namespace#elementId` point into another DMN model (a `<import>` target). dmn-js draws
 * no shape for them, so the Imported Requirements pane is the only place to see and edit them.
 */
export type ImportedRequirementType = 'decision' | 'input' | 'knowledge';

export type ImportedRequirement = {
  type: ImportedRequirementType;
  namespace: string;
  elementId: string;
  /** The `dmn:InformationRequirement` or `dmn:KnowledgeRequirement` moddle object that carries the reference. */
  requirement: any;
};

function toImportedRequirement(
  type: ImportedRequirementType,
  requirement: any,
  reference: any,
): ImportedRequirement | null {
  const href: string | undefined = reference?.href;
  if (href == null) {
    return null;
  }
  const { namespace, elementId } = splitQualifiedReference(href);
  return namespace == null ? null : { type, namespace, elementId, requirement };
}

export function readImportedRequirements(businessObject: any): ImportedRequirement[] {
  const found: (ImportedRequirement | null)[] = [];
  for (const requirement of businessObject?.informationRequirement ?? []) {
    found.push(toImportedRequirement('decision', requirement, requirement.requiredDecision));
    found.push(toImportedRequirement('input', requirement, requirement.requiredInput));
  }
  for (const requirement of businessObject?.knowledgeRequirement ?? []) {
    found.push(toImportedRequirement('knowledge', requirement, requirement.requiredKnowledge));
  }
  return found.filter((entry): entry is ImportedRequirement => entry != null);
}

/** Requirement types an element may carry; a Business Knowledge Model may only require knowledge (DMN rule). */
export function allowedImportedRequirementTypes(moddleType: string): ImportedRequirementType[] {
  return moddleType === 'dmn:BusinessKnowledgeModel' ? ['knowledge'] : ['decision', 'input', 'knowledge'];
}

export function requirementListName(type: ImportedRequirementType): 'informationRequirement' | 'knowledgeRequirement' {
  return type === 'knowledge' ? 'knowledgeRequirement' : 'informationRequirement';
}

type ModdleLike = { create: (type: string, attributes?: Record<string, unknown>) => any };

export function createImportedRequirement(moddle: ModdleLike, type: ImportedRequirementType, href: string): any {
  const reference = moddle.create('dmn:DMNElementReference', { href });
  const identifier = `Requirement_${crypto.randomUUID().slice(0, 8)}`;
  if (type === 'knowledge') {
    return moddle.create('dmn:KnowledgeRequirement', { id: identifier, requiredKnowledge: reference });
  }
  return moddle.create('dmn:InformationRequirement', {
    id: identifier,
    ...(type === 'decision' ? { requiredDecision: reference } : { requiredInput: reference }),
  });
}

/** The `dmn:DMNElementReference` that holds the `href` of an imported requirement. */
export function referenceOf(importedRequirement: ImportedRequirement): any {
  const { requirement, type } = importedRequirement;
  if (type === 'decision') {
    return requirement.requiredDecision;
  }
  return type === 'input' ? requirement.requiredInput : requirement.requiredKnowledge;
}
