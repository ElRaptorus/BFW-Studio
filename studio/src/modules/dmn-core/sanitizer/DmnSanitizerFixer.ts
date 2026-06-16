import { CmdHelper, type CmdHelperDescriptor } from '../dmn-js/CommandHandler/Helper/CmdHelper';
import type { DmnSanitizableIssue } from './sanitizerTypes';

interface ElementRegistryLike {
  get(id: string): any;
}

export function buildDmnSanitizerFixCommands(
  issues: DmnSanitizableIssue[],
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
  issue: DmnSanitizableIssue,
  definitions: any,
  elementRegistry: ElementRegistryLike,
): CmdHelperDescriptor[] {
  switch (issue.type) {
    case 'shapeless-decision':
    case 'shapeless-input-data':
    case 'shapeless-bkm':
    case 'shapeless-knowledge-source':
    case 'shapeless-decision-service':
      return fixShapelessDrgElement(issue, definitions, elementRegistry);

    case 'zombie-shape':
    case 'zombie-edge':
      return fixZombieDiElement(issue, definitions, elementRegistry);

    case 'unreferenced-item-definition':
      return fixUnreferencedItemDefinition(issue, definitions, elementRegistry);

    case 'unreferenced-import':
      return fixUnreferencedImport(issue, definitions, elementRegistry);

    case 'dangling-requirement-ref':
      return fixDanglingRequirement(issue, definitions, elementRegistry);

    case 'dangling-dmn-element-ref':
      return fixDanglingDmnElementRef(issue, definitions, elementRegistry);

    case 'empty-extension-elements':
      return fixEmptyExtensionElements(issue, definitions, elementRegistry);

    default:
      return [];
  }
}

function fixShapelessDrgElement(
  issue: DmnSanitizableIssue,
  definitions: any,
  elementRegistry: ElementRegistryLike,
): CmdHelperDescriptor[] {
  const drgElements: any[] = definitions.drgElement ?? [];
  const targetElement = drgElements.find((el: any) => el.id === issue.elementId);
  if (!targetElement) {
    return [];
  }

  const cmds: CmdHelperDescriptor[] = [];
  const rootElement = elementRegistry.get(definitions.id) ?? { id: definitions.id };

  cleanupRequirementsReferencingElement(definitions, targetElement.id, elementRegistry, cmds);

  cmds.push(CmdHelper.removeElementsFromList(rootElement, definitions, 'drgElement', undefined, [targetElement]));
  return cmds;
}

function cleanupRequirementsReferencingElement(
  definitions: any,
  removedElementId: string,
  elementRegistry: ElementRegistryLike,
  cmds: CmdHelperDescriptor[],
): void {
  const drgElements: any[] = definitions.drgElement ?? [];

  for (const drgElement of drgElements) {
    removeRequirementsPointingTo(
      drgElement,
      'informationRequirement',
      ['requiredDecision', 'requiredInput'],
      removedElementId,
      elementRegistry,
      cmds,
    );
    removeRequirementsPointingTo(
      drgElement,
      'knowledgeRequirement',
      ['requiredKnowledge'],
      removedElementId,
      elementRegistry,
      cmds,
    );
    removeRequirementsPointingTo(
      drgElement,
      'authorityRequirement',
      ['requiredAuthority', 'requiredDecision', 'requiredInput'],
      removedElementId,
      elementRegistry,
      cmds,
    );
  }
}

function removeRequirementsPointingTo(
  owner: any,
  listProperty: string,
  refProperties: string[],
  targetId: string,
  elementRegistry: ElementRegistryLike,
  cmds: CmdHelperDescriptor[],
): void {
  const requirements: any[] = owner[listProperty];
  if (!Array.isArray(requirements)) {
    return;
  }

  const toRemove: any[] = [];
  for (const req of requirements) {
    for (const refProp of refProperties) {
      const ref = req[refProp];
      if (ref == null) {
        continue;
      }
      const refId = ref.id ?? stripHashPrefix(ref.href);
      if (refId === targetId) {
        toRemove.push(req);
        break;
      }
    }
  }

  if (toRemove.length > 0) {
    const element = elementRegistry.get(owner.id) ?? { id: owner.id };
    cmds.push(CmdHelper.removeElementsFromList(element, owner, listProperty, undefined, toRemove));
  }
}

function fixZombieDiElement(
  issue: DmnSanitizableIssue,
  definitions: any,
  elementRegistry: ElementRegistryLike,
): CmdHelperDescriptor[] {
  const diagrams = definitions.dmnDI?.diagrams ?? definitions.dmnDI?.DMNDiagram;
  if (!Array.isArray(diagrams)) {
    return [];
  }

  for (const diagram of diagrams) {
    const diagramElements: any[] = diagram.diagramElements ?? diagram.DMNDiagramElement;
    if (!Array.isArray(diagramElements)) {
      continue;
    }

    const diElement = diagramElements.find((de: any) => de.id === issue.elementId);
    if (diElement) {
      const diagramElement = elementRegistry.get(diagram.id) ?? { id: diagram.id ?? 'diagram' };
      const listProperty = diagram.diagramElements ? 'diagramElements' : 'DMNDiagramElement';
      return [CmdHelper.removeElementsFromList(diagramElement, diagram, listProperty, undefined, [diElement])];
    }
  }

  return [];
}

function fixUnreferencedItemDefinition(
  issue: DmnSanitizableIssue,
  definitions: any,
  elementRegistry: ElementRegistryLike,
): CmdHelperDescriptor[] {
  const itemDefinitions: any[] = definitions.itemDefinition ?? [];
  const targetDef = itemDefinitions.find((def: any) => def.id === issue.elementId);
  if (!targetDef) {
    return [];
  }

  const rootElement = elementRegistry.get(definitions.id) ?? { id: definitions.id };
  return [CmdHelper.removeElementsFromList(rootElement, definitions, 'itemDefinition', undefined, [targetDef])];
}

function fixUnreferencedImport(
  issue: DmnSanitizableIssue,
  definitions: any,
  elementRegistry: ElementRegistryLike,
): CmdHelperDescriptor[] {
  const imports: any[] = definitions.import ?? [];
  const targetImport = imports.find((imp: any) => imp.id === issue.elementId || imp.namespace === issue.elementId);
  if (!targetImport) {
    return [];
  }

  const rootElement = elementRegistry.get(definitions.id) ?? { id: definitions.id };
  return [CmdHelper.removeElementsFromList(rootElement, definitions, 'import', undefined, [targetImport])];
}

function fixDanglingRequirement(
  issue: DmnSanitizableIssue,
  definitions: any,
  elementRegistry: ElementRegistryLike,
): CmdHelperDescriptor[] {
  const drgElements: any[] = definitions.drgElement ?? [];
  const drgIds = new Set(drgElements.map((el: any) => el.id).filter(Boolean));
  const owner = drgElements.find((el: any) => el.id === issue.elementId);
  if (!owner) {
    return [];
  }

  const cmds: CmdHelperDescriptor[] = [];
  const element = elementRegistry.get(owner.id) ?? { id: owner.id };

  removeDanglingFromList(owner, 'informationRequirement', ['requiredDecision', 'requiredInput'], drgIds, element, cmds);
  removeDanglingFromList(owner, 'knowledgeRequirement', ['requiredKnowledge'], drgIds, element, cmds);
  removeDanglingFromList(
    owner,
    'authorityRequirement',
    ['requiredAuthority', 'requiredDecision', 'requiredInput'],
    drgIds,
    element,
    cmds,
  );

  return cmds;
}

function removeDanglingFromList(
  owner: any,
  listProperty: string,
  refProperties: string[],
  validIds: Set<string>,
  element: any,
  cmds: CmdHelperDescriptor[],
): void {
  const requirements: any[] = owner[listProperty];
  if (!Array.isArray(requirements)) {
    return;
  }

  const toRemove: any[] = [];
  for (const req of requirements) {
    for (const refProp of refProperties) {
      const ref = req[refProp];
      if (ref == null) {
        continue;
      }
      const targetId = ref.id ?? stripHashPrefix(ref.href);
      if (targetId && !validIds.has(targetId)) {
        toRemove.push(req);
        break;
      }
    }
  }

  if (toRemove.length > 0) {
    cmds.push(CmdHelper.removeElementsFromList(element, owner, listProperty, undefined, toRemove));
  }
}

function fixDanglingDmnElementRef(
  issue: DmnSanitizableIssue,
  definitions: any,
  elementRegistry: ElementRegistryLike,
): CmdHelperDescriptor[] {
  return fixZombieDiElement(issue, definitions, elementRegistry);
}

function fixEmptyExtensionElements(
  issue: DmnSanitizableIssue,
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

function stripHashPrefix(href: string | undefined): string | undefined {
  if (href == null) {
    return undefined;
  }
  return href.startsWith('#') ? href.slice(1) : href;
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
