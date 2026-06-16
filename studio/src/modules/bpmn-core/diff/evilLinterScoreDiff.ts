const BFR_PROPERTIES_TYPE = 'evil:Properties';
const BFR_LINTER_SCORE_TYPE = 'evil:LinterRulesetScore';

export type LinterScoreChangeKind = 'added' | 'removed' | 'changed';

export type LinterScorePropertyDelta = {
  property: string;
  label: string;
  oldValue: string | undefined;
  newValue: string | undefined;
};

export type LinterScoreChange = {
  rulesetId: string;
  kind: LinterScoreChangeKind;
  propertyChanges: LinterScorePropertyDelta[];
};

/** Properties compared per `evil:LinterRulesetScore` entry. */
const DIFFED_PROPERTIES: readonly { key: string; label: string }[] = [
  { key: 'scorePercent', label: 'Score (%)' },
  { key: 'complianceStatus', label: 'Compliance' },
  { key: 'computedAtIso', label: 'Computed At' },
  { key: 'schemaVersion', label: 'Schema Version' },
  { key: 'maxPoints', label: 'Max Points' },
  { key: 'penaltyPoints', label: 'Penalty Points' },
  { key: 'rawErrorFindings', label: 'Errors' },
  { key: 'rawWarningFindings', label: 'Warnings' },
];

type ScoreRecord = Record<string, string>;
type ScoresByRuleset = Record<string, ScoreRecord>;

function extractLinterScoresFromDefinitions(definitions: any): ScoresByRuleset {
  const extensionElements = definitions?.extensionElements;
  if (extensionElements?.values == null) {
    return {};
  }

  const evilProps = extensionElements.values.find((value: any) => value.$type === BFR_PROPERTIES_TYPE);
  if (evilProps == null) {
    return {};
  }

  const scores: ScoresByRuleset = {};
  const scoreEntries = evilProps.linterRulesetScores ?? evilProps.values ?? [];

  for (const entry of scoreEntries) {
    if (entry.$type !== BFR_LINTER_SCORE_TYPE || entry.rulesetId == null) {
      continue;
    }

    const record: ScoreRecord = {};
    for (const { key } of DIFFED_PROPERTIES) {
      if (entry[key] != null) {
        record[key] = String(entry[key]);
      }
    }
    scores[entry.rulesetId] = record;
  }

  return scores;
}

export function diffLinterScores(definitionsBefore: any, definitionsAfter: any): LinterScoreChange[] {
  const before = extractLinterScoresFromDefinitions(definitionsBefore);
  const after = extractLinterScoresFromDefinitions(definitionsAfter);
  const allRulesetIds = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes: LinterScoreChange[] = [];

  for (const rulesetId of allRulesetIds) {
    const hadBefore = Object.prototype.hasOwnProperty.call(before, rulesetId);
    const hasAfter = Object.prototype.hasOwnProperty.call(after, rulesetId);

    if (!hadBefore && hasAfter) {
      const propDeltas: LinterScorePropertyDelta[] = DIFFED_PROPERTIES.filter(
        ({ key }) => after[rulesetId][key] != null,
      ).map(({ key, label }) => ({
        property: key,
        label,
        oldValue: undefined,
        newValue: after[rulesetId][key],
      }));
      changes.push({ rulesetId, kind: 'added', propertyChanges: propDeltas });
    } else if (hadBefore && !hasAfter) {
      const propDeltas: LinterScorePropertyDelta[] = DIFFED_PROPERTIES.filter(
        ({ key }) => before[rulesetId][key] != null,
      ).map(({ key, label }) => ({
        property: key,
        label,
        oldValue: before[rulesetId][key],
        newValue: undefined,
      }));
      changes.push({ rulesetId, kind: 'removed', propertyChanges: propDeltas });
    } else if (hadBefore && hasAfter) {
      const propDeltas: LinterScorePropertyDelta[] = [];
      for (const { key, label } of DIFFED_PROPERTIES) {
        const oldVal = before[rulesetId][key];
        const newVal = after[rulesetId][key];
        if (oldVal !== newVal) {
          propDeltas.push({ property: key, label, oldValue: oldVal, newValue: newVal });
        }
      }
      if (propDeltas.length > 0) {
        changes.push({ rulesetId, kind: 'changed', propertyChanges: propDeltas });
      }
    }
  }

  changes.sort((changeA, changeB) => changeA.rulesetId.localeCompare(changeB.rulesetId));
  return changes;
}

export function diffLinterScoresBetweenXml(definitionsBefore: any, definitionsAfter: any): LinterScoreChange[] {
  return diffLinterScores(definitionsBefore, definitionsAfter);
}
