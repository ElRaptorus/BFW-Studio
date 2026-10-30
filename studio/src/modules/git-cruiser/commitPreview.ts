import type { Bifrost } from '#bifrost/Bifrost';
import type { SourceControlFileStatus } from '#bifrost/contracts/SourceControlTypes';

import { getModelCommand } from './modelFileTypes';

export async function buildChangeSummaryForFiles(
  bifrost: Bifrost,
  repoRoot: string,
  stagedFiles: SourceControlFileStatus[],
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
      headXml = await bifrost.sourceControl.getFileContentAtRevision(repoRoot, 'HEAD', relativePath);
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

    const summaryCommand = getModelCommand(relativePath, 'getChangeSummaryMarkdown');
    if (summaryCommand != null && bifrost.commands.isRegistered(summaryCommand)) {
      try {
        const markdown = await bifrost.commands.executeCommand<string>(summaryCommand, [headXml, currentXml, fileName]);
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
