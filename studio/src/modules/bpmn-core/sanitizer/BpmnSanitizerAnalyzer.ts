import type { SanitizableIssue } from './sanitizerTypes';

interface ElementRegistryLike {
  getAll(): any[];
  get(id: string): any;
}

export type ModdleParseWarning = {
  message: string;
  property?: string;
  element?: any;
};

const GLOBAL_TYPES: Record<string, SanitizableIssue['type']> = {
  'bpmn:Message': 'unreferenced-message',
  'bpmn:Error': 'unreferenced-error',
  'bpmn:Signal': 'unreferenced-signal',
  'bpmn:Escalation': 'unreferenced-escalation',
};

const FLOW_NODE_BASE_TYPES = new Set([
  'bpmn:Task',
  'bpmn:UserTask',
  'bpmn:ServiceTask',
  'bpmn:SendTask',
  'bpmn:ReceiveTask',
  'bpmn:ManualTask',
  'bpmn:BusinessRuleTask',
  'bpmn:ScriptTask',
  'bpmn:SubProcess',
  'bpmn:CallActivity',
  'bpmn:ExclusiveGateway',
  'bpmn:ParallelGateway',
  'bpmn:InclusiveGateway',
  'bpmn:ComplexGateway',
  'bpmn:EventBasedGateway',
  'bpmn:StartEvent',
  'bpmn:EndEvent',
  'bpmn:IntermediateCatchEvent',
  'bpmn:IntermediateThrowEvent',
  'bpmn:BoundaryEvent',
]);

export function analyzeSanitizableIssues(
  definitions: any,
  elementRegistry?: ElementRegistryLike,
  parseWarnings?: ModdleParseWarning[],
): SanitizableIssue[] {
  const issues: SanitizableIssue[] = [];

  const diShapeIds = collectDiShapeIds(definitions);
  const diEdgeIds = collectDiEdgeIds(definitions);
  const referencedGlobalIds = collectReferencedGlobalIds(definitions);
  const globalDefinitionsById = collectGlobalDefinitions(definitions);

  const semanticIds = collectSemanticElementIds(definitions);

  detectShapelessElements(definitions, diShapeIds, diEdgeIds, elementRegistry, issues);
  detectZombieElements(definitions, semanticIds, issues);
  detectUnreferencedGlobals(globalDefinitionsById, referencedGlobalIds, issues);
  detectDanglingReferences(definitions, parseWarnings ?? [], issues);
  detectEmptyContainers(definitions, issues);

  return issues;
}

function collectDiShapeIds(definitions: any): Set<string> {
  const ids = new Set<string>();
  const diagrams = definitions.diagrams;
  if (!Array.isArray(diagrams)) {
    return ids;
  }

  for (const diagram of diagrams) {
    const planeElements = diagram.plane?.planeElement;
    if (!Array.isArray(planeElements)) {
      continue;
    }
    for (const pe of planeElements) {
      if (pe.$type === 'bpmndi:BPMNShape' && pe.bpmnElement?.id) {
        ids.add(pe.bpmnElement.id);
      }
    }
  }
  return ids;
}

function collectDiEdgeIds(definitions: any): Set<string> {
  const ids = new Set<string>();
  const diagrams = definitions.diagrams;
  if (!Array.isArray(diagrams)) {
    return ids;
  }

  for (const diagram of diagrams) {
    const planeElements = diagram.plane?.planeElement;
    if (!Array.isArray(planeElements)) {
      continue;
    }
    for (const pe of planeElements) {
      if (pe.$type === 'bpmndi:BPMNEdge' && pe.bpmnElement?.id) {
        ids.add(pe.bpmnElement.id);
      }
    }
  }
  return ids;
}

function collectGlobalDefinitions(definitions: any): Map<string, any> {
  const globals = new Map<string, any>();
  const rootElements = definitions.rootElements;
  if (!Array.isArray(rootElements)) {
    return globals;
  }

  for (const el of rootElements) {
    if (el.$type in GLOBAL_TYPES && el.id) {
      globals.set(el.id, el);
    }
  }
  return globals;
}

function collectReferencedGlobalIds(definitions: any): Set<string> {
  const refs = new Set<string>();
  const visited = new Set<any>();
  walkForRefs(definitions, refs, visited);
  return refs;
}

function walkForRefs(node: any, refs: Set<string>, visited: Set<any>): void {
  if (node == null || typeof node !== 'object') {
    return;
  }
  if (visited.has(node)) {
    return;
  }
  visited.add(node);

  if (node.messageRef?.id) {
    refs.add(node.messageRef.id);
  }
  if (node.errorRef?.id) {
    refs.add(node.errorRef.id);
  }
  if (node.signalRef?.id) {
    refs.add(node.signalRef.id);
  }
  if (node.escalationRef?.id) {
    refs.add(node.escalationRef.id);
  }

  for (const key of Object.keys(node)) {
    if (key.startsWith('$')) {
      continue;
    }
    const value = node[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        walkForRefs(item, refs, visited);
      }
    } else if (value != null && typeof value === 'object') {
      walkForRefs(value, refs, visited);
    }
  }
}

function hasShape(id: string, diShapeIds: Set<string>, elementRegistry?: ElementRegistryLike): boolean {
  if (elementRegistry) {
    return elementRegistry.get(id) != null;
  }
  return diShapeIds.has(id);
}

function hasEdge(id: string, diEdgeIds: Set<string>, elementRegistry?: ElementRegistryLike): boolean {
  if (elementRegistry) {
    return elementRegistry.get(id) != null;
  }
  return diEdgeIds.has(id);
}

function detectShapelessElements(
  definitions: any,
  diShapeIds: Set<string>,
  diEdgeIds: Set<string>,
  elementRegistry: ElementRegistryLike | undefined,
  issues: SanitizableIssue[],
): void {
  const rootElements = definitions.rootElements;
  if (!Array.isArray(rootElements)) {
    return;
  }

  for (const rootEl of rootElements) {
    if (rootEl.$type === 'bpmn:Process') {
      detectShapelessFlowElements(rootEl, diShapeIds, diEdgeIds, elementRegistry, issues);
    }

    if (rootEl.$type === 'bpmn:Collaboration') {
      const participants = rootEl.participants;
      if (Array.isArray(participants)) {
        for (const participant of participants) {
          if (participant.id && !hasShape(participant.id, diShapeIds, elementRegistry)) {
            issues.push({
              type: 'shapeless-participant',
              category: 'ghost-element',
              severity: 'error',
              label: `Poltergeist pool: ${participant.name ?? participant.id}`,
              elementId: participant.id,
              elementName: participant.name ?? undefined,
              elementType: 'bpmn:Participant',
            });
          }
        }
      }

      const messageFlows = rootEl.messageFlows;
      if (Array.isArray(messageFlows)) {
        for (const mf of messageFlows) {
          if (mf.id && !hasEdge(mf.id, diEdgeIds, elementRegistry)) {
            issues.push({
              type: 'shapeless-message-flow',
              category: 'ghost-element',
              severity: 'error',
              label: `Invisible message flow: ${mf.id}`,
              elementId: mf.id,
              elementName: mf.name ?? undefined,
              elementType: 'bpmn:MessageFlow',
            });
          }
        }
      }
    }
  }
}

function detectShapelessFlowElements(
  process: any,
  diShapeIds: Set<string>,
  diEdgeIds: Set<string>,
  elementRegistry: ElementRegistryLike | undefined,
  issues: SanitizableIssue[],
): void {
  const flowElements = process.flowElements;
  if (!Array.isArray(flowElements)) {
    return;
  }

  for (const el of flowElements) {
    if (!el.id) {
      continue;
    }

    if (el.$type === 'bpmn:SequenceFlow') {
      if (!hasEdge(el.id, diEdgeIds, elementRegistry)) {
        issues.push({
          type: 'shapeless-sequence-flow',
          category: 'ghost-element',
          severity: 'error',
          label: `Poltergeist wire: ${el.id}`,
          elementId: el.id,
          elementName: el.name ?? undefined,
          elementType: 'bpmn:SequenceFlow',
        });
      }
      continue;
    }

    if (FLOW_NODE_BASE_TYPES.has(el.$type)) {
      if (!hasShape(el.id, diShapeIds, elementRegistry)) {
        issues.push({
          type: 'shapeless-flow-node',
          category: 'ghost-element',
          severity: 'error',
          label: `Poltergeist: ${el.name ?? el.id}`,
          elementId: el.id,
          elementName: el.name ?? undefined,
          elementType: el.$type,
        });
      }
    }

    if (el.$type === 'bpmn:SubProcess' && Array.isArray(el.flowElements)) {
      detectShapelessFlowElements(el, diShapeIds, diEdgeIds, elementRegistry, issues);
    }
  }
}

function collectSemanticElementIds(definitions: any): Set<string> {
  const ids = new Set<string>();
  const rootElements = definitions.rootElements;
  if (!Array.isArray(rootElements)) {
    return ids;
  }

  if (definitions.id) {
    ids.add(definitions.id);
  }

  for (const rootEl of rootElements) {
    if (rootEl.id) {
      ids.add(rootEl.id);
    }

    if (rootEl.$type === 'bpmn:Process') {
      collectFlowElementIds(rootEl, ids);
    }

    if (rootEl.$type === 'bpmn:Collaboration') {
      for (const participant of rootEl.participants ?? []) {
        if (participant.id) {
          ids.add(participant.id);
        }
      }
      for (const messageFlow of rootEl.messageFlows ?? []) {
        if (messageFlow.id) {
          ids.add(messageFlow.id);
        }
      }
      for (const annotation of rootEl.textAnnotations ?? []) {
        if (annotation.id) {
          ids.add(annotation.id);
        }
      }
      for (const association of rootEl.associations ?? []) {
        if (association.id) {
          ids.add(association.id);
        }
      }
      for (const artifact of rootEl.artifacts ?? []) {
        if (artifact.id) {
          ids.add(artifact.id);
        }
      }
    }
  }
  return ids;
}

function collectFlowElementIds(container: any, ids: Set<string>): void {
  const flowElements = container.flowElements;
  if (Array.isArray(flowElements)) {
    for (const el of flowElements) {
      if (el.id) {
        ids.add(el.id);
      }
      collectActivityChildIds(el, ids);
      if (el.$type === 'bpmn:SubProcess') {
        collectFlowElementIds(el, ids);
      }
    }
  }

  for (const artifact of container.artifacts ?? []) {
    if (artifact.id) {
      ids.add(artifact.id);
    }
  }

  for (const lane of container.laneSets ?? []) {
    if (lane.id) {
      ids.add(lane.id);
    }
    collectLaneIds(lane, ids);
  }
}

function collectActivityChildIds(activity: any, ids: Set<string>): void {
  const nestedArrays = ['dataInputAssociations', 'dataOutputAssociations', 'ioSpecification'];

  for (const prop of nestedArrays) {
    const children = activity[prop];
    if (Array.isArray(children)) {
      for (const child of children) {
        if (child.id) {
          ids.add(child.id);
        }
      }
    } else if (children?.id) {
      ids.add(children.id);
    }
  }
}

function collectLaneIds(laneSet: any, ids: Set<string>): void {
  for (const lane of laneSet.lanes ?? []) {
    if (lane.id) {
      ids.add(lane.id);
    }
    for (const childSet of lane.childLaneSet ?? []) {
      collectLaneIds(childSet, ids);
    }
  }
}

function detectZombieElements(definitions: any, semanticIds: Set<string>, issues: SanitizableIssue[]): void {
  const diagrams = definitions.diagrams;
  if (!Array.isArray(diagrams)) {
    return;
  }

  for (const diagram of diagrams) {
    const planeElements = diagram.plane?.planeElement;
    if (!Array.isArray(planeElements)) {
      continue;
    }
    for (const pe of planeElements) {
      if (!pe.id) {
        continue;
      }

      const resolved = pe.bpmnElement?.id != null;
      const isZombie = resolved ? !semanticIds.has(pe.bpmnElement.id) : pe.bpmnElement == null;

      if (!isZombie) {
        continue;
      }

      const displayId = pe.bpmnElement?.id ?? pe.id;

      if (pe.$type === 'bpmndi:BPMNShape') {
        issues.push({
          type: 'zombie-shape',
          category: 'zombie-element',
          severity: 'warning',
          label: `Zombie: ${displayId}`,
          elementId: pe.id,
          elementName: pe.bpmnElement?.name ?? undefined,
          elementType: pe.bpmnElement?.$type ?? 'bpmndi:BPMNShape',
        });
      }

      if (pe.$type === 'bpmndi:BPMNEdge') {
        issues.push({
          type: 'zombie-edge',
          category: 'zombie-element',
          severity: 'warning',
          label: `Zombie wire: ${displayId}`,
          elementId: pe.id,
          elementName: pe.bpmnElement?.name ?? undefined,
          elementType: pe.bpmnElement?.$type ?? 'bpmndi:BPMNEdge',
        });
      }
    }
  }
}

function detectUnreferencedGlobals(
  globalDefinitionsById: Map<string, any>,
  referencedGlobalIds: Set<string>,
  issues: SanitizableIssue[],
): void {
  for (const [id, globalEl] of globalDefinitionsById) {
    if (!referencedGlobalIds.has(id)) {
      const issueType = GLOBAL_TYPES[globalEl.$type];
      if (!issueType) {
        continue;
      }

      issues.push({
        type: issueType,
        category: 'unreferenced-global',
        severity: 'info',
        label: `Orphaned ${globalEl.$type.replace('bpmn:', '')}: ${globalEl.name ?? id}`,
        elementId: id,
        elementName: globalEl.name ?? undefined,
        elementType: globalEl.$type,
      } as SanitizableIssue);
    }
  }
}

const PROPERTY_TO_ISSUE_TYPE: Record<string, SanitizableIssue['type']> = {
  'bpmn:messageRef': 'dangling-message-ref',
  'bpmn:errorRef': 'dangling-error-ref',
  'bpmn:signalRef': 'dangling-signal-ref',
  'bpmn:escalationRef': 'dangling-escalation-ref',
};

function detectDanglingReferences(
  _definitions: any,
  parseWarnings: ModdleParseWarning[],
  issues: SanitizableIssue[],
): void {
  for (const warning of parseWarnings) {
    if (!warning.message?.startsWith('unresolved reference')) {
      continue;
    }
    if (!warning.property || !warning.element) {
      continue;
    }

    const issueType = PROPERTY_TO_ISSUE_TYPE[warning.property];
    if (!issueType) {
      continue;
    }

    const eventDef = warning.element;
    const ownerElement = findOwnerElement(eventDef);
    const refProp = warning.property.replace('bpmn:', '');

    issues.push({
      type: issueType,
      category: 'dangling-reference',
      severity: 'warning',
      label: `Dangling ${refProp} on ${ownerElement?.name ?? ownerElement?.id ?? eventDef?.id ?? 'unknown'}`,
      elementId: ownerElement?.id ?? eventDef?.id ?? 'unknown',
      elementName: ownerElement?.name ?? undefined,
      elementType: ownerElement?.$type ?? 'unknown',
    } as SanitizableIssue);
  }
}

function findOwnerElement(node: any): any {
  let current = node.$parent;
  while (current != null) {
    if (current.id && current.$type && !current.$type.endsWith('EventDefinition')) {
      return current;
    }
    current = current.$parent;
  }
  return null;
}

function detectEmptyContainers(definitions: any, issues: SanitizableIssue[]): void {
  const visited = new Set<any>();
  walkForEmptyContainers(definitions, visited, issues);
}

function walkForEmptyContainers(node: any, visited: Set<any>, issues: SanitizableIssue[]): void {
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
    } else {
      for (const val of extValues) {
        if (val.$type === 'evil:Properties') {
          const hasScores = Array.isArray(val.linterRulesetScores) && val.linterRulesetScores.length > 0;
          const hasProperties = Array.isArray(val.values) && val.values.length > 0;
          if (!hasScores && !hasProperties) {
            issues.push({
              type: 'empty-evil-properties',
              category: 'empty-container',
              severity: 'warning',
              label: `Empty evil:Properties on ${node.name ?? node.id ?? 'element'}`,
              elementId: node.id ?? 'unknown',
              elementName: node.name ?? undefined,
              elementType: node.$type,
            });
          }
        }
      }
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
