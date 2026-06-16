import type { ElementLike } from 'diagram-js/lib/model/Types';

export const BFR_LINTER_RULESET_SCORE_COMMAND = 'evil.platform.updateLinterRulesetScore';

const BFR_PROPERTIES_TYPE = 'evil:Properties';
const BFR_LINTER_SCORE_TYPE = 'evil:LinterRulesetScore';
const BPMN_EXTENSION_ELEMENTS = 'bpmn:ExtensionElements';

export type EvilLinterRulesetScorePayload = {
  rulesetId: string;
  scorePercent: string;
  complianceStatus: string;
  computedAtIso: string;
  schemaVersion: string;
  maxPoints: string;
  penaltyPoints: string;
  rawErrorFindings: string;
  rawWarningFindings: string;
};

/**
 * Upserts one `evil:LinterRulesetScore` under `definitions.extensionElements` / `evil:Properties`.
 */
export function UpdateEvilLinterRulesetScoreHandler(this: any, bpmnFactory: any): void {
  this._bpmnFactory = bpmnFactory;
}

UpdateEvilLinterRulesetScoreHandler.$inject = ['bpmnFactory'];

UpdateEvilLinterRulesetScoreHandler.prototype.execute = function (context: any): ElementLike[] {
  const element = context.element as ElementLike;
  const definitions = context.definitions as any;
  const score = context.score as EvilLinterRulesetScorePayload;
  if (definitions == null || score?.rulesetId == null) {
    return [];
  }

  context.lintScoresSilent = true;

  let extensionElements = definitions.get('extensionElements');
  if (extensionElements == null) {
    extensionElements = this._bpmnFactory.create(BPMN_EXTENSION_ELEMENTS, { values: [] });
    extensionElements.$parent = definitions;
    definitions.set('extensionElements', extensionElements);
  }

  let values: any[] = extensionElements.get('values') ?? extensionElements.values;
  if (values == null) {
    values = [];
    extensionElements.set('values', values);
  }

  let evilProps = values.find((value: any) => value.$type === BFR_PROPERTIES_TYPE);
  if (evilProps == null) {
    evilProps = this._bpmnFactory.create(BFR_PROPERTIES_TYPE, { linterRulesetScores: [] });
    evilProps.$parent = extensionElements;
    values.push(evilProps);
    extensionElements.set('values', values);
  }

  let scores: any[] = evilProps.get?.('linterRulesetScores') ?? evilProps.linterRulesetScores ?? [];
  if (!Array.isArray(scores)) {
    scores = [];
  }

  const existing = scores.find(
    (entry: any) => entry.get?.('rulesetId') === score.rulesetId || entry.rulesetId === score.rulesetId,
  );
  context.previousSerialized = existing
    ? {
        rulesetId: existing.get?.('rulesetId') ?? existing.rulesetId,
        scorePercent: existing.get?.('scorePercent') ?? existing.scorePercent,
        complianceStatus: existing.get?.('complianceStatus') ?? existing.complianceStatus,
        computedAtIso: existing.get?.('computedAtIso') ?? existing.computedAtIso,
        schemaVersion: existing.get?.('schemaVersion') ?? existing.schemaVersion,
        maxPoints: existing.get?.('maxPoints') ?? existing.maxPoints,
        penaltyPoints: existing.get?.('penaltyPoints') ?? existing.penaltyPoints,
        rawErrorFindings: existing.get?.('rawErrorFindings') ?? existing.rawErrorFindings,
        rawWarningFindings: existing.get?.('rawWarningFindings') ?? existing.rawWarningFindings,
      }
    : null;
  context.removedIndex = existing ? scores.indexOf(existing) : -1;
  context.addedNew = !existing;

  const next = this._bpmnFactory.create(BFR_LINTER_SCORE_TYPE, {
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

  context.changed = [element];
  return context.changed;
};

UpdateEvilLinterRulesetScoreHandler.prototype.revert = function (context: any): ElementLike[] {
  const definitions = context.definitions as any;
  const score = context.score as EvilLinterRulesetScorePayload;
  const extensionElements = definitions?.get?.('extensionElements') ?? definitions?.extensionElements;
  if (extensionElements == null) {
    return context.changed ?? [];
  }
  const values: any[] = extensionElements.get?.('values') ?? extensionElements.values ?? [];
  const evilProps = values.find((value: any) => value.$type === BFR_PROPERTIES_TYPE);
  if (evilProps == null) {
    return context.changed ?? [];
  }
  let scores: any[] = evilProps.get?.('linterRulesetScores') ?? evilProps.linterRulesetScores ?? [];

  if (context.previousSerialized) {
    const restored = this._bpmnFactory.create(BFR_LINTER_SCORE_TYPE, context.previousSerialized);
    restored.$parent = evilProps;
    if (context.removedIndex >= 0) {
      const copy = [...scores];
      copy[context.removedIndex] = restored;
      scores = copy;
    }
  } else if (context.addedNew) {
    scores = scores.filter((entry: any) => (entry.get?.('rulesetId') ?? entry.rulesetId) !== score.rulesetId);
  }

  if (typeof evilProps.set === 'function') {
    evilProps.set('linterRulesetScores', scores);
  } else {
    evilProps.linterRulesetScores = scores;
  }

  return context.changed ?? [];
};

export default UpdateEvilLinterRulesetScoreHandler;
