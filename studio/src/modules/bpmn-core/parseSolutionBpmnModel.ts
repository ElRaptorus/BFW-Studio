import type { BpmnDefinitions, BpmnProcess, FlowNode } from '@elraptorus/bfw_engine_sdk';
import { parseBpmn } from '@elraptorus/bfw_engine_sdk';

import type {
  SolutionBpmnModelEntry,
  SolutionCallActivityEntry,
  SolutionEventNameEntry,
  SolutionProcessEntry,
  StoredLinterScore,
} from './scanSolutionBpmnModels';

/** One file sent to the scan worker. */
export type BpmnModelScanFile = { uri: string; text: string; sha256: string };
export type BpmnModelScanRequest = { requestId: number; files: BpmnModelScanFile[] };
export type BpmnModelScanResponse = { requestId: number; entries: SolutionBpmnModelEntry[] };

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

type ProcessReferences = Omit<SolutionProcessEntry, 'id' | 'name' | 'version' | 'isExecutable'>;
type NameLookup = { messages: Map<string, string>; signals: Map<string, string> };

/** Maps definition ids to names; a blank name is left out, because the Engine never routes by it. */
function namesById(definitions: { id: string; name: string | null }[]): Map<string, string> {
  const names = new Map<string, string>();
  for (const definition of definitions) {
    if (definition.name != null && definition.name.trim() !== '') {
      names.set(definition.id, definition.name);
    }
  }
  return names;
}

function addName(
  entries: SolutionEventNameEntry[],
  names: Map<string, string>,
  flowNodeId: string,
  reference: string | null,
): void {
  const name = reference == null ? undefined : names.get(reference);
  if (name != null) {
    entries.push({ flowNodeId, name });
  }
}

function collectEventNames(flowNode: FlowNode, lookup: NameLookup, references: ProcessReferences): void {
  const typeData = flowNode.typeData;
  if (typeData.type === 'send_task') {
    addName(references.thrownMessages, lookup.messages, flowNode.id, typeData.messageRef);
    return;
  }
  if (typeData.type === 'receive_task') {
    addName(references.caughtMessages, lookup.messages, flowNode.id, typeData.messageRef);
    return;
  }
  if (!('eventDefinition' in typeData)) {
    return;
  }
  const throwing = typeData.type === 'end_event' || typeData.type === 'intermediate_throw_event';
  const eventDefinition = typeData.eventDefinition;
  if (eventDefinition.type === 'message') {
    const entries = throwing ? references.thrownMessages : references.caughtMessages;
    addName(entries, lookup.messages, flowNode.id, eventDefinition.messageRef);
  } else if (eventDefinition.type === 'signal') {
    const entries = throwing ? references.thrownSignals : references.caughtSignals;
    addName(entries, lookup.signals, flowNode.id, eventDefinition.signalRef);
  }
}

function collectReferences(flowNodes: FlowNode[], lookup: NameLookup, references: ProcessReferences): void {
  for (const flowNode of flowNodes) {
    const typeData = flowNode.typeData;
    if (typeData.type === 'call_activity') {
      references.callActivities.push({
        id: flowNode.id,
        calledElement: typeData.calledElement,
        calledProcessVersion: typeData.calledProcessVersion,
      } satisfies SolutionCallActivityEntry);
    } else if (typeData.type === 'business_rule_task') {
      if (typeData.decisionRef != null && typeData.decisionRef !== '') {
        references.decisionRefs.push(typeData.decisionRef);
      }
    } else if (typeData.type === 'sub_process') {
      collectReferences(typeData.flowNodes, lookup, references);
    } else {
      collectEventNames(flowNode, lookup, references);
    }
  }
}

function toProcessEntry(process: BpmnProcess, lookup: NameLookup): SolutionProcessEntry {
  const references: ProcessReferences = {
    callActivities: [],
    decisionRefs: [],
    thrownMessages: [],
    caughtMessages: [],
    thrownSignals: [],
    caughtSignals: [],
  };
  collectReferences(process.flowNodes, lookup, references);
  return {
    id: process.id,
    name: process.name,
    version: process.version,
    isExecutable: process.isExecutable,
    ...references,
  };
}

/** Parses one saved BPMN file into its solution scan entry; never throws. */
export function parseSolutionBpmnModel(file: BpmnModelScanFile): SolutionBpmnModelEntry {
  const { uri, text, sha256 } = file;
  if (!DEFINITIONS_ROOT_PATTERN.test(text)) {
    return { kind: 'invalid', uri, error: 'The file has no complete <definitions> root element.' };
  }
  try {
    const definitions: BpmnDefinitions = parseBpmn(text);
    const lookup: NameLookup = { messages: namesById(definitions.messages), signals: namesById(definitions.signals) };
    return {
      kind: 'bpmn',
      uri,
      sha256,
      processes: definitions.processes.map((process) => toProcessEntry(process, lookup)),
      storedLinterScores: readStoredLinterScores(text),
    };
  } catch (error) {
    return { kind: 'invalid', uri, error: error instanceof Error ? error.message : String(error) };
  }
}
