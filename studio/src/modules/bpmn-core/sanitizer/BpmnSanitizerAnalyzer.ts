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
  'bpmn:Transaction',
  'bpmn:AdHocSubProcess',
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
  'bpmn:DataObjectReference',
  'bpmn:DataStoreReference',
]);

export function analyzeSanitizableIssues(
  definitions: any,
  elementRegistry?: ElementRegistryLike,
  parseWarnings?: ModdleParseWarning[],
): SanitizableIssue[] {
  const issues: SanitizableIssue[] = [];

  const diShapeIds = collectDiShapeIds(definitions);
  const diEdgeIds = collectDiEdgeIds(definitions);
  const semanticElements = collectSemanticElements(definitions);
  const semanticIds = new Set([...semanticElements].map((element) => element.id).filter(Boolean));
  const referencedGlobalIds = collectReferencedGlobalIds(semanticElements);
  const globalDefinitionsById = collectGlobalDefinitions(definitions);

  detectShapelessElements(definitions, diShapeIds, diEdgeIds, elementRegistry, issues);
  detectZombieElements(definitions, semanticIds, issues);
  detectUnreferencedGlobals(globalDefinitionsById, referencedGlobalIds, issues);
  detectDanglingReferences(semanticElements, parseWarnings ?? [], issues);
  detectEmptyContainers(semanticElements, issues);

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

function collectReferencedGlobalIds(semanticElements: Set<any>): Set<string> {
  const refs = new Set<string>();
  for (const element of semanticElements) {
    for (const property of ['messageRef', 'errorRef', 'signalRef', 'escalationRef']) {
      if (element[property]?.id) {
        refs.add(element[property].id);
      }
    }
  }
  return refs;
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

  const collapsedSubProcessIds = collectCollapsedSubProcessIds(definitions);
  const isCollapsed = (element: any): boolean =>
    elementRegistry ? elementRegistry.get(element.id)?.collapsed === true : collapsedSubProcessIds.has(element.id);

  for (const rootEl of rootElements) {
    if (rootEl.$type === 'bpmn:Process') {
      detectShapelessFlowElements(rootEl, false, isCollapsed, diShapeIds, diEdgeIds, elementRegistry, issues);
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

/** Sub-process-like elements whose DI shape is collapsed (bpmn-js treats a missing `isExpanded` as collapsed). */
function collectCollapsedSubProcessIds(definitions: any): Set<string> {
  const ids = new Set<string>();
  for (const diagram of definitions.diagrams ?? []) {
    for (const planeElement of diagram.plane?.planeElement ?? []) {
      const element = planeElement.bpmnElement;
      if (
        planeElement.$type === 'bpmndi:BPMNShape' &&
        element?.id &&
        Array.isArray(element.flowElements) &&
        planeElement.isExpanded !== true
      ) {
        ids.add(element.id);
      }
    }
  }
  return ids;
}

function detectShapelessFlowElements(
  container: any,
  insideCollapsedContainer: boolean,
  isCollapsed: (element: any) => boolean,
  diShapeIds: Set<string>,
  diEdgeIds: Set<string>,
  elementRegistry: ElementRegistryLike | undefined,
  issues: SanitizableIssue[],
): void {
  const flowElements = container.flowElements;
  if (!Array.isArray(flowElements)) {
    return;
  }
  // Deleting the children of a collapsed sub-process would destroy content that only lacks a drill-down layout.
  const manualFixOnly = insideCollapsedContainer ? { manualFixOnly: true as const } : {};

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
          ...manualFixOnly,
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
          ...manualFixOnly,
        });
      }
    }

    if (Array.isArray(el.flowElements)) {
      detectShapelessFlowElements(
        el,
        insideCollapsedContainer || isCollapsed(el),
        isCollapsed,
        diShapeIds,
        diEdgeIds,
        elementRegistry,
        issues,
      );
    }
  }
}

/**
 * Every element owned by the definitions, found by walking moddle containment
 * properties only. References are skipped so stale references to removed
 * elements do not revive them; DI is skipped because it is not semantic.
 */
function collectSemanticElements(definitions: any): Set<any> {
  const elements = new Set<any>();
  const visit = (node: any): void => {
    if (node == null || typeof node !== 'object' || elements.has(node)) {
      return;
    }
    elements.add(node);
    for (const property of node.$descriptor?.properties ?? []) {
      if (property.isReference || (node === definitions && property.name === 'diagrams')) {
        continue;
      }
      const value = node[property.name];
      if (Array.isArray(value)) {
        value.forEach(visit);
      } else if (value != null && typeof value === 'object' && '$type' in value) {
        visit(value);
      }
    }
  };
  visit(definitions);
  return elements;
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
  semanticElements: Set<any>,
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

    const refProp = warning.property.replace('bpmn:', '');
    const referencingElement = warning.element;
    // Import-time warnings go stale once the reference is set again or the element is removed.
    if (referencingElement[refProp] != null || !semanticElements.has(referencingElement)) {
      continue;
    }

    const ownerElement = findReferenceOwner(referencingElement);

    issues.push({
      type: issueType,
      category: 'dangling-reference',
      severity: 'warning',
      label: `Dangling ${refProp} on ${ownerElement?.name ?? ownerElement?.id ?? referencingElement.id ?? 'unknown'}`,
      elementId: ownerElement?.id ?? referencingElement.id ?? 'unknown',
      elementName: ownerElement?.name ?? undefined,
      elementType: ownerElement?.$type ?? 'unknown',
    } as SanitizableIssue);
  }
}

/** The flow element a reference belongs to: the element itself, or the event owning an event definition. */
export function findReferenceOwner(referencingElement: any): any {
  let current = referencingElement;
  while (current != null) {
    if (current.id && current.$type && !current.$type.endsWith('EventDefinition')) {
      return current;
    }
    current = current.$parent;
  }
  return null;
}

function detectEmptyContainers(semanticElements: Set<any>, issues: SanitizableIssue[]): void {
  for (const node of semanticElements) {
    if (!node.extensionElements) {
      continue;
    }
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
      continue;
    }

    for (const val of extValues) {
      if (val.$type === 'bfw:Properties') {
        const hasScores = Array.isArray(val.linterRulesetScores) && val.linterRulesetScores.length > 0;
        const hasProperties = Array.isArray(val.values) && val.values.length > 0;
        if (!hasScores && !hasProperties) {
          issues.push({
            type: 'empty-bfw-properties',
            category: 'empty-container',
            severity: 'warning',
            label: `Empty bfw:Properties on ${node.name ?? node.id ?? 'element'}`,
            elementId: node.id ?? 'unknown',
            elementName: node.name ?? undefined,
            elementType: node.$type,
          });
        }
      }
    }
  }
}
