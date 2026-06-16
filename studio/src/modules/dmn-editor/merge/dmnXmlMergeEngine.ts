import type { ElementResolutionStatus } from '@evil/bifrost_fw_sdk';

import type { DmnDiffChangesByAction } from '../../dmn-core/diff';

export type ResolutionMap = Map<string, ElementResolutionStatus>;

export type XmlMergeResult = {
  mergedXml: string;
  autoAppliedIds: Set<string>;
};

/**
 * Performs a three-way XML-level merge for DMN definitions.
 *
 * Takes the starting-side XML as the base document and applies non-conflicting
 * changes from the apply-side XML at the DOM level. Mirrors the BPMN
 * `xmlMergeEngine` pattern but adapted for DMN structure (DRG elements under
 * `<definitions>`, DMNDI with `dmnElementRef`, no lanes or connection ordering).
 *
 * For each non-conflict change in `applySideChanges`:
 * - removed: remove the semantic element + its DI node from the starting DOM
 * - added: copy the semantic element + its DI node from the apply-side DOM
 * - updated: replace the semantic element with the apply-side version (+ DI if both exist)
 * - layoutChanged: replace only the DI node with the apply-side version
 */
export function dmnXmlMergeEngine(
  startingSideXml: string,
  applySideXml: string,
  applySideChanges: DmnDiffChangesByAction,
  conflictElementIds: Set<string>,
): XmlMergeResult {
  const parser = new DOMParser();
  const resultDoc = parser.parseFromString(startingSideXml, 'application/xml');
  const donorDoc = parser.parseFromString(applySideXml, 'application/xml');

  const autoAppliedIds = new Set<string>();

  const resultIndex = buildElementIndex(resultDoc);
  const donorIndex = buildElementIndex(donorDoc);

  // --- 1. Deletions ---
  for (const elementId of Object.keys(applySideChanges.removed)) {
    if (conflictElementIds.has(elementId)) {
      continue;
    }
    if (applyDeletion(resultIndex, elementId)) {
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

  // --- 3. Layout changes (DI-only replacement) ---
  for (const elementId of Object.keys(applySideChanges.layoutChanged)) {
    if (conflictElementIds.has(elementId)) {
      continue;
    }
    if (applyLayoutChange(resultDoc, resultIndex, donorIndex, elementId)) {
      autoAppliedIds.add(elementId);
    }
  }

  // --- 4. Additions ---
  for (const elementId of Object.keys(applySideChanges.added)) {
    if (conflictElementIds.has(elementId)) {
      continue;
    }
    if (applyAddition(resultDoc, resultIndex, donorIndex, elementId)) {
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
  /** Maps element ID → semantic DOM node (decision, inputData, etc.) */
  semanticById: Map<string, Element>;
  /** Maps dmnElementRef ID → DI DOM node (dmndi:DMNShape or dmndi:DMNEdge) */
  diByDmnElement: Map<string, Element>;
};

function buildElementIndex(doc: Document): ElementIndex {
  const semanticById = new Map<string, Element>();
  const diByDmnElement = new Map<string, Element>();

  const allElements = doc.getElementsByTagName('*');
  for (let idx = 0; idx < allElements.length; idx++) {
    const element = allElements[idx];
    const elementId = element.getAttribute('id');
    if (elementId != null && elementId.length > 0) {
      semanticById.set(elementId, element);
    }

    const dmnElementRef = element.getAttribute('dmnElementRef');
    if (dmnElementRef != null && dmnElementRef.length > 0) {
      const localName = element.localName;
      if (localName === 'DMNShape' || localName === 'DMNEdge') {
        diByDmnElement.set(dmnElementRef, element);
      }
    }
  }

  return { semanticById, diByDmnElement };
}

// ---------------------------------------------------------------------------
// Deletion
// ---------------------------------------------------------------------------

function applyDeletion(resultIndex: ElementIndex, elementId: string): boolean {
  const semanticNode = resultIndex.semanticById.get(elementId);
  if (semanticNode != null) {
    semanticNode.parentNode?.removeChild(semanticNode);
    resultIndex.semanticById.delete(elementId);
  }

  const diNode = resultIndex.diByDmnElement.get(elementId);
  if (diNode != null) {
    diNode.parentNode?.removeChild(diNode);
    resultIndex.diByDmnElement.delete(elementId);
  }

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

  const donorDi = donorIndex.diByDmnElement.get(elementId);
  const resultDi = resultIndex.diByDmnElement.get(elementId);
  if (donorDi != null && resultDi != null) {
    const importedDi = resultDoc.importNode(donorDi, true);
    resultDi.parentNode?.replaceChild(importedDi, resultDi);
    resultIndex.diByDmnElement.set(elementId, importedDi);
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
  const donorDi = donorIndex.diByDmnElement.get(elementId);
  const resultDi = resultIndex.diByDmnElement.get(elementId);

  if (donorDi == null || resultDi == null) {
    return false;
  }

  const importedDi = resultDoc.importNode(donorDi, true);
  resultDi.parentNode?.replaceChild(importedDi, resultDi);
  resultIndex.diByDmnElement.set(elementId, importedDi);

  return true;
}

// ---------------------------------------------------------------------------
// Addition (semantic + DI from donor)
// ---------------------------------------------------------------------------

function applyAddition(
  resultDoc: Document,
  resultIndex: ElementIndex,
  donorIndex: ElementIndex,
  elementId: string,
): boolean {
  if (resultIndex.semanticById.has(elementId)) {
    return true;
  }

  const donorNode = donorIndex.semanticById.get(elementId);
  if (donorNode == null) {
    return false;
  }

  const donorParent = donorNode.parentNode as Element | null;
  if (donorParent == null) {
    return false;
  }

  const donorParentId = donorParent.getAttribute('id');
  let resultParent: Element | null = null;

  if (donorParentId != null) {
    resultParent = resultIndex.semanticById.get(donorParentId) ?? null;
  }

  if (resultParent == null) {
    resultParent = findMatchingAncestor(donorNode, resultIndex);
  }

  if (resultParent == null) {
    console.warn(`[dmnXmlMerge] Could not find result parent for added element ${elementId}`);
    return false;
  }

  const importedNode = resultDoc.importNode(donorNode, true);
  resultParent.appendChild(importedNode);
  resultIndex.semanticById.set(elementId, importedNode);

  const donorDi = donorIndex.diByDmnElement.get(elementId);
  if (donorDi != null) {
    const dmnDiagram = findDmnDiagram(resultDoc);
    if (dmnDiagram != null) {
      const importedDi = resultDoc.importNode(donorDi, true);
      dmnDiagram.appendChild(importedDi);
      resultIndex.diByDmnElement.set(elementId, importedDi);
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findDmnDiagram(doc: Document): Element | null {
  const allElements = doc.getElementsByTagName('*');
  for (let idx = 0; idx < allElements.length; idx++) {
    if (allElements[idx].localName === 'DMNDiagram') {
      return allElements[idx];
    }
  }
  return null;
}

/**
 * Walk up the donor element's ancestor chain until we find one whose ID
 * exists in the result document (typically `<definitions>` for DRG elements).
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
