import { summarizeDeployFolders } from '#modules/engine-deploy/analysis/summarizeDeployFolders';
import type { DeployItemAnalysis } from '#modules/engine-deploy/analysis/types';
import {
  describeDeployStatus,
  describeStoredLinterScore,
  formatPercent,
} from '#modules/engine-deploy/components/formatDeployBadges';
import { describe, expect, it } from 'vitest';

const projects = [{ name: 'shop', baseUri: 'file:///work/shop' }];

function item(uri: string, status: DeployItemAnalysis['status'], scorePercent?: string, complianceStatus = 'valid') {
  return {
    uri,
    kind: 'bpmn',
    status,
    processes: [],
    storedLinterScores:
      scorePercent == null
        ? []
        : [{ rulesetId: 'bpmn-development', scorePercent, complianceStatus, computedAtIso: 'then' }],
    linterInfo: null,
    blockers: [],
    includedByDefault: true,
  } as unknown as DeployItemAnalysis;
}

describe('summarizeDeployFolders', () => {
  it('groups by direct folder, averages scores and keeps the worst verdict', () => {
    const items = [
      item('file:///work/shop/a/one.bpmn', 'new', '90'),
      item('file:///work/shop/a/two.bpmn', 'unchanged', '70', 'failed'),
      item('file:///work/shop/root.bpmn', 'new'),
    ];
    const summaries = summarizeDeployFolders(
      items,
      new Set([items[0].uri]),
      (uri) => (uri.endsWith('one.bpmn') ? { uri, status: 'deployed', message: null, rulesetFailures: [] } : null),
      projects,
    );
    expect(summaries.map((summary) => summary.folder)).toEqual(['', 'a']);
    const folder = summaries[1];
    expect(folder.includedCount).toBe(1);
    expect(folder.statusCounts).toEqual({ new: 1, unchanged: 1 });
    expect(folder.linter[0]).toMatchObject({ averagePercent: 80, verdict: 'failed', fileCount: 2 });
    expect(folder.deployedCount).toBe(1);
  });
});

describe('formatDeployBadges', () => {
  it('formats a stored score with the short ruleset label and its verdict', () => {
    const presentation = describeStoredLinterScore(
      {
        rulesetId: 'bpmn-production-ready',
        scorePercent: '77.3',
        complianceStatus: 'risky',
        computedAtIso: 'x',
      } as never,
      'de-DE',
    );
    expect(presentation).toMatchObject({ label: 'Prod: 77,3%', verdict: 'risky' });
    expect(describeStoredLinterScore({ rulesetId: 'x', scorePercent: 'n/a' } as never)).toBeNull();
    expect(formatPercent(92.55, 'de-DE')).toBe('92,6%');
    expect(describeDeployStatus('new').tone).toBe('positive');
  });
});
