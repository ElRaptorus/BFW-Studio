import type { LinterVerdict } from '../components/formatDeployBadges';
import { toLinterVerdict, worstLinterVerdict } from '../components/formatDeployBadges';
import type { DeployProjectRoot } from './describeDeployItemLocation';
import { describeDeployItemLocation } from './describeDeployItemLocation';
import type { DeployItemAnalysis, DeployItemResult, DeployItemStatus } from './types';

export type DeployFolderLinterSummary = {
  rulesetId: string;
  averagePercent: number;
  /** The worst verdict of any file in the folder. */
  verdict: LinterVerdict;
  fileCount: number;
};

export type DeployFolderSummary = {
  /** The folder relative to its project root ('' at the root). */
  folder: string;
  fileUris: string[];
  includedCount: number;
  statusCounts: Partial<Record<DeployItemStatus, number>>;
  linter: DeployFolderLinterSummary[];
  deployedCount: number;
  failedCount: number;
};

/**
 * Groups the plan items by their direct parent folder. Dependencies and versions are left out on purpose; the
 * linter scores are averaged per ruleset and the verdict is the worst one among the files.
 */
export function summarizeDeployFolders(
  items: readonly DeployItemAnalysis[],
  includedUris: ReadonlySet<string>,
  getResult: (uri: string) => DeployItemResult | null,
  projects: readonly DeployProjectRoot[],
): DeployFolderSummary[] {
  const folders = new Map<string, DeployItemAnalysis[]>();
  for (const item of items) {
    const { folder } = describeDeployItemLocation(item.uri, projects);
    folders.set(folder, [...(folders.get(folder) ?? []), item]);
  }
  return [...folders.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([folder, folderItems]) => {
      const statusCounts: Partial<Record<DeployItemStatus, number>> = {};
      const scoresByRuleset = new Map<string, { sum: number; count: number; verdict: LinterVerdict }>();
      let deployedCount = 0;
      let failedCount = 0;
      for (const item of folderItems) {
        statusCounts[item.status] = (statusCounts[item.status] ?? 0) + 1;
        const result = getResult(item.uri);
        deployedCount += result?.status === 'deployed' ? 1 : 0;
        failedCount += result?.status === 'failed' ? 1 : 0;
        for (const score of item.storedLinterScores) {
          const percent = Number(score.scorePercent);
          if (!Number.isFinite(percent)) {
            continue;
          }
          const aggregate = scoresByRuleset.get(score.rulesetId) ?? { sum: 0, count: 0, verdict: 'valid' as const };
          scoresByRuleset.set(score.rulesetId, {
            sum: aggregate.sum + percent,
            count: aggregate.count + 1,
            verdict: worstLinterVerdict(aggregate.verdict, toLinterVerdict(score.complianceStatus)),
          });
        }
      }
      return {
        folder,
        fileUris: folderItems.map((item) => item.uri),
        includedCount: folderItems.filter((item) => includedUris.has(item.uri)).length,
        statusCounts,
        linter: [...scoresByRuleset.entries()].map(([rulesetId, aggregate]) => ({
          rulesetId,
          averagePercent: aggregate.sum / aggregate.count,
          verdict: aggregate.verdict,
          fileCount: aggregate.count,
        })),
        deployedCount,
        failedCount,
      };
    });
}
