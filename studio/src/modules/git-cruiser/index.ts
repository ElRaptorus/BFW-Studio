import type { Bifrost } from '#bifrost/Bifrost';
import { EVENT_EDITOR_DOCUMENT_DATA_UPDATED } from '#bifrost/contracts/internal/EditorEvents';

import React from 'react';

import { GitService } from './GitService';
import { MERGE_URI } from './GitTypes';
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

type Disposable = { dispose: () => void };

let gitService: GitService;
const configWatchers: Disposable[] = [];

export const MERGE_DOCUMENT_TYPE = 'merge';

export function getGitService(): GitService {
  if (!gitService) {
    throw new Error('[git-cruiser] GitService not initialized. Extension not loaded?');
  }
  return gitService;
}

export async function onLoad(bifrost: Bifrost): Promise<void> {
  initializeIcons(bifrost);
  initializeSettings(bifrost);

  gitService = new GitService(bifrost);

  initializeCommands(bifrost, gitService);
  const decorationProvider = initializeDecorations(bifrost);
  gitService.setDecorationProvider(decorationProvider);
  initializeMenus(bifrost, gitService);
  initializePanes(bifrost, gitService);
  initializeStatusBar(bifrost, gitService);

  await cleanupTempFiles(bifrost);

  bifrost.editors.registerDocumentType(MERGE_DOCUMENT_TYPE, {
    uriMatch: /^merge:/,
    modelKey: 'MergeDocumentModel',
    modelConstructor: MergeDocumentModel,
    rendererKey: 'MergeDocumentRenderer',
    rendererConstructor: MergeDocumentRenderer,
    icon: 'ph ph-git-merge',
  });

  bifrost.commands.register('git.merge.openResolver', () => {
    bifrost.editors.focusOrOpenEditorDocument(MERGE_URI, 'Merge Conflicts');
  });

  bifrost.commands.register('git.focusGitPane', () => {
    bifrost.panes.setVisibilityOfPaneAreaByPaneId('pane/left/git', true);
  });

  await gitService.initialize();

  if (gitService.isActive) {
    registerUiEntrypoints(bifrost);
    subscribeToRefreshTriggers(bifrost, gitService);
    loadProjectConfigForRepos(bifrost, gitService);

    bifrost.events.on('ready', () => {
      suggestGitignoreForRepos(bifrost, gitService);
    });
  }

  bifrost.events.on('settingsUpdate', (key: string) => {
    if (key === 'gitCruiser.general.enabled') {
      if (gitService.isEnabled && gitService.isGitAvailable) {
        gitService.detectRepos();
        subscribeToRefreshTriggers(bifrost, gitService);
      }
    }
  });

  bifrost.events.on('solutionChanged', () => {
    if (gitService.isActive) {
      gitService.detectRepos();
      loadProjectConfigForRepos(bifrost, gitService);
    }
  });
}

function subscribeToRefreshTriggers(bifrost: Bifrost, gitService: GitService): void {
  const autoRefresh = bifrost.settings.get('gitCruiser.general.autoRefresh') !== false;
  if (!autoRefresh) {
    return;
  }

  bifrost.editors.on(EVENT_EDITOR_DOCUMENT_DATA_UPDATED, () => {
    gitService.scheduleRefresh();
  });
}

function loadProjectConfigForRepos(bifrost: Bifrost, gitService: GitService): void {
  for (const watcher of configWatchers) {
    watcher.dispose();
  }
  configWatchers.length = 0;

  for (const state of gitService.getAllRepoStates()) {
    loadProjectConfig(bifrost, state.repoRoot);

    const configUri = `file://${state.repoRoot}/.bifrostfw/git-cruiser.json`;
    try {
      const watcher = bifrost.files.watchFile(configUri, (eventType) => {
        if (eventType === 'change' || eventType === 'add' || eventType === 'unlink') {
          loadProjectConfig(bifrost, state.repoRoot);
        }
      });
      configWatchers.push(watcher);
    } catch {
      // config file may not exist yet — that's fine
    }
  }
}

function suggestGitignoreForRepos(bifrost: Bifrost, gitService: GitService): void {
  for (const state of gitService.getAllRepoStates()) {
    bifrost.commands.executeCommand('git.suggestGitignore', [state.repoRoot]);
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
