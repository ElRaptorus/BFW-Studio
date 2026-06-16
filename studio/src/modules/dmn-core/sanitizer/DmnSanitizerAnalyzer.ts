import type { DmnSanitizableIssue } from './sanitizerTypes';

interface ElementRegistryLike {
  getAll(): any[];
  get(id: string): any;
}

export type ModdleParseWarning = {
  message: string;
  property?: string;
  element?: any;
};

const DRG_TYPE_TO_ISSUE: Record<string, DmnSanitizableIssue['type']> = {
  'dmn:Decision': 'shapeless-decision',
  'dmn:InputData': 'shapeless-input-data',
  'dmn:BusinessKnowledgeModel': 'shapeless-bkm',
  'dmn:KnowledgeSource': 'shapeless-knowledge-source',
  'dmn:DecisionService': 'shapeless-decision-service',
};

const DRG_TYPE_LABEL: Record<string, string> = {
  'dmn:Decision': 'Decision',
  'dmn:InputData': 'Input Data',
  'dmn:BusinessKnowledgeModel': 'BKM',
  'dmn:KnowledgeSource': 'Knowledge Source',
  'dmn:DecisionService': 'Decision Service',
};

export function analyzeDmnSanitizableIssues(
  definitions: any,
  elementRegistry?: ElementRegistryLike,
  parseWarnings?: ModdleParseWarning[],
): DmnSanitizableIssue[] {
  if (!definitions) {
    return [];
  }

  const issues: DmnSanitizableIssue[] = [];

  const diShapeRefs = collectDiShapeRefs(definitions);
  const semanticIds = collectSemanticIds(definitions);

  detectShapelessDrgElements(definitions, diShapeRefs, elementRegistry, issues);
  detectZombieDiElements(definitions, semanticIds, issues);
  detectUnreferencedDefinitions(definitions, issues);
  detectDanglingReferences(definitions, parseWarnings ?? [], issues);
  detectEmptyContainers(definitions, issues);

  return issues;
}

function collectDiShapeRefs(definitions: any): Set<string> {
  const refs = new Set<string>();
  const diagrams = definitions.dmnDI?.diagrams ?? definitions.dmnDI?.DMNDiagram;
  if (!Array.isArray(diagrams)) {
    return refs;
  }

  for (const diagram of diagrams) {
    const elements = diagram.diagramElements ?? diagram.DMNDiagramElement;
    if (!Array.isArray(elements)) {
      continue;
    }
    for (const diElement of elements) {
      const type = diElement.$type;
      if ((type === 'dmndi:DMNShape' || type === 'DMNShape') && diElement.dmnElementRef?.id) {
        refs.add(diElement.dmnElementRef.id);
      }
    }
  }
  return refs;
}

function collectSemanticIds(definitions: any): Set<string> {
  const ids = new Set<string>();

  if (definitions.id) {
    ids.add(definitions.id);
  }

  const drgElements: any[] = definitions.drgElement ?? [];
  for (const element of drgElements) {
    if (element.id) {
      ids.add(element.id);
    }
    collectRequirementIds(element, ids);
  }

  const artifacts: any[] = definitions.artifact ?? [];
  for (const artifact of artifacts) {
    if (artifact.id) {
      ids.add(artifact.id);
    }
  }

  const itemDefinitions: any[] = definitions.itemDefinition ?? [];
  for (const itemDef of itemDefinitions) {
    if (itemDef.id) {
      ids.add(itemDef.id);
    }
  }

  return ids;
}

function collectRequirementIds(drgElement: any, ids: Set<string>): void {
  for (const req of drgElement.informationRequirement ?? []) {
    if (req.id) {
      ids.add(req.id);
    }
  }
  for (const req of drgElement.knowledgeRequirement ?? []) {
    if (req.id) {
      ids.add(req.id);
    }
  }
  for (const req of drgElement.authorityRequirement ?? []) {
    if (req.id) {
      ids.add(req.id);
    }
  }
}

function hasShapeInDi(elementId: string, diShapeRefs: Set<string>, elementRegistry?: ElementRegistryLike): boolean {
  if (elementRegistry) {
    return elementRegistry.get(elementId) != null;
  }
  return diShapeRefs.has(elementId);
}

function detectShapelessDrgElements(
  definitions: any,
  diShapeRefs: Set<string>,
  elementRegistry: ElementRegistryLike | undefined,
  issues: DmnSanitizableIssue[],
): void {
  const drgElements: any[] = definitions.drgElement ?? [];

  for (const element of drgElements) {
    if (!element.id || !element.$type) {
      continue;
    }

    const issueType = DRG_TYPE_TO_ISSUE[element.$type];
    if (!issueType) {
      continue;
    }

    if (!hasShapeInDi(element.id, diShapeRefs, elementRegistry)) {
      const typeLabel = DRG_TYPE_LABEL[element.$type] ?? element.$type;
      issues.push({
        type: issueType,
        category: 'ghost-element',
        severity: 'error',
        label: `Poltergeist ${typeLabel}: ${element.name ?? element.id}`,
        elementId: element.id,
        elementName: element.name ?? undefined,
        elementType: element.$type,
      } as DmnSanitizableIssue);
    }
  }
}

function detectZombieDiElements(definitions: any, semanticIds: Set<string>, issues: DmnSanitizableIssue[]): void {
  const diagrams = definitions.dmnDI?.diagrams ?? definitions.dmnDI?.DMNDiagram;
  if (!Array.isArray(diagrams)) {
    return;
  }

  for (const diagram of diagrams) {
    const elements = diagram.diagramElements ?? diagram.DMNDiagramElement;
    if (!Array.isArray(elements)) {
      continue;
    }

    for (const diElement of elements) {
      if (!diElement.id) {
        continue;
      }

      const type = diElement.$type;
      const isShape = type === 'dmndi:DMNShape' || type === 'DMNShape';
      const isEdge = type === 'dmndi:DMNEdge' || type === 'DMNEdge';
      if (!isShape && !isEdge) {
        continue;
      }

      const refId = diElement.dmnElementRef?.id;
      const isZombie = refId != null ? !semanticIds.has(refId) : true;

      if (!isZombie) {
        continue;
      }

      const displayId = refId ?? diElement.id;

      if (isShape) {
        issues.push({
          type: 'zombie-shape',
          category: 'zombie-element',
          severity: 'warning',
          label: `Zombie: ${displayId}`,
          elementId: diElement.id,
          elementName: diElement.dmnElementRef?.name ?? undefined,
          elementType: diElement.dmnElementRef?.$type ?? 'dmndi:DMNShape',
        });
      }

      if (isEdge) {
        issues.push({
          type: 'zombie-edge',
          category: 'zombie-element',
          severity: 'warning',
          label: `Zombie wire: ${displayId}`,
          elementId: diElement.id,
          elementName: diElement.dmnElementRef?.name ?? undefined,
          elementType: diElement.dmnElementRef?.$type ?? 'dmndi:DMNEdge',
        });
      }
    }
  }
}

function detectUnreferencedDefinitions(definitions: any, issues: DmnSanitizableIssue[]): void {
  detectUnreferencedItemDefinitions(definitions, issues);
  detectUnreferencedImports(definitions, issues);
}

function detectUnreferencedItemDefinitions(definitions: any, issues: DmnSanitizableIssue[]): void {
  const itemDefinitions: any[] = definitions.itemDefinition ?? [];
  if (itemDefinitions.length === 0) {
    return;
  }

  const referencedTypeRefs = collectAllTypeRefs(definitions);
  collectItemDefinitionCrossRefs(itemDefinitions, referencedTypeRefs);
  const itemDefIds = new Set(itemDefinitions.map((item: any) => item.id).filter(Boolean));

  for (const itemDef of itemDefinitions) {
    if (!itemDef.id) {
      continue;
    }

    const nameStr = itemDef.name ?? itemDef.id;
    const isReferencedByTypeRef = referencedTypeRefs.has(nameStr) || referencedTypeRefs.has(itemDef.id);
    const isReferencedByComponent = isReferencedAsComponent(itemDef, itemDefinitions, itemDefIds);

    if (!isReferencedByTypeRef && !isReferencedByComponent) {
      issues.push({
        type: 'unreferenced-item-definition',
        category: 'unreferenced-definition',
        severity: 'info',
        label: `Orphaned ItemDefinition: ${nameStr}`,
        elementId: itemDef.id,
        elementName: itemDef.name ?? undefined,
        elementType: 'dmn:ItemDefinition',
      });
    }
  }
}

function collectAllTypeRefs(definitions: any): Set<string> {
  const refs = new Set<string>();
  const visited = new Set<any>();
  walkForTypeRefs(definitions, refs, visited);
  return refs;
}

function collectItemDefinitionCrossRefs(itemDefinitions: any[], refs: Set<string>): void {
  for (const itemDef of itemDefinitions) {
    if (typeof itemDef.typeRef === 'string' && itemDef.typeRef.length > 0) {
      refs.add(itemDef.typeRef);
    }
    for (const component of itemDef.itemComponent ?? []) {
      if (typeof component.typeRef === 'string' && component.typeRef.length > 0) {
        refs.add(component.typeRef);
      }
    }
  }
}

function walkForTypeRefs(node: any, refs: Set<string>, visited: Set<any>): void {
  if (node == null || typeof node !== 'object') {
    return;
  }
  if (visited.has(node)) {
    return;
  }
  visited.add(node);

  if (node.$type === 'dmn:ItemDefinition') {
    return;
  }

  if (typeof node.typeRef === 'string' && node.typeRef.length > 0) {
    refs.add(node.typeRef);
  }

  for (const key of Object.keys(node)) {
    if (key.startsWith('$') || key === 'itemDefinition') {
      continue;
    }
    const value = node[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        walkForTypeRefs(item, refs, visited);
      }
    } else if (value != null && typeof value === 'object') {
      walkForTypeRefs(value, refs, visited);
    }
  }
}

function isReferencedAsComponent(itemDef: any, allItemDefs: any[], _itemDefIds: Set<string>): boolean {
  for (const other of allItemDefs) {
    if (other === itemDef) {
      continue;
    }
    const components: any[] = other.itemComponent ?? [];
    for (const component of components) {
      if (component.typeRef === itemDef.name || component.typeRef === itemDef.id) {
        return true;
      }
    }
  }
  return false;
}

function detectUnreferencedImports(definitions: any, issues: DmnSanitizableIssue[]): void {
  const imports: any[] = definitions.import ?? [];
  if (imports.length === 0) {
    return;
  }

  const referencedNamespaces = collectReferencedImportNamespaces(definitions);

  for (const importDef of imports) {
    if (!importDef.namespace) {
      continue;
    }

    if (!referencedNamespaces.has(importDef.namespace)) {
      issues.push({
        type: 'unreferenced-import',
        category: 'unreferenced-definition',
        severity: 'info',
        label: `Orphaned Import: ${importDef.name ?? importDef.namespace}`,
        elementId: importDef.id ?? importDef.namespace,
        elementName: importDef.name ?? undefined,
        elementType: 'dmn:Import',
      });
    }
  }
}

function collectReferencedImportNamespaces(definitions: any): Set<string> {
  const namespaces = new Set<string>();
  const visited = new Set<any>();
  walkForImportRefs(definitions, namespaces, visited);
  return namespaces;
}

function walkForImportRefs(node: any, namespaces: Set<string>, visited: Set<any>): void {
  if (node == null || typeof node !== 'object') {
    return;
  }
  if (visited.has(node)) {
    return;
  }
  visited.add(node);

  if (typeof node.href === 'string' && node.href.includes('#')) {
    const namespacePart = node.href.split('#')[0];
    if (namespacePart) {
      namespaces.add(namespacePart);
    }
  }

  if (typeof node.namespace === 'string' && node.$type === 'dmn:Import') {
    return;
  }

  for (const key of Object.keys(node)) {
    if (key.startsWith('$') || key === 'import') {
      continue;
    }
    const value = node[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        walkForImportRefs(item, namespaces, visited);
      }
    } else if (value != null && typeof value === 'object') {
      walkForImportRefs(value, namespaces, visited);
    }
  }
}

function detectDanglingReferences(
  definitions: any,
  parseWarnings: ModdleParseWarning[],
  issues: DmnSanitizableIssue[],
): void {
  for (const warning of parseWarnings) {
    if (!warning.message?.startsWith('unresolved reference')) {
      continue;
    }
    if (!warning.element) {
      continue;
    }

    const element = warning.element;
    const owner = findOwnerDrgElement(element);
    const displayName = owner?.name ?? owner?.id ?? element?.id ?? 'unknown';

    if (warning.property === 'dmndi:dmnElementRef' || warning.property === 'dmnElementRef') {
      issues.push({
        type: 'dangling-dmn-element-ref',
        category: 'dangling-reference',
        severity: 'warning',
        label: `Dangling dmnElementRef on ${displayName}`,
        elementId: element.id ?? 'unknown',
        elementName: undefined,
        elementType: element.$type ?? 'unknown',
      });
    } else {
      issues.push({
        type: 'dangling-requirement-ref',
        category: 'dangling-reference',
        severity: 'warning',
        label: `Dangling requirement on ${displayName}`,
        elementId: owner?.id ?? element?.id ?? 'unknown',
        elementName: owner?.name ?? undefined,
        elementType: owner?.$type ?? element?.$type ?? 'unknown',
      });
    }
  }

  detectDanglingRequirementsByWalk(definitions, issues);
}

function detectDanglingRequirementsByWalk(definitions: any, issues: DmnSanitizableIssue[]): void {
  const drgElements: any[] = definitions.drgElement ?? [];
  const drgIds = new Set<string>();
  for (const element of drgElements) {
    if (element.id) {
      drgIds.add(element.id);
    }
  }

  for (const element of drgElements) {
    checkRequirementList(element, element.informationRequirement, 'requiredDecision', drgIds, issues);
    checkRequirementList(element, element.informationRequirement, 'requiredInput', drgIds, issues);
    checkRequirementList(element, element.knowledgeRequirement, 'requiredKnowledge', drgIds, issues);
    checkAuthorityRequirements(element, element.authorityRequirement, drgIds, issues);
  }
}

function checkRequirementList(
  owner: any,
  requirements: any[] | undefined,
  refProperty: string,
  drgIds: Set<string>,
  issues: DmnSanitizableIssue[],
): void {
  if (!Array.isArray(requirements)) {
    return;
  }

  for (const req of requirements) {
    const ref = req[refProperty];
    if (ref == null) {
      continue;
    }

    const rawId = typeof ref === 'string' ? ref : (ref.id ?? ref.href);
    const targetId = rawId ? extractIdFromHref(rawId) : null;
    if (targetId && !drgIds.has(targetId)) {
      const alreadyReported = issues.some(
        (issue) => issue.type === 'dangling-requirement-ref' && issue.elementId === owner.id,
      );
      if (!alreadyReported) {
        issues.push({
          type: 'dangling-requirement-ref',
          category: 'dangling-reference',
          severity: 'warning',
          label: `Dangling requirement on ${owner.name ?? owner.id}`,
          elementId: owner.id,
          elementName: owner.name ?? undefined,
          elementType: owner.$type,
        });
      }
    }
  }
}

function checkAuthorityRequirements(
  owner: any,
  requirements: any[] | undefined,
  drgIds: Set<string>,
  issues: DmnSanitizableIssue[],
): void {
  if (!Array.isArray(requirements)) {
    return;
  }

  for (const req of requirements) {
    for (const refProp of ['requiredAuthority', 'requiredDecision', 'requiredInput']) {
      const ref = req[refProp];
      if (ref == null) {
        continue;
      }

      const rawId = typeof ref === 'string' ? ref : (ref.id ?? ref.href);
      const targetId = rawId ? extractIdFromHref(rawId) : null;
      if (targetId && !drgIds.has(targetId)) {
        const alreadyReported = issues.some(
          (issue) => issue.type === 'dangling-requirement-ref' && issue.elementId === owner.id,
        );
        if (!alreadyReported) {
          issues.push({
            type: 'dangling-requirement-ref',
            category: 'dangling-reference',
            severity: 'warning',
            label: `Dangling requirement on ${owner.name ?? owner.id}`,
            elementId: owner.id,
            elementName: owner.name ?? undefined,
            elementType: owner.$type,
          });
        }
      }
    }
  }
}

function extractIdFromHref(href: string): string | null {
  if (href.includes('#')) {
    return href.split('#').pop() ?? null;
  }
  return href;
}

function findOwnerDrgElement(node: any): any {
  let current = node?.$parent;
  while (current != null) {
    if (current.id && current.$type && DRG_TYPE_TO_ISSUE[current.$type]) {
      return current;
    }
    current = current.$parent;
  }
  return null;
}

function detectEmptyContainers(definitions: any, issues: DmnSanitizableIssue[]): void {
  const visited = new Set<any>();
  walkForEmptyContainers(definitions, visited, issues);
}

function walkForEmptyContainers(node: any, visited: Set<any>, issues: DmnSanitizableIssue[]): void {
  if (node == null || typeof node !== 'object') {
    return;
  }
  if (visited.has(node)) {
    return;
  }
  visited.add(node);

  if (node.$type && node.extensionElements) {
    const extValues = node.extensionElements.values;
    const isEmpty = !Array.isArray(extValues) || extValues.length === 0;

    if (isEmpty) {
      issues.push({
        type: 'empty-extension-elements',
        category: 'empty-container',
        severity: 'warning',
        label: `Empty extensionElements on ${node.name ?? node.id ?? 'element'}`,
        elementId: node.id ?? 'unknown',
        elementName: node.name ?? undefined,
        elementType: node.$type,
      });
    }
  }

  for (const key of Object.keys(node)) {
    if (key.startsWith('$') || key === 'extensionElements') {
      continue;
    }
    const value = node[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        walkForEmptyContainers(item, visited, issues);
      }
    } else if (value != null && typeof value === 'object') {
      walkForEmptyContainers(value, visited, issues);
    }
  }
}
