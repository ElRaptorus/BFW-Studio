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
  // Cascading removals take connected elements with them; their own issues must not remove them twice.
  const removedElements = new Set<any>();

  for (const issue of issues) {
    const cmds = buildFixForIssue(issue, definitions, elementRegistry, removedElements);
    commands.push(...cmds);
  }

  commands.push(...removeConnectionsToRemovedElements(definitions, elementRegistry, removedElements));
  commands.push(...removeDiOfRemovedElements(definitions, elementRegistry, removedElements));
  return CmdHelper.executeMultipleCommands(commands);
}

// bpmn-js cannot import a connection whose end is gone; message flows go first so associations attached to them are caught too.
function removeConnectionsToRemovedElements(
  definitions: any,
  elementRegistry: ElementRegistryLike,
  removedElements: Set<any>,
): CmdHelperDescriptor[] {
  const rootElements: any[] = Array.isArray(definitions.rootElements) ? definitions.rootElements : [];
  const cmds: CmdHelperDescriptor[] = [];
  const removeDangling = (owner: any, propertyName: string, candidates: any[]): void => {
    const dangling = candidates.filter(
      (connection: any) =>
        !removedElements.has(connection) &&
        (removedElements.has(connection.sourceRef) || removedElements.has(connection.targetRef)),
    );
    if (dangling.length > 0) {
      dangling.forEach((connection) => removedElements.add(connection));
      const ownerShape = elementRegistry.get(owner.id) ?? { id: owner.id };
      cmds.push(CmdHelper.removeElementsFromList(ownerShape, owner, propertyName, undefined, dangling));
    }
  };

  for (const collaboration of rootElements.filter((element: any) => element.$type === 'bpmn:Collaboration')) {
    removeDangling(collaboration, 'messageFlows', collaboration.messageFlows ?? []);
  }

  const visitArtifactsOwner = (owner: any): void => {
    if (removedElements.has(owner)) {
      return;
    }
    removeDangling(
      owner,
      'artifacts',
      (owner.artifacts ?? []).filter((artifact: any) => artifact.$type === 'bpmn:Association'),
    );
    for (const child of owner.flowElements ?? []) {
      if (Array.isArray(child.flowElements)) {
        visitArtifactsOwner(child);
      }
    }
  };
  rootElements
    .filter((element: any) => element.$type === 'bpmn:Process' || element.$type === 'bpmn:Collaboration')
    .forEach(visitArtifactsOwner);
  return cmds;
}

// A cascade can remove elements that still have DI (e.g. a drawn boundary on a shapeless host); that DI would become a zombie.
function removeDiOfRemovedElements(
  definitions: any,
  elementRegistry: ElementRegistryLike,
  removedElements: Set<any>,
): CmdHelperDescriptor[] {
  const cmds: CmdHelperDescriptor[] = [];
  for (const diagram of Array.isArray(definitions.diagrams) ? definitions.diagrams : []) {
    const plane = diagram.plane;
    const orphans = (plane?.planeElement ?? []).filter((diElement: any) => removedElements.has(diElement.bpmnElement));
    if (orphans.length > 0) {
      const planeShape = elementRegistry.get(plane.id ?? plane.bpmnElement?.id) ?? { id: plane.id ?? 'plane' };
      cmds.push(CmdHelper.removeElementsFromList(planeShape, plane, 'planeElement', undefined, orphans));
    }
  }
  return cmds;
}

function buildFixForIssue(
  issue: SanitizableIssue,
  definitions: any,
  elementRegistry: ElementRegistryLike,
  removedElements: Set<any>,
): CmdHelperDescriptor[] {
  if (issue.manualFixOnly) {
    return [];
  }

  switch (issue.type) {
    case 'unreferenced-message':
    case 'unreferenced-error':
    case 'unreferenced-signal':
    case 'unreferenced-escalation':
      return fixUnreferencedGlobal(issue, definitions, elementRegistry);

    case 'shapeless-flow-node':
      return fixShapelessFlowNode(issue, definitions, elementRegistry, removedElements);

    case 'shapeless-participant':
      return fixShapelessParticipant(issue, definitions, elementRegistry, removedElements);

    case 'shapeless-sequence-flow':
      return fixShapelessSequenceFlow(issue, definitions, elementRegistry, removedElements);

    case 'shapeless-message-flow':
      return fixShapelessMessageFlow(issue, definitions, elementRegistry, removedElements);

    case 'zombie-shape':
    case 'zombie-edge':
      return fixZombieDiElement(issue, definitions, elementRegistry);

    // moddle already left the unresolved reference unset; SanitizerBridge.dismissDanglingRefWarnings clears the warning.
    case 'dangling-message-ref':
    case 'dangling-error-ref':
    case 'dangling-signal-ref':
    case 'dangling-escalation-ref':
      return [];

    case 'empty-extension-elements':
      return fixEmptyExtensionElements(issue, definitions, elementRegistry);

    case 'empty-bfw-properties':
      return fixEmptyBfwProperties(issue, definitions, elementRegistry);

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
  removedElements: Set<any>,
): CmdHelperDescriptor[] {
  const container = findProcessContaining(definitions, issue.elementId);
  const flowNode = (container?.flowElements ?? []).find((el: any) => el.id === issue.elementId);
  if (!flowNode || removedElements.has(flowNode)) {
    return [];
  }
  return removeFlowNodeWithDependents(flowNode, container, elementRegistry, removedElements);
}

/**
 * Removes a shapeless flow node together with everything that cannot be drawn without it:
 * lane references, connected sequence flows, attached boundary events, and data associations to it.
 */
function removeFlowNodeWithDependents(
  flowNode: any,
  container: any,
  elementRegistry: ElementRegistryLike,
  removedElements: Set<any>,
): CmdHelperDescriptor[] {
  removedElements.add(flowNode);
  const cmds: CmdHelperDescriptor[] = [];

  for (let scope = container; scope != null; scope = scope.$parent) {
    for (const lane of collectLanes(scope.laneSets)) {
      if (Array.isArray(lane.flowNodeRef) && lane.flowNodeRef.includes(flowNode)) {
        const laneShape = elementRegistry.get(lane.id) ?? { id: lane.id };
        cmds.push(CmdHelper.removeElementsFromList(laneShape, lane, 'flowNodeRef', undefined, [flowNode]));
      }
    }
  }

  for (const sequenceFlow of [...(flowNode.incoming ?? []), ...(flowNode.outgoing ?? [])]) {
    if (!removedElements.has(sequenceFlow)) {
      cmds.push(
        ...removeSequenceFlow(sequenceFlow, sequenceFlow.$parent ?? container, elementRegistry, removedElements),
      );
    }
  }

  for (const sibling of container.flowElements ?? []) {
    if (sibling.$type === 'bpmn:BoundaryEvent' && sibling.attachedToRef === flowNode && !removedElements.has(sibling)) {
      cmds.push(...removeFlowNodeWithDependents(sibling, container, elementRegistry, removedElements));
    }
  }

  if (flowNode.$type === 'bpmn:DataObjectReference' || flowNode.$type === 'bpmn:DataStoreReference') {
    cmds.push(...removeDataAssociationsTo(flowNode, container, elementRegistry, removedElements));
  }

  const containerShape = elementRegistry.get(container.id) ?? { id: container.id };
  cmds.push(CmdHelper.removeElementsFromList(containerShape, container, 'flowElements', undefined, [flowNode]));
  return cmds;
}

function collectLanes(laneSets: any): any[] {
  const lanes: any[] = [];
  const visitLaneSet = (laneSet: any): void => {
    for (const lane of laneSet?.lanes ?? []) {
      lanes.push(lane);
      visitLaneSet(lane.childLaneSet);
    }
  };
  (Array.isArray(laneSets) ? laneSets : []).forEach(visitLaneSet);
  return lanes;
}

function removeDataAssociationsTo(
  dataReference: any,
  container: any,
  elementRegistry: ElementRegistryLike,
  removedElements: Set<any>,
): CmdHelperDescriptor[] {
  const cmds: CmdHelperDescriptor[] = [];
  const visit = (scope: any): void => {
    for (const owner of scope.flowElements ?? []) {
      const inputs = (owner.dataInputAssociations ?? []).filter(
        (association: any) =>
          association.sourceRef === dataReference ||
          (Array.isArray(association.sourceRef) && association.sourceRef.includes(dataReference)),
      );
      const outputs = (owner.dataOutputAssociations ?? []).filter(
        (association: any) => association.targetRef === dataReference,
      );
      [...inputs, ...outputs].forEach((association) => removedElements.add(association));
      const ownerShape = elementRegistry.get(owner.id) ?? { id: owner.id };
      if (inputs.length > 0) {
        cmds.push(CmdHelper.removeElementsFromList(ownerShape, owner, 'dataInputAssociations', undefined, inputs));
      }
      if (outputs.length > 0) {
        cmds.push(CmdHelper.removeElementsFromList(ownerShape, owner, 'dataOutputAssociations', undefined, outputs));
      }
      if (Array.isArray(owner.flowElements)) {
        visit(owner);
      }
    }
  };
  visit(container);
  return cmds;
}

function fixShapelessParticipant(
  issue: SanitizableIssue,
  definitions: any,
  elementRegistry: ElementRegistryLike,
  removedElements: Set<any>,
): CmdHelperDescriptor[] {
  const collab = findCollaboration(definitions);
  if (!collab) {
    return [];
  }

  const participant = (collab.participants ?? []).find((el: any) => el.id === issue.elementId);
  if (!participant) {
    return [];
  }
  removedElements.add(participant);

  const rootShape = elementRegistry.get(collab.id) ?? { id: collab.id };
  return [CmdHelper.removeElementsFromList(rootShape, collab, 'participants', undefined, [participant])];
}

function fixShapelessSequenceFlow(
  issue: SanitizableIssue,
  definitions: any,
  elementRegistry: ElementRegistryLike,
  removedElements: Set<any>,
): CmdHelperDescriptor[] {
  const container = findProcessContaining(definitions, issue.elementId);
  const sequenceFlow = (container?.flowElements ?? []).find((el: any) => el.id === issue.elementId);
  if (!sequenceFlow || removedElements.has(sequenceFlow)) {
    return [];
  }
  return removeSequenceFlow(sequenceFlow, container, elementRegistry, removedElements);
}

function removeSequenceFlow(
  sequenceFlow: any,
  container: any,
  elementRegistry: ElementRegistryLike,
  removedElements: Set<any>,
): CmdHelperDescriptor[] {
  removedElements.add(sequenceFlow);
  const cmds: CmdHelperDescriptor[] = [];

  const source = sequenceFlow.sourceRef;
  if (source && Array.isArray(source.outgoing) && !removedElements.has(source)) {
    const sourceShape = elementRegistry.get(source.id) ?? { id: source.id };
    cmds.push(CmdHelper.removeElementsFromList(sourceShape, source, 'outgoing', undefined, [sequenceFlow]));
  }
  const target = sequenceFlow.targetRef;
  if (target && Array.isArray(target.incoming) && !removedElements.has(target)) {
    const targetShape = elementRegistry.get(target.id) ?? { id: target.id };
    cmds.push(CmdHelper.removeElementsFromList(targetShape, target, 'incoming', undefined, [sequenceFlow]));
  }

  const containerShape = elementRegistry.get(container.id) ?? { id: container.id };
  cmds.push(CmdHelper.removeElementsFromList(containerShape, container, 'flowElements', undefined, [sequenceFlow]));
  return cmds;
}

function fixShapelessMessageFlow(
  issue: SanitizableIssue,
  definitions: any,
  elementRegistry: ElementRegistryLike,
  removedElements: Set<any>,
): CmdHelperDescriptor[] {
  const collab = findCollaboration(definitions);
  if (!collab) {
    return [];
  }

  const mf = (collab.messageFlows ?? []).find((el: any) => el.id === issue.elementId);
  if (!mf || removedElements.has(mf)) {
    return [];
  }
  removedElements.add(mf);

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

function fixEmptyBfwProperties(
  issue: SanitizableIssue,
  definitions: any,
  elementRegistry: ElementRegistryLike,
): CmdHelperDescriptor[] {
  const ownerElement = findElementById(definitions, issue.elementId);
  if (!ownerElement?.extensionElements?.values) {
    return [];
  }

  const bfwProps = ownerElement.extensionElements.values.find((val: any) => val.$type === 'bfw:Properties');
  if (!bfwProps) {
    return [];
  }

  const element = elementRegistry.get(issue.elementId) ?? { id: issue.elementId };
  const cmds: CmdHelperDescriptor[] = [];

  cmds.push(CmdHelper.removeElementsFromList(element, ownerElement.extensionElements, 'values', undefined, [bfwProps]));

  const remainingAfterRemoval = ownerElement.extensionElements.values.filter((val: any) => val !== bfwProps);
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
    if (Array.isArray(el.flowElements)) {
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
