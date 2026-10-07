import type { Bifrost } from '#bifrost/Bifrost';
import { sha256Hex } from '#bifrost/common/HashFunctions';

import type { BpmnProcess, FlowNode } from '@elraptorus/bfw_engine_sdk';
import { parseBpmn } from '@elraptorus/bfw_engine_sdk';

import type { BfwLinterRulesetScorePayload } from './bpmn-js/CommandHandler/UpdateBfwLinterRulesetScoreHandler';

/** A `bfw:linterRulesetScore` as stored in the file; every value is the attribute text. */
export type StoredLinterScore = BfwLinterRulesetScorePayload;

export type SolutionCallActivityEntry = {
  id: string;
  calledElement: string | null;
  calledProcessVersion: string | null;
};

export type SolutionProcessEntry = {
  id: string;
  name: string | null;
  version: string | null;
  isExecutable: boolean;
  /** Includes call activities nested in subprocesses. */
  callActivities: SolutionCallActivityEntry[];
  /** `bfw:decisionRef` of every Business Rule Task, including nested ones. */
  decisionRefs: string[];
};

export type SolutionBpmnModelEntry =
  | {
      kind: 'bpmn';
      uri: string;
      sha256: string;
      processes: SolutionProcessEntry[];
      storedLinterScores: StoredLinterScore[];
    }
  | { kind: 'invalid'; uri: string; error: string };

const SCORE_ELEMENT_PATTERN = /<(?:[\w-]+:)?linterRulesetScore\b([^>]*?)\/?>/g;
const ATTRIBUTE_PATTERN = /([\w:-]+)="([^"]*)"/g;
/**
 * ponytail: only checks that a `definitions` root opens and closes the file; mismatched tags inside a complete root
 * are not detected, because the SDK parsers do not validate. The upgrade path is a validating XML parser once one is a
 * declared dependency.
 */
const DEFINITIONS_ROOT_PATTERN = /<(?:[\w-]+:)?definitions[\s>][\s\S]*<\/(?:[\w-]+:)?definitions\s*>\s*$/;

/**
 * Reads the definitions-level `bfw:linterRulesetScore` elements the Studio writes.
 *
 * ponytail: a text scan, not an XML parse. It decodes neither single-quoted attributes nor XML entities, which is
 * fine for what the Studio's serializer writes (double quotes; numbers, ids, ISO timestamps). The upgrade path is a
 * real XML parser once one is a declared dependency; `DOMParser` is not available in the Node unit tests.
 */
function readStoredLinterScores(xml: string): StoredLinterScore[] {
  const scores: StoredLinterScore[] = [];
  for (const elementMatch of xml.matchAll(SCORE_ELEMENT_PATTERN)) {
    const attributes: Record<string, string> = {};
    for (const attributeMatch of elementMatch[1].matchAll(ATTRIBUTE_PATTERN)) {
      attributes[attributeMatch[1]] = attributeMatch[2];
    }
    if (attributes.rulesetId == null || attributes.rulesetId === '') {
      continue;
    }
    scores.push({
      rulesetId: attributes.rulesetId,
      scorePercent: attributes.scorePercent ?? '',
      complianceStatus: attributes.complianceStatus ?? '',
      computedAtIso: attributes.computedAtIso ?? '',
      schemaVersion: attributes.schemaVersion ?? '',
      maxPoints: attributes.maxPoints ?? '',
      penaltyPoints: attributes.penaltyPoints ?? '',
      rawErrorFindings: attributes.rawErrorFindings ?? '',
      rawWarningFindings: attributes.rawWarningFindings ?? '',
    });
  }
  return scores;
}

function collectReferences(
  flowNodes: FlowNode[],
  callActivities: SolutionCallActivityEntry[],
  decisionRefs: string[],
): void {
  for (const flowNode of flowNodes) {
    const typeData = flowNode.typeData;
    if (typeData.type === 'call_activity') {
      callActivities.push({
        id: flowNode.id,
        calledElement: typeData.calledElement,
        calledProcessVersion: typeData.calledProcessVersion,
      });
    } else if (typeData.type === 'business_rule_task') {
      if (typeData.decisionRef != null && typeData.decisionRef !== '') {
        decisionRefs.push(typeData.decisionRef);
      }
    } else if (typeData.type === 'sub_process') {
      collectReferences(typeData.flowNodes, callActivities, decisionRefs);
    }
  }
}

function toProcessEntry(process: BpmnProcess): SolutionProcessEntry {
  const callActivities: SolutionCallActivityEntry[] = [];
  const decisionRefs: string[] = [];
  collectReferences(process.flowNodes, callActivities, decisionRefs);
  return {
    id: process.id,
    name: process.name,
    version: process.version,
    isExecutable: process.isExecutable,
    callActivities,
    decisionRefs,
  };
}

/**
 * Reads and parses every included `.bpmn` file of the open solution, sorted by URI. A file that cannot be read or
 * parsed becomes an `invalid` entry and does not stop the scan.
 *
 * ponytail: no cache, so every call re-reads every file and the cost grows with the file count. The upgrade path is a
 * cache invalidated on save and on solution change.
 */
export async function scanSolutionBpmnModels(bifrost: Bifrost): Promise<SolutionBpmnModelEntry[]> {
  const uris = await bifrost.solution.listIncludedFileUris(/\.bpmn$/i);
  const entries = await Promise.all(
    uris.map(async (uri): Promise<SolutionBpmnModelEntry> => {
      try {
        const text = await bifrost.files.load(uri);
        if (!DEFINITIONS_ROOT_PATTERN.test(text)) {
          return { kind: 'invalid', uri, error: 'The file has no complete <definitions> root element.' };
        }
        return {
          kind: 'bpmn',
          uri,
          sha256: await sha256Hex(text),
          processes: parseBpmn(text).processes.map(toProcessEntry),
          storedLinterScores: readStoredLinterScores(text),
        };
      } catch (error) {
        return { kind: 'invalid', uri, error: error instanceof Error ? error.message : String(error) };
      }
    }),
  );
  return entries.sort((first, second) => first.uri.localeCompare(second.uri));
}
