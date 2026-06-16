import type { Bifrost } from '#bifrost/Bifrost';

export function initializeIcons(bifrost: Bifrost): void {
  bifrost.icons.registerIcons({
    'git-cruiser/branch': 'ph-duotone ph-git-branch',
    'git-cruiser/commit': 'ph-duotone ph-git-commit',
    'git-cruiser/merge': 'ph-duotone ph-git-merge',
    'git-cruiser/pull-request': 'ph-duotone ph-git-pull-request',
    'git-cruiser/diff': 'ph-duotone ph-git-diff',
    'git-cruiser/stash': 'ph-duotone ph-package',
    'git-cruiser/push': 'ph-duotone ph-cloud-arrow-up',
    'git-cruiser/pull': 'ph-duotone ph-cloud-arrow-down',
    'git-cruiser/sync': 'ph-duotone ph-arrows-clockwise',
    'git-cruiser/sync-spinning': 'ph-duotone ph-arrows-clockwise ph-spin',
    'git-cruiser/revert': 'ph-duotone ph-arrow-counter-clockwise',
    'git-cruiser/stage': 'ph-duotone ph-plus-circle',
    'git-cruiser/unstage': 'ph-duotone ph-minus-circle',
    'git-cruiser/pane': 'ph-duotone ph-git-branch',
    'git-cruiser/menubar-icon': 'ph-bold ph-git-branch',
    'git-cruiser/refresh': 'ph-duotone ph-arrows-clockwise',
    'git-cruiser/git-not-found': 'ph ph-info',
    'git-cruiser/history': 'ph-duotone ph-clock-counter-clockwise',
  });
}
