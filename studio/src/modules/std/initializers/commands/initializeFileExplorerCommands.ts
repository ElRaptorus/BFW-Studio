import type { Bifrost } from '#bifrost/Bifrost';
import { computeRelativeUri } from '#bifrost/common/FilePatternMatcher';

import type { CommandContext, DialogOptions, TreeViewMediator } from '@evil/bifrost_fw_sdk';

const SETTING_FILE_EXPLORER_EXCLUDE = 'std.fileExplorer.exclude';

export function initializeFileExplorerCommands(bifrost: Bifrost): void {
  const commands = bifrost.commands;

  commands.register(
    'std.fileExplorer.hideDirByName',
    (uri: string) => {
      const directoryName = bifrost.files.getFilename(uri);
      const pattern = `**/${directoryName}`;

      const current: string[] = bifrost.settings.get(SETTING_FILE_EXPLORER_EXCLUDE);
      if (current.includes(pattern)) {
        return;
      }

      bifrost.settings.add(SETTING_FILE_EXPLORER_EXCLUDE, pattern);
    },
    { enabledWhen: (uri: string) => uri != null && bifrost.files.isLocalFilename(uri) },
  );

  commands.register(
    'std.fileExplorer.hideDirByPath',
    (uri: string) => {
      const matchingProject = bifrost.solution
        .getSolution()
        ?.projects.find((project) => uri.startsWith(project.baseUri));
      if (matchingProject == null) {
        return;
      }

      const relativePath = computeRelativeUri(uri, matchingProject.baseUri);

      const current: string[] = bifrost.settings.get(SETTING_FILE_EXPLORER_EXCLUDE);
      if (current.includes(relativePath)) {
        return;
      }

      bifrost.settings.add(SETTING_FILE_EXPLORER_EXCLUDE, relativePath);
    },
    { enabledWhen: (uri: string) => uri != null && bifrost.files.isLocalFilename(uri) },
  );

  commands.register(
    'std.fileExplorer.dropItems',
    async (context: CommandContext, sourceUris: string[], targetUri: string) => {
      const isCopy =
        context?.type === 'generic' && (context.event?.ctrlKey === true || context.event?.metaKey === true);

      const targetLocalDirectory = await resolveTargetDirectory(bifrost, targetUri);
      if (targetLocalDirectory == null) {
        return;
      }

      const plan = await buildMovePlan(bifrost, sourceUris, targetLocalDirectory);
      if (plan.itemsToMove.length === 0 && plan.conflicting.length === 0) {
        return;
      }

      const resolvedPlan = await resolveConflicts(bifrost, plan);
      if (resolvedPlan == null) {
        return;
      }

      let lastUri: string | null = null;
      for (const item of resolvedPlan) {
        try {
          if (isCopy) {
            await bifrost.files.copyFileOrDirectory(item.sourceUri, item.newUri);
          } else {
            await bifrost.files.renameFileOrDirectory(item.sourceUri, item.newUri);
            await updateOpenEditorDocuments(bifrost, item.sourceUri, item.newUri);
          }
          lastUri = item.newUri;
        } catch (error) {
          console.warn(`Failed to ${isCopy ? 'copy' : 'move'} ${item.sourceUri}:`, error);
        }
      }

      if (lastUri != null) {
        if (isCopy) {
          await bifrost.solution.onElementAdded(lastUri);
        } else {
          await bifrost.solution.onElementMoved(lastUri);
        }
      }
    },
    { expectsContext: true, enabledWhen: () => bifrost.solution.hasOpenSolution() },
  );

  commands.register(
    'std.fileExplorer.copyExternalItems',
    async (sourceLocalPaths: string[], targetUri: string) => {
      const targetLocalDirectory = await resolveTargetDirectory(bifrost, targetUri);
      if (targetLocalDirectory == null) {
        return;
      }

      const sourceUris = sourceLocalPaths.map((path) => bifrost.files.getUriForFilename(path));

      const plan = await buildMovePlan(bifrost, sourceUris, targetLocalDirectory);
      if (plan.itemsToMove.length === 0 && plan.conflicting.length === 0) {
        if (sourceUris.length > 0) {
          const names = sourceUris.map((uri) => bifrost.files.getFilename(uri));
          let subject: string;

          if (sourceUris.length === 1) {
            const isDir = await bifrost.files.isDirectory(sourceUris[0]);
            subject = isDir
              ? `Source and target directory are identical: ${names[0]}`
              : `Source and target file are equal: ${names[0]}`;
          } else {
            subject = `Source and target are identical for: ${names.join(', ')}`;
          }

          bifrost.notifications.open({ type: 'info', content: `${subject}. Nothing to do here.` });
        }
        return;
      }

      const resolvedPlan = await resolveConflicts(bifrost, plan);
      if (resolvedPlan == null) {
        return;
      }

      let lastUri: string | null = null;
      for (const item of resolvedPlan) {
        try {
          await bifrost.files.copyFileOrDirectory(item.sourceUri, item.newUri);
          lastUri = item.newUri;
        } catch (error) {
          console.warn(`Failed to copy ${item.sourceUri}:`, error);
        }
      }

      if (lastUri != null) {
        await bifrost.solution.onElementAdded(lastUri);
      }
    },
    { enabledWhen: () => bifrost.solution.hasOpenSolution() },
  );

  commands.register('std.fileExplorer.handleExternalDrop', async (localPaths: string[]) => {
    const bpmnFiles: string[] = [];
    const esslnFiles: string[] = [];
    const folders: string[] = [];

    for (const localPath of localPaths) {
      const uri = bifrost.files.getUriForFilename(localPath);
      if (await bifrost.files.isDirectory(uri)) {
        folders.push(localPath);
      } else if (localPath.endsWith('.bpmn')) {
        bpmnFiles.push(localPath);
      } else if (localPath.endsWith('.essln')) {
        esslnFiles.push(localPath);
      }
    }

    for (const bpmnPath of bpmnFiles) {
      const uri = bifrost.files.getUriForFilename(bpmnPath);
      bifrost.commands.executeCommand('std.editor.focusOrOpenDocument', [uri]);
    }

    for (const esslnPath of esslnFiles) {
      const uri = bifrost.files.getUriForFilename(esslnPath);
      bifrost.commands.executeCommand('std.solution.openSolutionFile', [uri]);
    }

    if (folders.length === 1) {
      const dialogResult = await bifrost.dialog.open({
        title: 'Open Folder',
        content: [
          {
            type: 'response_link',
            label: 'Open as a folder',
            sublabel: folders[0],
            icon: 'ph ph-folder-open',
            response: 'open-folder',
          },
          {
            type: 'response_link',
            label: 'Create a solution from this folder',
            icon: 'ph ph-folder-notch-plus',
            response: 'create-solution',
          },
        ],
        actions: [{ label: 'Cancel', response: 'cancel', cancel: true }],
      });

      if (dialogResult.wasCancelled) {
        return;
      }

      if (dialogResult.response === 'open-folder') {
        const uri = bifrost.files.getUriForFilename(folders[0]);
        await bifrost.commands.executeCommand('std.solution.openDirectory', [uri]);
      } else if (dialogResult.response === 'create-solution') {
        bifrost.commands.executeCommand('std.solution.createSolution', [folders]);
      }
    } else if (folders.length > 1) {
      const dialogResult = await bifrost.dialog.open({
        title: 'Open Folders',
        content: [
          {
            type: 'response_link',
            label: 'Create a solution from these folders',
            sublabel: `${folders.length} folders selected`,
            icon: 'ph ph-folder-notch-plus',
            response: 'create-solution',
          },
          {
            type: 'response_link',
            label: 'Open each folder separately',
            icon: 'ph ph-app-window',
            response: 'open-separately',
          },
        ],
        actions: [{ label: 'Cancel', response: 'cancel', cancel: true }],
      });

      if (dialogResult.wasCancelled) {
        return;
      }

      if (dialogResult.response === 'create-solution') {
        bifrost.commands.executeCommand('std.solution.createSolution', [folders]);
      } else if (dialogResult.response === 'open-separately') {
        const firstUri = bifrost.files.getUriForFilename(folders[0]);
        await bifrost.commands.executeCommand('std.solution.openDirectory', [firstUri]);

        for (let i = 1; i < folders.length; i++) {
          const uri = bifrost.files.getUriForFilename(folders[i]);
          bifrost.commands.executeCommand('std.window.focusOrOpenWithSolution', [uri]);
        }
      }
    }
  });

  commands.register(
    'std.fileExplorer.handleExternalDropIntoSolution',
    async (localPaths: string[], targetUri: string) => {
      const isExplicitSolution = bifrost.solution.getSolution()?.isExplicitSolution === true;

      if (!isExplicitSolution) {
        await bifrost.commands.executeCommand('std.fileExplorer.copyExternalItems', [localPaths, targetUri]);
        return;
      }

      const files: string[] = [];
      const folders: string[] = [];

      for (const localPath of localPaths) {
        const uri = bifrost.files.getUriForFilename(localPath);
        if (await bifrost.files.isDirectory(uri)) {
          folders.push(localPath);
        } else {
          files.push(localPath);
        }
      }

      if (files.length > 0) {
        await bifrost.commands.executeCommand('std.fileExplorer.copyExternalItems', [files, targetUri]);
      }

      if (folders.length === 0) {
        return;
      }

      let action: string;
      const rememberChoice = bifrost.settings.get('std.fileExplorer.externalFolderDrop.rememberChoice');

      if (rememberChoice === true) {
        action = bifrost.settings.get('std.fileExplorer.externalFolderDrop.defaultChoice') as string;
      } else {
        const isSingle = folders.length === 1;
        const dialogResult = await bifrost.dialog.open({
          title: isSingle ? 'Add Folder' : 'Add Folders',
          content: [
            {
              type: 'response_link',
              label: isSingle
                ? 'Copy the folder into the target directory'
                : 'Copy the folders into the target directory',
              sublabel: isSingle ? folders[0] : `${folders.length} folders`,
              icon: 'ph ph-copy',
              response: 'copy',
            },
            {
              type: 'response_link',
              label: isSingle
                ? 'Add folder as a root directory to the solution'
                : 'Add folders as root directories to the solution',
              icon: 'ph ph-tree-view',
              response: 'add-root',
            },
            { type: 'divider' },
            {
              type: 'checkbox',
              id: 'remember',
              label: `Remember my choice and don't ask next time`,
            },
          ],
          actions: [{ label: 'Cancel', response: 'cancel', cancel: true }],
        } as DialogOptions);

        if (dialogResult.wasCancelled || dialogResult.response == null) {
          return;
        }

        action = dialogResult.response;

        if (dialogResult.formData?.remember === true) {
          bifrost.settings.set('std.fileExplorer.externalFolderDrop.rememberChoice', true);
          bifrost.settings.set('std.fileExplorer.externalFolderDrop.defaultChoice', action);
        }
      }

      if (action === 'copy') {
        await bifrost.commands.executeCommand('std.fileExplorer.copyExternalItems', [folders, targetUri]);
      } else if (action === 'add-root') {
        for (const folderPath of folders) {
          const folderUri = bifrost.files.getUriForFilename(folderPath);
          bifrost.solution.addFolderToSolution(folderUri);
        }

        const updatedSolution = bifrost.solution.getSolution();
        if (updatedSolution?.solutionFileUri != null) {
          await bifrost.solution.saveSolutionFile(updatedSolution.solutionFileUri);
        }
      }
    },
    { enabledWhen: () => bifrost.solution.hasOpenSolution() },
  );

  commands.register('std.fileExplorer.revealUri', async (uri: string) => {
    if (!bifrost.views.isRegistered('std/file-explorer/open-solution')) {
      return;
    }

    const treeViewMediator = bifrost.views.getById<TreeViewMediator>('std/file-explorer/open-solution');
    try {
      await treeViewMediator.waitForAndSelectEntriesByMetadataFilter((metadata) => metadata.uri === uri);

      const selectedEntry = document.querySelector(treeViewMediator.domSelector + ' .treeview__entry--selected') as any;
      selectedEntry?.scrollIntoViewIfNeeded();
    } catch {
      // Entry may not exist in the tree
    }
  });

  commands.register(
    'std.explorer.toggleCursorFollowsTabs',
    () => {
      const current = bifrost.settings.get('std.explorer.cursorFollowsTabs');
      bifrost.settings.set('std.explorer.cursorFollowsTabs', !current);
    },
    { visibleInSearch: true, description: 'File Explorer: Toggle Cursor Follows Tabs' },
  );

  commands.register('std.fileExplorer.collapseAll', () => {
    if (bifrost.views.isRegistered('std/file-explorer/open-solution')) {
      bifrost.views.getById<TreeViewMediator>('std/file-explorer/open-solution').collapseAll();
    }
  });

  commands.register('std.fileExplorer.expandAll', () => {
    if (bifrost.views.isRegistered('std/file-explorer/open-solution')) {
      bifrost.views.getById<TreeViewMediator>('std/file-explorer/open-solution').expandAll();
    }
  });
}

type MoveItem = {
  sourceUri: string;
  destinationPath: string;
  newUri: string;
};

type MovePlan = {
  itemsToMove: MoveItem[];
  conflicting: MoveItem[];
};

async function resolveTargetDirectory(bifrost: Bifrost, targetUri: string): Promise<string | null> {
  const isDirectory = await bifrost.files.isDirectory(targetUri);
  if (isDirectory) {
    return bifrost.files.getLocalFilenameForUri(targetUri);
  }

  const containingDirectory = bifrost.files.getContainingDirectoryOrNull(targetUri);
  return containingDirectory;
}

async function buildMovePlan(bifrost: Bifrost, sourceUris: string[], targetLocalDirectory: string): Promise<MovePlan> {
  const itemsToMove: MoveItem[] = [];
  const conflicting: MoveItem[] = [];

  for (const sourceUri of sourceUris) {
    const filename = bifrost.files.getFilename(sourceUri);
    const sourceLocalDirectory = bifrost.files.getContainingDirectory(sourceUri);

    if (sourceLocalDirectory === targetLocalDirectory) {
      continue;
    }

    const sourceLocalPath = bifrost.files.getLocalFilenameForUri(sourceUri);
    if (targetLocalDirectory.startsWith(sourceLocalPath + '/') || targetLocalDirectory === sourceLocalPath) {
      continue;
    }

    const destinationPath = bifrost.files.joinPaths(targetLocalDirectory, filename);
    const newUri = bifrost.files.getUriForFilename(destinationPath);

    const exists = await bifrost.files.doesFileOrDirectoryExist(destinationPath);
    if (exists) {
      conflicting.push({ sourceUri, destinationPath, newUri });
    } else {
      itemsToMove.push({ sourceUri, destinationPath, newUri });
    }
  }

  return { itemsToMove, conflicting };
}

async function resolveConflicts(bifrost: Bifrost, movePlan: MovePlan): Promise<MoveItem[] | null> {
  const { itemsToMove, conflicting } = movePlan;

  if (conflicting.length === 0) {
    return itemsToMove;
  }

  const isSingleConflict = conflicting.length === 1;
  const conflictLabel = isSingleConflict
    ? `The target folder already contains an item named \`${bifrost.files.getFilename(conflicting[0].sourceUri)}\`.\n\nDo you want to overwrite it?`
    : `The target folder already contains **${conflicting.length} items** with the same name.\n\nDo you want to overwrite them?`;

  const dialogResult = await bifrost.dialog.open({
    title: 'Confirm Overwrite',
    content: conflictLabel,
    actions: [
      { label: isSingleConflict ? 'Keep Original' : 'Keep Originals', response: 'keep' },
      {
        label: isSingleConflict ? 'Overwrite' : 'Overwrite All',
        response: 'overwrite',
        default: true,
        dangerous: true,
      },
      { label: 'Cancel', response: 'cancel', cancel: true },
    ],
  });

  if (dialogResult.wasCancelled || dialogResult.response === 'cancel') {
    return null;
  }

  async function attachCopySuffixToFileName(item: MoveItem): Promise<MoveItem> {
    const isDirectory = await bifrost.files.isDirectory(item.sourceUri);
    const filename = bifrost.files.getFilename(item.newUri);
    const parentDirectory = bifrost.files.getContainingDirectory(item.newUri);

    if (isDirectory) {
      const suffixedPath = bifrost.files.joinPaths(parentDirectory, `${filename}_copy`);
      return { ...item, destinationPath: suffixedPath, newUri: bifrost.files.getUriForFilename(suffixedPath) };
    }

    const extension = bifrost.files.getFileExtension(item.newUri);
    const baseName = extension ? filename.slice(0, -(extension.length + 1)) : filename;
    const suffixedFilename = extension ? `${baseName}_copy.${extension}` : `${filename}_copy`;
    const suffixedPath = bifrost.files.joinPaths(parentDirectory, suffixedFilename);

    return { ...item, destinationPath: suffixedPath, newUri: bifrost.files.getUriForFilename(suffixedPath) };
  }

  if (dialogResult.response === 'keep') {
    const conflictsWithSuffix = await Promise.all(conflicting.map(attachCopySuffixToFileName));
    return [...itemsToMove, ...conflictsWithSuffix];
  }

  if (dialogResult.response === 'overwrite') {
    return [...itemsToMove, ...conflicting];
  }

  return itemsToMove;
}

async function updateOpenEditorDocuments(bifrost: Bifrost, sourceUri: string, newUri: string): Promise<void> {
  const directMatch = bifrost.editors.getEditorDocumentByUri(sourceUri);
  if (directMatch != null) {
    const model = await bifrost.editors.getEditorDocumentModel(directMatch);
    model.resetUriAndData(newUri, directMatch.data.original, directMatch.data.current);
    return;
  }

  const sourcePrefix = sourceUri.endsWith('/') ? sourceUri : sourceUri + '/';
  const newPrefix = newUri.endsWith('/') ? newUri : newUri + '/';

  const openDocuments = bifrost.editors.getOpenEditorDocuments();
  for (const openDocument of openDocuments) {
    if (openDocument.uri.startsWith(sourcePrefix)) {
      const updatedUri = newPrefix + openDocument.uri.slice(sourcePrefix.length);
      const model = await bifrost.editors.getEditorDocumentModel(openDocument);
      model.resetUriAndData(updatedUri, openDocument.data.original, openDocument.data.current);
    }
  }
}
