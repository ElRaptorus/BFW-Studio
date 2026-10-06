import { describe, expect, it, vi } from 'vitest';

import { parseOpenInNewTabUrl } from '../../../src/bifrost/common/OpenInNewTabUrl';
import type { SourceControlFileStatus } from '../../../src/bifrost/contracts/SourceControlTypes';
import { openChangeDiff, showGitDiffForFile } from '../../../src/modules/git-cruiser/diffFromGit';

const repositoryRoot = '/work/repository';

function createFakeBifrost(options: { registeredCommands?: string[]; existingFiles?: string[] } = {}) {
  const registeredCommands = options.registeredCommands ?? ['bpmn.diff.openDiffTwoFiles', 'dmn.diff.openDiffTwoFiles'];
  const existingFiles = options.existingFiles ?? [];

  const executeCommand = vi.fn();
  const focusOrOpenEditorDocument = vi.fn();
  const getFileContentAtRevision = vi.fn(async (_root: string, revision: string, relativePath: string) => {
    return `<content of ${relativePath} at ${revision}>`;
  });
  const save = vi.fn(async () => true);
  const createDirectory = vi.fn(async () => true);
  const open = vi.fn();

  const bifrost = {
    commands: { isRegistered: (command: string) => registeredCommands.includes(command), executeCommand },
    editors: { focusOrOpenEditorDocument },
    sourceControl: { getFileContentAtRevision },
    files: {
      save,
      createDirectory,
      doesFileOrDirectoryExist: async (filePath: string) => existingFiles.includes(filePath),
    },
    notifications: { open },
  };

  return { bifrost: bifrost as any, executeCommand, focusOrOpenEditorDocument, getFileContentAtRevision, save, open };
}

describe('openChangeDiff', () => {
  it('opens the visual diff of a model with both sides present, using a temp copy per committed side', async () => {
    const { bifrost, executeCommand, getFileContentAtRevision, save } = createFakeBifrost();

    await openChangeDiff(bifrost, {
      repositoryRoot,
      relativePath: 'flows/order.bpmn',
      previousRelativePath: null,
      beforeRef: 'a1b2c3d4e5f6',
      afterRef: 'WORKING',
    });

    expect(getFileContentAtRevision).toHaveBeenCalledWith(repositoryRoot, 'a1b2c3d4e5f6', 'flows/order.bpmn');
    const [command, [beforeUri, afterUri, options]] = executeCommand.mock.calls[0];
    expect(command).toBe('bpmn.diff.openDiffTwoFiles');
    expect(beforeUri).toMatch(/bifrost-forge-world\/git-diff\/[0-9a-f]{12}\/flows\/order\.bpmn$/);
    expect(afterUri).toBe(`file://${repositoryRoot}/flows/order.bpmn`);
    expect(options).toEqual({
      label: 'Diff: order.bpmn (a1b2c3d ↔ Your changes)',
      sourceFileUri: `file://${repositoryRoot}/flows/order.bpmn`,
      beforeLabel: 'a1b2c3d',
      afterLabel: 'Your changes',
    });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('gives different content a different temp path, so a moved HEAD never reuses an old diff tab', async () => {
    const { bifrost, executeCommand, getFileContentAtRevision } = createFakeBifrost();
    const request = {
      repositoryRoot,
      relativePath: 'flows/order.bpmn',
      previousRelativePath: null,
      beforeRef: 'HEAD',
      afterRef: 'WORKING',
    };

    await openChangeDiff(bifrost, request);
    await openChangeDiff(bifrost, request);
    getFileContentAtRevision.mockResolvedValue('<content after a new commit>');
    await openChangeDiff(bifrost, request);

    const beforeUris = executeCommand.mock.calls.map((call) => call[1][0]);
    expect(beforeUris[1]).toBe(beforeUris[0]);
    expect(beforeUris[2]).not.toBe(beforeUris[0]);
  });

  it('routes a DMN file to the DMN diff and reads the before side from the previous path of a rename', async () => {
    const { bifrost, executeCommand, getFileContentAtRevision } = createFakeBifrost();

    await openChangeDiff(bifrost, {
      repositoryRoot,
      relativePath: 'rules/new-name.dmn',
      previousRelativePath: 'rules/old-name.dmn',
      beforeRef: 'HEAD',
      afterRef: 'WORKING',
    });

    expect(getFileContentAtRevision).toHaveBeenCalledWith(repositoryRoot, 'HEAD', 'rules/old-name.dmn');
    expect(executeCommand.mock.calls[0][0]).toBe('dmn.diff.openDiffTwoFiles');
    expect(executeCommand.mock.calls[0][1][2].beforeLabel).toBe('Last commit');
  });

  it.each([
    ['NONE', 'WORKING'],
    ['HEAD', 'NONE'],
  ])('opens the text diff for a model with one side missing (%s to %s)', async (beforeRef, afterRef) => {
    const { bifrost, executeCommand, focusOrOpenEditorDocument } = createFakeBifrost();

    await openChangeDiff(bifrost, {
      repositoryRoot,
      relativePath: 'order.bpmn',
      previousRelativePath: null,
      beforeRef,
      afterRef,
    });

    expect(executeCommand).not.toHaveBeenCalled();
    const { type, data } = parseOpenInNewTabUrl(focusOrOpenEditorDocument.mock.calls[0][0]);
    expect(type).toBe('git.text-diff');
    expect(data).toMatchObject({ repositoryRoot: repositoryRoot, path: 'order.bpmn', beforeRef, afterRef });
  });

  it('opens the text diff for any other file and keeps the previous path of a rename', async () => {
    const { bifrost, focusOrOpenEditorDocument } = createFakeBifrost();

    await openChangeDiff(bifrost, {
      repositoryRoot,
      relativePath: 'config/b.json',
      previousRelativePath: 'config/a.json',
      beforeRef: 'HEAD',
      afterRef: 'WORKING',
    });

    const [uri, label] = focusOrOpenEditorDocument.mock.calls[0];
    expect(label).toBe('Diff: b.json (Last commit ↔ Your changes)');
    const { parentUri, data } = parseOpenInNewTabUrl(uri);
    expect(parentUri).toBe(`file://${repositoryRoot}/config/b.json`);
    expect(data).toMatchObject({
      previousPath: 'config/a.json',
      beforeLabel: 'Last commit',
      afterLabel: 'Your changes',
    });
  });

  it('falls back to the text diff when the diff module is not loaded', async () => {
    const { bifrost, executeCommand, focusOrOpenEditorDocument } = createFakeBifrost({ registeredCommands: [] });

    await openChangeDiff(bifrost, {
      repositoryRoot,
      relativePath: 'order.bpmn',
      previousRelativePath: null,
      beforeRef: 'HEAD',
      afterRef: 'WORKING',
    });

    expect(executeCommand).not.toHaveBeenCalled();
    expect(focusOrOpenEditorDocument).toHaveBeenCalledTimes(1);
  });

  it('rejects when a version cannot be read, so the command can report it', async () => {
    const { bifrost, getFileContentAtRevision } = createFakeBifrost();
    getFileContentAtRevision.mockRejectedValue(new Error('fatal: path does not exist'));

    await expect(
      openChangeDiff(bifrost, {
        repositoryRoot,
        relativePath: 'order.bpmn',
        previousRelativePath: null,
        beforeRef: 'HEAD',
        afterRef: 'WORKING',
      }),
    ).rejects.toThrow('path does not exist');
  });
});

describe('showGitDiffForFile', () => {
  const fileUri = `file://${repositoryRoot}/order.bpmn`;

  function createStore(status: Partial<SourceControlFileStatus> | null) {
    return {
      getRepoRootForUri: () => repositoryRoot,
      getFileStatus: () =>
        status == null ? null : { uri: fileUri, path: 'order.bpmn', previousPath: null, ...status },
    } as any;
  }

  it('compares the last commit with the file on disk for a modified file', async () => {
    const { bifrost, executeCommand } = createFakeBifrost({ existingFiles: [`${repositoryRoot}/order.bpmn`] });

    await showGitDiffForFile(bifrost, createStore({ workingTreeStatus: 'modified', indexStatus: null }), fileUri);

    expect(executeCommand.mock.calls[0][1][2]).toMatchObject({
      beforeLabel: 'Last commit',
      afterLabel: 'Your changes',
    });
  });

  it.each([
    ['untracked', { workingTreeStatus: 'untracked', indexStatus: null }],
    ['staged as new', { workingTreeStatus: null, indexStatus: 'added' }],
  ] as const)('has no before side for a file that is %s', async (_name, status) => {
    const { bifrost, focusOrOpenEditorDocument } = createFakeBifrost({
      existingFiles: [`${repositoryRoot}/order.bpmn`],
    });

    await showGitDiffForFile(bifrost, createStore(status), fileUri);

    expect(parseOpenInNewTabUrl(focusOrOpenEditorDocument.mock.calls[0][0]).data).toMatchObject({
      beforeRef: 'NONE',
      afterRef: 'WORKING',
    });
  });

  it('has no after side for a file that was deleted from disk', async () => {
    const { bifrost, focusOrOpenEditorDocument } = createFakeBifrost();

    await showGitDiffForFile(bifrost, createStore({ workingTreeStatus: 'deleted', indexStatus: null }), fileUri);

    expect(parseOpenInNewTabUrl(focusOrOpenEditorDocument.mock.calls[0][0]).data).toMatchObject({
      beforeRef: 'HEAD',
      afterRef: 'NONE',
    });
  });

  it('tells the user when the file is not in a repository', async () => {
    const { bifrost, open, executeCommand, focusOrOpenEditorDocument } = createFakeBifrost();
    const store = { getRepoRootForUri: () => null } as any;

    await showGitDiffForFile(bifrost, store, fileUri);

    expect(open).toHaveBeenCalledWith('File is not in a Git repository.');
    expect(executeCommand).not.toHaveBeenCalled();
    expect(focusOrOpenEditorDocument).not.toHaveBeenCalled();
  });
});
