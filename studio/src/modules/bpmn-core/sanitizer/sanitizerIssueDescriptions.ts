import type { SanitizableIssue, SanitizerIssueTypeDiscriminant } from './sanitizerTypes';

export type SanitizableIssueDescription = {
  message: (issue: SanitizableIssue) => string;
  why: string;
  suggestion: string;
};

function nameOrId(issue: SanitizableIssue): string {
  return issue.elementName ? `'${issue.elementName}' (${issue.elementId})` : issue.elementId;
}

export const issueDescriptions: Record<SanitizerIssueTypeDiscriminant, SanitizableIssueDescription> = {
  'shapeless-flow-node': {
    message: (issue) => `Poltergeist: ${nameOrId(issue)}`,
    why: 'This is a Poltergeist — a ghost element that haunts the process definition. It has no diagram coordinates, so it is completely invisible in the editor, yet the engine will still execute it. If it is connected to visible elements via invisible sequence flows, it creates hidden execution paths that cause unpredictable behavior in production.',
    suggestion:
      'Remove the ghost element from the XML. This also removes its lane references, connected sequence flows, attached boundary events, and data associations to it. Inside a collapsed sub-process there is no automatic fix: expand the sub-process or lay out its children on the drill-down plane.',
  },

  'shapeless-participant': {
    message: (issue) => `Poltergeist pool: ${nameOrId(issue)}`,
    why: 'This participant (pool) has no diagram coordinates and is invisible in the editor. It may contain flow elements that the engine attempts to execute, but that the user cannot see or manage.',
    suggestion: 'Remove the ghost participant from the XML.',
  },

  'shapeless-sequence-flow': {
    message: (issue) => `Poltergeist wire: ${issue.elementId}`,
    why: 'This invisible sequence flow is the arm of a Poltergeist — it connects a ghost element to the visible process flow without appearing on the diagram. The engine follows it silently, creating a hidden execution branch.',
    suggestion:
      'Remove the invisible sequence flow. This typically happens alongside removing the ghost element it connects. Inside a collapsed sub-process there is no automatic fix: expand the sub-process or lay out its children on the drill-down plane.',
  },

  'shapeless-message-flow': {
    message: (issue) => `Invisible message flow: ${issue.elementId}`,
    why: 'This invisible message flow connects participants or elements without appearing on the diagram. It can cause unexpected message routing at runtime.',
    suggestion: 'Remove the invisible message flow from the XML.',
  },

  'unreferenced-message': {
    message: (issue) => `Orphaned Message: ${nameOrId(issue)}`,
    why: 'This Message definition is declared at the process level but nothing references it — no MessageEventDefinition or MessageFlow uses it. Dead weight in the XML, likely left behind after a refactoring or merge.',
    suggestion: 'Remove the unused Message definition.',
  },

  'unreferenced-error': {
    message: (issue) => `Orphaned Error: ${nameOrId(issue)}`,
    why: 'This Error definition is declared at the process level but nothing references it — no ErrorEventDefinition uses it. Dead weight in the XML, likely left behind after a refactoring or merge.',
    suggestion: 'Remove the unused Error definition.',
  },

  'unreferenced-signal': {
    message: (issue) => `Orphaned Signal: ${nameOrId(issue)}`,
    why: 'This Signal definition is declared at the process level but nothing references it — no SignalEventDefinition uses it. Dead weight in the XML, likely left behind after a refactoring or merge.',
    suggestion: 'Remove the unused Signal definition.',
  },

  'unreferenced-escalation': {
    message: (issue) => `Orphaned Escalation: ${nameOrId(issue)}`,
    why: 'This Escalation definition is declared at the process level but nothing references it — no EscalationEventDefinition uses it. Dead weight in the XML, likely left behind after a refactoring or merge.',
    suggestion: 'Remove the unused Escalation definition.',
  },

  'dangling-message-ref': {
    message: (issue) => `Dangling messageRef on ${nameOrId(issue)}`,
    why: 'This element references a Message definition that no longer exists in the XML. The engine will fail at runtime when trying to resolve it.',
    suggestion: 'Either remove the reference or re-create the missing Message definition.',
  },

  'dangling-error-ref': {
    message: (issue) => `Dangling errorRef on ${nameOrId(issue)}`,
    why: 'This element references an Error definition that no longer exists in the XML. The engine will fail at runtime when trying to resolve it.',
    suggestion: 'Either remove the reference or re-create the missing Error definition.',
  },

  'dangling-signal-ref': {
    message: (issue) => `Dangling signalRef on ${nameOrId(issue)}`,
    why: 'This element references a Signal definition that no longer exists in the XML. The engine will fail at runtime when trying to resolve it.',
    suggestion: 'Either remove the reference or re-create the missing Signal definition.',
  },

  'dangling-escalation-ref': {
    message: (issue) => `Dangling escalationRef on ${nameOrId(issue)}`,
    why: 'This element references an Escalation definition that no longer exists in the XML. The engine will fail at runtime when trying to resolve it.',
    suggestion: 'Either remove the reference or re-create the missing Escalation definition.',
  },

  'empty-extension-elements': {
    message: (issue) => `Empty extensionElements on ${nameOrId(issue)}`,
    why: 'An empty <extensionElements> wrapper that adds XML noise without serving any purpose. Common merge artifact.',
    suggestion: 'Remove the empty extensionElements container.',
  },

  'empty-bfw-properties': {
    message: (issue) => `Empty bfw:Properties on ${nameOrId(issue)}`,
    why: 'A bfw:Properties container with no content (no linter scores and no custom properties) — empty wrapper left behind after a merge or cleanup.',
    suggestion:
      'Remove the empty bfw:Properties container. If the parent extensionElements also becomes empty, it will be cleaned up too.',
  },

  'zombie-shape': {
    message: (issue) => `Zombie: ${nameOrId(issue)}`,
    why: 'This is a Zombie — a diagram shape whose semantic element has been removed from the process definition. Visible to everybody on the canvas, but clearly braindead: no properties, no connections, no runtime behavior. Common merge artifact where the XML element was deleted in one branch while the diagram shape survived in another.',
    suggestion: 'Remove the orphaned diagram shape from the DI layer.',
  },

  'zombie-edge': {
    message: (issue) => `Zombie wire: ${nameOrId(issue)}`,
    why: 'This is a Zombie wire — a diagram edge (connection) whose semantic element has been removed from the process definition. It still appears as a line on the canvas, but connects nothing in the engine.',
    suggestion: 'Remove the orphaned diagram edge from the DI layer.',
  },
};

export const CATEGORY_LABELS: Record<string, { label: string; description: string }> = {
  'ghost-element': {
    label: 'Poltergeists — Ghost Elements',
    description:
      'Ghost elements that haunt the XML. Invisible on the diagram, but the engine still executes them. These are the most dangerous merge artifacts.',
  },
  'unreferenced-global': {
    label: 'Orphaned Definitions',
    description:
      'Definitions declared at process level that nothing references — dead weight from refactoring or merging.',
  },
  'dangling-reference': {
    label: 'Dangling References',
    description: 'References that point to definitions which no longer exist. These cause runtime failures.',
  },
  'zombie-element': {
    label: 'Zombies — Braindead Shapes',
    description:
      'Diagram shapes or edges whose semantic elements have been removed. Visible on the canvas, but the engine ignores them. The opposite of a Poltergeist.',
  },
  'empty-container': {
    label: 'Empty Containers',
    description: 'Empty XML wrappers that serve no purpose. Common merge artifacts that add noise.',
  },
};

export const CATEGORY_SEVERITY_ORDER: string[] = [
  'ghost-element',
  'zombie-element',
  'dangling-reference',
  'empty-container',
  'unreferenced-global',
];
