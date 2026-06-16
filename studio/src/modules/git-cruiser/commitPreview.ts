import type { Bifrost } from '#bifrost/Bifrost';

import type { GitService } from './GitService';
import type { GitFileStatus } from './GitTypes';

export async function buildChangeSummaryForFiles(
  bifrost: Bifrost,
  gitService: GitService,
  repoRoot: string,
  stagedFiles: GitFileStatus[],
): Promise<string | null> {
  if (stagedFiles.length === 0) {
    return null;
  }

  const summaryParts: string[] = [];

  for (const file of stagedFiles) {
    const uri = file.uri;
    const relativePath = file.path;

    let headXml: string;
    try {
      headXml = await gitService.showFileAtRef(repoRoot, `HEAD:${relativePath}`);
    } catch {
      summaryParts.push(`- **${relativePath}**: new file (untracked)`);
      continue;
    }

    let currentXml: string;
    try {
      currentXml = await bifrost.files.load(uri);
    } catch {
      continue;
    }

    const fileName = relativePath.split('/').pop() ?? relativePath;

    if (bifrost.commands.isRegistered('bpmn.diff.getChangeSummaryMarkdown')) {
      try {
        const markdown = await bifrost.commands.executeCommand<string>('bpmn.diff.getChangeSummaryMarkdown', [
          headXml,
          currentXml,
          fileName,
        ]);
        summaryParts.push(markdown);
      } catch {
        summaryParts.push(`- **${relativePath}**: (diff unavailable)`);
      }
    } else {
      summaryParts.push(`- **${fileName}**: (detailed diff unavailable)`);
    }
  }

  if (summaryParts.length === 0) {
    return null;
  }

  return `## Change Summary\n\n${summaryParts.join('\n\n')}`;
}
