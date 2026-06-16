import { CmdHelper, type CmdHelperDescriptor } from '../bpmn-js/CommandHandler/Helper/CommmandHelper';
import type { SanitizableIssue } from './sanitizerTypes';

interface ElementRegistryLike {
  get(id: string): any;
}

export function buildSanitizerFixCommands(
  issues: SanitizableIssue[],
  definitions: any,
  elementRegistry: ElementRegistryLike,
): CmdHelperDescriptor {
  const commands: CmdHelperDescriptor[] = [];

  for (const issue of issues) {
    const cmds = buildFixForIssue(issue, definitions, elementRegistry);
    commands.push(...cmds);
  }

  return CmdHelper.executeMultipleCommands(commands);
}

function buildFixForIssue(
  issue: SanitizableIssue,
  definitions: any,
  elementRegistry: ElementRegistryLike,
): CmdHelperDescriptor[] {
  switch (issue.type) {
    case 'unreferenced-message':
    case 'unreferenced-error':
    case 'unreferenced-signal':
    case 'unreferenced-escalation':
      return fixUnreferencedGlobal(issue, definitions, elementRegistry);

    case 'shapeless-flow-node':
      return fixShapelessFlowNode(issue, definitions, elementRegistry);

    case 'shapeless-participant':
      return fixShapelessParticipant(issue, definitions, elementRegistry);

    case 'shapeless-sequence-flow':
      return fixShapelessSequenceFlow(issue, definitions, elementRegistry);

    case 'shapeless-message-flow':
      return fixShapelessMessageFlow(issue, definitions, elementRegistry);

    case 'zombie-shape':
    case 'zombie-edge':
      return fixZombieDiElement(issue, definitions, elementRegistry);

    case 'dangling-message-ref':
    case 'dangling-error-ref':
    case 'dangling-signal-ref':
    case 'dangling-escalation-ref':
      return fixDanglingRef(issue, definitions, elementRegistry);

    case 'empty-extension-elements':
      return fixEmptyExtensionElements(issue, definitions, elementRegistry);

    case 'empty-evil-properties':
      return fixEmptyEvilProperties(issue, definitions, elementRegistry);

    default:
      return [];
  }
}

function fixUnreferencedGlobal(
  issue: SanitizableIssue,
  definitions: any,
  elementRegistry: ElementRegistryLike,
): CmdHelperDescriptor[] {
  const rootElements: any[] = definitions.rootElements ?? [];
  const globalEl = rootElements.find((el: any) => el.id === issue.elementId);
  if (!globalEl) {
    return [];
  }

  const rootShape = elementRegistry.get(definitions.id) ?? elementRegistry.get('__implicitroot');
  const element = rootShape ?? { id: definitions.id };

  return [CmdHelper.removeElementsFromList(element, definitions, 'rootElements', undefined, [globalEl])];
}

function fixShapelessFlowNode(
  issue: SanitizableIssue,
  definitions: any,
  elementRegistry: ElementRegistryLike,
): CmdHelperDescriptor[] {
  const process = findProcessContaining(definitions, issue.elementId);
  if (!process) {
    return [];
  }

  const flowEl = (process.flowElements ?? []).find((el: any) => el.id === issue.elementId);
  if (!flowEl) {
    return [];
  }

  const rootShape = elementRegistry.get(process.id) ?? { id: process.id };
  return [CmdHelper.removeElementsFromList(rootShape, process, 'flowElements', undefined, [flowEl])];
}

function fixShapelessParticipant(
  issue: SanitizableIssue,
  definitions: any,
  elementRegistry: ElementRegistryLike,
): CmdHelperDescriptor[] {
  const collab = findCollaboration(definitions);
  if (!collab) {
    return [];
  }

  const participant = (collab.participants ?? []).find((el: any) => el.id === issue.elementId);
  if (!participant) {
    return [];
  }

  const rootShape = elementRegistry.get(collab.id) ?? { id: collab.id };
  return [CmdHelper.removeElementsFromList(rootShape, collab, 'participants', undefined, [participant])];
}

function fixShapelessSequenceFlow(
  issue: SanitizableIssue,
  definitions: any,
  elementRegistry: ElementRegistryLike,
): CmdHelperDescriptor[] {
  const process = findProcessContaining(definitions, issue.elementId);
  if (!process) {
    return [];
  }

  const flowEl = (process.flowElements ?? []).find((el: any) => el.id === issue.elementId);
  if (!flowEl) {
    return [];
  }

  const cmds: CmdHelperDescriptor[] = [];
  const rootShape = elementRegistry.get(process.id) ?? { id: process.id };

  if (flowEl.sourceRef && Array.isArray(flowEl.sourceRef.outgoing)) {
    const srcElement = elementRegistry.get(flowEl.sourceRef.id) ?? { id: flowEl.sourceRef.id };
    cmds.push(CmdHelper.removeElementsFromList(srcElement, flowEl.sourceRef, 'outgoing', undefined, [flowEl]));
  }
  if (flowEl.targetRef && Array.isArray(flowEl.targetRef.incoming)) {
    const tgtElement = elementRegistry.get(flowEl.targetRef.id) ?? { id: flowEl.targetRef.id };
    cmds.push(CmdHelper.removeElementsFromList(tgtElement, flowEl.targetRef, 'incoming', undefined, [flowEl]));
  }

  cmds.push(CmdHelper.removeElementsFromList(rootShape, process, 'flowElements', undefined, [flowEl]));
  return cmds;
}

function fixShapelessMessageFlow(
  issue: SanitizableIssue,
  definitions: any,
  elementRegistry: ElementRegistryLike,
): CmdHelperDescriptor[] {
  const collab = findCollaboration(definitions);
  if (!collab) {
    return [];
  }

  const mf = (collab.messageFlows ?? []).find((el: any) => el.id === issue.elementId);
  if (!mf) {
    return [];
  }

  const rootShape = elementRegistry.get(collab.id) ?? { id: collab.id };
  return [CmdHelper.removeElementsFromList(rootShape, collab, 'messageFlows', undefined, [mf])];
}

function fixZombieDiElement(
  issue: SanitizableIssue,
  definitions: any,
  elementRegistry: ElementRegistryLike,
): CmdHelperDescriptor[] {
  const diagrams = definitions.diagrams;
  if (!Array.isArray(diagrams)) {
    return [];
  }

  for (const diagram of diagrams) {
    const plane = diagram.plane;
    const planeElements: any[] = plane?.planeElement;
    if (!Array.isArray(planeElements)) {
      continue;
    }

    const diElement = planeElements.find((pe: any) => pe.id === issue.elementId);
    if (diElement) {
      const planeShape = elementRegistry.get(plane.id ?? plane.bpmnElement?.id) ?? { id: plane.id ?? 'plane' };
      return [CmdHelper.removeElementsFromList(planeShape, plane, 'planeElement', undefined, [diElement])];
    }
  }

  return [];
}

function fixDanglingRef(
  issue: SanitizableIssue,
  definitions: any,
  elementRegistry: ElementRegistryLike,
): CmdHelperDescriptor[] {
  const refProp = ISSUE_TYPE_TO_REF_PROP[issue.type];
  if (!refProp) {
    return [];
  }

  const eventDef = findEventDefinitionWithDanglingRef(definitions, issue.elementId, refProp);
  if (!eventDef) {
    return [];
  }

  const element = elementRegistry.get(issue.elementId) ?? { id: issue.elementId };
  return [CmdHelper.updateBusinessObject(element, eventDef, { [refProp]: undefined })];
}

const ISSUE_TYPE_TO_REF_PROP: Record<string, string> = {
  'dangling-message-ref': 'messageRef',
  'dangling-error-ref': 'errorRef',
  'dangling-signal-ref': 'signalRef',
  'dangling-escalation-ref': 'escalationRef',
};

function fixEmptyExtensionElements(
  issue: SanitizableIssue,
  definitions: any,
  elementRegistry: ElementRegistryLike,
): CmdHelperDescriptor[] {
  const ownerElement = findElementById(definitions, issue.elementId);
  if (!ownerElement || !ownerElement.extensionElements) {
    return [];
  }

  const element = elementRegistry.get(issue.elementId) ?? { id: issue.elementId };
  return [CmdHelper.updateBusinessObject(element, ownerElement, { extensionElements: undefined })];
}

function fixEmptyEvilProperties(
  issue: SanitizableIssue,
  definitions: any,
  elementRegistry: ElementRegistryLike,
): CmdHelperDescriptor[] {
  const ownerElement = findElementById(definitions, issue.elementId);
  if (!ownerElement?.extensionElements?.values) {
    return [];
  }

  const evilProps = ownerElement.extensionElements.values.find((val: any) => val.$type === 'evil:Properties');
  if (!evilProps) {
    return [];
  }

  const element = elementRegistry.get(issue.elementId) ?? { id: issue.elementId };
  const cmds: CmdHelperDescriptor[] = [];

  cmds.push(
    CmdHelper.removeElementsFromList(element, ownerElement.extensionElements, 'values', undefined, [evilProps]),
  );

  const remainingAfterRemoval = ownerElement.extensionElements.values.filter((val: any) => val !== evilProps);
  if (remainingAfterRemoval.length === 0) {
    cmds.push(CmdHelper.updateBusinessObject(element, ownerElement, { extensionElements: undefined }));
  }

  return cmds;
}

// --- Helpers ---

function findProcessContaining(definitions: any, elementId: string): any {
  const rootElements = definitions.rootElements;
  if (!Array.isArray(rootElements)) {
    return null;
  }

  for (const rootEl of rootElements) {
    if (rootEl.$type === 'bpmn:Process') {
      const container = findDirectContainer(rootEl, elementId);
      if (container) {
        return container;
      }
    }
  }
  return null;
}

function findDirectContainer(container: any, elementId: string): any {
  const flowElements = container.flowElements;
  if (!Array.isArray(flowElements)) {
    return null;
  }

  if (flowElements.some((el: any) => el.id === elementId)) {
    return container;
  }

  for (const el of flowElements) {
    if (el.$type === 'bpmn:SubProcess' && Array.isArray(el.flowElements)) {
      const nested = findDirectContainer(el, elementId);
      if (nested) {
        return nested;
      }
    }
  }

  return null;
}

function findCollaboration(definitions: any): any {
  const rootElements = definitions.rootElements;
  if (!Array.isArray(rootElements)) {
    return null;
  }
  return rootElements.find((el: any) => el.$type === 'bpmn:Collaboration') ?? null;
}

function findEventDefinitionWithDanglingRef(definitions: any, ownerId: string, refProp: string): any {
  const visited = new Set<any>();
  return walkFindEventDef(definitions, ownerId, refProp, visited);
}

function walkFindEventDef(node: any, ownerId: string, refProp: string, visited: Set<any>): any {
  if (node == null || typeof node !== 'object') {
    return null;
  }
  if (visited.has(node)) {
    return null;
  }
  visited.add(node);

  if (node.$type && node[refProp] != null) {
    const owner = findOwnerOfEventDef(node);
    if (owner?.id === ownerId) {
      return node;
    }
  }

  for (const key of Object.keys(node)) {
    if (key.startsWith('$')) {
      continue;
    }
    const value = node[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        const result = walkFindEventDef(item, ownerId, refProp, visited);
        if (result) {
          return result;
        }
      }
    } else if (value != null && typeof value === 'object') {
      const result = walkFindEventDef(value, ownerId, refProp, visited);
      if (result) {
        return result;
      }
    }
  }
  return null;
}

function findOwnerOfEventDef(node: any): any {
  let current = node.$parent;
  while (current != null) {
    if (current.id && current.$type && !current.$type.endsWith('EventDefinition')) {
      return current;
    }
    current = current.$parent;
  }
  return null;
}

function findElementById(definitions: any, elementId: string): any {
  if (definitions.id === elementId) {
    return definitions;
  }

  const visited = new Set<any>();
  return walkFindById(definitions, elementId, visited);
}

function walkFindById(node: any, elementId: string, visited: Set<any>): any {
  if (node == null || typeof node !== 'object') {
    return null;
  }
  if (visited.has(node)) {
    return null;
  }
  visited.add(node);

  if (node.id === elementId) {
    return node;
  }

  for (const key of Object.keys(node)) {
    if (key.startsWith('$')) {
      continue;
    }
    const value = node[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        const result = walkFindById(item, elementId, visited);
        if (result) {
          return result;
        }
      }
    } else if (value != null && typeof value === 'object') {
      const result = walkFindById(value, elementId, visited);
      if (result) {
        return result;
      }
    }
  }
  return null;
}
