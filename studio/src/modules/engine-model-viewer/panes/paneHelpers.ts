import type { EditorDocument, EditorDocumentModel } from '@evil/bifrost_fw_sdk';

import type { ModelViewerDocumentModel } from '../models/ModelViewerDocumentModel';
import type { ModelViewerSelection } from '../types';

export function isModelViewerDocument(editorDocument: EditorDocument | null | undefined): boolean {
  return editorDocument?.uri.startsWith('engine-model://') === true;
}

export function getSelection(model: EditorDocumentModel | null): ModelViewerSelection | null {
  return (model as ModelViewerDocumentModel | null)?.getSelectedElement() ?? null;
}

export function matchesType(selection: ModelViewerSelection | null, types: string[]): boolean {
  if (!selection) {
    return false;
  }
  return types.some((type) => selection.elementType === type || selection.elementType.endsWith(type));
}

export function hasEventDefinition(selection: ModelViewerSelection, eventDefinitionType: string): boolean {
  const eventDefinitions = selection.businessObject.eventDefinitions as Record<string, unknown>[] | undefined;
  return eventDefinitions?.some((definition) => String(definition.$type).includes(eventDefinitionType)) ?? false;
}

export function moddleRefId(reference: unknown): string {
  if (!reference) {
    return '—';
  }
  if (typeof reference === 'object' && reference !== null && 'id' in reference) {
    return String((reference as { id: string }).id);
  }
  return String(reference);
}

export function moddleRefName(reference: unknown): string {
  if (!reference) {
    return '—';
  }
  if (typeof reference === 'object' && reference !== null && 'name' in reference) {
    return String((reference as { name: string }).name);
  }
  return moddleRefId(reference);
}

type ExtensionElement = Record<string, unknown>;

function getExtensionElements(businessObject: Record<string, unknown>): ExtensionElement[] {
  const extensionElements = businessObject.extensionElements as Record<string, unknown> | undefined;
  if (!extensionElements || typeof extensionElements !== 'object') {
    return [];
  }
  const values = extensionElements.values as unknown[] | undefined;
  return Array.isArray(values) ? (values as ExtensionElement[]) : [];
}

export function getExtensionValue(businessObject: Record<string, unknown>, typeSuffix: string): string | null {
  const element = getExtensionElements(businessObject).find((entry) => String(entry.$type ?? '').endsWith(typeSuffix));
  if (!element) {
    return null;
  }
  const body = element.body ?? element.value ?? element.text;
  return body != null ? String(body) : null;
}

export function getExtensionAttribute(
  businessObject: Record<string, unknown>,
  typeSuffix: string,
  attribute: string,
): string | null {
  const element = getExtensionElements(businessObject).find((entry) => String(entry.$type ?? '').endsWith(typeSuffix));
  if (!element) {
    return null;
  }
  const value = element[attribute];
  return value != null ? String(value) : null;
}

export type MappingEntry = { source: string; target: string };

export function getExtensionMappings(businessObject: Record<string, unknown>, typeSuffix: string): MappingEntry[] {
  return getExtensionElements(businessObject)
    .filter((entry) => String(entry.$type ?? '').endsWith(typeSuffix))
    .map((entry) => ({
      source: String(entry.source ?? ''),
      target: String(entry.target ?? ''),
    }));
}

export function getEventDefinition(
  businessObject: Record<string, unknown>,
  definitionType: string,
): ExtensionElement | null {
  const eventDefinitions = businessObject.eventDefinitions as ExtensionElement[] | undefined;
  if (!Array.isArray(eventDefinitions)) {
    return null;
  }
  return eventDefinitions.find((def) => String(def.$type ?? '').includes(definitionType)) ?? null;
}
