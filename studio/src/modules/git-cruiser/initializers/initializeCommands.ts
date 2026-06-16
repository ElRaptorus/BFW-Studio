import type { Bifrost } from '#bifrost/Bifrost';
import { Minimatch } from 'minimatch';
import * as path from 'path';

import type { DialogContentObject, DialogOptions, EditorDocument } from '@evil/bifrost_fw_sdk';

import type { GitService } from '../GitService';
import type { GitFileStatus, GitLogEntry, GitRepoState } from '../GitTypes';
import { buildChangeSummaryForFiles } from '../commitPreview';
import { getProtectedDiagramPatterns } from '../config/ProjectConfig';
import { openCommitDialog } from '../dialogs/commitDialog';
import { confirmRevert } from '../dialogs/confirmRevertDialog';
import {
  showBranchCreateError,
  showCommitError,
  showGitError,
  showPullError,
  showPushError,
  showRevertError,
  showStashError,
  showStashPopError,
} from '../dialogs/gitErrorNotification';
import { handlePullResult } from '../dialogs/pullErrorDialog';
import { suggestGitignore } from '../dialogs/suggestGitignoreDialog';
import { showGitDiffForFile } from '../diffFromGit';
import { showFileHistory } from '../fileHistory';
import type MergeDocumentModel from '../merge/MergeDocumentModel';
import { removeResolvedFile, writeResolvedFile } from '../merge/writeResolvedFile';

function resolveRepoRoot(
  bifrost: Bifrost,
  gitService: GitService,
  commandId: string,
  givenRepoRoot?: string,
): string | null {
  if (givenRepoRoot) {
    return givenRepoRoot;
  }

  const states = gitService.getAllRepoStates();
  if (states.length === 0) {
    return null;
  }
  if (states.length === 1) {
    return states[0].repoRoot;
  }

  bifrost.quickJump.show({
    prompt: 'Select Repository...',
    entries: states.map((state) => ({
      type: 'command',
      label: path.basename(state.repoRoot),
      sublabel: state.branch.detached ? `(${state.branch.current})` : state.branch.current,
      icon: 'git-cruiser/branch',
      command: commandId,
      commandArgs: [state.repoRoot],
    })),
  });
  return null;
}

export function initializeCommands(bifrost: Bifrost, gitService: GitService): void {
  bifrost.commands.register('git.getGitServiceRef', () => gitService);

  bifrost.commands.register(
    'git.refreshStatus',
    async () => {
      await gitService.refreshAllRepos();
    },
    { visibleInSearch: true, description: 'Git: Refresh Status' },
  );

  bifrost.commands.register(
    'git.fetch',
    async (repoRoot?: string) => {
      const resolved = resolveRepoRoot(bifrost, gitService, 'git.fetch', repoRoot);
      if (!resolved) {
        return;
      }

      const progress = bifrost.statusBar.showProgress('Fetching...');
      try {
        await gitService.fetch(resolved);
        await gitService.refreshAllRepos();
        bifrost.notifications.open('Fetch completed.');
      } catch (error: any) {
        showGitError(bifrost, 'Fetch failed', error);
      } finally {
        progress.done();
      }
    },
    { visibleInSearch: true, description: 'Git: Fetch' },
  );

  bifrost.commands.register(
    'git.stageAll',
    async () => {
      for (const state of gitService.getAllRepoStates()) {
        const unstaged = state.files
          .filter((gitFile) => gitFile.workingTreeStatus != null)
          .map((gitFile) => gitFile.path);
        if (unstaged.length > 0) {
          await gitService.stage(state.repoRoot, unstaged);
        }
      }
    },
    { visibleInSearch: true, description: 'Git: Stage All Changes' },
  );

  bifrost.commands.register(
    'git.unstageAll',
    async () => {
      for (const state of gitService.getAllRepoStates()) {
        const staged = state.files.filter((gitFile) => gitFile.indexStatus != null).map((gitFile) => gitFile.path);
        if (staged.length > 0) {
          await gitService.unstage(state.repoRoot, staged);
        }
      }
    },
    { visibleInSearch: true, description: 'Git: Unstage All Changes' },
  );

  bifrost.commands.register('git.stage', async (filePath: string, repoRoot: string) => {
    await gitService.stage(repoRoot, [filePath]);
  });

  bifrost.commands.register('git.unstage', async (filePath: string, repoRoot: string) => {
    await gitService.unstage(repoRoot, [filePath]);
  });

  bifrost.commands.register('git.revert', async (filePath: string, repoRoot: string) => {
    if (!filePath || !repoRoot) {
      console.error('[git-cruiser] revert called with invalid args:', { filePath, repoRoot });
      return;
    }

    try {
      const revertConfirmed = await confirmRevert(bifrost, filePath);
      if (!revertConfirmed) {
        return;
      }

      await gitService.revert(repoRoot, [filePath]);

      const fileUri = `file://${repoRoot}/${filePath}`;
      const openDoc = bifrost.editors.getEditorDocumentByUri(fileUri);
      if (openDoc) {
        await bifrost.editors.saveEditorDocument(openDoc, false);
      }
    } catch (error: any) {
      showRevertError(bifrost, error);
    }
  });

  bifrost.commands.register(
    'git.commit',
    async (repoRoot?: string) => {
      const resolved = resolveRepoRoot(bifrost, gitService, 'git.commit', repoRoot);
      if (!resolved) {
        return;
      }

      const state = gitService.getRepoState(resolved);
      if (state) {
        const protectedHits = findProtectedDiagramsInStaged(bifrost, state);
        if (protectedHits.length > 0) {
          const listing = protectedHits.map((protectedPath) => `- ${protectedPath}`).join('\n');
          const result = await bifrost.dialog.open({
            title: 'Protected Diagrams Detected',
            content: `You are about to commit changes to protected diagram(s):\n\n${listing}\n\nAre you sure you want to proceed?`,
            actions: [
              { label: 'Cancel', response: 'cancel', cancel: true },
              { label: 'Commit Anyway', response: 'commit', dangerous: true, default: true },
            ],
          });
          if (result?.response !== 'commit') {
            return;
          }
        }
      }

      let bpmnSummary: string | null = null;
      if (state) {
        const stagedBpmn = state.files.filter(
          (gitFile) => gitFile.indexStatus != null && gitFile.path.endsWith('.bpmn'),
        );
        if (stagedBpmn.length > 0) {
          bpmnSummary = await buildChangeSummaryForFiles(bifrost, gitService, resolved, stagedBpmn);
        }

        const stagedDmn = state.files.filter((gitFile) => gitFile.indexStatus != null && gitFile.path.endsWith('.dmn'));
        if (stagedDmn.length > 0) {
          const dmnSummary = await buildChangeSummaryForDmnFiles(bifrost, gitService, resolved, stagedDmn);
          bpmnSummary = bpmnSummary ? `${bpmnSummary}\n\n${dmnSummary}` : dmnSummary;
        }
      }

      const options = await openCommitDialog(bifrost, undefined, bpmnSummary ?? undefined);
      if (!options) {
        return;
      }

      try {
        await gitService.commit(resolved, options);
      } catch (error: any) {
        showCommitError(bifrost, error);
      }
    },
    { visibleInSearch: true, description: 'Git: Commit' },
  );

  bifrost.commands.register(
    'git.push',
    async (repoRoot?: string) => {
      const resolved = resolveRepoRoot(bifrost, gitService, 'git.push', repoRoot);
      if (!resolved) {
        return;
      }

      const progress = bifrost.statusBar.showProgress('Pushing...');
      try {
        await gitService.push(resolved);
        bifrost.notifications.open('Pushed successfully.');
      } catch (error: any) {
        const msg = error?.message ?? String(error);
        const actions: any[] = [];

        if (msg.includes('rejected') || msg.includes('non-fast-forward')) {
          actions.push({ label: 'Pull First', response: 'pull-first', default: true });
        } else if (
          msg.includes('no upstream') ||
          msg.includes('has no upstream branch') ||
          msg.includes('--set-upstream')
        ) {
          actions.push({ label: 'Set Upstream & Push', response: 'set-upstream', default: true });
        }

        actions.push({ label: 'Close', response: 'close', cancel: true });

        const result = await bifrost.dialog.open({
          title: 'Git Push Failed',
          content: msg,
          actions,
        });

        if (result?.response === 'pull-first') {
          progress.update('Pulling...');
          const pullResult = await gitService.pull(resolved);
          if (pullResult.success) {
            try {
              progress.update('Pushing...');
              await gitService.push(resolved);
              bifrost.notifications.open('Pull + Push completed successfully.');
            } catch (pushRetry: any) {
              showPushError(bifrost, pushRetry);
            }
          } else {
            await handlePullResult(bifrost, gitService, resolved, pullResult);
          }
        } else if (result?.response === 'set-upstream') {
          try {
            await gitService.push(resolved, { setUpstream: true });
            bifrost.notifications.open('Pushed with upstream set.');
          } catch (upstreamError: any) {
            showPushError(bifrost, upstreamError);
          }
        }
      } finally {
        progress.done();
      }
    },
    { visibleInSearch: true, description: 'Git: Push' },
  );

  bifrost.commands.register(
    'git.pull',
    async (repoRoot?: string): Promise<boolean> => {
      const resolved = resolveRepoRoot(bifrost, gitService, 'git.pull', repoRoot);
      if (!resolved) {
        return false;
      }

      const progress = bifrost.statusBar.showProgress('Pulling...');
      try {
        const result = await gitService.pull(resolved);
        if (result.success) {
          bifrost.notifications.open('Pulled successfully.');
          return true;
        }
        return await handlePullResult(bifrost, gitService, resolved, result);
      } catch (error: any) {
        showPullError(bifrost, error);
        return false;
      } finally {
        progress.done();
      }
    },
    { visibleInSearch: true, description: 'Git: Pull' },
  );

  bifrost.commands.register(
    'git.sync',
    async (repoRoot?: string) => {
      const resolved = resolveRepoRoot(bifrost, gitService, 'git.sync', repoRoot);
      if (!resolved) {
        return;
      }

      const progress = bifrost.statusBar.showProgress('Syncing...');
      gitService.isSyncing = true;
      bifrost.statusBar.updateStatusBarItems();
      try {
        progress.update('Fetching...');
        await gitService.fetch(resolved);

        progress.update('Pulling...');
        const pullOK = await bifrost.commands.executeCommand('git.pull', [resolved]);
        if (!pullOK) {
          return;
        }

        progress.update('Pushing...');
        await gitService.push(resolved);
        bifrost.notifications.open('Sync completed (Fetch + Pull + Push).');
      } catch (error: any) {
        showPushError(bifrost, error);
      } finally {
        gitService.isSyncing = false;
        bifrost.statusBar.updateStatusBarItems();
        progress.done();
      }
    },
    { visibleInSearch: true, description: 'Git: Sync (Fetch + Pull + Push)' },
  );

  bifrost.commands.register(
    'git.stash',
    async (repoRoot?: string) => {
      const resolved = resolveRepoRoot(bifrost, gitService, 'git.stash', repoRoot);
      if (!resolved) {
        return;
      }

      const message = await bifrost.dialog.prompt('Stash Message (optional)', 'e.g. WIP: feature work');

      try {
        await gitService.stash(resolved, message?.trim() || undefined);
      } catch (error: any) {
        showStashError(bifrost, error);
      }
    },
    { visibleInSearch: true, description: 'Git: Stash Changes' },
  );

  bifrost.commands.register(
    'git.stashApply',
    async (repoRoot?: string) => {
      const resolved = resolveRepoRoot(bifrost, gitService, 'git.stashApply', repoRoot);
      if (!resolved) {
        return;
      }

      const stashEntries = await gitService.stashList(resolved);
      if (stashEntries.length === 0) {
        bifrost.notifications.open({ type: 'info', content: 'No stash entries found.', source: 'Git Cruiser' });
        return;
      }

      try {
        await gitService.stashApply(resolved);
      } catch (error: any) {
        showStashPopError(bifrost, error);
      }
    },
    { visibleInSearch: true, description: 'Git: Apply Stash' },
  );

  bifrost.commands.register(
    'git.switchBranch',
    async (repoRoot?: string, branchName?: string) => {
      const resolved = resolveRepoRoot(bifrost, gitService, 'git.switchBranch', repoRoot);
      if (!resolved) {
        return;
      }

      if (!branchName) {
        const branchData = await gitService.getBranches(resolved);
        const localBranches = branchData.branches.filter(
          (branch: any) => !branch.name.startsWith('remotes/') && !branch.name.startsWith('HEAD'),
        );
        const remoteBranches = branchData.branches.filter(
          (branch: any) => branch.name.startsWith('remotes/') && !branch.name.endsWith('/HEAD'),
        );

        const entries: any[] = [
          {
            type: 'command',
            label: 'Create new branch...',
            icon: 'ph-light ph-plus',
            command: 'git.createBranch',
            commandArgs: [resolved],
            sticky: true,
          },
          ...localBranches.map((branch: any) => ({
            type: 'command',
            label: branch.name,
            icon: 'git-cruiser/branch',
            command: 'git.switchBranch',
            commandArgs: [resolved, branch.name],
            badges: branch.name === branchData.current ? [{ type: 'text', text: 'current' }] : undefined,
          })),
          ...remoteBranches.map((branch: any) => ({
            type: 'command',
            label: branch.name.replace(/^remotes\//, ''),
            icon: 'ph-light ph-cloud',
            command: 'git.switchBranch',
            commandArgs: [resolved, branch.name.replace(/^remotes\//, '')],
          })),
        ];

        bifrost.quickJump.show({
          prompt: 'Select a branch or tag to checkout',
          entries,
        });
        return;
      }

      try {
        await gitService.switchBranch(resolved, branchName);
      } catch (error: any) {
        const msg = error?.message ?? String(error);
        const actions: any[] = [];

        if (msg.includes('uncommitted changes') || msg.includes('would be overwritten')) {
          actions.push({ label: 'Stash & Switch', response: 'stash-switch', default: true });
        }
        actions.push({ label: 'Close', response: 'close', cancel: true });

        const result = await bifrost.dialog.open({
          title: 'Branch Switch Failed',
          content: msg,
          actions,
        });

        if (result?.response === 'stash-switch') {
          try {
            await gitService.stash(resolved, 'Auto-stash before branch switch');
            await gitService.switchBranch(resolved, branchName);
            await gitService.stashApply(resolved, 0);
          } catch (stashError: any) {
            showGitError(bifrost, 'Stash & switch failed', stashError);
          }
        }
      }
    },
    { visibleInSearch: true, description: 'Git: Switch Branch' },
  );

  bifrost.commands.register(
    'git.createBranch',
    async (repoRoot?: string) => {
      const resolved = resolveRepoRoot(bifrost, gitService, 'git.createBranch', repoRoot);
      if (!resolved) {
        return;
      }

      const branchName = await bifrost.dialog.prompt('New Branch Name', 'e.g. feature/my-new-feature');
      if (!branchName?.trim()) {
        return;
      }

      try {
        await gitService.createBranch(resolved, branchName.trim(), true);
      } catch (error: any) {
        showBranchCreateError(bifrost, error);
      }
    },
    { visibleInSearch: true, description: 'Git: Create Branch' },
  );

  bifrost.commands.register(
    'git.createBranchForProcess',
    async () => {
      if (!bifrost.commands.isRegistered('bpmn.diff.suggestBranchNameForProcess')) {
        bifrost.notifications.open('No branch name provider available for the current document type.');
        return;
      }

      const suggestion = await bifrost.commands.executeCommand<{ uri: string; suggestedName: string } | null>(
        'bpmn.diff.suggestBranchNameForProcess',
      );
      if (!suggestion) {
        bifrost.notifications.open('No BPMN document is currently focused.');
        return;
      }

      const repoRoot = gitService.getRepoRootForUri(suggestion.uri);
      if (!repoRoot) {
        bifrost.notifications.open('File is not in a Git repository.');
        return;
      }

      const branchName = await bifrost.dialog.prompt('Create Branch for Process', suggestion.suggestedName);
      if (!branchName?.trim()) {
        return;
      }

      try {
        await gitService.createBranch(repoRoot, branchName.trim(), true);
      } catch (error: any) {
        showBranchCreateError(bifrost, error);
      }
    },
    { visibleInSearch: true, description: 'Git: Create Branch for This Process' },
  );

  bifrost.commands.register(
    'git.showGitDiff',
    async (uri: string) => await showGitDiffForFile(bifrost, gitService, uri),
    {
      visibleInSearch: true,
      description: 'Git: Show Changes for This File',
      enabledWhen: (uri?: string): boolean => {
        if (!uri) {
          return false;
        }
        return gitService.hasModifications(uri);
      },
    },
  );

  bifrost.commands.register(
    'git.showFileHistory',
    async (uri: string) => await showFileHistory(bifrost, gitService, uri),
    {
      enabledWhen: (uri?: string): boolean => {
        if (!uri) {
          return false;
        }
        return gitService.hasFileHistory(uri);
      },
    },
  );

  bifrost.commands.register('git.showInGitPane', async (_uri?: string) => {
    bifrost.panes.setVisibilityOfPaneAreaByPaneId('pane/left/git', true);
  });

  bifrost.commands.register('git.showGitNotFoundInfo', async () => {
    bifrost.notifications.open(
      'Git was not found on this system. Install Git, make sure it is available in your PATH, and run "Git: Refresh Status".',
    );
  });

  bifrost.commands.register('git.getHeadContent', async (uri: string): Promise<string> => {
    const repoRoot = gitService.getRepoRootForUri(uri);
    if (!repoRoot) {
      throw new Error('File is not in a Git repository.');
    }

    const filePath = uri.startsWith('file://') ? uri.substring('file://'.length) : uri;
    const relativePath = filePath.substring(repoRoot.length + 1);

    return gitService.showFileAtRef(repoRoot, `HEAD:${relativePath}`);
  });

  bifrost.commands.register('git.getFileAtRef', async (uri: string, ref: string): Promise<string> => {
    const repoRoot = gitService.getRepoRootForUri(uri);
    if (!repoRoot) {
      throw new Error('File is not in a Git repository.');
    }

    const filePath = uri.startsWith('file://') ? uri.substring('file://'.length) : uri;
    const relativePath = filePath.substring(repoRoot.length + 1);

    return gitService.showFileAtRef(repoRoot, `${ref}:${relativePath}`);
  });

  bifrost.commands.register('git.getLog', async (uri: string): Promise<GitLogEntry[]> => {
    const repoRoot = gitService.getRepoRootForUri(uri);
    if (!repoRoot) {
      throw new Error('File is not in a Git repository.');
    }

    const filePath = uri.startsWith('file://') ? uri.substring('file://'.length) : uri;
    const relativePath = filePath.substring(repoRoot.length + 1);

    return gitService.getLog(repoRoot, { file: relativePath });
  });

  bifrost.commands.register(
    'git.createBranchInRepoOf',
    async (uri: string, branchName: string, checkout = true): Promise<void> => {
      const repoRoot = gitService.getRepoRootForUri(uri);
      if (!repoRoot) {
        throw new Error('File is not in a Git repository.');
      }
      await gitService.createBranch(repoRoot, branchName, checkout);
    },
  );

  bifrost.commands.register(
    'git.restoreFileContent',
    async (
      editorDocument: EditorDocument,
      parentUri: string,
      content: string,
      filename: string,
      shortHash: string,
    ): Promise<void> => {
      const result = await bifrost.dialog.open({
        title: 'Restore Diagram',
        content: `This will overwrite the current version of '${filename}' with the version from commit ${shortHash}. Any unsaved changes will be lost. Proceed?`,
        actions: [
          { label: 'Restore', response: 'restore', dangerous: true, default: true },
          { label: 'Cancel', response: 'cancel', cancel: true },
        ],
      });

      if (result?.response !== 'restore') {
        return;
      }

      await bifrost.files.save(parentUri, content);
      bifrost.notifications.open(`Restored '${filename}' to version ${shortHash}.`);

      await bifrost.editors.closeEditorDocument(editorDocument);
      bifrost.editors.focusOrOpenEditorDocument(parentUri);
    },
  );

  bifrost.commands.register('git.suggestGitignore', async (repoRoot: string) => {
    const gitignoreUri = `file://${repoRoot}/.gitignore`;
    const localPath = bifrost.files.getLocalFilenameForUri(gitignoreUri);
    const exists = await bifrost.files.doesFileOrDirectoryExist(localPath);

    if (exists) {
      return;
    }

    suggestGitignore(bifrost, repoRoot);
  });

  initializeMergeCommands(bifrost, gitService);
  initializePaneCommitCommands(bifrost, gitService);
  initializeCloneAndConnectCommands(bifrost, gitService);

  if (process.env.APP_TEST === 'true') {
    initializeTestCommands(bifrost, gitService);
  }
}

function initializeMergeCommands(bifrost: Bifrost, gitService: GitService): void {
  // --- Generic dispatch commands (std-style pattern) ---

  function getDocType(model: MergeDocumentModel): string | null {
    return model?.getFileDocumentType() ?? null;
  }

  bifrost.commands.register(
    'git.merge.zoomToViewport',
    (model: MergeDocumentModel) => {
      const docType = getDocType(model);
      if (docType && bifrost.commands.isRegistered(`git.merge.zoomToViewport.${docType}`)) {
        bifrost.commands.executeCommand(`git.merge.zoomToViewport.${docType}`, [model]);
      }
    },
    {
      enabledWhen: (model: MergeDocumentModel) => {
        const docType = getDocType(model);
        return docType != null && bifrost.commands.isRegistered(`git.merge.zoomToViewport.${docType}`);
      },
    },
  );

  bifrost.commands.register(
    'git.merge.zoomToActualSize',
    (model: MergeDocumentModel) => {
      const docType = getDocType(model);
      if (docType && bifrost.commands.isRegistered(`git.merge.zoomToActualSize.${docType}`)) {
        bifrost.commands.executeCommand(`git.merge.zoomToActualSize.${docType}`, [model]);
      }
    },
    {
      enabledWhen: (model: MergeDocumentModel) => {
        const docType = getDocType(model);
        return docType != null && bifrost.commands.isRegistered(`git.merge.zoomToActualSize.${docType}`);
      },
    },
  );

  bifrost.commands.register(
    'git.merge.zoomToSelectedElement',
    (model: MergeDocumentModel) => {
      const docType = getDocType(model);
      if (docType && bifrost.commands.isRegistered(`git.merge.zoomToSelectedElement.${docType}`)) {
        bifrost.commands.executeCommand(`git.merge.zoomToSelectedElement.${docType}`, [model]);
      }
    },
    {
      enabledWhen: (model: MergeDocumentModel) => {
        const docType = getDocType(model);
        return docType != null && bifrost.commands.isRegistered(`git.merge.zoomToSelectedElement.${docType}`);
      },
    },
  );

  bifrost.commands.register(
    'git.merge.selectNextConflict',
    (model: MergeDocumentModel) => {
      const docType = getDocType(model);
      if (docType && bifrost.commands.isRegistered(`git.merge.selectNextConflict.${docType}`)) {
        bifrost.commands.executeCommand(`git.merge.selectNextConflict.${docType}`, [model]);
      }
    },
    {
      enabledWhen: (model: MergeDocumentModel) => {
        const docType = getDocType(model);
        return docType != null && bifrost.commands.isRegistered(`git.merge.selectNextConflict.${docType}`);
      },
    },
  );

  bifrost.commands.register(
    'git.merge.selectPreviousConflict',
    (model: MergeDocumentModel) => {
      const docType = getDocType(model);
      if (docType && bifrost.commands.isRegistered(`git.merge.selectPreviousConflict.${docType}`)) {
        bifrost.commands.executeCommand(`git.merge.selectPreviousConflict.${docType}`, [model]);
      }
    },
    {
      enabledWhen: (model: MergeDocumentModel) => {
        const docType = getDocType(model);
        return docType != null && bifrost.commands.isRegistered(`git.merge.selectPreviousConflict.${docType}`);
      },
    },
  );

  bifrost.commands.register(
    'git.merge.getCurrentConflictIndex',
    (model: MergeDocumentModel): { current: number | null; total: number } | null => {
      const docType = getDocType(model);
      if (docType && bifrost.commands.isRegistered(`git.merge.getCurrentConflictIndex.${docType}`)) {
        return bifrost.commands.executeCommand(`git.merge.getCurrentConflictIndex.${docType}`, [model]);
      }
      return null;
    },
  );

  bifrost.commands.register('git.merge.acceptOursThenEdit', async (model: MergeDocumentModel) => {
    const docType = getDocType(model);
    if (docType && bifrost.commands.isRegistered(`git.merge.acceptOursThenEdit.${docType}`)) {
      bifrost.commands.executeCommand(`git.merge.acceptOursThenEdit.${docType}`, [model]);
      return;
    }

    const entry = model.getCurrentEntry();
    if (entry == null) {
      return;
    }
    const repoRoot = model.getRepoRoot();
    if (model.conflictKind === 'ours-deleted') {
      await removeResolvedFile(gitService, repoRoot, entry.relativePath);
    } else if (model.blobs?.ours != null) {
      await writeResolvedFile(bifrost, gitService, repoRoot, entry.relativePath, model.blobs.ours, { stage: true });
    }
    model.markCurrentResolved();
    model.advanceToNext();
    bifrost.editors.focusOrOpenEditorDocument(entry.uri);
  });

  bifrost.commands.register('git.merge.acceptTheirsThenEdit', async (model: MergeDocumentModel) => {
    const docType = getDocType(model);
    if (docType && bifrost.commands.isRegistered(`git.merge.acceptTheirsThenEdit.${docType}`)) {
      bifrost.commands.executeCommand(`git.merge.acceptTheirsThenEdit.${docType}`, [model]);
      return;
    }

    const entry = model.getCurrentEntry();
    if (entry == null) {
      return;
    }
    const repoRoot = model.getRepoRoot();
    if (model.conflictKind === 'theirs-deleted') {
      await removeResolvedFile(gitService, repoRoot, entry.relativePath);
    } else if (model.blobs?.theirs != null) {
      await writeResolvedFile(bifrost, gitService, repoRoot, entry.relativePath, model.blobs.theirs, { stage: true });
    }
    model.markCurrentResolved();
    model.advanceToNext();
    bifrost.editors.focusOrOpenEditorDocument(entry.uri);
  });

  // --- File-level merge commands ---

  bifrost.commands.register('git.merge.acceptOurs', async (model: MergeDocumentModel) => {
    const entry = model.getCurrentEntry();
    if (entry == null) {
      return;
    }

    const repoRoot = model.getRepoRoot();

    // When a result modeler is active, batch-resolve all pending as "ours"
    // and write the merged result instead of the raw blob.
    const resolverApi = model.resolverRef?.current;
    if (resolverApi?.acceptAllOurs != null) {
      resolverApi.acceptAllOurs();
      const xml = await resolverApi.getResultXml?.();
      if (xml != null) {
        await writeResolvedFile(bifrost, gitService, repoRoot, entry.relativePath, xml, { stage: true });
        model.markCurrentResolved();
        model.advanceToNext();
        return;
      }
    }

    if (model.conflictKind === 'ours-deleted') {
      await removeResolvedFile(gitService, repoRoot, entry.relativePath);
    } else if (model.blobs?.ours != null) {
      await writeResolvedFile(bifrost, gitService, repoRoot, entry.relativePath, model.blobs.ours, { stage: true });
    }

    model.markCurrentResolved();
    model.advanceToNext();
  });

  bifrost.commands.register('git.merge.acceptTheirs', async (model: MergeDocumentModel) => {
    const entry = model.getCurrentEntry();
    if (entry == null) {
      return;
    }

    const repoRoot = model.getRepoRoot();

    const resolverApi = model.resolverRef?.current;
    if (resolverApi?.acceptAllTheirs != null) {
      resolverApi.acceptAllTheirs();
      const xml = await resolverApi.getResultXml?.();
      if (xml != null) {
        await writeResolvedFile(bifrost, gitService, repoRoot, entry.relativePath, xml, { stage: true });
        model.markCurrentResolved();
        model.advanceToNext();
        return;
      }
    }

    if (model.conflictKind === 'theirs-deleted') {
      await removeResolvedFile(gitService, repoRoot, entry.relativePath);
    } else if (model.blobs?.theirs != null) {
      await writeResolvedFile(bifrost, gitService, repoRoot, entry.relativePath, model.blobs.theirs, { stage: true });
    }

    model.markCurrentResolved();
    model.advanceToNext();
  });

  bifrost.commands.register(
    'git.merge.skip',
    (model: MergeDocumentModel) => {
      model.advanceToNext();
    },
    { enabledWhen: (model: MergeDocumentModel) => model != null && model.getProgress().remaining > 1 },
  );

  bifrost.commands.register('git.merge.abort', async () => {
    const repoRoot = gitService.getSelectedRepo();
    if (repoRoot == null) {
      return;
    }

    const state = gitService.getRepoState(repoRoot);
    if (state == null) {
      return;
    }

    try {
      switch (state.mergeState.kind) {
        case 'merge':
          await gitService.mergeAbort(repoRoot);
          break;
        case 'rebase':
          await gitService.rebaseAbort(repoRoot);
          break;
        case 'cherry-pick':
          await gitService.cherryPickAbort(repoRoot);
          break;
        default:
          break;
      }
    } catch (error: any) {
      showGitError(bifrost, 'abort merge', error);
    }
  });

  // --- Per-element resolution dispatch commands ---

  bifrost.commands.register(
    'git.merge.acceptOursForElement',
    (model: MergeDocumentModel, elementId: string) => {
      const docType = getDocType(model);
      if (docType && bifrost.commands.isRegistered(`git.merge.acceptOursForElement.${docType}`)) {
        bifrost.commands.executeCommand(`git.merge.acceptOursForElement.${docType}`, [model, elementId]);
      }
    },
    {
      enabledWhen: (model: MergeDocumentModel) => {
        const docType = getDocType(model);
        return docType != null && bifrost.commands.isRegistered(`git.merge.acceptOursForElement.${docType}`);
      },
    },
  );

  bifrost.commands.register(
    'git.merge.acceptTheirsForElement',
    (model: MergeDocumentModel, elementId: string) => {
      const docType = getDocType(model);
      if (docType && bifrost.commands.isRegistered(`git.merge.acceptTheirsForElement.${docType}`)) {
        bifrost.commands.executeCommand(`git.merge.acceptTheirsForElement.${docType}`, [model, elementId]);
      }
    },
    {
      enabledWhen: (model: MergeDocumentModel) => {
        const docType = getDocType(model);
        return docType != null && bifrost.commands.isRegistered(`git.merge.acceptTheirsForElement.${docType}`);
      },
    },
  );

  bifrost.commands.register(
    'git.merge.acceptAllOurs',
    (model: MergeDocumentModel) => {
      const docType = getDocType(model);
      if (docType && bifrost.commands.isRegistered(`git.merge.acceptAllOurs.${docType}`)) {
        bifrost.commands.executeCommand(`git.merge.acceptAllOurs.${docType}`, [model]);
      }
    },
    {
      enabledWhen: (model: MergeDocumentModel) => {
        const docType = getDocType(model);
        return docType != null && bifrost.commands.isRegistered(`git.merge.acceptAllOurs.${docType}`);
      },
    },
  );

  bifrost.commands.register(
    'git.merge.acceptAllTheirs',
    (model: MergeDocumentModel) => {
      const docType = getDocType(model);
      if (docType && bifrost.commands.isRegistered(`git.merge.acceptAllTheirs.${docType}`)) {
        bifrost.commands.executeCommand(`git.merge.acceptAllTheirs.${docType}`, [model]);
      }
    },
    {
      enabledWhen: (model: MergeDocumentModel) => {
        const docType = getDocType(model);
        return docType != null && bifrost.commands.isRegistered(`git.merge.acceptAllTheirs.${docType}`);
      },
    },
  );

  bifrost.commands.register(
    'git.merge.resolveAndStage',
    async (model: MergeDocumentModel) => {
      const docType = getDocType(model);
      const entry = model.getCurrentEntry();
      if (entry == null) {
        return;
      }
      const repoRoot = model.getRepoRoot();

      let xml: string | null = null;
      if (docType && bifrost.commands.isRegistered(`git.merge.getResultXml.${docType}`)) {
        xml = await bifrost.commands.executeCommand<string | null>(`git.merge.getResultXml.${docType}`, [model]);
      }

      if (xml != null) {
        await writeResolvedFile(bifrost, gitService, repoRoot, entry.relativePath, xml, { stage: true });
        model.markCurrentResolved();
        model.advanceToNext();
      }
    },
    {
      enabledWhen: (model: MergeDocumentModel) => {
        if (model == null) {
          return false;
        }
        return model.isCurrentFileFullyResolved();
      },
    },
  );

  bifrost.commands.register(
    'git.merge.saveTextAndNext',
    async (model: MergeDocumentModel, text: string) => {
      const entry = model.getCurrentEntry();
      if (entry == null || text == null) {
        return;
      }
      const repoRoot = model.getRepoRoot();
      await writeResolvedFile(bifrost, gitService, repoRoot, entry.relativePath, text, { stage: true });
      model.markCurrentResolved();
      model.advanceToNext();
    },
    { enabledWhen: (model: MergeDocumentModel, text: string) => model != null && text != null && text.trim() != '' },
  );

  bifrost.commands.register('git.merge.paneAcceptOurs', async (relativePath: string, repoRoot: string) => {
    const blobs = await gitService.getConflictBlobs(repoRoot, relativePath);
    if (blobs.ours != null) {
      await writeResolvedFile(bifrost, gitService, repoRoot, relativePath, blobs.ours, { stage: true });
    } else {
      await removeResolvedFile(gitService, repoRoot, relativePath);
    }
  });

  bifrost.commands.register('git.merge.paneAcceptTheirs', async (relativePath: string, repoRoot: string) => {
    const blobs = await gitService.getConflictBlobs(repoRoot, relativePath);
    if (blobs.theirs != null) {
      await writeResolvedFile(bifrost, gitService, repoRoot, relativePath, blobs.theirs, { stage: true });
    } else {
      await removeResolvedFile(gitService, repoRoot, relativePath);
    }
  });

  bifrost.commands.register('git.merge.continue', async () => {
    const repoRoot = gitService.getSelectedRepo();
    if (repoRoot == null) {
      return;
    }

    const state = gitService.getRepoState(repoRoot);
    if (state == null) {
      return;
    }

    try {
      switch (state.mergeState.kind) {
        case 'rebase':
          await gitService.rebaseContinue(repoRoot);
          break;
        case 'cherry-pick':
          await gitService.cherryPickContinue(repoRoot);
          break;
        default:
          break;
      }
    } catch (error: any) {
      showGitError(bifrost, 'continue merge', error);
    }
  });
}

type CommitRef = { current: string };

function initializePaneCommitCommands(bifrost: Bifrost, gitService: GitService): void {
  const canPaneCommit = (titleRef?: CommitRef): boolean => {
    const repoRoot = gitService.getSelectedRepo();
    if (!repoRoot || !titleRef?.current?.trim()) {
      return false;
    }
    const state = gitService.getRepoState(repoRoot);
    if (!state) {
      return false;
    }
    return state.files.some((file) => file.indexStatus != null && file.indexStatus !== 'untracked');
  };

  const clearRefs = (titleRef: CommitRef, bodyRef: CommitRef): void => {
    titleRef.current = '';
    bodyRef.current = '';
  };

  const buildCommitOptions = (titleRef: CommitRef, bodyRef: CommitRef) => ({
    title: titleRef.current.trim(),
    body: bodyRef.current?.trim() || undefined,
  });

  type BranchResolution = { ready: true; isNew: boolean } | { ready: false };

  async function resolveNewBranch(repoRoot: string, branchName: string): Promise<BranchResolution> {
    const { branches, current } = await gitService.getBranches(repoRoot);
    const localExists = branches.some((branch) => branch.name === branchName);
    const remoteExists = branches.some((branch) => branch.name === `remotes/origin/${branchName}`);

    if (!localExists && !remoteExists) {
      try {
        await gitService.createBranch(repoRoot, branchName, true);
        return { ready: true, isNew: true };
      } catch (error: any) {
        showBranchCreateError(bifrost, error);
        return { ready: false };
      }
    }

    if (current === branchName) {
      bifrost.notifications.open({
        type: 'info',
        content: `You are already on branch \`${branchName}\`. Use a regular Commit instead.`,
        source: 'Git Cruiser',
      });
      return { ready: false };
    }

    let where: string;
    if (localExists && remoteExists) {
      where = 'locally and on the remote';
    } else if (remoteExists) {
      where = 'on the remote';
    } else {
      where = 'locally';
    }

    const result = await bifrost.dialog.open({
      title: 'Branch already exists',
      content: `Branch \`${branchName}\` already exists ${where}.\n\nContinuing will check out the existing branch and commit on top of it.`,
      actions: [
        { label: 'Cancel', response: 'cancel', cancel: true },
        { label: 'Continue', response: 'continue', dangerous: true, default: true },
      ],
    });

    if (result?.response !== 'continue') {
      return { ready: false };
    }

    return await switchToExistingBranch(repoRoot, branchName, current);
  }

  async function switchToExistingBranch(
    repoRoot: string,
    branchName: string,
    originalBranch: string,
  ): Promise<BranchResolution> {
    try {
      await gitService.switchBranch(repoRoot, branchName);
      return { ready: true, isNew: false };
    } catch (error: any) {
      const errorMsg = error?.message ?? String(error);
      const isLocalChangesConflict =
        errorMsg.includes('overwritten') || errorMsg.includes('überschrieben') || errorMsg.includes('uncommitted');

      if (!isLocalChangesConflict) {
        showGitError(bifrost, `Failed to switch to branch \`${branchName}\``, error);
        return { ready: false };
      }
    }

    try {
      await gitService.stash(repoRoot, `auto: switch to ${branchName}`);
    } catch (error: any) {
      showGitError(bifrost, 'Failed to stash your changes before switching branches', error);
      return { ready: false };
    }

    try {
      await gitService.switchBranch(repoRoot, branchName);
    } catch (error: any) {
      await safeStashPop(repoRoot);
      showGitError(bifrost, `Failed to switch to branch \`${branchName}\` after stashing`, error);
      return { ready: false };
    }

    try {
      await gitService.stashApply(repoRoot, undefined, { restoreIndex: true });
      return { ready: true, isNew: false };
    } catch (popError: any) {
      const popMsg = popError?.message ?? String(popError);
      await revertFailedStashPop(repoRoot, branchName, originalBranch);

      let userMessage: string;
      if (popMsg.includes('conflict') || popMsg.includes('Konflikt') || popMsg.includes('CONFLICT')) {
        userMessage =
          `Your staged changes conflict with files on branch \`${branchName}\`.\n\n` +
          `The operation has been reverted — you are back on \`${originalBranch}\` with your original changes intact.`;
      } else {
        userMessage =
          `Could not restore your changes on branch \`${branchName}\`.\n\n` +
          `The operation has been reverted — you are back on \`${originalBranch}\` with your original changes intact.`;
      }

      bifrost.notifications.open({ type: 'error', content: userMessage, source: 'Git Cruiser' });
      return { ready: false };
    }
  }

  async function revertFailedStashPop(repoRoot: string, targetBranch: string, originalBranch: string): Promise<void> {
    try {
      await gitService.unstage(repoRoot, ['.']);
      await gitService.revert(repoRoot, ['.']);
      await gitService.switchBranch(repoRoot, originalBranch);
      await safeStashPop(repoRoot);
    } catch (revertError: any) {
      console.error(
        `[git-cruiser] Failed to fully revert branch switch from ${targetBranch} to ${originalBranch}.`,
        revertError,
      );
    }
  }

  async function safeStashPop(repoRoot: string): Promise<void> {
    try {
      await gitService.stashApply(repoRoot, undefined, { restoreIndex: true });
    } catch {
      // Last resort — nothing more we can do
    }
  }

  bifrost.commands.register(
    'git.pane.commit',
    async (titleRef: CommitRef, bodyRef: CommitRef) => {
      const repoRoot = gitService.getSelectedRepo();
      if (!repoRoot || !titleRef.current.trim()) {
        return;
      }
      try {
        await gitService.commit(repoRoot, buildCommitOptions(titleRef, bodyRef));
        clearRefs(titleRef, bodyRef);
      } catch (error: any) {
        showCommitError(bifrost, error);
      }
    },
    { enabledWhen: (titleRef?: CommitRef) => canPaneCommit(titleRef) },
  );

  bifrost.commands.register(
    'git.pane.commitAndPush',
    async (titleRef: CommitRef, bodyRef: CommitRef) => {
      const repoRoot = gitService.getSelectedRepo();
      if (!repoRoot || !titleRef.current.trim()) {
        return;
      }
      try {
        await gitService.commit(repoRoot, buildCommitOptions(titleRef, bodyRef));
        clearRefs(titleRef, bodyRef);
        await gitService.push(repoRoot);
      } catch (error: any) {
        showPushError(bifrost, error);
      }
    },
    { enabledWhen: (titleRef?: CommitRef) => canPaneCommit(titleRef) },
  );

  bifrost.commands.register(
    'git.pane.commitAndSync',
    async (titleRef: CommitRef, bodyRef: CommitRef) => {
      const repoRoot = gitService.getSelectedRepo();
      if (!repoRoot || !titleRef.current.trim()) {
        return;
      }
      gitService.isSyncing = true;
      bifrost.statusBar.updateStatusBarItems();
      try {
        await gitService.fetch(repoRoot);
        await gitService.commit(repoRoot, buildCommitOptions(titleRef, bodyRef));
        clearRefs(titleRef, bodyRef);
        const pullOK = await bifrost.commands.executeCommand('git.pull', [repoRoot]);
        if (!pullOK) {
          return;
        }
        await gitService.push(repoRoot);
      } catch (error: any) {
        showPushError(bifrost, error);
      } finally {
        gitService.isSyncing = false;
        bifrost.statusBar.updateStatusBarItems();
      }
    },
    { enabledWhen: (titleRef?: CommitRef) => canPaneCommit(titleRef) },
  );

  bifrost.commands.register(
    'git.pane.commitToNewBranch',
    async (titleRef: CommitRef, bodyRef: CommitRef) => {
      const repoRoot = gitService.getSelectedRepo();
      if (!repoRoot || !titleRef.current.trim()) {
        return;
      }

      const branchName = await bifrost.dialog.prompt('New Branch Name', 'e.g. feature/my-new-feature');
      if (!branchName?.trim()) {
        return;
      }

      const resolution = await resolveNewBranch(repoRoot, branchName.trim());
      if (!resolution.ready) {
        return;
      }

      try {
        await gitService.commit(repoRoot, buildCommitOptions(titleRef, bodyRef));
        clearRefs(titleRef, bodyRef);
      } catch (error: any) {
        showCommitError(bifrost, error);
      }
    },
    { enabledWhen: (titleRef?: CommitRef) => canPaneCommit(titleRef) },
  );

  bifrost.commands.register(
    'git.pane.commitToNewBranchAndSync',
    async (titleRef: CommitRef, bodyRef: CommitRef) => {
      const repoRoot = gitService.getSelectedRepo();
      if (!repoRoot || !titleRef.current.trim()) {
        return;
      }

      const branchName = await bifrost.dialog.prompt('New Branch Name', 'e.g. feature/my-new-feature');
      if (!branchName?.trim()) {
        return;
      }

      gitService.isSyncing = true;
      bifrost.statusBar.updateStatusBarItems();
      try {
        await gitService.fetch(repoRoot);
        const resolution = await resolveNewBranch(repoRoot, branchName.trim());
        if (!resolution.ready) {
          return;
        }

        await gitService.commit(repoRoot, buildCommitOptions(titleRef, bodyRef));
        clearRefs(titleRef, bodyRef);

        if (resolution.isNew) {
          await gitService.push(repoRoot, { setUpstream: true });
        } else {
          const pullOK = await bifrost.commands.executeCommand('git.pull', [repoRoot]);
          if (!pullOK) {
            return;
          }
          await gitService.push(repoRoot);
        }
      } catch (error: any) {
        showPushError(bifrost, error);
      } finally {
        gitService.isSyncing = false;
        bifrost.statusBar.updateStatusBarItems();
      }
    },
    { enabledWhen: (titleRef?: CommitRef) => canPaneCommit(titleRef) },
  );
}

function initializeTestCommands(bifrost: Bifrost, gitService: GitService): void {
  bifrost.commands.register(
    'git.test.stageFile',
    async (repoRoot?: string) => {
      const resolved = resolveRepoRoot(bifrost, gitService, 'git.test.stageFile', repoRoot);
      if (!resolved) {
        return;
      }
      const filePath = await bifrost.dialog.prompt('File path (relative to repo)', 'e.g. readme.txt');
      if (!filePath?.trim()) {
        return;
      }
      await gitService.stage(resolved, [filePath.trim()]);
    },
    { visibleInSearch: true, description: 'Test: Git Stage File' },
  );

  bifrost.commands.register(
    'git.test.unstageFile',
    async (repoRoot?: string) => {
      const resolved = resolveRepoRoot(bifrost, gitService, 'git.test.unstageFile', repoRoot);
      if (!resolved) {
        return;
      }
      const filePath = await bifrost.dialog.prompt('File path (relative to repo)', 'e.g. readme.txt');
      if (!filePath?.trim()) {
        return;
      }
      await gitService.unstage(resolved, [filePath.trim()]);
    },
    { visibleInSearch: true, description: 'Test: Git Unstage File' },
  );

  bifrost.commands.register(
    'git.test.commitAll',
    async (repoRoot?: string) => {
      const resolved = resolveRepoRoot(bifrost, gitService, 'git.test.commitAll', repoRoot);
      if (!resolved) {
        return;
      }
      const message = await bifrost.dialog.prompt('Commit message', 'e.g. test commit');
      if (!message?.trim()) {
        return;
      }
      await gitService.commit(resolved, { title: message.trim() });
    },
    { visibleInSearch: true, description: 'Test: Git Commit All Staged' },
  );

  bifrost.commands.register('git.test.openMergeResolver', async (repoRoot?: string) => {
    if (repoRoot) {
      await gitService.refreshRepo(repoRoot);
    }
    bifrost.commands.executeCommand('git.merge.openResolver');
  });

  bifrost.commands.register('git.test.getMergeState', (repoRoot?: string): any => {
    const root = repoRoot ?? gitService.getSelectedRepo();
    if (!root) {
      return null;
    }
    const state = gitService.getRepoState(root);
    if (!state) {
      return null;
    }
    return {
      kind: state.mergeState.kind,
      conflictedFileCount: state.mergeState.conflictedFiles.length,
      conflictedFiles: state.mergeState.conflictedFiles.map((file) => file.path),
    };
  });
}

type GitProtocol = 'ssh' | 'https';

function detectProtocol(url: string): GitProtocol | null {
  const trimmed = url.trim();
  if (/^(ssh:\/\/|git@)/.test(trimmed)) {
    return 'ssh';
  }
  if (/^https?:\/\//.test(trimmed)) {
    return 'https';
  }
  return null;
}

function embedCredentials(url: string, username?: string, token?: string): string {
  if (!username && !token) {
    return url;
  }
  const prefix = token ? `${username || ''}:${token}` : username!;
  return url.replace(/^(https?:\/\/)/, `$1${prefix}@`);
}

async function showUrlDialog(
  bifrost: Bifrost,
  title: string,
  previousUrl?: string,
): Promise<{ url: string; protocol: GitProtocol } | null> {
  const result = await bifrost.dialog.open(
    {
      title,
      content: [
        {
          type: 'text_input',
          id: 'repoUrl',
          label: 'Repository URL',
          focus: true,
          placeholder: 'git@github.com:user/repo.git  or  https://github.com/user/repo.git',
          value: previousUrl ?? '',
        },
      ],
      actions: [
        { label: 'Cancel', response: 'cancel', cancel: true },
        { label: 'Next', response: 'next', default: true },
      ],
    } as DialogOptions,
    async (dialogResult) => {
      if (dialogResult.wasCancelled) {
        return { closeDialog: true as const };
      }
      const enteredUrl = dialogResult.formData?.repoUrl?.trim();
      if (!enteredUrl) {
        return {
          closeDialog: false as const,
          validationErrors: [{ contentId: 'repoUrl', errorLabel: 'Repository URL is required' }],
        };
      }
      const detected = detectProtocol(enteredUrl);
      if (!detected) {
        return {
          closeDialog: false as const,
          validationErrors: [{ contentId: 'repoUrl', errorLabel: 'Enter a valid SSH or HTTPS repository URL' }],
        };
      }
      return { closeDialog: true as const };
    },
  );

  if (result.wasCancelled) {
    return null;
  }

  const url = result.formData!.repoUrl.trim();
  return { url, protocol: detectProtocol(url)! };
}

async function showCredentialsDialog(
  bifrost: Bifrost,
  title: string,
): Promise<{ username: string; token: string } | 'back' | null> {
  const result = await bifrost.dialog.open({
    title,
    content: [
      {
        type: 'text_input',
        id: 'username',
        label: 'Username',
        focus: true,
        placeholder: 'GitHub username or email',
        optional: true,
      },
      {
        type: 'text_input',
        id: 'token',
        label: 'Token / Password',
        masked: true,
        placeholder: 'Personal access token or password',
        optional: true,
        hint: 'Required for private repositories. Public repos can skip this step.',
      },
    ],
    actions: [
      { label: 'Cancel', response: 'cancel', cancel: true },
      { label: 'Back', response: 'back' },
      { label: 'Next', response: 'next', default: true },
    ],
  } as DialogOptions);

  if (result.wasCancelled) {
    return null;
  }
  if (result.response === 'back') {
    return 'back';
  }

  return {
    username: result.formData?.username?.trim() ?? '',
    token: result.formData?.token?.trim() ?? '',
  };
}

async function fetchBranchEntries(
  gitService: GitService,
  effectiveUrl: string,
): Promise<{ entries: { label: string; value: string }[]; error?: string }> {
  try {
    const branches = await gitService.listRemoteBranches(effectiveUrl);
    return {
      entries: branches.map((branch) => ({
        label: branch.isHead ? `${branch.name} (default)` : branch.name,
        value: branch.name,
      })),
    };
  } catch (error: unknown) {
    const rawMessage = error instanceof Error ? error.message : String(error);
    let friendlyMessage: string;
    if (rawMessage.includes('timeout')) {
      friendlyMessage = 'Connection timed out. Check the URL and your network connection.';
    } else if (rawMessage.includes('Authentication') || rawMessage.includes('fatal:')) {
      friendlyMessage = rawMessage.replace(/^fatal:\s*/, '');
    } else {
      friendlyMessage = `Failed to fetch branches: ${rawMessage}`;
    }
    return { entries: [], error: friendlyMessage };
  }
}

function initializeCloneAndConnectCommands(bifrost: Bifrost, gitService: GitService): void {
  bifrost.commands.register(
    'git.cloneRepository',
    async () => {
      let previousUrl: string | undefined;

      while (true) {
        const urlResult = await showUrlDialog(bifrost, 'Clone Repository', previousUrl);
        if (!urlResult) {
          return;
        }
        previousUrl = urlResult.url;

        let effectiveUrl = urlResult.url;
        if (urlResult.protocol === 'https') {
          const credResult = await showCredentialsDialog(bifrost, 'Clone Repository — HTTPS Credentials');
          if (credResult === null) {
            return;
          }
          if (credResult === 'back') {
            continue;
          }
          effectiveUrl = embedCredentials(urlResult.url, credResult.username, credResult.token);
        }

        const notificationId = bifrost.notifications.open({
          type: 'info',
          content: 'Fetching branches...',
          source: 'Git',
          sticky: true,
        });

        const branchResult = await fetchBranchEntries(gitService, effectiveUrl);
        bifrost.notifications.close(notificationId);

        const branchContent: DialogContentObject[] =
          branchResult.entries.length > 0
            ? [
                {
                  type: 'path_picker',
                  id: 'targetDir',
                  label: 'Destination Folder',
                  mode: 'directory',
                  hint: 'The repository will be cloned into a subfolder of the selected directory.',
                },
                {
                  type: 'select',
                  id: 'branch',
                  label: 'Branch',
                  entries: branchResult.entries,
                  value:
                    branchResult.entries.find((e) => e.label.includes('(default)'))?.value ??
                    branchResult.entries[0]?.value,
                },
              ]
            : [
                {
                  type: 'path_picker',
                  id: 'targetDir',
                  label: 'Destination Folder',
                  mode: 'directory',
                  hint: 'The repository will be cloned into a subfolder of the selected directory.',
                },
                {
                  type: 'text_input',
                  id: 'branch',
                  label: 'Branch',
                  placeholder: 'main',
                  hint: branchResult.error
                    ? `Could not fetch branches: ${branchResult.error}. Enter a branch name manually.`
                    : 'Enter the branch name to clone.',
                },
              ];

        const cloneResult = await bifrost.dialog.open(
          {
            title: 'Clone Repository',
            content: branchContent,
            actions: [
              { label: 'Cancel', response: 'cancel', cancel: true },
              { label: 'Clone', response: 'clone', default: true },
            ],
          } as DialogOptions,
          async (dialogResult) => {
            if (dialogResult.wasCancelled) {
              return { closeDialog: true as const };
            }
            const errors: { contentId: string; errorLabel: string }[] = [];
            const targetDir = dialogResult.formData?.targetDir?.trim();
            if (!targetDir) {
              errors.push({ contentId: 'targetDir', errorLabel: 'Select a destination folder' });
            }
            if (errors.length > 0) {
              return { closeDialog: false as const, validationErrors: errors };
            }
            return { closeDialog: true as const };
          },
        );

        if (cloneResult.wasCancelled) {
          return;
        }

        const parentDir = cloneResult.formData!.targetDir.trim();
        const branch = cloneResult.formData!.branch || undefined;

        const repoName =
          urlResult.url
            .replace(/\.git$/, '')
            .split('/')
            .pop() ?? 'repository';
        const targetDir = path.join(parentDir, repoName);

        const cloneNotificationId = bifrost.notifications.open({
          type: 'info',
          content: 'Cloning repository...',
          source: 'Git',
          sticky: true,
        });

        const unsubscribe = gitService.onCloneProgress((stage, progress) => {
          const percentage = Math.min(Math.floor(progress), 99);
          bifrost.notifications.update(cloneNotificationId, {
            type: 'info',
            content: `Cloning repository... ${stage} (${percentage}%)`,
            source: 'Git',
            sticky: true,
          });
        });

        try {
          await gitService.clone(effectiveUrl, targetDir, branch);
          unsubscribe();
          bifrost.notifications.close(cloneNotificationId);
          bifrost.notifications.open({
            type: 'info',
            content: `Repository cloned to ${repoName}`,
            source: 'Git',
          });

          await integrateClonedFolder(bifrost, targetDir);
        } catch (error: any) {
          unsubscribe();
          bifrost.notifications.close(cloneNotificationId);
          bifrost.commands.executeCommand('std.notifications.showError', [error, 'Git']);
        }
        return;
      }
    },
    { visibleInSearch: true, description: 'Git: Clone Repository...', enabledWhen: () => gitService.isActive },
  );

  bifrost.commands.register(
    'git.connectFolderToRemote',
    async (folderUri?: string) => {
      let targetFolderPath: string | null = null;

      if (folderUri) {
        targetFolderPath = bifrost.files.getLocalFilenameForUri(folderUri);
      } else {
        const picked = await bifrost.dialog.showOpenDirectory();
        if (!picked || picked.length === 0) {
          return;
        }
        targetFolderPath = picked[0];
      }

      if (!targetFolderPath) {
        return;
      }

      let previousUrl: string | undefined;

      while (true) {
        const urlResult = await showUrlDialog(bifrost, 'Connect to Remote', previousUrl);
        if (!urlResult) {
          return;
        }
        previousUrl = urlResult.url;

        let effectiveUrl = urlResult.url;
        if (urlResult.protocol === 'https') {
          const credResult = await showCredentialsDialog(bifrost, 'Connect to Remote — HTTPS Credentials');
          if (credResult === null) {
            return;
          }
          if (credResult === 'back') {
            continue;
          }
          effectiveUrl = embedCredentials(urlResult.url, credResult.username, credResult.token);
        }

        const notificationId = bifrost.notifications.open({
          type: 'info',
          content: 'Fetching branches...',
          source: 'Git',
          sticky: true,
        });

        const branchResult = await fetchBranchEntries(gitService, effectiveUrl);
        bifrost.notifications.close(notificationId);

        const newBranchField: DialogContentObject = {
          type: 'text_input',
          id: 'newBranch',
          label: 'Optional: Create new branch from selected base branch',
          placeholder: 'Leave empty to use the selected branch',
        };

        const branchContent: DialogContentObject[] =
          branchResult.entries.length > 0
            ? [
                {
                  type: 'text',
                  text: `Folder: ${targetFolderPath}`,
                },
                {
                  type: 'select',
                  id: 'branch',
                  label: 'Branch',
                  entries: branchResult.entries,
                  value:
                    branchResult.entries.find((e) => e.label.includes('(default)'))?.value ??
                    branchResult.entries[0]?.value,
                },
                newBranchField,
              ]
            : [
                {
                  type: 'text',
                  text: `Folder: ${targetFolderPath}`,
                },
                {
                  type: 'text_input',
                  id: 'branch',
                  label: 'Branch',
                  placeholder: 'main',
                  hint: branchResult.error
                    ? `Could not fetch branches: ${branchResult.error}. Enter a branch name manually.`
                    : 'Enter the branch name to connect to.',
                },
                newBranchField,
              ];

        const connectResult = await bifrost.dialog.open({
          title: 'Connect to Remote',
          content: branchContent,
          actions: [
            { label: 'Cancel', response: 'cancel', cancel: true },
            { label: 'Connect', response: 'connect', default: true },
          ],
        } as DialogOptions);

        if (connectResult.wasCancelled) {
          return;
        }

        const branch = connectResult.formData?.branch || 'main';
        const newBranch = connectResult.formData?.newBranch?.trim() || undefined;

        const connectNotificationId = bifrost.notifications.open({
          type: 'info',
          content: 'Connecting folder to remote...',
          source: 'Git',
          sticky: true,
        });

        const unsubscribe = gitService.onCloneProgress((stage, progress) => {
          const percentage = Math.min(Math.floor(progress), 99);
          bifrost.notifications.update(connectNotificationId, {
            type: 'info',
            content: `Connecting folder to remote... ${stage} (${percentage}%)`,
            source: 'Git',
            sticky: true,
          });
        });

        try {
          await gitService.connectFolderToRemote(targetFolderPath, effectiveUrl, branch, newBranch);
          unsubscribe();

          await gitService.refreshAllRepos();

          bifrost.notifications.close(connectNotificationId);
          bifrost.notifications.open({
            type: 'info',
            content: 'Folder connected to remote repository. Local changes appear in the Git pane.',
            source: 'Git',
          });
        } catch (error: any) {
          unsubscribe();
          await cleanupPartialInit(bifrost, targetFolderPath);
          bifrost.notifications.close(connectNotificationId);
          bifrost.commands.executeCommand('std.notifications.showError', [error, 'Git']);
        }
        return;
      }
    },
    {
      visibleInSearch: true,
      description: 'Git: Connect Folder to Remote Repository...',
      enabledWhen: () => gitService.isActive,
    },
  );
}

async function integrateClonedFolder(bifrost: Bifrost, localPath: string): Promise<void> {
  const folderUri = bifrost.files.getUriForFilename(localPath);
  const solution = bifrost.solution.getSolution();

  if (solution?.isExplicitSolution && solution.solutionFileUri) {
    bifrost.solution.addFolderToSolution(folderUri);
    await bifrost.solution.saveSolutionFile(solution.solutionFileUri);
  } else {
    await bifrost.commands.executeCommand('std.solution.openDirectory', [folderUri]);
  }
}

async function cleanupPartialInit(bifrost: Bifrost, folderPath: string): Promise<void> {
  const gitDirPath = path.join(folderPath, '.git');
  const gitDirUri = bifrost.files.getUriForFilename(gitDirPath);
  try {
    await bifrost.files.deleteFilesAndDirectories([gitDirUri]);
  } catch {
    // best-effort cleanup
  }
}

function findProtectedDiagramsInStaged(bifrost: Bifrost, state: GitRepoState): string[] {
  const patterns = getProtectedDiagramPatterns(bifrost);
  if (patterns.length === 0) {
    return [];
  }

  const matchers = patterns.map((pattern) => new Minimatch(pattern, { matchBase: true }));
  const stagedDiagrams = state.files
    .filter(
      (gitFile) => gitFile.indexStatus != null && (gitFile.path.endsWith('.bpmn') || gitFile.path.endsWith('.dmn')),
    )
    .map((gitFile) => gitFile.path);

  return stagedDiagrams.filter((filePath) => matchers.some((patternMatcher) => patternMatcher.match(filePath)));
}

async function buildChangeSummaryForDmnFiles(
  bifrost: Bifrost,
  gitService: GitService,
  repoRoot: string,
  stagedFiles: GitFileStatus[],
): Promise<string> {
  const summaryParts: string[] = [];

  for (const gitFile of stagedFiles) {
    const filePath = gitFile.uri.startsWith('file://') ? gitFile.uri.substring('file://'.length) : gitFile.uri;
    const relativePath = filePath.substring(repoRoot.length + 1);
    const fileName = relativePath.split('/').pop() ?? relativePath;

    try {
      const headXml = await gitService.showFileAtRef(repoRoot, `HEAD:${relativePath}`);
      const currentXml = await bifrost.files.load(gitFile.uri);

      if (bifrost.commands.isRegistered('dmn.diff.getChangeSummaryMarkdown')) {
        const markdown = await bifrost.commands.executeCommand<string>('dmn.diff.getChangeSummaryMarkdown', [
          headXml,
          currentXml,
          fileName,
        ]);
        summaryParts.push(markdown);
      } else {
        summaryParts.push(`- **${fileName}**: (detailed diff unavailable)`);
      }
    } catch {
      summaryParts.push(`- **${relativePath}**: (diff unavailable)`);
    }
  }

  return summaryParts.join('\n\n');
}
