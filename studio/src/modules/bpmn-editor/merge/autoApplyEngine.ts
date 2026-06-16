import type { ElementResolutionStatus } from '@evil/bifrost_fw_sdk';

import type { BpmnDiffChangesByAction } from '../../bpmn-core/diff';

export type ResolutionMap = Map<string, ElementResolutionStatus>;

export type XmlMergeResult = {
  mergedXml: string;
  autoAppliedIds: Set<string>;
};

const BPMN_NS = 'http://www.omg.org/spec/BPMN/20100524/MODEL';
const BPMNDI_NS = 'http://www.omg.org/spec/BPMN/20100524/DI';

/**
 * Performs a three-way XML-level merge.
 *
 * Takes the starting-side XML as the base document and applies non-conflicting
 * changes from the apply-side XML at the DOM level. This avoids all the pitfalls
 * of the modeler-based approach (lost $parent after JSON serialization in the
 * web worker, broken connection rerouting via updateProperties, skipped connection
 * additions).
 *
 * For each non-conflict change in `applySideChanges`:
 * - DELETED: remove the semantic element + its DI node from the starting DOM
 * - ADDED: copy the semantic element + its DI node from the apply-side DOM
 * - UPDATED: replace the semantic element with the apply-side version
 * - MOVED: replace only the DI node with the apply-side version
 */
export function xmlMergeEngine(
  startingSideXml: string,
  applySideXml: string,
  applySideChanges: BpmnDiffChangesByAction,
  conflictElementIds: Set<string>,
): XmlMergeResult {
  const parser = new DOMParser();
  const resultDoc = parser.parseFromString(startingSideXml, 'application/xml');
  const donorDoc = parser.parseFromString(applySideXml, 'application/xml');

  const autoAppliedIds = new Set<string>();

  const resultIndex = buildElementIndex(resultDoc);
  const donorIndex = buildElementIndex(donorDoc);

  // --- 1. Deletions (connections first, then shapes) ---
  const deletedIds = Object.keys(applySideChanges.deleted).filter((id) => !conflictElementIds.has(id));
  const deletedConnections = deletedIds.filter((id) => isConnectionId(id, resultIndex));
  const deletedShapes = deletedIds.filter((id) => !isConnectionId(id, resultIndex));

  for (const elementId of [...deletedConnections, ...deletedShapes]) {
    if (applyDeletion(resultDoc, resultIndex, elementId)) {
      autoAppliedIds.add(elementId);
    }
  }

  // --- 2. Updates (semantic element replacement) ---
  for (const elementId of Object.keys(applySideChanges.updated)) {
    if (conflictElementIds.has(elementId)) {
      continue;
    }
    if (applyUpdate(resultDoc, resultIndex, donorIndex, elementId)) {
      autoAppliedIds.add(elementId);
    }
  }

  // --- 3. Moved (DI-only replacement) ---
  for (const elementId of Object.keys(applySideChanges.moved)) {
    if (conflictElementIds.has(elementId)) {
      continue;
    }
    if (applyLayoutChange(resultDoc, resultIndex, donorIndex, elementId)) {
      autoAppliedIds.add(elementId);
    }
  }

  // --- 4. Additions (shapes first, then connections) ---
  const addedIds = Object.keys(applySideChanges.added).filter((id) => !conflictElementIds.has(id));
  const addedConnections = addedIds.filter((id) => isConnectionId(id, donorIndex));
  const addedShapes = addedIds.filter((id) => !isConnectionId(id, donorIndex));

  for (const elementId of [...addedShapes, ...addedConnections]) {
    if (applyAddition(resultDoc, resultIndex, donorDoc, donorIndex, elementId)) {
      autoAppliedIds.add(elementId);
    }
  }

  // --- 5. Serialize ---
  const serializer = new XMLSerializer();
  const mergedXml = serializer.serializeToString(resultDoc);

  return { mergedXml, autoAppliedIds };
}

// ---------------------------------------------------------------------------
// Index builders
// ---------------------------------------------------------------------------

type ElementIndex = {
  /** Maps element ID → semantic DOM node (bpmn:task, bpmn:sequenceFlow, etc.) */
  semanticById: Map<string, Element>;
  /** Maps bpmnElement ref ID → DI DOM node (bpmndi:BPMNShape or bpmndi:BPMNEdge) */
  diByBpmnElement: Map<string, Element>;
};

function buildElementIndex(doc: Document): ElementIndex {
  const semanticById = new Map<string, Element>();
  const diByBpmnElement = new Map<string, Element>();

  const allElements = doc.getElementsByTagName('*');
  for (let idx = 0; idx < allElements.length; idx++) {
    const el = allElements[idx];
    const elId = el.getAttribute('id');
    if (elId != null && elId.length > 0) {
      semanticById.set(elId, el);
    }

    const bpmnElement = el.getAttribute('bpmnElement');
    if (bpmnElement != null && bpmnElement.length > 0) {
      const localName = el.localName;
      if (localName === 'BPMNShape' || localName === 'BPMNEdge') {
        diByBpmnElement.set(bpmnElement, el);
      }
    }
  }

  return { semanticById, diByBpmnElement };
}

function isConnectionId(elementId: string, index: ElementIndex): boolean {
  const el = index.semanticById.get(elementId);
  if (el == null) {
    return false;
  }
  const localName = el.localName;
  return (
    localName === 'sequenceFlow' ||
    localName === 'messageFlow' ||
    localName === 'association' ||
    localName === 'dataInputAssociation' ||
    localName === 'dataOutputAssociation'
  );
}

// ---------------------------------------------------------------------------
// Deletion
// ---------------------------------------------------------------------------

function applyDeletion(resultDoc: Document, resultIndex: ElementIndex, elementId: string): boolean {
  const semanticNode = resultIndex.semanticById.get(elementId);
  if (semanticNode != null) {
    semanticNode.parentNode?.removeChild(semanticNode);
  }

  const diNode = resultIndex.diByBpmnElement.get(elementId);
  if (diNode != null) {
    diNode.parentNode?.removeChild(diNode);
  }

  removeLaneFlowNodeRef(resultDoc, elementId);

  return semanticNode != null || diNode != null;
}

// ---------------------------------------------------------------------------
// Update (semantic element replacement + optional DI update)
// ---------------------------------------------------------------------------

function applyUpdate(
  resultDoc: Document,
  resultIndex: ElementIndex,
  donorIndex: ElementIndex,
  elementId: string,
): boolean {
  const resultNode = resultIndex.semanticById.get(elementId);
  const donorNode = donorIndex.semanticById.get(elementId);

  if (resultNode == null || donorNode == null) {
    return false;
  }

  const parent = resultNode.parentNode;
  if (parent == null) {
    return false;
  }

  const imported = resultDoc.importNode(donorNode, true);
  parent.replaceChild(imported, resultNode);
  resultIndex.semanticById.set(elementId, imported);

  // Also update DI if the donor has one (layout may have changed alongside semantic changes)
  const donorDi = donorIndex.diByBpmnElement.get(elementId);
  const resultDi = resultIndex.diByBpmnElement.get(elementId);
  if (donorDi != null && resultDi != null) {
    const importedDi = resultDoc.importNode(donorDi, true);
    resultDi.parentNode?.replaceChild(importedDi, resultDi);
    resultIndex.diByBpmnElement.set(elementId, importedDi);
  }

  return true;
}

// ---------------------------------------------------------------------------
// Layout change (DI-only replacement)
// ---------------------------------------------------------------------------

function applyLayoutChange(
  resultDoc: Document,
  resultIndex: ElementIndex,
  donorIndex: ElementIndex,
  elementId: string,
): boolean {
  const donorDi = donorIndex.diByBpmnElement.get(elementId);
  const resultDi = resultIndex.diByBpmnElement.get(elementId);

  if (donorDi == null || resultDi == null) {
    return false;
  }

  const importedDi = resultDoc.importNode(donorDi, true);
  resultDi.parentNode?.replaceChild(importedDi, resultDi);
  resultIndex.diByBpmnElement.set(elementId, importedDi);

  return true;
}

// ---------------------------------------------------------------------------
// Addition (semantic + DI from donor)
// ---------------------------------------------------------------------------

function applyAddition(
  resultDoc: Document,
  resultIndex: ElementIndex,
  donorDoc: Document,
  donorIndex: ElementIndex,
  elementId: string,
): boolean {
  // Already exists in result — nothing to do
  if (resultIndex.semanticById.has(elementId)) {
    return true;
  }

  const donorNode = donorIndex.semanticById.get(elementId);
  if (donorNode == null) {
    return false;
  }

  // Find the parent in the donor DOM, then locate the same parent in the result DOM
  const donorParent = donorNode.parentNode as Element | null;
  if (donorParent == null) {
    return false;
  }

  const donorParentId = donorParent.getAttribute('id');
  let resultParent: Element | null = null;

  if (donorParentId != null) {
    resultParent = resultIndex.semanticById.get(donorParentId) ?? null;
  }

  // Fallback: for elements whose parent doesn't have an ID (e.g., laneSet),
  // walk up to the first ancestor with an ID
  if (resultParent == null) {
    resultParent = findMatchingAncestor(donorNode, resultIndex);
  }

  if (resultParent == null) {
    console.warn(`[xmlMerge] Could not find result parent for added element ${elementId}`);
    return false;
  }

  const importedNode = resultDoc.importNode(donorNode, true);
  resultParent.appendChild(importedNode);
  resultIndex.semanticById.set(elementId, importedNode);

  // Copy DI node
  const donorDi = donorIndex.diByBpmnElement.get(elementId);
  if (donorDi != null) {
    const bpmnPlane = findBpmnPlane(resultDoc);
    if (bpmnPlane != null) {
      const importedDi = resultDoc.importNode(donorDi, true);
      bpmnPlane.appendChild(importedDi);
      resultIndex.diByBpmnElement.set(elementId, importedDi);
    }
  }

  // Update lane flowNodeRef if this is a flow node inside a lane
  addLaneFlowNodeRef(resultDoc, donorDoc, donorIndex, elementId);

  return true;
}

// ---------------------------------------------------------------------------
// Lane flowNodeRef management
// ---------------------------------------------------------------------------

function removeLaneFlowNodeRef(doc: Document, elementId: string): void {
  const refs = doc.getElementsByTagNameNS(BPMN_NS, 'flowNodeRef');
  for (let idx = refs.length - 1; idx >= 0; idx--) {
    const refNode = refs[idx];
    if (refNode.textContent?.trim() === elementId) {
      refNode.parentNode?.removeChild(refNode);
    }
  }
}

function addLaneFlowNodeRef(
  resultDoc: Document,
  donorDoc: Document,
  donorIndex: ElementIndex,
  elementId: string,
): void {
  // Check if the element is referenced by a lane in the donor
  const donorRefs = donorDoc.getElementsByTagNameNS(BPMN_NS, 'flowNodeRef');
  for (let idx = 0; idx < donorRefs.length; idx++) {
    const refNode = donorRefs[idx];
    if (refNode.textContent?.trim() !== elementId) {
      continue;
    }

    const donorLane = refNode.parentNode as Element | null;
    if (donorLane == null) {
      continue;
    }

    const laneId = donorLane.getAttribute('id');
    if (laneId == null) {
      continue;
    }

    // Find the same lane in the result document
    const resultLane = findElementById(resultDoc, laneId);
    if (resultLane == null) {
      continue;
    }

    // Check if the ref already exists
    const existingRefs = resultLane.getElementsByTagNameNS(BPMN_NS, 'flowNodeRef');
    let alreadyPresent = false;
    for (let refIdx = 0; refIdx < existingRefs.length; refIdx++) {
      if (existingRefs[refIdx].textContent?.trim() === elementId) {
        alreadyPresent = true;
        break;
      }
    }

    if (!alreadyPresent) {
      const newRef = resultDoc.createElementNS(BPMN_NS, 'bpmn:flowNodeRef');
      newRef.textContent = elementId;
      resultLane.appendChild(newRef);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findBpmnPlane(doc: Document): Element | null {
  const planes = doc.getElementsByTagNameNS(BPMNDI_NS, 'BPMNPlane');
  return planes.length > 0 ? planes[0] : null;
}

function findElementById(doc: Document, elementId: string): Element | null {
  const allElements = doc.getElementsByTagName('*');
  for (let idx = 0; idx < allElements.length; idx++) {
    if (allElements[idx].getAttribute('id') === elementId) {
      return allElements[idx];
    }
  }
  return null;
}

/**
 * Walk up the donor element's ancestor chain until we find one whose ID
 * exists in the result document. This handles cases where the immediate
 * parent is a container without a unique ID (e.g., laneSet).
 */
function findMatchingAncestor(donorNode: Node, resultIndex: ElementIndex): Element | null {
  let current = donorNode.parentNode;
  while (current != null && current.nodeType === Node.ELEMENT_NODE) {
    const id = (current as Element).getAttribute('id');
    if (id != null) {
      const match = resultIndex.semanticById.get(id);
      if (match != null) {
        return match;
      }
    }
    current = current.parentNode;
  }
  return null;
}
