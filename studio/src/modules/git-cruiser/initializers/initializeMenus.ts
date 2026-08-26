import type { Bifrost } from '#bifrost/Bifrost';
import { assertNotNull } from '#bifrost/common/AssertionFunctions';

import type { Menu } from '@evil/bifrost_fw_sdk';

import type { GitService } from '../GitService';

export function initializeMenus(bifrost: Bifrost, gitService: GitService): void {
  bifrost.menus.registerMenuModifier('std/file-explorer/file', (menu: Menu, metadata: any) => {
    assertNotNull(metadata.uri, 'metadata.uri');

    const repoRoot = gitService.getRepoRootForUri(metadata.uri);
    if (!repoRoot || !gitService.isActive) {
      return menu;
    }

    const fileStatus = gitService.getFileStatus(metadata.uri);
    const hasChanges = fileStatus != null;
    const isRevertable = hasChanges && fileStatus?.workingTreeStatus !== 'untracked';

    return bifrost.menus.appendToMenu(menu, [
      { type: 'divider', visible: hasChanges },
      {
        type: 'command',
        label: 'Revert Changes',
        id: 'git-cruiser/file/revert',
        icon: 'git-cruiser/revert',
        command: 'git.revert',
        commandArgs: [fileStatus?.path, repoRoot],
        visible: isRevertable,
      },
      {
        type: 'command',
        label: 'Show in Git Pane',
        id: 'git-cruiser/file/show-in-pane',
        icon: 'git-cruiser/pane',
        command: 'git.showInGitPane',
        commandArgs: [metadata.uri],
        visible: hasChanges,
      },
    ]);
  });

  bifrost.menus.registerMenuModifier('std/file-explorer/directory', (menu: Menu, metadata: any) => {
    assertNotNull(metadata.uri, 'metadata.uri');

    const repoRoot = gitService.getRepoRootForUri(metadata.uri);
    if (!repoRoot || !gitService.isActive) {
      return menu;
    }

    return bifrost.menus.appendToMenu(menu, [
      { type: 'divider' },
      {
        type: 'command',
        label: 'Show in Git Pane',
        id: 'git-cruiser/directory/show-in-pane',
        icon: 'git-cruiser/pane',
        command: 'git.showInGitPane',
        commandArgs: [metadata.uri],
      },
    ]);
  });

  bifrost.menus.registerMenuModifier('std/file-explorer/project', (menu: Menu, metadata: any) => {
    const repoRoot = gitService.getRepoRootForUri(metadata.uri);
    if (!repoRoot || !gitService.isActive) {
      return menu;
    }

    return bifrost.menus.appendToMenu(menu, [
      { type: 'divider' },
      {
        type: 'command',
        label: 'Show in Git Pane',
        id: 'git-cruiser/project/show-in-pane',
        icon: 'git-cruiser/pane',
        command: 'git.showInGitPane',
        commandArgs: [metadata.uri],
      },
    ]);
  });

  bifrost.menus.registerMenuModifier('std/file-explorer/solution-root', (menu: Menu, metadata: any) => {
    const repoRoot = gitService.getRepoRootForUri(metadata.uri);
    if (!repoRoot || !gitService.isActive) {
      return menu;
    }

    return bifrost.menus.appendToMenu(menu, [
      { type: 'divider' },
      {
        type: 'command',
        label: 'Show in Git Pane',
        id: 'git-cruiser/solution-root/show-in-pane',
        icon: 'git-cruiser/pane',
        command: 'git.showInGitPane',
        commandArgs: [metadata.uri],
      },
    ]);
  });

  bifrost.menus.registerMenuModifier('std/editor/editor-tab', (menu: Menu, metadata: any) => {
    assertNotNull(metadata.uri, 'uri');

    const repoRoot = gitService.getRepoRootForUri(metadata.uri);
    if (!repoRoot || !gitService.isActive) {
      return menu;
    }

    const fileStatus = gitService.getFileStatus(metadata.uri);
    const hasChanges = fileStatus != null;
    const isRevertable = hasChanges && fileStatus?.workingTreeStatus !== 'untracked';

    return bifrost.menus.insertAfterMenuItem(menu, 'std/editor/editor-tab/divider-before-split-commands', [
      { type: 'divider' },
      {
        type: 'command',
        label: 'Revert Changes',
        id: 'git-cruiser/editor-tab/revert',
        icon: 'git-cruiser/revert',
        command: 'git.revert',
        commandArgs: [fileStatus?.path, repoRoot],
        visible: isRevertable,
      },
      {
        type: 'command',
        label: 'Show Git Changes',
        id: 'git-cruiser/editor-tab/show-diff',
        icon: 'git-cruiser/diff',
        command: 'git.showGitDiff',
        commandArgs: [metadata.uri],
      },
      {
        type: 'command',
        label: 'Show in Git Pane',
        id: 'git-cruiser/editor-tab/show-in-pane',
        icon: 'git-cruiser/pane',
        command: 'git.showInGitPane',
        commandArgs: [metadata.uri],
        visible: hasChanges,
      },
    ]);
  });

  bifrost.menus.registerMenu('git-cruiser/pane-file', (metadata: any): Menu => {
    const { path: filePath, repoRoot, statusKey, statusCode, uri } = metadata;
    const isStaged = statusKey === 'indexStatus';
    const isRevertable = statusCode !== 'untracked';

    return [
      {
        type: 'command',
        label: isStaged ? 'Unstage' : 'Stage',
        id: 'git-cruiser/pane-file/toggle-stage',
        icon: isStaged ? 'git-cruiser/unstage' : 'git-cruiser/stage',
        command: isStaged ? 'git.unstage' : 'git.stage',
        commandArgs: [filePath, repoRoot],
      },
      {
        type: 'command',
        label: 'Revert Changes',
        id: 'git-cruiser/pane-file/revert',
        icon: 'git-cruiser/revert',
        command: 'git.revert',
        commandArgs: [filePath, repoRoot],
        visible: isRevertable,
      },
      { type: 'divider' },
      {
        type: 'command',
        label: 'Show Git Changes',
        id: 'git-cruiser/pane-file/show-diff',
        icon: 'git-cruiser/diff',
        command: 'git.showGitDiff',
        commandArgs: [uri],
      },
      {
        type: 'command',
        label: 'Open File',
        id: 'git-cruiser/pane-file/open',
        command: 'std.editor.openDocument',
        commandArgs: [uri],
      },
      {
        type: 'command',
        label: 'Reveal in File Manager',
        id: 'git-cruiser/pane-file/reveal',
        command: 'std.shell.revealUniqueContainingFolders',
        commandArgs: [[uri]],
      },
    ];
  });

  bifrost.menus.registerMenu(
    'git-cruiser/pane-commit-actions',
    (titleRef: { current: string }, bodyRef: { current: string }): Menu => {
      const args = [titleRef, bodyRef];
      return [
        { type: 'command', label: 'Commit', command: 'git.pane.commit', commandArgs: args },
        { type: 'command', label: 'Commit & Push', command: 'git.pane.commitAndPush', commandArgs: args },
        { type: 'command', label: 'Commit & Sync', command: 'git.pane.commitAndSync', commandArgs: args },
        { type: 'divider' },
        {
          type: 'command',
          label: 'Commit to new Branch',
          command: 'git.pane.commitToNewBranch',
          commandArgs: args,
        },
        {
          type: 'command',
          label: 'Commit to new Branch & Sync',
          command: 'git.pane.commitToNewBranchAndSync',
          commandArgs: args,
        },
      ];
    },
  );

  bifrost.menus.registerMenuModifier('std/file-explorer/project', (menu: Menu, metadata: any) => {
    const repoRoot = gitService.getRepoRootForUri(metadata.uri);
    if (!repoRoot || !gitService.isActive) {
      return menu;
    }

    return bifrost.menus.appendToMenu(menu, [
      { type: 'divider' },
      {
        type: 'command',
        label: 'Connect to Remote Repository',
        id: 'git-cruiser/project/connect-to-remote',
        command: 'git.connectFolderToRemote',
        commandArgs: [metadata.uri],
        visible: gitService.isActive && repoRoot != null,
      },
    ]);
  });

  bifrost.menus.registerMenuModifier('std/file-explorer/solution-root', (menu: Menu) => {
    return bifrost.menus.insertAfterMenuItem(menu, 'std/file-explorer/solution-root/add-folder', [
      {
        type: 'command',
        label: 'Clone and add Git Repo to Solution',
        id: 'git-cruiser/solution-root/add-git-repo',
        command: 'git.cloneRepository',
        visible: gitService.isActive,
      },
    ]);
  });

  bifrost.menus.registerMenuModifier('std/file-explorer/solution-root', (menu: Menu, metadata: any) => {
    const repoRoot = gitService.getRepoRootForUri(metadata.uri);
    if (!gitService.isActive || repoRoot != null) {
      return menu;
    }

    return bifrost.menus.appendToMenu(menu, [
      { type: 'divider' },
      {
        type: 'command',
        label: 'Connect to Remote Repository',
        id: 'git-cruiser/solution-root/connect-to-remote',
        command: 'git.connectFolderToRemote',
        commandArgs: [metadata.uri],
      },
    ]);
  });

  if (bifrost.menus.isMenuRegistered('std/application/main')) {
    bifrost.menus.registerMenuModifier('std/application/main', async (menuPromise: Promise<Menu>) => {
      const menu = await menuPromise;
      return bifrost.menus.insertAfterMenuItem(menu, 'file/add-folder-to-solution', [
        {
          type: 'command',
          label: 'Clone and add Git Repo to Solution',
          id: 'file/add-git-repo-to-solution',
          command: 'git.cloneRepository',
          visible: gitService.isActive && bifrost.solution.hasOpenSolution(),
        },
      ]);
    });
  }

  if (bifrost.menus.isMenuRegistered('bpmn/element')) {
    bifrost.menus.registerMenuModifier('bpmn/element', (menu: Menu) => {
      const editorDocument = bifrost.editors.getFocusedEditorDocument();
      if (!editorDocument) {
        return menu;
      }

      const repoRoot = gitService.getRepoRootForUri(editorDocument.uri);
      if (!repoRoot || !gitService.isActive) {
        return menu;
      }

      return bifrost.menus.appendToMenu(menu, [
        { type: 'divider' },
        {
          type: 'command',
          label: 'Show Git Changes',
          id: 'git-cruiser/bpmn-element/show-diff',
          icon: 'git-cruiser/diff',
          command: 'git.showGitDiff',
          commandArgs: [editorDocument.uri],
        },
      ]);
    });
  }
}
