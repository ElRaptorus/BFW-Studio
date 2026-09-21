import type { ElementLike } from 'diagram-js/lib/model/Types';

export const BFW_LINTER_RULESET_SCORE_COMMAND = 'bfw.platform.updateLinterRulesetScore';

const BFW_PROPERTIES_TYPE = 'bfw:Properties';
const BFW_LINTER_SCORE_TYPE = 'bfw:LinterRulesetScore';
const BPMN_EXTENSION_ELEMENTS = 'bpmn:ExtensionElements';

export type BfwLinterRulesetScorePayload = {
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
 * Upserts one `bfw:LinterRulesetScore` under `definitions.extensionElements` / `bfw:Properties`.
 */
export function UpdateBfwLinterRulesetScoreHandler(this: any, bpmnFactory: any): void {
  this._bpmnFactory = bpmnFactory;
}

UpdateBfwLinterRulesetScoreHandler.$inject = ['bpmnFactory'];

UpdateBfwLinterRulesetScoreHandler.prototype.execute = function (context: any): ElementLike[] {
  const element = context.element as ElementLike;
  const definitions = context.definitions as any;
  const score = context.score as BfwLinterRulesetScorePayload;
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

  let bfwProps = values.find((value: any) => value.$type === BFW_PROPERTIES_TYPE);
  if (bfwProps == null) {
    bfwProps = this._bpmnFactory.create(BFW_PROPERTIES_TYPE, { linterRulesetScores: [] });
    bfwProps.$parent = extensionElements;
    values.push(bfwProps);
    extensionElements.set('values', values);
  }

  let scores: any[] = bfwProps.get?.('linterRulesetScores') ?? bfwProps.linterRulesetScores ?? [];
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

  const next = this._bpmnFactory.create(BFW_LINTER_SCORE_TYPE, {
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
  next.$parent = bfwProps;

  if (existing) {
    const idx = scores.indexOf(existing);
    const copy = [...scores];
    copy[idx] = next;
    scores = copy;
  } else {
    scores = [...scores, next];
  }

  if (typeof bfwProps.set === 'function') {
    bfwProps.set('linterRulesetScores', scores);
  } else {
    bfwProps.linterRulesetScores = scores;
  }

  context.changed = [element];
  return context.changed;
};

UpdateBfwLinterRulesetScoreHandler.prototype.revert = function (context: any): ElementLike[] {
  const definitions = context.definitions as any;
  const score = context.score as BfwLinterRulesetScorePayload;
  const extensionElements = definitions?.get?.('extensionElements') ?? definitions?.extensionElements;
  if (extensionElements == null) {
    return context.changed ?? [];
  }
  const values: any[] = extensionElements.get?.('values') ?? extensionElements.values ?? [];
  const bfwProps = values.find((value: any) => value.$type === BFW_PROPERTIES_TYPE);
  if (bfwProps == null) {
    return context.changed ?? [];
  }
  let scores: any[] = bfwProps.get?.('linterRulesetScores') ?? bfwProps.linterRulesetScores ?? [];

  if (context.previousSerialized) {
    const restored = this._bpmnFactory.create(BFW_LINTER_SCORE_TYPE, context.previousSerialized);
    restored.$parent = bfwProps;
    if (context.removedIndex >= 0) {
      const copy = [...scores];
      copy[context.removedIndex] = restored;
      scores = copy;
    }
  } else if (context.addedNew) {
    scores = scores.filter((entry: any) => (entry.get?.('rulesetId') ?? entry.rulesetId) !== score.rulesetId);
  }

  if (typeof bfwProps.set === 'function') {
    bfwProps.set('linterRulesetScores', scores);
  } else {
    bfwProps.linterRulesetScores = scores;
  }

  return context.changed ?? [];
};

export default UpdateBfwLinterRulesetScoreHandler;
