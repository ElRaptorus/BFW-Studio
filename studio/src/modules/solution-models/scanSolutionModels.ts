import type { FileHandlingService } from '#bifrost/common/FileHandlingService';
import { isUriIncludedInSolution } from '#bifrost/common/SolutionFunctions';
import type { Solution } from '#bifrost/contracts/SolutionTypes';

import type { BpmnProcess, FlowNode } from '@elraptorus/bfw_engine_sdk';
import { parseBpmn, parseDmn } from '@elraptorus/bfw_engine_sdk';

import type {
  SolutionCallActivityEntry,
  SolutionDmnElement,
  SolutionModelEntry,
  SolutionProcessEntry,
  StoredLinterScore,
} from './types';

const MODEL_FILE_PATTERN = /\.(bpmn|dmn)$/i;
const SCORE_ELEMENT_PATTERN = /<(?:[\w-]+:)?linterRulesetScore\b([^>]*?)\/?>/g;
const ATTRIBUTE_PATTERN = /([\w:-]+)="([^"]*)"/g;
/**
 * ponytail: only checks that a `definitions` root opens and closes the file; mismatched tags inside a complete root
 * are not detected, because the SDK parsers do not validate. The upgrade path is a validating XML parser once one is a
 * declared dependency.
 */
const DEFINITIONS_ROOT_PATTERN = /<(?:[\w-]+:)?definitions[\s>][\s\S]*<\/(?:[\w-]+:)?definitions\s*>\s*$/;

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Reads the definitions-level `bfw:linterRulesetScore` elements the Studio writes.
 *
 * ponytail: a text scan, not an XML parse. It decodes neither single-quoted attributes nor XML entities, which is
 * fine for what the Studio's serializer writes (double quotes; numbers, ids, ISO timestamps). The upgrade path is a
 * real XML parser once one is a declared dependency; `DOMParser` is not available in the Node unit tests.
 */
export function readStoredLinterScores(xml: string): StoredLinterScore[] {
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

async function toEntry(uri: string, text: string): Promise<SolutionModelEntry> {
  if (!DEFINITIONS_ROOT_PATTERN.test(text)) {
    return { kind: 'invalid', uri, error: 'The file has no complete <definitions> root element.' };
  }
  const sha256 = await sha256Hex(text);
  if (uri.toLowerCase().endsWith('.dmn')) {
    const definitions = parseDmn(text);
    const toElements = (items: { id: string; name: string | null }[]): SolutionDmnElement[] =>
      items.map((item) => ({ id: item.id, name: item.name }));
    return {
      kind: 'dmn',
      uri,
      sha256,
      definitionsId: definitions.id,
      namespace: definitions.namespace,
      elements: {
        decisions: toElements(definitions.decisions),
        businessKnowledgeModels: toElements(definitions.businessKnowledgeModels),
        inputData: toElements(definitions.inputData),
      },
    };
  }
  return {
    kind: 'bpmn',
    uri,
    sha256,
    processes: parseBpmn(text).processes.map(toProcessEntry),
    storedLinterScores: readStoredLinterScores(text),
  };
}

/**
 * Reads and parses every `.bpmn` and `.dmn` file of the solution, sorted by URI. A file that cannot be read or parsed
 * becomes an `invalid` entry and does not stop the scan.
 *
 * ponytail: no cache, so every call re-reads every file and the cost grows with the file count. The upgrade path is a
 * cache invalidated on save and on solution change.
 */
export async function scanSolutionModels(
  solution: Solution,
  files: FileHandlingService,
): Promise<SolutionModelEntry[]> {
  const uris = new Set<string>();
  for (const project of solution.projects) {
    await files.traverseProject(project, async (fileOrDirectory) => {
      if (
        fileOrDirectory.type === 'file' &&
        MODEL_FILE_PATTERN.test(fileOrDirectory.uri) &&
        isUriIncludedInSolution(solution, fileOrDirectory.uri)
      ) {
        uris.add(fileOrDirectory.uri);
      }
      return fileOrDirectory;
    });
  }

  const entries = await Promise.all(
    [...uris].map(async (uri): Promise<SolutionModelEntry> => {
      try {
        return await toEntry(uri, await files.load(uri));
      } catch (error) {
        return { kind: 'invalid', uri, error: error instanceof Error ? error.message : String(error) };
      }
    }),
  );
  return entries.sort((first, second) => first.uri.localeCompare(second.uri));
}
