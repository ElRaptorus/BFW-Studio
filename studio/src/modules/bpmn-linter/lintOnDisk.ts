import type { EvilLinterRulesetScorePayload } from '#modules/bpmn-core/bpmn-js/CommandHandler/UpdateEvilLinterRulesetScoreHandler';
import { createBpmnModdleForDiff } from '#modules/bpmn-core/diff/bpmnModdleForDiff';

import { LintEngine } from './LintEngine';
import { detectBpmnOrigin } from './detectBpmnOrigin';
import { resolveScorePolicy } from './resolveScorePolicy';
import { computeLintScore } from './scoring/computeLintScore';
import type { CustomRulesetEntry, LintScoreSnapshot, ModdleDefinitions, RuleSeverityConfig } from './types';

const BFR_PROPERTIES_TYPE = 'evil:Properties';
const BFR_LINTER_SCORE_TYPE = 'evil:LinterRulesetScore';
const BPMN_EXTENSION_ELEMENTS = 'bpmn:ExtensionElements';

const SCORE_COMPARISON_KEYS: readonly (keyof EvilLinterRulesetScorePayload)[] = [
  'rulesetId',
  'scorePercent',
  'complianceStatus',
  'schemaVersion',
  'maxPoints',
  'penaltyPoints',
  'rawErrorFindings',
  'rawWarningFindings',
];

export type LintOnDiskOptions = {
  profileName: string;
  customRulesets: Record<string, CustomRulesetEntry>;
  alwaysLintForeignDiagrams: boolean;
};

export type LintOnDiskResult =
  { status: 'skipped-foreign' } | { status: 'unchanged'; xml: string } | { status: 'updated'; xml: string };

type ModdleLike = {
  create: (type: string, properties?: Record<string, unknown>) => any;
  fromXML: (xml: string) => Promise<{ rootElement: any }>;
  toXML: (element: any, options?: { format?: boolean }) => Promise<{ xml: string }>;
};

/**
 * Applies the same profile / custom-ruleset resolution as LintBridge.applyProfile.
 */
export function applyLintEngineProfile(
  engine: LintEngine,
  profileName: string,
  customRulesets: Record<string, CustomRulesetEntry>,
): void {
  const customRuleset = customRulesets[profileName];
  if (customRuleset && typeof customRuleset === 'object') {
    const base = customRuleset.base ?? 'bpmn-development';
    const overrides: Record<string, RuleSeverityConfig> = {};
    const rules = customRuleset.rules;
    if (rules && typeof rules === 'object') {
      for (const [ruleId, severity] of Object.entries(rules)) {
        if (typeof severity === 'string') {
          overrides[ruleId] = severity;
        }
      }
    }
    engine.setProfile(base);
    engine.setRuleOverrides(overrides);
    return;
  }

  engine.setProfile(profileName);
  engine.setRuleOverrides({});
}

export function snapshotToLinterScorePayload(
  snapshot: LintScoreSnapshot,
  rulesetId: string,
  computedAtIso: string = new Date().toISOString(),
): EvilLinterRulesetScorePayload {
  return {
    rulesetId,
    scorePercent: String(snapshot.scorePercent),
    complianceStatus: snapshot.complianceStatus,
    computedAtIso,
    schemaVersion: String(snapshot.schemaVersion),
    maxPoints: String(snapshot.maxPoints),
    penaltyPoints: String(snapshot.penaltyPoints),
    rawErrorFindings: String(snapshot.rawFindingErrors),
    rawWarningFindings: String(snapshot.rawFindingWarnings),
  };
}

export function readExistingScore(definitions: ModdleDefinitions, rulesetId: string): Record<string, string> | null {
  const extensionElements = definitions.extensionElements as { values?: unknown[] } | undefined;
  const values = extensionElements?.values;
  if (!Array.isArray(values)) {
    return null;
  }
  const evilProps = values.find((val: unknown) => (val as { $type?: string }).$type === BFR_PROPERTIES_TYPE) as
    { linterRulesetScores?: unknown[] } | undefined;
  const scores = evilProps?.linterRulesetScores;
  if (!Array.isArray(scores)) {
    return null;
  }
  type ModdleEntry = Record<string, unknown> & { get?(prop: string): unknown };
  const entry = scores.find((score: unknown) => {
    const obj = score as ModdleEntry;
    return (obj.get?.('rulesetId') ?? obj.rulesetId) === rulesetId;
  }) as ModdleEntry | undefined;
  if (!entry) {
    return null;
  }
  const result: Record<string, string> = {};
  for (const key of SCORE_COMPARISON_KEYS) {
    result[key] = String(entry.get?.(key) ?? entry[key] ?? '');
  }
  return result;
}

export function scoreMatchesExisting(
  newScore: EvilLinterRulesetScorePayload,
  existing: Record<string, string> | null,
): boolean {
  if (!existing) {
    return false;
  }
  return SCORE_COMPARISON_KEYS.every((key) => String(newScore[key]) === existing[key]);
}

export type DiskScoreRegistry = {
  getAll: () => unknown[];
  get: (id: string) => unknown | undefined;
  rootElementId: string | null;
};

/**
 * Canvas-equivalent elementRegistry for closed-file scoring.
 *
 * Live lint denominators come from bpmn-js `elementRegistry.getAll()` plus
 * `canvas.getRootElement().id` (the DI plane's `bpmnElement` — Collaboration or
 * Process — never `bpmn:Definitions`). A full moddle walk over-counts structural
 * nodes that have no canvas shape (`bpmn:Collaboration`, `bpmn:Process`,
 * `bpmn:LaneSet`), which made Explorer `maxPoints` diverge from the Live Linter
 * (e.g. 12 vs 9 on a pool+lane diagram) and dirty the file on first open.
 *
 * Prefer BPMNDI shape/edge `bpmnElement` refs. If the file has no DI, fall back
 * to semantic nodes excluding those structural containers, with the same root id.
 */
export function buildModdleElementRegistry(definitions: unknown): DiskScoreRegistry {
  const semanticById = indexSemanticBpmnNodes(definitions);
  const fromDi = collectDiReferencedElements(definitions, semanticById);
  const elements = fromDi.elements.length > 0 ? fromDi.elements : collectFallbackCanvasElements(semanticById);
  const rootElementId = fromDi.rootElementId ?? inferCanvasRootElementId(definitions, semanticById);
  const byId = new Map(elements.map((element) => [element.id, element]));
  return {
    getAll: () => elements,
    get: (id: string) => byId.get(id),
    rootElementId,
  };
}

export function upsertLinterRulesetScoreOnDefinitions(
  definitions: any,
  score: EvilLinterRulesetScorePayload,
  moddle: { create: (type: string, properties?: Record<string, unknown>) => any },
): void {
  if (definitions == null || score?.rulesetId == null) {
    return;
  }

  let extensionElements = typeof definitions.get === 'function' ? definitions.get('extensionElements') : undefined;
  if (extensionElements == null) {
    extensionElements = definitions.extensionElements;
  }
  if (extensionElements == null) {
    extensionElements = moddle.create(BPMN_EXTENSION_ELEMENTS, { values: [] });
    extensionElements.$parent = definitions;
    if (typeof definitions.set === 'function') {
      definitions.set('extensionElements', extensionElements);
    } else {
      definitions.extensionElements = extensionElements;
    }
  }

  let values: any[] = extensionElements.get?.('values') ?? extensionElements.values;
  if (values == null) {
    values = [];
    if (typeof extensionElements.set === 'function') {
      extensionElements.set('values', values);
    } else {
      extensionElements.values = values;
    }
  }

  let evilProps = values.find((value: any) => value.$type === BFR_PROPERTIES_TYPE);
  if (evilProps == null) {
    evilProps = moddle.create(BFR_PROPERTIES_TYPE, { linterRulesetScores: [] });
    evilProps.$parent = extensionElements;
    values.push(evilProps);
    if (typeof extensionElements.set === 'function') {
      extensionElements.set('values', values);
    } else {
      extensionElements.values = values;
    }
  }

  let scores: any[] = evilProps.get?.('linterRulesetScores') ?? evilProps.linterRulesetScores ?? [];
  if (!Array.isArray(scores)) {
    scores = [];
  }

  const existing = scores.find(
    (entry: any) => entry.get?.('rulesetId') === score.rulesetId || entry.rulesetId === score.rulesetId,
  );

  const next = moddle.create(BFR_LINTER_SCORE_TYPE, {
    rulesetId: score.rulesetId,
    scorePercent: score.scorePercent,
    complianceStatus: score.complianceStatus,
    computedAtIso: score.computedAtIso,
    schemaVersion: score.schemaVersion,
    maxPoints: score.maxPoints,
    penaltyPoints: score.penaltyPoints,
    rawErrorFindings: score.rawErrorFindings,
    rawWarningFindings: score.rawWarningFindings,
  });
  next.$parent = evilProps;

  if (existing) {
    const idx = scores.indexOf(existing);
    const copy = [...scores];
    copy[idx] = next;
    scores = copy;
  } else {
    scores = [...scores, next];
  }

  if (typeof evilProps.set === 'function') {
    evilProps.set('linterRulesetScores', scores);
  } else {
    evilProps.linterRulesetScores = scores;
  }
}

/**
 * Parse BPMN XML, run LintEngine, and upsert evil:LinterRulesetScore. Private helper
 * for Explorer lint of closed files — not a public extraction API.
 */
export async function lintBpmnXmlOnDisk(xml: string, options: LintOnDiskOptions): Promise<LintOnDiskResult> {
  const moddle: ModdleLike = createBpmnModdleForDiff();
  const { rootElement: definitions } = await moddle.fromXML(xml);

  const origin = detectBpmnOrigin(definitions);
  if (origin.origin !== 'daemon-engine' && !options.alwaysLintForeignDiagrams) {
    return { status: 'skipped-foreign' };
  }

  const engine = new LintEngine();
  applyLintEngineProfile(engine, options.profileName, options.customRulesets);
  const findings = await engine.lint(definitions);
  const elementRegistry = buildModdleElementRegistry(definitions);
  const snapshot = computeLintScore({
    findings,
    elementRegistry,
    rootElementId: elementRegistry.rootElementId,
    scorePolicy: resolveScorePolicy(options.profileName, options.customRulesets),
  });
  const newScore = snapshotToLinterScorePayload(snapshot, options.profileName);
  const existingScore = readExistingScore(definitions, newScore.rulesetId);
  if (scoreMatchesExisting(newScore, existingScore)) {
    return { status: 'unchanged', xml };
  }

  upsertLinterRulesetScoreOnDefinitions(definitions, newScore, moddle);
  const { xml: updatedXml } = await moddle.toXML(definitions, { format: true });
  return { status: 'updated', xml: updatedXml };
}

type RegistryElement = { id: string; type?: string; businessObject: { $type?: string } };

const STRUCTURAL_BPMN_TYPES = new Set(['bpmn:Definitions', 'bpmn:Process', 'bpmn:Collaboration', 'bpmn:LaneSet']);

const DI_SHAPE_OR_EDGE_TYPES = new Set(['bpmndi:BPMNShape', 'bpmndi:BPMNEdge']);

function getModdleProperty(node: unknown, name: string): unknown {
  if (node == null || typeof node !== 'object') {
    return undefined;
  }
  const record = node as { get?: (propertyName: string) => unknown } & Record<string, unknown>;
  if (typeof record.get === 'function') {
    const viaGet = record.get(name);
    if (viaGet !== undefined) {
      return viaGet;
    }
  }
  return record[name];
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (value == null) {
    return [];
  }
  return [value];
}

function indexSemanticBpmnNodes(root: unknown): Map<string, RegistryElement> {
  const seen = new Set<unknown>();
  const byId = new Map<string, RegistryElement>();

  function walk(node: unknown): void {
    if (node == null || typeof node !== 'object' || seen.has(node)) {
      return;
    }
    seen.add(node);
    const record = node as { $type?: string; id?: string };
    if (
      typeof record.$type === 'string' &&
      record.$type.startsWith('bpmn:') &&
      typeof record.id === 'string' &&
      record.id !== ''
    ) {
      byId.set(record.id, {
        id: record.id,
        type: record.$type,
        businessObject: record,
      });
    }
    for (const [key, value] of Object.entries(record)) {
      if (key === '$parent' || key === '$descriptor' || key === '$model') {
        continue;
      }
      if (typeof value === 'function') {
        continue;
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          walk(item);
        }
      } else {
        walk(value);
      }
    }
  }

  walk(root);
  return byId;
}

function resolveBpmnElementRef(ref: unknown, semanticById: Map<string, RegistryElement>): RegistryElement | undefined {
  if (ref == null) {
    return undefined;
  }
  if (typeof ref === 'string') {
    return semanticById.get(ref);
  }
  if (typeof ref !== 'object') {
    return undefined;
  }
  const record = ref as { $type?: string; id?: string };
  if (typeof record.id === 'string' && semanticById.has(record.id)) {
    return semanticById.get(record.id);
  }
  if (typeof record.$type === 'string' && record.$type.startsWith('bpmn:') && typeof record.id === 'string') {
    return {
      id: record.id,
      type: record.$type,
      businessObject: record,
    };
  }
  return undefined;
}

function collectDiReferencedElements(
  definitions: unknown,
  semanticById: Map<string, RegistryElement>,
): { elements: RegistryElement[]; rootElementId: string | null } {
  const diagrams = asArray(getModdleProperty(definitions, 'diagrams'));
  const byId = new Map<string, RegistryElement>();
  let rootElementId: string | null = null;

  for (const diagram of diagrams) {
    const plane = getModdleProperty(diagram, 'plane');
    if (plane == null) {
      continue;
    }
    if (rootElementId == null) {
      const planeRoot = resolveBpmnElementRef(getModdleProperty(plane, 'bpmnElement'), semanticById);
      if (planeRoot != null) {
        rootElementId = planeRoot.id;
      }
    }
    for (const planeElement of asArray(getModdleProperty(plane, 'planeElement'))) {
      const diType = (planeElement as { $type?: string }).$type;
      if (diType == null || !DI_SHAPE_OR_EDGE_TYPES.has(diType)) {
        continue;
      }
      const semantic = resolveBpmnElementRef(getModdleProperty(planeElement, 'bpmnElement'), semanticById);
      if (semantic == null) {
        continue;
      }
      byId.set(semantic.id, semantic);
    }
  }

  return { elements: [...byId.values()], rootElementId };
}

function collectFallbackCanvasElements(semanticById: Map<string, RegistryElement>): RegistryElement[] {
  return [...semanticById.values()].filter((element) => {
    const bpmnType = element.businessObject.$type;
    return bpmnType != null && !STRUCTURAL_BPMN_TYPES.has(bpmnType);
  });
}

function inferCanvasRootElementId(definitions: unknown, semanticById: Map<string, RegistryElement>): string | null {
  for (const element of semanticById.values()) {
    if (element.businessObject.$type === 'bpmn:Collaboration') {
      return element.id;
    }
  }
  for (const element of semanticById.values()) {
    if (element.businessObject.$type === 'bpmn:Process') {
      return element.id;
    }
  }
  const definitionsId = getModdleProperty(definitions, 'id');
  return typeof definitionsId === 'string' ? definitionsId : null;
}
