import type { ModelChangeDigest } from '#bifrost/contracts/SourceControlTypes';

/**
 * The part of a BPMN or DMN change summary that the digest needs.
 * `ChangeSummary` and `DmnChangeSummary` both satisfy it structurally.
 */
type ModelChangeSummaryLike = {
  added: { displayName: string }[];
  removed: { displayName: string }[];
  modified: { displayName: string }[];
  layoutChanged: unknown[];
  definitionsMetadata?: unknown[];
  linterScoreChanges?: unknown[];
};

const NAMED_XML_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decodeXmlEntities(value: string): string {
  return value.replace(
    /&(?:#x([0-9a-f]+)|#(\d+)|(amp|lt|gt|quot|apos));/gi,
    (match, hexadecimalCode?: string, decimalCode?: string, entityName?: string) => {
      if (hexadecimalCode != null) {
        return String.fromCodePoint(parseInt(hexadecimalCode, 16));
      }
      if (decimalCode != null) {
        return String.fromCodePoint(parseInt(decimalCode, 10));
      }
      return NAMED_XML_ENTITIES[entityName!.toLowerCase()] ?? match;
    },
  );
}

/** The `name` attribute of the first `<rootElementName>` tag (any namespace prefix); blank or missing → `null`. */
function extractModelName(xml: string, rootElementName: 'process' | 'definitions'): string | null {
  const rootMatch = xml.match(new RegExp(`<(?:[\\w-]+:)?${rootElementName}\\b[^>]*>`));
  const nameMatch = rootMatch?.[0].match(/\sname="([^"]*)"/);
  return nameMatch != null && nameMatch[1].trim() !== '' ? decodeXmlEntities(nameMatch[1]) : null;
}

function buildModelChangeDigest(summary: ModelChangeSummaryLike, modelName: string | null): ModelChangeDigest {
  return {
    fileChange: 'modified',
    modelName,
    addedElementNames: summary.added.map((entry) => entry.displayName),
    removedElementNames: summary.removed.map((entry) => entry.displayName),
    modifiedElementNames: summary.modified.map((entry) => entry.displayName),
    layoutChangedCount: summary.layoutChanged.length,
    fileDetailsChanged: (summary.definitionsMetadata?.length ?? 0) + (summary.linterScoreChanges?.length ?? 0) > 0,
  };
}

function buildWholeModelDigest(fileChange: 'added' | 'deleted', modelName: string | null): ModelChangeDigest {
  return {
    fileChange,
    modelName,
    addedElementNames: [],
    removedElementNames: [],
    modifiedElementNames: [],
    layoutChangedCount: 0,
    fileDetailsChanged: false,
  };
}

/**
 * Builds the digest for a before/after pair of model sources. A `null` side means the file did not exist
 * on that side, so no diff is computed. The model name is the `name` of the `rootElementName` element
 * (`process` for BPMN, `definitions` for DMN) of the present side, the after side when both exist.
 *
 * @throws If both sides are `null`, or if `computeSummary` throws (e.g. for unparsable XML).
 */
export async function buildModelChangeDigestForXmlPair(
  beforeXml: string | null,
  afterXml: string | null,
  rootElementName: 'process' | 'definitions',
  computeSummary: (beforeXml: string, afterXml: string) => Promise<ModelChangeSummaryLike>,
): Promise<ModelChangeDigest> {
  if (beforeXml == null && afterXml == null) {
    throw new Error('Cannot build a change digest: neither a before nor an after version was given.');
  }

  if (beforeXml == null) {
    return buildWholeModelDigest('added', extractModelName(afterXml!, rootElementName));
  }

  if (afterXml == null) {
    return buildWholeModelDigest('deleted', extractModelName(beforeXml, rootElementName));
  }

  const summary = await computeSummary(beforeXml, afterXml);

  return buildModelChangeDigest(summary, extractModelName(afterXml, rootElementName));
}
