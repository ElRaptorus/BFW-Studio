import type { DmnSanitizableIssue, DmnSanitizerIssueTypeDiscriminant } from './sanitizerTypes';

export type DmnSanitizableIssueDescription = {
  message: (issue: DmnSanitizableIssue) => string;
  why: string;
  suggestion: string;
};

function nameOrId(issue: DmnSanitizableIssue): string {
  return issue.elementName ? `'${issue.elementName}' (${issue.elementId})` : issue.elementId;
}

export const issueDescriptions: Record<DmnSanitizerIssueTypeDiscriminant, DmnSanitizableIssueDescription> = {
  'shapeless-decision': {
    message: (issue) => `Poltergeist Decision: ${nameOrId(issue)}`,
    why: 'This Decision exists in the semantic model but has no DMNShape on the DRD canvas. It is invisible in the editor, yet the engine will still evaluate it. If other elements have requirements pointing to it, those edges are also invisible.',
    suggestion: 'Remove the ghost Decision from the DMN XML.',
  },

  'shapeless-input-data': {
    message: (issue) => `Poltergeist Input Data: ${nameOrId(issue)}`,
    why: 'This Input Data element exists in the semantic model but has no DMNShape on the DRD canvas. It is invisible in the editor but still participates in the decision graph.',
    suggestion: 'Remove the ghost Input Data from the DMN XML.',
  },

  'shapeless-bkm': {
    message: (issue) => `Poltergeist BKM: ${nameOrId(issue)}`,
    why: 'This Business Knowledge Model exists in the semantic model but has no DMNShape on the DRD canvas. It is invisible but can still be invoked by decisions via knowledge requirements.',
    suggestion: 'Remove the ghost Business Knowledge Model from the DMN XML.',
  },

  'shapeless-knowledge-source': {
    message: (issue) => `Poltergeist Knowledge Source: ${nameOrId(issue)}`,
    why: 'This Knowledge Source exists in the semantic model but has no DMNShape on the DRD canvas. It is a documentation-only element, but its invisibility creates confusion about which sources govern which decisions.',
    suggestion: 'Remove the ghost Knowledge Source from the DMN XML.',
  },

  'shapeless-decision-service': {
    message: (issue) => `Poltergeist Decision Service: ${nameOrId(issue)}`,
    why: 'This Decision Service exists in the semantic model but has no DMNShape on the DRD canvas. It defines a reusable subset of the DRG, but being invisible means it cannot be inspected or maintained.',
    suggestion: 'Remove the ghost Decision Service from the DMN XML.',
  },

  'zombie-shape': {
    message: (issue) => `Zombie: ${nameOrId(issue)}`,
    why: 'This is a Zombie — a DMNShape on the DRD canvas whose semantic element has been removed from the definitions. Visible to everybody, but braindead: no properties, no logic, no runtime behavior. Common merge artifact.',
    suggestion: 'Remove the orphaned DMNShape from the DMNDI layer.',
  },

  'zombie-edge': {
    message: (issue) => `Zombie wire: ${nameOrId(issue)}`,
    why: 'This is a Zombie wire — a DMNEdge on the DRD canvas whose semantic element has been removed. It still appears as a line on the canvas but represents nothing in the decision model.',
    suggestion: 'Remove the orphaned DMNEdge from the DMNDI layer.',
  },

  'unreferenced-item-definition': {
    message: (issue) => `Orphaned ItemDefinition: ${nameOrId(issue)}`,
    why: 'This ItemDefinition is declared at the definitions level but nothing references it — no typeRef in the model uses it. Dead weight in the XML, likely left behind after a refactoring or merge.',
    suggestion: 'Remove the unused ItemDefinition.',
  },

  'unreferenced-import': {
    message: (issue) => `Orphaned Import: ${nameOrId(issue)}`,
    why: 'This Import is declared at the definitions level but no element in the model references it. Dead weight in the XML.',
    suggestion: 'Remove the unused Import.',
  },

  'dangling-requirement-ref': {
    message: (issue) => `Dangling requirement on ${nameOrId(issue)}`,
    why: 'This element has an information, knowledge, or authority requirement whose href target does not exist in the model. The engine will fail at runtime when trying to resolve the dependency.',
    suggestion: 'Either remove the broken requirement or re-create the missing target element.',
  },

  'dangling-dmn-element-ref': {
    message: (issue) => `Dangling dmnElementRef on ${nameOrId(issue)}`,
    why: 'This DI element has a dmnElementRef that points to a semantic element which no longer exists. It is a broken diagram shape or edge.',
    suggestion: 'Remove the broken DI element from the DMNDI layer.',
  },

  'empty-extension-elements': {
    message: (issue) => `Empty extensionElements on ${nameOrId(issue)}`,
    why: 'An empty <extensionElements> wrapper that adds XML noise without serving any purpose. Common merge artifact.',
    suggestion: 'Remove the empty extensionElements container.',
  },
};

export const CATEGORY_LABELS: Record<string, { label: string; description: string }> = {
  'ghost-element': {
    label: 'Poltergeists — Ghost Elements',
    description:
      'Ghost elements that haunt the DMN XML. Invisible on the DRD canvas, but the engine still evaluates them. These are the most dangerous merge artifacts.',
  },
  'zombie-element': {
    label: 'Zombies — Braindead Shapes',
    description:
      'DRD shapes or edges whose semantic elements have been removed. Visible on the canvas, but the engine ignores them. The opposite of a Poltergeist.',
  },
  'dangling-reference': {
    label: 'Dangling References',
    description:
      'References that point to elements which no longer exist. Requirements with broken href targets or DI elements with missing dmnElementRef.',
  },
  'empty-container': {
    label: 'Empty Containers',
    description: 'Empty XML wrappers that serve no purpose. Common merge artifacts that add noise.',
  },
  'unreferenced-definition': {
    label: 'Orphaned Definitions',
    description:
      'Definitions declared at the top level that nothing references — dead weight from refactoring or merging.',
  },
};

export const CATEGORY_SEVERITY_ORDER: string[] = [
  'ghost-element',
  'zombie-element',
  'dangling-reference',
  'empty-container',
  'unreferenced-definition',
];
