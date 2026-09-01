import type { Bifrost } from '#bifrost/Bifrost';

import type { GitService } from '../GitService';
import * as GitPaneModule from '../panes/GitPane';

export function initializePanes(bifrost: Bifrost, gitService: GitService): void {
  bifrost.panes.registerPaneGroup('left', 'git', [
    bifrost.panes.getPaneViaPaneProvider('pane/left/git', 'git-cruiser/pane-providers/GitPane', GitPaneModule),
  ]);

  bifrost.menuBar.registerMenuBarItemModifier((menuBarItems) => {
    return bifrost.menuBar.insertAfterMenuBarItem(menuBarItems, 'pane/left/search', () => [
      {
        type: 'pane_content_toggle',
        id: 'pane/left/git',
        tooltip: 'Source Control',
        icon: 'git-cruiser/menubar-icon',
        visible: bifrost.panes.getPaneAreaVisibility('left'),
        paneAreaId: 'left',
        paneId: 'pane/left/git',
      },
    ]);
  });
}
