import {
  type LinterScoreChange,
  type LinterScoreChangeKind,
  type LinterScorePropertyDelta,
  diffLinterScores,
} from './bfwLinterScoreDiff';
import { ATTRIBUTE_LABELS, LAYOUT_CHANGE_REJECTED_TYPES } from './bpmnDiffConstants';
import { parseBpmnDefinitionsFromXml } from './bpmnModdleForDiff';
import {
  CALL_ACTIVITY_DIFF_ATTRIBUTE_LABELS,
  CALL_ACTIVITY_EXTENSION_LABELS,
  collectCallActivityExtensionsByElementId,
  diffCallActivityExtensionMaps,
} from './callActivityExtensionDiff';
import {
  type CustomPropertiesSummaryEntry,
  type CustomPropertyChangeKind,
  type CustomPropertyDelta,
  collectCustomPropertiesByElementId,
  diffCustomPropertiesMaps,
} from './customPropertiesDiff';
import { type DefinitionsMetadataChange, diffDefinitionsMetadata } from './definitionsMetadataDiff';

export type { CustomPropertiesSummaryEntry, CustomPropertyChangeKind, CustomPropertyDelta, DefinitionsMetadataChange };
export type { LinterScoreChange, LinterScoreChangeKind, LinterScorePropertyDelta };

export type ChangeSummaryEntry = {
  id: string;
  type: string;
  label: string;
  displayName: string;
  /** Custom property deltas for this element (merged from augmented diff; not a top-level category). */
  customPropertyChanges?: CustomPropertyDelta[];
};

export type AttributeChange = {
  attribute: string;
  oldValue: string | undefined;
  newValue: string | undefined;
};

export type ModifiedEntry = ChangeSummaryEntry & {
  attributeChanges: AttributeChange[];
};

export type ChangeSummary = {
  added: ChangeSummaryEntry[];
  removed: ChangeSummaryEntry[];
  modified: ModifiedEntry[];
  layoutChanged: ChangeSummaryEntry[];
  definitionsMetadata: DefinitionsMetadataChange[];
  linterScoreChanges: LinterScoreChange[];
  /**
   * Always empty after {@link buildChangeSummary} / {@link buildAugmentedChangeSummary}:
   * custom property deltas are merged onto {@link ChangeSummaryEntry.customPropertyChanges}.
   */
  customProperties: CustomPropertiesSummaryEntry[];
};

export type RawDiffResult = {
  _added?: Record<string, any>;
  _removed?: Record<string, any>;
  _changed?: Record<string, any>;
  _layoutChanged?: Record<string, any>;
};

/** Maps {@link BpmnDiff} bucket names to `bpmn-js-differ`-shaped keys for {@link buildChangeSummary}. */
export function rawDiffFromBpmnDiffBuckets(changes: {
  added: Record<string, any>;
  deleted: Record<string, any>;
  updated: Record<string, any>;
  moved: Record<string, any>;
}): RawDiffResult {
  const rawDiff: RawDiffResult = {
    _added: {},
    _removed: {},
    _changed: {},
    _layoutChanged: {},
  };

  for (const [elementId, change] of Object.entries(changes.added)) {
    rawDiff._added![elementId] = (change as any).change ?? change;
  }
  for (const [elementId, change] of Object.entries(changes.deleted)) {
    rawDiff._removed![elementId] = (change as any).change ?? change;
  }
  for (const [elementId, change] of Object.entries(changes.updated)) {
    rawDiff._changed![elementId] = (change as any).change ?? change;
  }
  for (const [elementId, change] of Object.entries(changes.moved)) {
    rawDiff._layoutChanged![elementId] = (change as any).change ?? change;
  }

  return rawDiff;
}

export function formatBpmnType(bpmnType: string): string {
  const withoutPrefix = bpmnType.replace(/^bpmn:/, '');
  return withoutPrefix.replace(/([A-Z])/g, ' $1').trim();
}

export function formatElementDisplayName(element: any): { type: string; label: string; displayName: string } {
  const type = element.$type ? formatBpmnType(element.$type) : 'Element';
  const name = element.name;

  if (name) {
    return { type, label: `'${name}'`, displayName: `${type} '${name}'` };
  }
  return { type, label: `(${element.id})`, displayName: `${type} (${element.id})` };
}

function buildEntry(elementId: string, element: any): ChangeSummaryEntry {
  const { type, label, displayName } = formatElementDisplayName(element);
  return { id: elementId, type, label, displayName };
}

export function resolveAttributeLabel(attributeName: string): string {
  if (ATTRIBUTE_LABELS[attributeName]) {
    return ATTRIBUTE_LABELS[attributeName];
  }
  return attributeName
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.substring(1))
    .join(' ');
}

export function stringifyValue(value: any): string | undefined {
  if (value == null) {
    return undefined;
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

function buildModifiedEntry(elementId: string, changeData: any): ModifiedEntry {
  const model = changeData.model ?? changeData;
  const entry = buildEntry(elementId, model);
  const attrs = changeData.attrs ?? {};
  const attributeChanges: AttributeChange[] = [];

  for (const attrName of Object.keys(attrs)) {
    const values = attrs[attrName];
    attributeChanges.push({
      attribute: resolveAttributeLabel(attrName),
      oldValue: stringifyValue(values.oldValue),
      newValue: stringifyValue(values.newValue),
    });
  }

  return { ...entry, attributeChanges };
}

function mergeCustomPropertyBlocksIntoSummary(summary: ChangeSummary, blocks: CustomPropertiesSummaryEntry[]): void {
  const cpMap = new Map(blocks.map((e) => [e.elementId, e]));

  const attach = (entry: ChangeSummaryEntry): void => {
    const block = cpMap.get(entry.id);
    if (block != null && block.changes.length > 0) {
      entry.customPropertyChanges = block.changes;
      cpMap.delete(entry.id);
    }
  };

  for (const e of summary.added) {
    attach(e);
  }
  for (const e of summary.removed) {
    attach(e);
  }
  for (const e of summary.modified) {
    attach(e);
  }
  for (const e of summary.layoutChanged) {
    attach(e);
  }

  for (const block of cpMap.values()) {
    if (block.changes.length === 0) {
      continue;
    }
    summary.modified.push({
      id: block.elementId,
      type: 'Element',
      label: block.elementId,
      displayName: block.displayName,
      attributeChanges: [],
      customPropertyChanges: block.changes,
    });
  }

  summary.customProperties = [];
}

function mergeCallActivityExtensionBlocksIntoSummary(
  summary: ChangeSummary,
  blocks: CustomPropertiesSummaryEntry[],
): void {
  const blockMap = new Map(blocks.map((block) => [block.elementId, block]));

  const toAttributeChanges = (block: CustomPropertiesSummaryEntry): AttributeChange[] =>
    block.changes.map((change) => ({
      attribute: CALL_ACTIVITY_EXTENSION_LABELS[change.propertyName] ?? change.propertyName,
      oldValue: change.oldValue,
      newValue: change.newValue,
    }));

  const hideRawExtensionElementsDump = (entry: ModifiedEntry): void => {
    entry.attributeChanges = entry.attributeChanges.filter(
      (change) => change.attribute !== ATTRIBUTE_LABELS.extensionElements,
    );
  };

  const attachToModified = (entry: ModifiedEntry, extra: AttributeChange[]): void => {
    hideRawExtensionElementsDump(entry);
    for (const extraChange of extra) {
      const existingIndex = entry.attributeChanges.findIndex((change) => change.attribute === extraChange.attribute);
      if (existingIndex >= 0) {
        entry.attributeChanges[existingIndex] = extraChange;
      } else {
        entry.attributeChanges.push(extraChange);
      }
    }
  };

  for (const entry of summary.modified) {
    const block = blockMap.get(entry.id);
    if (block == null) {
      continue;
    }
    attachToModified(entry, toAttributeChanges(block));
    blockMap.delete(entry.id);
  }

  const attachLabeledCustomProperties = (entry: ChangeSummaryEntry): void => {
    const block = blockMap.get(entry.id);
    if (block == null) {
      return;
    }
    const labeledChanges = block.changes.map((change) => ({
      ...change,
      propertyName: CALL_ACTIVITY_EXTENSION_LABELS[change.propertyName] ?? change.propertyName,
    }));
    entry.customPropertyChanges = [...(entry.customPropertyChanges ?? []), ...labeledChanges];
    blockMap.delete(entry.id);
  };

  for (const entry of summary.added) {
    attachLabeledCustomProperties(entry);
  }
  for (const entry of summary.removed) {
    attachLabeledCustomProperties(entry);
  }
  for (const entry of summary.layoutChanged) {
    attachLabeledCustomProperties(entry);
  }

  for (const block of blockMap.values()) {
    summary.modified.push({
      id: block.elementId,
      type: 'Call Activity',
      label: block.elementId,
      displayName: block.displayName,
      attributeChanges: toAttributeChanges(block),
    });
  }
}

export function buildChangeSummary(
  rawDiff: RawDiffResult,
  options?: {
    definitionsMetadata?: DefinitionsMetadataChange[];
    customProperties?: CustomPropertiesSummaryEntry[];
    callActivityExtensions?: CustomPropertiesSummaryEntry[];
    linterScoreChanges?: LinterScoreChange[];
  },
): ChangeSummary {
  const added: ChangeSummaryEntry[] = [];
  const removed: ChangeSummaryEntry[] = [];
  const modified: ModifiedEntry[] = [];
  const layoutChanged: ChangeSummaryEntry[] = [];

  for (const [elementId, element] of Object.entries(rawDiff._added ?? {})) {
    added.push(buildEntry(elementId, element));
  }

  for (const [elementId, element] of Object.entries(rawDiff._removed ?? {})) {
    removed.push(buildEntry(elementId, element));
  }

  for (const [elementId, changeData] of Object.entries(rawDiff._changed ?? {})) {
    modified.push(buildModifiedEntry(elementId, changeData));
  }

  for (const [elementId, element] of Object.entries(rawDiff._layoutChanged ?? {})) {
    const elementType = element.$type ?? (element.model ?? element).$type;
    if (elementType && LAYOUT_CHANGE_REJECTED_TYPES.test(elementType)) {
      continue;
    }
    layoutChanged.push(buildEntry(elementId, element));
  }

  const summary: ChangeSummary = {
    added,
    removed,
    modified,
    layoutChanged,
    definitionsMetadata: options?.definitionsMetadata ?? [],
    linterScoreChanges: options?.linterScoreChanges ?? [],
    customProperties: [],
  };

  const rawCp = options?.customProperties ?? [];
  if (rawCp.length > 0) {
    mergeCustomPropertyBlocksIntoSummary(summary, rawCp);
  }

  const callActivityExtensions = options?.callActivityExtensions ?? [];
  if (callActivityExtensions.length > 0) {
    mergeCallActivityExtensionBlocksIntoSummary(summary, callActivityExtensions);
  }

  return summary;
}

/** Looks up merged custom property deltas on any change bucket for an element id. */
export function getCustomPropertyChangesForElement(summary: ChangeSummary, elementId: string): CustomPropertyDelta[] {
  const lists: readonly ChangeSummaryEntry[][] = [
    summary.modified,
    summary.added,
    summary.removed,
    summary.layoutChanged,
  ];
  for (const list of lists) {
    const entry = list.find((e) => e.id === elementId);
    const cp = entry?.customPropertyChanges;
    if (cp != null && cp.length > 0) {
      return cp;
    }
  }
  return [];
}

/** Looks up Call Activity pin / start-event-id deltas merged onto modified attribute changes. */
export function getCallActivityExtensionChangesForElement(
  summary: ChangeSummary,
  elementId: string,
): AttributeChange[] {
  const modified = summary.modified.find((entry) => entry.id === elementId);
  if (modified == null) {
    return [];
  }
  return modified.attributeChanges.filter((change) =>
    (CALL_ACTIVITY_DIFF_ATTRIBUTE_LABELS as readonly string[]).includes(change.attribute),
  );
}

/**
 * Semantic diff summary plus definitions-root metadata and custom property deltas
 * (requires XML parse with bfw-platform moddle — same stack as {@link parseBpmnDefinitionsFromXml}).
 */
export async function buildAugmentedChangeSummary(
  rawDiff: RawDiffResult,
  beforeXml: string,
  afterXml: string,
): Promise<ChangeSummary> {
  const [defsBefore, defsAfter] = await Promise.all([
    parseBpmnDefinitionsFromXml(beforeXml),
    parseBpmnDefinitionsFromXml(afterXml),
  ]);

  const definitionsMetadata = diffDefinitionsMetadata(defsBefore, defsAfter);
  const customProperties = diffCustomPropertiesMaps(
    collectCustomPropertiesByElementId(defsBefore),
    collectCustomPropertiesByElementId(defsAfter),
  );
  const callActivityExtensions = diffCallActivityExtensionMaps(
    collectCallActivityExtensionsByElementId(defsBefore),
    collectCallActivityExtensionsByElementId(defsAfter),
  );

  let linterScoreChanges: LinterScoreChange[];
  try {
    linterScoreChanges = diffLinterScores(defsBefore, defsAfter);
  } catch (linterDiffError) {
    console.warn('[bpmn-diff] Linter score diffing failed:', linterDiffError);
    linterScoreChanges = [];
  }

  return buildChangeSummary(rawDiff, {
    definitionsMetadata,
    customProperties,
    callActivityExtensions,
    linterScoreChanges,
  });
}

export async function buildCustomPropertiesSummaryBetweenXml(
  beforeXml: string,
  afterXml: string,
): Promise<CustomPropertiesSummaryEntry[]> {
  const [defsBefore, defsAfter] = await Promise.all([
    parseBpmnDefinitionsFromXml(beforeXml),
    parseBpmnDefinitionsFromXml(afterXml),
  ]);
  return diffCustomPropertiesMaps(
    collectCustomPropertiesByElementId(defsBefore),
    collectCustomPropertiesByElementId(defsAfter),
  );
}

export async function buildDefinitionsMetadataBetweenXml(
  beforeXml: string,
  afterXml: string,
): Promise<DefinitionsMetadataChange[]> {
  const [defsBefore, defsAfter] = await Promise.all([
    parseBpmnDefinitionsFromXml(beforeXml),
    parseBpmnDefinitionsFromXml(afterXml),
  ]);
  return diffDefinitionsMetadata(defsBefore, defsAfter);
}

export async function buildLinterScoreChangesBetweenXml(
  beforeXml: string,
  afterXml: string,
): Promise<LinterScoreChange[]> {
  const [defsBefore, defsAfter] = await Promise.all([
    parseBpmnDefinitionsFromXml(beforeXml),
    parseBpmnDefinitionsFromXml(afterXml),
  ]);
  return diffLinterScores(defsBefore, defsAfter);
}

/** Display formatting for scalar values in change summaries (overview + markdown). */
export function formatSummaryValueForDisplay(value: string | undefined): string {
  if (value == null) {
    return '(none)';
  }
  if (value.includes('\n')) {
    return '(complex value)';
  }
  return `'${value}'`;
}

export function partitionCustomPropertyDeltas(changes: CustomPropertyDelta[]): {
  added: CustomPropertyDelta[];
  removed: CustomPropertyDelta[];
  changed: CustomPropertyDelta[];
} {
  const byName = (changeA: CustomPropertyDelta, changeB: CustomPropertyDelta): number =>
    changeA.propertyName.localeCompare(changeB.propertyName);
  return {
    added: changes.filter((change) => change.kind === 'added').sort(byName),
    removed: changes.filter((change) => change.kind === 'removed').sort(byName),
    changed: changes.filter((change) => change.kind === 'changed').sort(byName),
  };
}

function appendCustomPropertiesGroupedMarkdown(
  lines: string[],
  changes: CustomPropertyDelta[],
  baseIndent: string,
): void {
  if (changes.length === 0) {
    return;
  }
  const { added, removed, changed } = partitionCustomPropertyDeltas(changes);
  const indent1 = `${baseIndent}  `;
  const indent2 = `${baseIndent}    `;
  lines.push(`${baseIndent}- Custom properties:`);
  if (added.length > 0) {
    lines.push(`${indent1}- Added:`);
    for (const ch of added) {
      lines.push(`${indent2}- ${ch.propertyName}: ${formatSummaryValueForDisplay(ch.newValue)}`);
    }
  }
  if (removed.length > 0) {
    lines.push(`${indent1}- Removed:`);
    for (const ch of removed) {
      lines.push(`${indent2}- ${ch.propertyName}: ${formatSummaryValueForDisplay(ch.oldValue)}`);
    }
  }
  if (changed.length > 0) {
    lines.push(`${indent1}- Changed:`);
    for (const ch of changed) {
      lines.push(
        `${indent2}- ${ch.propertyName}: ${formatSummaryValueForDisplay(ch.oldValue)} → ${formatSummaryValueForDisplay(ch.newValue)}`,
      );
    }
  }
}

export function changeSummaryHasAnySemanticChange(summary: ChangeSummary): boolean {
  return (
    summary.added.length > 0 ||
    summary.removed.length > 0 ||
    summary.modified.length > 0 ||
    summary.layoutChanged.length > 0 ||
    summary.definitionsMetadata.length > 0 ||
    summary.linterScoreChanges.length > 0
  );
}

export function formatChangeSummaryAsMarkdown(
  summary: ChangeSummary,
  fileName: string,
  options?: { includeHeading?: boolean },
): string {
  const lines: string[] = [];
  if (options?.includeHeading !== false) {
    lines.push(`### Changes in ${fileName}\n`);
  }

  if (summary.definitionsMetadata.length > 0) {
    lines.push(`#### Definitions / file metadata (${summary.definitionsMetadata.length})`);
    for (const row of summary.definitionsMetadata) {
      lines.push(
        `  - ${row.label}: ${formatSummaryValueForDisplay(row.oldValue)} → ${formatSummaryValueForDisplay(row.newValue)}`,
      );
    }
    lines.push('');
  }

  if (summary.linterScoreChanges.length > 0) {
    lines.push(`#### Linter Scores (${summary.linterScoreChanges.length})`);
    for (const change of summary.linterScoreChanges) {
      let kindLabel = 'changed';
      if (change.kind === 'added') {
        kindLabel = 'added';
      } else if (change.kind === 'removed') {
        kindLabel = 'removed';
      }
      lines.push(`- Ruleset '${change.rulesetId}' (${kindLabel})`);
      for (const prop of change.propertyChanges) {
        lines.push(
          `  - ${prop.label}: ${formatSummaryValueForDisplay(prop.oldValue)} → ${formatSummaryValueForDisplay(prop.newValue)}`,
        );
      }
    }
    lines.push('');
  }

  if (summary.added.length > 0) {
    lines.push(`#### Added (${summary.added.length})`);
    for (const entry of summary.added) {
      lines.push(`- ${entry.displayName}`);
      appendCustomPropertiesGroupedMarkdown(lines, entry.customPropertyChanges ?? [], '  ');
    }
    lines.push('');
  }

  if (summary.removed.length > 0) {
    lines.push(`#### Removed (${summary.removed.length})`);
    for (const entry of summary.removed) {
      lines.push(`- ${entry.displayName}`);
      appendCustomPropertiesGroupedMarkdown(lines, entry.customPropertyChanges ?? [], '  ');
    }
    lines.push('');
  }

  if (summary.modified.length > 0) {
    lines.push(`#### Modified (${summary.modified.length})`);
    for (const entry of summary.modified) {
      lines.push(`- ${entry.displayName}`);
      for (const attr of entry.attributeChanges) {
        lines.push(
          `  - ${attr.attribute}: ${formatSummaryValueForDisplay(attr.oldValue)} → ${formatSummaryValueForDisplay(attr.newValue)}`,
        );
      }
      appendCustomPropertiesGroupedMarkdown(lines, entry.customPropertyChanges ?? [], '  ');
    }
    lines.push('');
  }

  if (summary.layoutChanged.length > 0) {
    lines.push(`#### Layout Changed (${summary.layoutChanged.length})`);
    for (const entry of summary.layoutChanged) {
      lines.push(`- ${entry.displayName}`);
      appendCustomPropertiesGroupedMarkdown(lines, entry.customPropertyChanges ?? [], '  ');
    }
    lines.push('');
  }

  if (!changeSummaryHasAnySemanticChange(summary)) {
    lines.push('No semantic changes detected.');
  }

  return lines.join('\n');
}
