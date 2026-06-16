export type DmnChangeSummaryEntry = {
  id: string;
  type: string;
  label: string;
  displayName: string;
};

export type DmnAttributeChange = {
  attribute: string;
  oldValue: string | undefined;
  newValue: string | undefined;
};

export type DmnModifiedEntry = DmnChangeSummaryEntry & {
  attributeChanges: DmnAttributeChange[];
};

export type DmnChangeSummary = {
  added: DmnChangeSummaryEntry[];
  removed: DmnChangeSummaryEntry[];
  modified: DmnModifiedEntry[];
  layoutChanged: DmnChangeSummaryEntry[];
};

export type DmnRawDiffResult = {
  added: Record<string, any>;
  removed: Record<string, any>;
  updated: Record<string, any>;
  layoutChanged: Record<string, any>;
};

const DMN_TYPE_LABELS: Record<string, string> = {
  'dmn:Decision': 'Decision',
  'dmn:InputData': 'Input Data',
  'dmn:BusinessKnowledgeModel': 'Business Knowledge Model',
  'dmn:KnowledgeSource': 'Knowledge Source',
  'dmn:DecisionService': 'Decision Service',
};

const DMN_ATTRIBUTE_LABELS: Record<string, string> = {
  name: 'Name',
  $type: 'Type',
  expression: 'Expression',
  requirements: 'Requirements',
  composition: 'Service Composition',
  'variable.name': 'Variable Name',
  'variable.typeRef': 'Variable Type',
};

export function formatDmnType(dmnType: string): string {
  return DMN_TYPE_LABELS[dmnType] ?? dmnType.replace(/^dmn:/, '');
}

function formatElementDisplayName(element: any): { type: string; label: string; displayName: string } {
  const $type = element.$type ?? element.change?.$type ?? 'Element';
  const type = formatDmnType($type);
  const name = element.name ?? element.change?.name;

  if (name) {
    return { type, label: `'${name}'`, displayName: `${type} '${name}'` };
  }
  const id = element.id ?? element.change?.id ?? 'unknown';
  return { type, label: `(${id})`, displayName: `${type} (${id})` };
}

function buildEntry(elementId: string, element: any): DmnChangeSummaryEntry {
  const { type, label, displayName } = formatElementDisplayName(element);
  return { id: elementId, type, label, displayName };
}

export function resolveAttributeLabel(attributeName: string): string {
  return (
    DMN_ATTRIBUTE_LABELS[attributeName] ??
    attributeName
      .split(/[._]/)
      .map((part) => part.charAt(0).toUpperCase() + part.substring(1))
      .join(' ')
  );
}

function stringifyValue(value: any): string | undefined {
  if (value == null) {
    return undefined;
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

export function buildDmnChangeSummary(raw: DmnRawDiffResult): DmnChangeSummary {
  const added: DmnChangeSummaryEntry[] = [];
  const removed: DmnChangeSummaryEntry[] = [];
  const modified: DmnModifiedEntry[] = [];
  const layoutChanged: DmnChangeSummaryEntry[] = [];

  for (const [id, changes] of Object.entries(raw.added)) {
    const element = Array.isArray(changes) ? (changes[0]?.change ?? changes[0]) : changes;
    added.push(buildEntry(id, element));
  }

  for (const [id, changes] of Object.entries(raw.removed)) {
    const element = Array.isArray(changes) ? (changes[0]?.change ?? changes[0]) : changes;
    removed.push(buildEntry(id, element));
  }

  for (const [id, changes] of Object.entries(raw.updated)) {
    const changeData = Array.isArray(changes) ? changes[0] : changes;
    const model = changeData?.change?.model ?? changeData?.change ?? changeData;
    const attrs = changeData?.change?.attrs ?? {};
    const entry = buildEntry(id, model);
    const attributeChanges: DmnAttributeChange[] = [];

    for (const [attrName, values] of Object.entries(attrs) as [string, any][]) {
      attributeChanges.push({
        attribute: resolveAttributeLabel(attrName),
        oldValue: stringifyValue(values.oldValue),
        newValue: stringifyValue(values.newValue),
      });
    }

    modified.push({ ...entry, attributeChanges });
  }

  for (const [id, changes] of Object.entries(raw.layoutChanged)) {
    const element = Array.isArray(changes) ? (changes[0]?.change ?? changes[0]) : changes;
    layoutChanged.push(buildEntry(id, element));
  }

  return { added, removed, modified, layoutChanged };
}

export function dmnChangeSummaryHasAnyChange(summary: DmnChangeSummary): boolean {
  return (
    summary.added.length > 0 ||
    summary.removed.length > 0 ||
    summary.modified.length > 0 ||
    summary.layoutChanged.length > 0
  );
}

function formatValueForDisplay(value: string | undefined): string {
  if (value == null) {
    return '(none)';
  }
  if (value.includes('\n')) {
    return '(complex value)';
  }
  return `'${value}'`;
}

export function formatDmnChangeSummaryAsMarkdown(
  summary: DmnChangeSummary,
  fileName: string,
  options?: { includeHeading?: boolean },
): string {
  const lines: string[] = [];
  if (options?.includeHeading !== false) {
    lines.push(`### Changes in ${fileName}\n`);
  }

  if (summary.added.length > 0) {
    lines.push(`#### Added (${summary.added.length})`);
    for (const entry of summary.added) {
      lines.push(`- ${entry.displayName}`);
    }
    lines.push('');
  }

  if (summary.removed.length > 0) {
    lines.push(`#### Removed (${summary.removed.length})`);
    for (const entry of summary.removed) {
      lines.push(`- ${entry.displayName}`);
    }
    lines.push('');
  }

  if (summary.modified.length > 0) {
    lines.push(`#### Modified (${summary.modified.length})`);
    for (const entry of summary.modified) {
      lines.push(`- ${entry.displayName}`);
      for (const attr of entry.attributeChanges) {
        lines.push(
          `  - ${attr.attribute}: ${formatValueForDisplay(attr.oldValue)} → ${formatValueForDisplay(attr.newValue)}`,
        );
      }
    }
    lines.push('');
  }

  if (summary.layoutChanged.length > 0) {
    lines.push(`#### Layout Changed (${summary.layoutChanged.length})`);
    for (const entry of summary.layoutChanged) {
      lines.push(`- ${entry.displayName}`);
    }
    lines.push('');
  }

  if (!dmnChangeSummaryHasAnyChange(summary)) {
    lines.push('No semantic changes detected.');
  }

  return lines.join('\n');
}
