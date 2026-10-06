import type { Bifrost } from '#bifrost/Bifrost';
import { EVENT_EDITOR_DOCUMENT_DATA_UPDATED } from '#bifrost/contracts/internal/EditorEvents';

import React from 'react';

import { MERGE_URI } from './GitTypes';
import { RepositoryStore } from './RepositoryStore';
import { loadProjectConfig } from './config/ProjectConfig';
import { cleanupTempFiles } from './diffFromGit';
import { initializeCommands } from './initializers/initializeCommands';
import { initializeDecorations } from './initializers/initializeDecorations';
import { initializeIcons } from './initializers/initializeIcons';
import { initializeMenus } from './initializers/initializeMenus';
import { initializePanes } from './initializers/initializePanes';
import { initializeSettings } from './initializers/initializeSettings';
import { initializeStatusBar } from './initializers/initializeStatusBar';
import MergeDocumentModel from './merge/MergeDocumentModel';
import MergeDocumentRenderer from './merge/MergeDocumentRenderer';
import SourceOverviewDocumentModel, { SOURCE_OVERVIEW_URI } from './overview/SourceOverviewDocumentModel';
import SourceOverviewDocumentRenderer from './overview/SourceOverviewDocumentRenderer';
import { registerOverviewCommands } from './overview/overviewCommands';
import TextDiffDocumentModel from './textDiff/TextDiffDocumentModel';
import TextDiffDocumentRenderer from './textDiff/TextDiffDocumentRenderer';

type Disposable = { dispose: () => void };

let repositoryStore: RepositoryStore;
const configWatchers: Disposable[] = [];

const MERGE_DOCUMENT_TYPE = 'merge';
const TEXT_DIFF_DOCUMENT_TYPE = 'git.text-diff';
const OVERVIEW_DOCUMENT_TYPE = 'git.overview';

export async function onLoad(bifrost: Bifrost): Promise<void> {
  bifrost.icons.registerIcons({ 'std/page/source': 'ph ph-git-branch' });
  bifrost.categories.registerPage({
    id: 'design/source',
    categoryId: 'design',
    label: 'Source',
    icon: 'std/page/source',
    order: 10,
    defaultDocumentUri: SOURCE_OVERVIEW_URI,
  });
  bifrost.helpTexts.registerHelpText('git/overview', require('./texts/source-overview.md'));

  initializeIcons(bifrost);
  initializeSettings(bifrost);

  repositoryStore = new RepositoryStore(bifrost);

  initializeCommands(bifrost, repositoryStore);
  const decorationProvider = initializeDecorations(bifrost);
  repositoryStore.setDecorationProvider(decorationProvider);
  initializeMenus(bifrost, repositoryStore);
  initializePanes(bifrost);
  initializeStatusBar(bifrost, repositoryStore);

  await cleanupTempFiles(bifrost);

  bifrost.editors.registerDocumentType(MERGE_DOCUMENT_TYPE, {
    page: 'design/source',
    uriMatch: /^merge:/,
    modelKey: 'MergeDocumentModel',
    modelConstructor: MergeDocumentModel,
    rendererKey: 'MergeDocumentRenderer',
    rendererConstructor: MergeDocumentRenderer,
    icon: 'ph ph-git-merge',
  });

  bifrost.editors.registerDocumentType(TEXT_DIFF_DOCUMENT_TYPE, {
    page: 'design/source',
    uriMatch: /^fragment\+git\.text-diff:/,
    modelKey: 'TextDiffDocumentModel',
    modelConstructor: TextDiffDocumentModel,
    rendererKey: 'TextDiffDocumentRenderer',
    rendererConstructor: TextDiffDocumentRenderer,
    icon: 'ph ph-git-diff',
  });

  bifrost.editors.registerDocumentType(OVERVIEW_DOCUMENT_TYPE, {
    page: 'design/source',
    uriMatch: /^git:overview$/,
    modelKey: 'SourceOverviewDocumentModel',
    modelConstructor: SourceOverviewDocumentModel,
    rendererKey: 'SourceOverviewDocumentRenderer',
    rendererConstructor: SourceOverviewDocumentRenderer,
    icon: 'ph ph-git-branch',
  });
  registerOverviewCommands(bifrost);

  bifrost.commands.register('git.merge.openResolver', () => {
    bifrost.editors.focusOrOpenEditorDocument(MERGE_URI, 'Merge Conflicts');
  });

  bifrost.commands.register('git.focusGitPane', () => {
    bifrost.panes.setVisibilityOfPaneAreaByPaneId('design/source/git', true);
  });

  await repositoryStore.initialize();

  if (repositoryStore.isActive) {
    registerUiEntrypoints(bifrost);
    subscribeToRefreshTriggers(bifrost, repositoryStore);
    loadProjectConfigForRepos(bifrost, repositoryStore);

    bifrost.events.on('ready', () => {
      suggestGitignoreForRepos(bifrost, repositoryStore);
    });
  }

  bifrost.events.on('settingsUpdate', (key: string) => {
    if (key === 'gitCruiser.general.enabled') {
      if (repositoryStore.isEnabled && repositoryStore.isGitAvailable) {
        repositoryStore.detectRepos();
        subscribeToRefreshTriggers(bifrost, repositoryStore);
      }
    }
  });

  bifrost.events.on('solutionChanged', () => {
    if (repositoryStore.isActive) {
      repositoryStore.detectRepos();
      loadProjectConfigForRepos(bifrost, repositoryStore);
    }
  });
}

function subscribeToRefreshTriggers(bifrost: Bifrost, repositoryStore: RepositoryStore): void {
  const autoRefresh = bifrost.settings.get('gitCruiser.general.autoRefresh') !== false;
  if (!autoRefresh) {
    return;
  }

  bifrost.editors.on(EVENT_EDITOR_DOCUMENT_DATA_UPDATED, () => {
    repositoryStore.scheduleRefresh();
  });
}

function loadProjectConfigForRepos(bifrost: Bifrost, repositoryStore: RepositoryStore): void {
  for (const watcher of configWatchers) {
    watcher.dispose();
  }
  configWatchers.length = 0;

  for (const state of repositoryStore.getAllRepoStates()) {
    loadProjectConfig(bifrost, state.repositoryRoot);

    const configUri = `file://${state.repositoryRoot}/.bifrostfw/git-cruiser.json`;
    try {
      const watcher = bifrost.files.watchFile(configUri, (eventType) => {
        if (eventType === 'change' || eventType === 'add' || eventType === 'unlink') {
          loadProjectConfig(bifrost, state.repositoryRoot);
        }
      });
      configWatchers.push(watcher);
    } catch {
      // config file may not exist yet — that's fine
    }
  }
}

function suggestGitignoreForRepos(bifrost: Bifrost, repositoryStore: RepositoryStore): void {
  for (const state of repositoryStore.getAllRepoStates()) {
    bifrost.commands.executeCommand('git.suggestGitignore', [state.repositoryRoot]);
  }
}

function registerUiEntrypoints(bifrost: Bifrost): void {
  if (bifrost.commands.isRegistered('std.startpage.registerHeroCard')) {
    bifrost.commands.executeCommand('std.startpage.registerHeroCard', [
      {
        key: 'git-clone',
        icon: 'ph-fill ph-plus-square',
        title: 'Git Repo',
        description: 'Clone and connect a Git Repository',
        command: 'git.cloneRepository',
        testId: 'startpage-clone-repository',
      },
    ]);
  }

  if (bifrost.commands.isRegistered('std.editorEmptyState.setExtraAction')) {
    const cloneButton = React.createElement(
      'button',
      {
        key: 'git-clone',
        className: 'editor-area-empty-state__action',
        'data-test--editor-empty-state-clone-repository': true,
        onClick: () => bifrost.commands.executeCommand('git.cloneRepository'),
      },
      '+ Clone Repository',
    );
    bifrost.commands.executeCommand('std.editorEmptyState.setExtraAction', [cloneButton]);
  }
}
