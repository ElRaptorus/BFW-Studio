import { DEFINITIONS_METADATA_KEYS, DEFINITIONS_METADATA_LABELS } from './bpmnDiffConstants';

export type DefinitionsMetadataChange = {
  attribute: string;
  label: string;
  oldValue: string | undefined;
  newValue: string | undefined;
};

function stringifyMeta(value: unknown): string | undefined {
  if (value == null) {
    return undefined;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return undefined;
}

/**
 * Compares a fixed allowlist of attributes on the BPMN definitions root element.
 */
export function diffDefinitionsMetadata(definitionsBefore: any, definitionsAfter: any): DefinitionsMetadataChange[] {
  const result: DefinitionsMetadataChange[] = [];

  for (const key of DEFINITIONS_METADATA_KEYS) {
    const oldValue = stringifyMeta(definitionsBefore?.[key]);
    const newValue = stringifyMeta(definitionsAfter?.[key]);

    if (oldValue === newValue) {
      continue;
    }

    result.push({
      attribute: key,
      label: DEFINITIONS_METADATA_LABELS[key] ?? key,
      oldValue,
      newValue,
    });
  }

  return result;
}
