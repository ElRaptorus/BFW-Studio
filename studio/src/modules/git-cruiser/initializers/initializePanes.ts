import type { Bifrost } from '#bifrost/Bifrost';

import * as GitPaneModule from '../panes/GitPane';

export function initializePanes(bifrost: Bifrost): void {
  bifrost.panes.registerPaneGroup(
    'left',
    'git',
    [bifrost.panes.getPaneViaPaneProvider('design/source/git', 'git-cruiser/pane-providers/GitPane', GitPaneModule)],
    { pages: ['design/source'] },
  );
}
