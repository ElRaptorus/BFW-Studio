import type { Bifrost } from '#bifrost/Bifrost';

const SUGGESTED_PATTERNS = ['# Bifrost Forge World', '*.essln', 'node_modules/', '.env'];

export function suggestGitignore(bifrost: Bifrost, repoRoot: string): void {
  if (bifrost.settings.get('gitCruiser.suggest.gitignore') === false) {
    return;
  }

  const repoName = repoRoot.split('/').pop() ?? repoRoot;

  const notificationId = bifrost.notifications.open(
    {
      type: 'info',
      content: `Repository "${repoName}" has no .gitignore file. Create one with recommended patterns?`,
      source: 'Git Cruiser',
      actions: [
        { action: 'dontAskAgain', label: `Don't ask again` },
        { action: 'dismiss', label: 'No' },
        { action: 'create', label: 'Create', default: true },
      ],
    },
    async (response) => {
      bifrost.notifications.close(notificationId);

      if (response.action === 'dontAskAgain') {
        bifrost.settings.set('gitCruiser.suggest.gitignore', false);
        return;
      }

      if (response.action !== 'create') {
        return;
      }

      try {
        const gitignoreUri = `file://${repoRoot}/.gitignore`;
        await bifrost.files.save(gitignoreUri, SUGGESTED_PATTERNS.join('\n') + '\n');
        bifrost.notifications.open('.gitignore created with recommended patterns.');
      } catch (error: any) {
        bifrost.notifications.open({
          type: 'error',
          content: `Failed to create .gitignore: ${error?.message ?? String(error)}`,
          source: 'Git Cruiser',
        });
      }
    },
  );
}
