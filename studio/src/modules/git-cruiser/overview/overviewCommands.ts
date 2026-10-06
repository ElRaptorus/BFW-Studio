import type { Bifrost } from '#bifrost/Bifrost';

import type { Menu } from '@elraptorus/bfw_studio_sdk';

import type SourceOverviewDocumentModel from './SourceOverviewDocumentModel';
import type { OverviewFile } from './SourceOverviewDocumentModel';
import { SOURCE_OVERVIEW_URI } from './SourceOverviewDocumentModel';

export const OVERVIEW_BASE_MENU_ID = 'git-cruiser/overview-base';
export const OVERVIEW_HISTORY_ENTRY_MENU_ID = 'git-cruiser/overview-history-entry';

export function registerOverviewCommands(bifrost: Bifrost): void {
  bifrost.commands.register(
    'git.overview.open',
    () => {
      bifrost.editors.focusOrOpenEditorDocument(SOURCE_OVERVIEW_URI, 'Source Overview');
    },
    { visibleInSearch: true, description: 'Git: Open Source Overview' },
  );

  bifrost.commands.register('git.overview.showUncommitted', (model: SourceOverviewDocumentModel) =>
    model.setMode('uncommitted'),
  );

  bifrost.commands.register('git.overview.showComparison', (model: SourceOverviewDocumentModel) =>
    model.setMode('comparison'),
  );

  bifrost.commands.register('git.overview.showHistory', (model: SourceOverviewDocumentModel) =>
    model.setMode('history'),
  );

  bifrost.commands.register('git.overview.setComparisonBase', (model: SourceOverviewDocumentModel, base: string) =>
    model.setComparisonBase(base),
  );

  bifrost.commands.register('git.overview.refresh', (model: SourceOverviewDocumentModel) => model.refresh());

  bifrost.commands.register('git.overview.toggleCommit', (model: SourceOverviewDocumentModel, hash: string) =>
    model.toggleCommit(hash),
  );

  bifrost.commands.register('git.overview.loadMoreHistory', (model: SourceOverviewDocumentModel) =>
    model.loadMoreHistory(),
  );

  bifrost.commands.register('git.overview.summarizeFile', (model: SourceOverviewDocumentModel, file: OverviewFile) =>
    model.summarizeFile(file),
  );

  bifrost.menus.registerMenu(OVERVIEW_BASE_MENU_ID, (model: SourceOverviewDocumentModel): Menu => {
    const baseOptions = model.getBaseOptions();
    if (baseOptions.length === 0) {
      return [{ type: 'command', label: 'No other branch to compare with', command: 'std.internal.empty' }];
    }

    const currentBase = model.getComparison().base;
    return baseOptions.map((base) => ({
      type: 'command',
      label: base === currentBase ? `${base} (current base)` : base,
      command: 'git.overview.setComparisonBase',
      commandArgs: [model, base],
    }));
  });

  bifrost.menus.registerMenu(OVERVIEW_HISTORY_ENTRY_MENU_ID, (hash: string): Menu => [
    { type: 'command', label: 'Copy Commit Hash', command: 'git.copyCommitHash', commandArgs: [hash] },
  ]);
}
