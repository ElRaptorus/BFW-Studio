import type { Bifrost } from '#bifrost/Bifrost';

export type GitCruiserProjectConfig = {
  protectedDiagrams?: string[];
};

const CONFIG_FILENAME = '.bifrostfw/git-cruiser.json';

let projectConfig: GitCruiserProjectConfig | null = null;

export function getProjectConfig(): GitCruiserProjectConfig | null {
  return projectConfig;
}

export function getProtectedDiagramPatterns(bifrost: Bifrost): string[] {
  if (projectConfig?.protectedDiagrams) {
    return projectConfig.protectedDiagrams;
  }
  return bifrost.settings.get('gitCruiser.protect.diagrams') ?? [];
}

export async function loadProjectConfig(bifrost: Bifrost, repoRoot: string): Promise<void> {
  const configUri = `file://${repoRoot}/${CONFIG_FILENAME}`;
  const localPath = bifrost.files.getLocalFilenameForUri(configUri);

  const exists = await bifrost.files.doesFileOrDirectoryExist(localPath);
  if (!exists) {
    projectConfig = null;
    return;
  }

  try {
    const content = await bifrost.files.load(configUri);
    if (!content) {
      projectConfig = null;
      return;
    }
    projectConfig = JSON.parse(content);
  } catch {
    projectConfig = null;
  }
}
