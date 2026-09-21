import type { Bifrost } from '#bifrost/Bifrost';
import { BFW_LINTER_RULESET_SCORE_COMMAND } from '#modules/bpmn-core/bpmn-js/CommandHandler/UpdateBfwLinterRulesetScoreHandler';
import type BpmnDocumentModel from '#modules/bpmn-editor/BpmnDocumentModel';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';

import { LintEngine } from './LintEngine';
import { detectBpmnOrigin } from './detectBpmnOrigin';
import {
  applyLintEngineProfile,
  lintBpmnXmlOnDisk,
  readExistingScore,
  scoreMatchesExisting,
  snapshotToLinterScorePayload,
} from './lintOnDisk';
import { resolveScorePolicy } from './resolveScorePolicy';
import { computeLintScore } from './scoring/computeLintScore';
import type { CustomRulesetEntry, ModdleDefinitions, ModdleNode } from './types';

const NOTIFICATION_SOURCE = 'BPMN Linter';
const BPMN_EXTENSION = '.bpmn';

type LintFileOutcome = 'updated' | 'unchanged' | 'skipped-foreign' | 'failed';

export async function lintUris(bifrost: Bifrost, uris: string | string[] | undefined): Promise<void> {
  const input = normalizeUriList(uris);
  const bpmnUris = await collectBpmnUris(bifrost, input);

  if (bpmnUris.length === 0) {
    bifrost.notifications.open({
      type: 'info',
      content: 'No BPMN files found.',
      source: NOTIFICATION_SOURCE,
    });
    return;
  }

  const options = readLintSettings(bifrost);
  const counts: Record<LintFileOutcome, number> = {
    updated: 0,
    unchanged: 0,
    'skipped-foreign': 0,
    failed: 0,
  };

  for (const uri of bpmnUris) {
    try {
      const outcome = await lintSingleUri(bifrost, uri, options);
      counts[outcome] += 1;
    } catch (error) {
      console.error('[bpmn-linter] Explorer lint failed for', uri, error);
      counts.failed += 1;
    }
  }

  bifrost.notifications.open({
    type: notificationTypeForCounts(counts),
    content: formatLintSummary(bpmnUris.length, counts),
    source: NOTIFICATION_SOURCE,
  });
}

export async function lintSolution(bifrost: Bifrost): Promise<void> {
  const solution = bifrost.solution.getSolution();
  const projectUris = (solution?.projects ?? []).map((project) => project.baseUri).filter(Boolean);
  await lintUris(bifrost, projectUris);
}

function normalizeUriList(uris: string | string[] | undefined): string[] {
  if (uris == null) {
    return [];
  }
  if (Array.isArray(uris)) {
    return uris;
  }
  return [uris];
}

async function collectBpmnUris(bifrost: Bifrost, uris: string[]): Promise<string[]> {
  const unique = new Set<string>();

  for (const uri of uris) {
    if (!uri) {
      continue;
    }
    if (uri.toLowerCase().endsWith(BPMN_EXTENSION)) {
      unique.add(uri);
      continue;
    }
    const isDirectory = await bifrost.files.isDirectory(uri);
    if (!isDirectory) {
      continue;
    }
    const files = await bifrost.files.getAllFileUrisInDirectoryTree(uri);
    for (const fileUri of files) {
      if (fileUri.toLowerCase().endsWith(BPMN_EXTENSION)) {
        unique.add(fileUri);
      }
    }
  }

  return [...unique];
}

function readLintSettings(bifrost: Bifrost): {
  profileName: string;
  customRulesets: Record<string, CustomRulesetEntry>;
  alwaysLintForeignDiagrams: boolean;
} {
  return {
    profileName: (bifrost.settings.get('bpmnLinter.profile') as string | undefined) ?? 'bpmn-development',
    customRulesets:
      (bifrost.settings.get('bpmnLinter.customRulesets') as Record<string, CustomRulesetEntry> | undefined) ?? {},
    alwaysLintForeignDiagrams: bifrost.settings.get('bpmnLinter.alwaysLintForeignDiagrams') === true,
  };
}

async function lintSingleUri(
  bifrost: Bifrost,
  uri: string,
  options: ReturnType<typeof readLintSettings>,
): Promise<LintFileOutcome> {
  const openTabOutcome = await tryLintOpenBpmnTab(bifrost, uri, options);
  if (openTabOutcome != null) {
    return openTabOutcome;
  }
  return lintClosedFile(bifrost, uri, options);
}

async function tryLintOpenBpmnTab(
  bifrost: Bifrost,
  uri: string,
  options: ReturnType<typeof readLintSettings>,
): Promise<LintFileOutcome | null> {
  const services = getOpenBpmnModelerServices(bifrost, uri);
  if (!services) {
    return null;
  }

  const origin = detectBpmnOrigin(services.definitions);
  if (origin.origin !== 'bfw-engine' && !options.alwaysLintForeignDiagrams) {
    return 'skipped-foreign';
  }

  const engine = new LintEngine();
  applyLintEngineProfile(engine, options.profileName, options.customRulesets);
  const findings = await engine.lint(services.definitions, services.elementRegistry);
  const snapshot = computeLintScore({
    findings,
    elementRegistry: services.elementRegistry,
    rootElementId: services.rootShape?.id ?? null,
    scorePolicy: resolveScorePolicy(options.profileName, options.customRulesets),
  });
  const newScore = snapshotToLinterScorePayload(snapshot, options.profileName);
  const existingScore = readExistingScore(services.definitions, newScore.rulesetId);
  if (scoreMatchesExisting(newScore, existingScore)) {
    return 'unchanged';
  }

  services.commandStack.execute(BFW_LINTER_RULESET_SCORE_COMMAND, {
    element: services.rootShape,
    definitions: services.definitions,
    score: newScore,
    lintScoresSilent: true,
  });
  services.eventBus.fire('elements.changed', { elements: [services.rootShape] });
  return 'updated';
}

function getOpenBpmnModelerServices(
  bifrost: Bifrost,
  uri: string,
): {
  commandStack: { execute: (command: string, context: unknown) => void };
  elementRegistry: ElementRegistry;
  eventBus: { fire: (event: string, payload?: unknown) => void };
  rootShape: { id?: string; businessObject?: ModdleNode };
  definitions: ModdleDefinitions;
} | null {
  const document = bifrost.editors.getEditorDocumentByUri(uri);
  if (!document || document.documentType !== 'bpmn') {
    return null;
  }

  const model = bifrost.editors.getEditorDocumentModelIfPresent<BpmnDocumentModel>(document);
  if (!model?.modelerAdapter || !model.xmlLoaded) {
    return null;
  }

  try {
    const adapter = model.modelerAdapter;
    const commandStack = adapter.getCommandStack();
    const canvas = adapter.getCanvas();
    const elementRegistry = adapter.getElementRegistry();
    const eventBus = adapter.getModelerComponentByName<{ fire: (event: string, payload?: unknown) => void }>(
      'eventBus',
    );
    const rootShape = canvas.getRootElement();
    if (!commandStack || !canvas || !elementRegistry || !eventBus || !rootShape) {
      return null;
    }

    const definitions = getDefinitionsBusinessObject(rootShape);
    if (!definitions) {
      return null;
    }

    return { commandStack, elementRegistry, eventBus, rootShape, definitions };
  } catch {
    return null;
  }
}

function getDefinitionsBusinessObject(
  rootShape: { businessObject?: ModdleNode } | null | undefined,
): ModdleDefinitions | null {
  let businessObject: ModdleNode | undefined = rootShape?.businessObject;
  while (businessObject != null && businessObject.$type !== 'bpmn:Definitions') {
    businessObject = businessObject.$parent;
  }
  return (businessObject as unknown as ModdleDefinitions) ?? null;
}

async function lintClosedFile(
  bifrost: Bifrost,
  uri: string,
  options: ReturnType<typeof readLintSettings>,
): Promise<LintFileOutcome> {
  const xml = await bifrost.files.load(uri);
  const result = await lintBpmnXmlOnDisk(xml, options);
  if (result.status === 'skipped-foreign') {
    return 'skipped-foreign';
  }
  if (result.status === 'unchanged') {
    return 'unchanged';
  }
  await bifrost.files.save(uri, result.xml);
  return 'updated';
}

function notificationTypeForCounts(counts: Record<LintFileOutcome, number>): 'info' | 'warning' | 'error' {
  if (counts.failed > 0 && counts.updated === 0 && counts.unchanged === 0) {
    return 'error';
  }
  if (counts.failed > 0 || counts['skipped-foreign'] > 0) {
    return 'warning';
  }
  return 'info';
}

function formatLintSummary(total: number, counts: Record<LintFileOutcome, number>): string {
  const parts = [
    `Linted ${total} file${total === 1 ? '' : 's'}.`,
    `Updated: ${counts.updated}.`,
    `Unchanged: ${counts.unchanged}.`,
    `Skipped (foreign): ${counts['skipped-foreign']}.`,
    `Failed: ${counts.failed}.`,
  ];
  return parts.join(' ');
}
