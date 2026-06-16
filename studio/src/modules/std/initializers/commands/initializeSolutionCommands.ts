import type { Bifrost } from '#bifrost/Bifrost';
import { IPC_MESSAGE_CLEAR_WINDOW_SOLUTION } from '#bifrost/contracts/IpcEvents';

import type { DialogOptions, DialogResult, DialogValidationResult, TreeViewMediator } from '@evil/bifrost_fw_sdk';
import { assertNotNull } from '@evil/bifrost_fw_sdk';

export function initializeSolutionCommands(bifrost: Bifrost): void {
  const commands = bifrost.commands;

  commands.register(
    'std.solution.createSolution',
    async (initialFolders?: string[]) => {
      const wizardOptions: DialogOptions = {
        title: 'Solution Wizard',
        content: [
          {
            type: 'text_input',
            id: 'solutionName',
            label: 'Solution Name',
            placeholder: 'My Solution',
            focus: true,
          },
          {
            type: 'path_list',
            id: 'directories',
            label: 'Directories to include',
            mode: 'directory',
            initialValue: initialFolders,
            hint: 'You can always add more directories later.',
          },
        ],
        actions: [
          { label: 'Cancel', response: 'cancel', cancel: true },
          { label: 'OK', response: 'ok', default: true },
        ],
      };

      const wizardValidation = async (dialogResult: DialogResult): Promise<DialogValidationResult> => {
        if (dialogResult.response === 'ok') {
          const name = dialogResult.formData?.solutionName?.trim();
          if (name == null || name === '') {
            return {
              closeDialog: false,
              validationErrors: [{ contentId: 'solutionName', errorLabel: 'Solution name cannot be empty' }],
            };
          }
        }
        return { closeDialog: true };
      };

      const wizardResult = await bifrost.dialog.open(wizardOptions, wizardValidation);

      if (wizardResult.wasCancelled || wizardResult.response !== 'ok') {
        return;
      }

      const solutionName: string = wizardResult.formData?.solutionName?.trim() ?? 'Untitled';
      const rawDirectories: string = wizardResult.formData?.directories ?? '[]';
      const directories: string[] = JSON.parse(rawDirectories);

      let defaultPath: string | undefined;
      if (directories.length > 0) {
        defaultPath = directories[0] + '/' + solutionName + '.essln';
      } else {
        defaultPath = solutionName + '.essln';
      }

      const solutionFilePath = await bifrost.dialog.showSaveFile({
        title: 'Save Solution as...',
        defaultPath,
        filters: [{ name: 'Bifrost Forge World Solution', extensions: ['essln'] }],
      });

      if (solutionFilePath == null) {
        return;
      }

      const solutionFileContent = {
        folders: directories.map((dir) => ({ path: dir })),
        settings: {},
      };

      const solutionFileUri = bifrost.files.getUriForFilename(solutionFilePath);
      const serialized = JSON.stringify(solutionFileContent, null, 2) + '\n';
      await bifrost.files.save(solutionFileUri, serialized);

      await bifrost.solution.openSolutionFile(solutionFileUri);
    },
    { visibleInSearch: true, description: 'Solution: Create New Solution...' },
  );

  commands.register(
    'std.solution.convertFolderToSolution',
    () => {
      const solution = bifrost.solution.getSolution();
      if (solution == null || solution.projects.length === 0) {
        return;
      }
      const folderPath = bifrost.files.getLocalFilenameForUri(solution.projects[0].baseUri);
      bifrost.commands.executeCommand('std.solution.createSolution', [[folderPath]]);
    },
    {
      enabledWhen: () => {
        const solution = bifrost.solution.getSolution();
        return solution != null && solution.isExplicitSolution !== true;
      },
    },
  );

  commands.register(
    'std.solution.addFolder',
    async () => {
      const solution = bifrost.solution.getSolution();
      if (solution == null) {
        return;
      }

      const filenames = await bifrost.dialog.showOpenDirectory();
      if (filenames == null || filenames.length === 0) {
        return;
      }

      const selectedDirectory = filenames[0];
      const directoryUri = bifrost.files.getUriForFilename(selectedDirectory);

      bifrost.solution.addFolderToSolution(directoryUri);

      const updatedSolution = bifrost.solution.getSolution();
      if (updatedSolution?.solutionFileUri != null) {
        await bifrost.solution.saveSolutionFile(updatedSolution.solutionFileUri);
      }
    },
    {
      visibleInSearch: true,
      description: 'Add Folder to Solution',
      enabledWhen: () => bifrost.solution.hasOpenSolution(),
    },
  );

  commands.register(
    'std.solution.removeFolder',
    async (projectId?: string) => {
      const solution = bifrost.solution.getSolution();
      if (solution == null || solution.projects.length <= 1) {
        return;
      }

      if (projectId == null) {
        return;
      }

      const project = solution.projects.find((solutionProject) => solutionProject.id === projectId);
      if (project == null) {
        return;
      }

      const dialogOptions: DialogOptions = {
        title: 'Confirmation',
        content: `Remove "${project.name}" from the solution?`,
        actions: [
          { label: 'Cancel', response: 'cancel', cancel: true },
          { label: 'Remove', response: 'remove', default: true },
        ],
      };

      const dialogResult = await bifrost.dialog.open(dialogOptions);
      if (dialogResult.wasCancelled || dialogResult.response !== 'remove') {
        return;
      }

      bifrost.solution.removeFolderFromSolution(projectId);
    },
    {
      visibleInSearch: true,
      description: 'Remove Folder from Solution',
      enabledWhen: () => {
        const solution = bifrost.solution.getSolution();
        return solution != null && solution.projects.length > 1;
      },
    },
  );

  commands.register(
    'std.solution.saveSolution',
    async () => {
      const solution = bifrost.solution.getSolution();
      if (solution == null) {
        return;
      }

      if (solution.solutionFileUri != null) {
        await bifrost.solution.saveSolutionFile(solution.solutionFileUri);
      } else {
        await bifrost.commands.executeCommand('std.solution.saveSolutionAs');
      }
    },
    {
      visibleInSearch: true,
      description: 'Save Solution',
      enabledWhen: () => bifrost.solution.getSolution()?.isExplicitSolution === true,
    },
  );

  commands.register(
    'std.solution.saveSolutionAs',
    async () => {
      const solution = bifrost.solution.getSolution();
      if (solution == null) {
        return;
      }

      let defaultPath: string | undefined;
      if (solution.solutionFileUri != null) {
        defaultPath = bifrost.files.getLocalFilenameForUri(solution.solutionFileUri);
      } else {
        defaultPath = (await bifrost.files.getLocalDirectory(solution.projects[0].baseUri)) ?? undefined;
      }

      const solutionFilePath = await bifrost.dialog.showSaveFile({
        title: 'Save Solution As',
        defaultPath,
        filters: [{ name: 'Bifrost Forge World Solution', extensions: ['essln'] }],
      });

      if (solutionFilePath == null) {
        return;
      }

      const solutionFileUri = bifrost.files.getUriForFilename(solutionFilePath);
      await bifrost.solution.saveSolutionFile(solutionFileUri);
    },
    {
      visibleInSearch: true,
      description: 'Save Solution As...',
      enabledWhen: () => bifrost.solution.getSolution()?.isExplicitSolution === true,
    },
  );

  commands.register(
    'std.solution.renameProjectLabel',
    async (projectBaseUri?: string) => {
      const solution = bifrost.solution.getSolution();
      if (solution == null) {
        return;
      }

      const project =
        projectBaseUri != null
          ? solution.projects.find((solutionProject) => solutionProject.baseUri === projectBaseUri)
          : null;

      if (project == null) {
        return;
      }

      const dialogOptions: DialogOptions = {
        title: 'Rename Project',
        content: [
          {
            type: 'text_input',
            id: 'name',
            placeholder: 'Project name',
            value: project.name,
            focus: true,
          },
        ],
        actions: [
          { label: 'Cancel', response: 'cancel', cancel: true },
          { label: 'Rename', response: 'rename', default: true },
        ],
      };

      const dialogResult = await bifrost.dialog.open(dialogOptions);
      if (dialogResult.wasCancelled || dialogResult.response !== 'rename') {
        return;
      }

      const newName = dialogResult.formData?.name?.trim();
      if (newName == null || newName === '' || newName === project.name) {
        return;
      }

      bifrost.solution.renameProjectInSolution(project.id, newName);
    },
    {
      visibleInSearch: true,
      description: 'Rename Project Label',
      enabledWhen: () => {
        const solution = bifrost.solution.getSolution();
        return solution != null && solution.isExplicitSolution === true;
      },
    },
  );

  commands.register(
    'std.solution.closeSolution',
    async () => {
      const solution = bifrost.solution.getSolution();
      if (solution == null) {
        return;
      }

      if (bifrost.solution.isSolutionDirty()) {
        const dialogResult = await bifrost.dialog.open({
          title: 'Close Solution',
          content: 'Save solution before closing?',
          actions: [
            { label: 'Cancel', response: 'cancel', cancel: true },
            { label: "Don't Save", response: 'no' },
            { label: 'Save', response: 'yes', default: true },
          ],
        });

        if (dialogResult.wasCancelled || dialogResult.response === 'cancel') {
          return;
        }

        if (dialogResult.response === 'yes') {
          if (solution.solutionFileUri != null) {
            await bifrost.solution.saveSolutionFile(solution.solutionFileUri);
          } else {
            const defaultPath = (await bifrost.files.getLocalDirectory(solution.projects[0].baseUri)) ?? undefined;

            const solutionFilePath = await bifrost.dialog.showSaveFile({
              title: 'Save Solution As',
              defaultPath,
              filters: [{ name: 'Bifrost Forge World Solution', extensions: ['essln'] }],
            });

            if (solutionFilePath == null) {
              return;
            }

            const solutionFileUri = bifrost.files.getUriForFilename(solutionFilePath);
            await bifrost.solution.saveSolutionFile(solutionFileUri);
          }
        }
      }

      bifrost.solution.closeSolution();

      if (bifrost.env.isElectron) {
        const { ipcRenderer } = require('electron');
        ipcRenderer.send(IPC_MESSAGE_CLEAR_WINDOW_SOLUTION, bifrost.env.instanceKey);
      }
    },
    { visibleInSearch: true, description: 'Close Solution', enabledWhen: () => bifrost.solution.hasOpenSolution() },
  );

  commands.register(
    'std.solution.openSolutionFile',
    async (givenUri?: string) => {
      let solutionFileUri = givenUri;

      if (solutionFileUri == null) {
        const filenames = await bifrost.dialog.showOpenFile({
          title: 'Open Solution File',
          filters: [{ name: 'Bifrost Forge World Solution', extensions: ['essln'] }],
        });

        if (filenames == null || filenames.length === 0) {
          return;
        }

        solutionFileUri = bifrost.files.getUriForFilename(filenames[0]);
      }

      await bifrost.solution.openSolutionFile(solutionFileUri);
    },
    { visibleInSearch: true, description: 'Open Solution File...' },
  );

  commands.register(
    'std.solution.refresh',
    () => {
      const solution = bifrost.solution.getSolution();
      if (!solution) {
        return;
      }

      bifrost.solution.onRefresh();
    },
    { enabledWhen: () => bifrost.solution.hasOpenSolution() },
  );

  commands.register(
    'std.solution.addDirectory',
    async (givenTargetDirectoryUri?: string) => {
      let treeViewMediator: TreeViewMediator | null = null;
      let targetDirectory;
      let targetUri;

      if (givenTargetDirectoryUri == null) {
        treeViewMediator = bifrost.views.getById<TreeViewMediator>('std/file-explorer/open-solution');
        const seletedElements = treeViewMediator.getSelectedMetadata();
        const selectedElementUri = seletedElements[0]?.uri ?? bifrost.solution.getSolution()?.projects[0].baseUri;
        if (await bifrost.files.isDirectory(selectedElementUri)) {
          targetDirectory = bifrost.files.getLocalFilenameForUri(selectedElementUri);
        } else {
          targetDirectory = bifrost.files.getContainingDirectory(selectedElementUri);
        }
      } else {
        targetDirectory = bifrost.files.getLocalFilenameForUri(givenTargetDirectoryUri);
      }

      if (targetDirectory == null) {
        return;
      }

      const dialogOptions: DialogOptions = {
        title: 'Directory name',
        content: [
          {
            type: 'text_input',
            id: 'name',
            placeholder: 'Enter a name, e.g. myFolder',
            focus: true,
          },
        ],
        actions: [
          {
            label: 'Create',
            response: 'submit',
            default: true,
          },
        ],
      };

      const dialogValidationFn = async (dialogResultToValidate: DialogResult): Promise<DialogValidationResult> => {
        if (dialogResultToValidate.response === 'submit') {
          const newName = dialogResultToValidate.formData?.name;

          if (newName == null || newName.trim() === '') {
            return {
              closeDialog: false,
              validationErrors: [{ contentId: 'name', errorLabel: "Name can't be blank" }],
            };
          }

          const targetPath = bifrost.files.joinPaths(targetDirectory, newName);
          targetUri = bifrost.files.getUriForFilename(targetPath);
          const nameDoesAlreadyExist = await bifrost.files.doesFileOrDirectoryExist(targetPath);

          if (nameDoesAlreadyExist) {
            return {
              closeDialog: false,
              validationErrors: [{ contentId: 'name', errorLabel: 'Name already exists' }],
            };
          }
        }

        return { closeDialog: true };
      };

      const dialogResult = await bifrost.dialog.open(dialogOptions, dialogValidationFn);

      if (dialogResult.wasCancelled) {
        return;
      }

      await bifrost.files.createDirectory(targetUri);

      await bifrost.solution.onElementAdded(targetUri);
      if (treeViewMediator != null) {
        bifrost.panes.setPaneCollapsed('pane/left/explorer', false);
        try {
          await treeViewMediator.waitForAndSelectEntriesByMetadataFilter((metadata) => metadata.uri === targetUri);

          const solutionEntry = document.querySelector(
            treeViewMediator.domSelector + ' .treeview__entry--selected',
          ) as any;

          solutionEntry?.scrollIntoViewIfNeeded();
        } catch {
          // Entry may have been removed before appearing in tree
        }
      }
    },
    { enabledWhen: () => bifrost.solution.hasOpenSolution() },
  );

  commands.register(
    'std.solution.deleteSelectedElementsInFileExplorer',
    async (givenUrisToDelete?: string[]) => {
      let selectedElementUris;
      if (givenUrisToDelete == null) {
        const treeViewMediator = bifrost.views.getById<TreeViewMediator>('std/file-explorer/open-solution');
        selectedElementUris = treeViewMediator.getSelectedMetadata().map((metadata) => metadata.uri);
      } else {
        selectedElementUris = givenUrisToDelete;
      }

      const selectedElementNames = selectedElementUris.map((uri) => bifrost.files.getLocalBasename(uri));

      const dialogOptions: DialogOptions = {
        title: 'Confirmation',
        content: `Do you want to delete:\n${selectedElementNames.join('\n')}`,
        actions: [
          {
            label: 'No',
            response: 'no',
            cancel: true,
          },
          {
            label: 'Yes',
            response: 'yes',
            default: true,
          },
        ],
      };

      const dialogResult = await bifrost.dialog.open(dialogOptions);

      if (dialogResult.wasCancelled || dialogResult.response === 'no') {
        return;
      }

      const unpackedSelectedFileUris: string[] = [];
      for (const elementUri of selectedElementUris) {
        if (await bifrost.files.isDirectory(elementUri)) {
          const containedFileUris = await bifrost.files.getAllFileUrisInDirectoryTree(elementUri);
          unpackedSelectedFileUris.push(...containedFileUris);
        } else {
          unpackedSelectedFileUris.push(elementUri);
        }
      }

      const openEditorDocuments = bifrost.editors.getOpenEditorDocuments();
      const openEditorDocumentsSelectedForDeletion = openEditorDocuments.filter((editorDocument) => {
        return unpackedSelectedFileUris.includes(editorDocument.uri);
      });

      const closedAllFilesSuccessfully = await bifrost.editors.closeEditorDocumentsUntilUserCancels(
        openEditorDocumentsSelectedForDeletion,
      );

      if (closedAllFilesSuccessfully) {
        await bifrost.files.deleteFilesAndDirectories(selectedElementUris);
        await bifrost.solution.onElementsRemoved(selectedElementUris);
      }
    },
    {
      visibleInSearch: true,
      enabledWhen: (givenUrisToDelete?: string[]): boolean => {
        if (!bifrost.solution.hasOpenSolution()) {
          return false;
        }

        let selectedElementUris: string[];
        if (givenUrisToDelete == null) {
          if (!bifrost.views.isRegistered('std/file-explorer/open-solution')) {
            return false;
          }
          const treeViewMediator = bifrost.views.getById<TreeViewMediator>('std/file-explorer/open-solution');
          selectedElementUris = treeViewMediator.getSelectedMetadata();
        } else {
          selectedElementUris = givenUrisToDelete;
        }

        if (selectedElementUris.length) {
          return true;
        }
        return false;
      },
    },
  );

  commands.register(
    'std.solution.compareTo',
    (uri: string) => {
      const extension = bifrost.files.getFileExtension(uri);
      if (!extension) {
        return;
      }

      return bifrost.commands.executeCommand(`std.solution.compareTo${extension}`, [uri]);
    },
    {
      enabledWhen: (uri: string) => {
        if (!uri) {
          return false;
        }

        const isLocalFile = bifrost.files.isLocalFilename(uri);
        const extension = bifrost.files.getFileExtension(uri);

        if (!extension) {
          return false;
        }

        return (
          isLocalFile &&
          bifrost.commands.isRegistered(`std.solution.compareTo${extension}`) &&
          bifrost.commands.isCommandEnabled(`std.solution.compareTo${extension}`, [uri])
        );
      },
    },
  );

  commands.register(
    'std.solution.duplicateFile',
    async (givenUriToRename?: string) => {
      let treeViewMediator;
      let currentUri;
      if (givenUriToRename == null) {
        treeViewMediator = bifrost.views.getById<TreeViewMediator>('std/file-explorer/open-solution');
        const selectedElements = treeViewMediator.getSelectedMetadata();
        currentUri = selectedElements[0]?.uri;
      } else {
        currentUri = givenUriToRename;
      }

      assertNotNull(currentUri, 'currentUri');

      if (bifrost.editors.hasDocumentTypeDefinitionForUri(currentUri)) {
        const documentTypeDefinition = bifrost.editors.getDocumentTypeDefinitionByUri(currentUri);
        if (bifrost.commands.isRegistered(`std.solution.duplicateFile.${documentTypeDefinition.documentType}`)) {
          bifrost.commands.executeCommand(`std.solution.duplicateFile.${documentTypeDefinition.documentType}`, [
            givenUriToRename,
          ]);

          return;
        }
      }

      bifrost.commands.executeCommand(`std.solution.duplicateFileAndTransformContent`, [
        currentUri,
        (content) => content,
      ]);
    },
    { enabledWhen: () => bifrost.solution.hasOpenSolution() },
  );

  commands.register(
    'std.solution.duplicateFileAndTransformContent',
    async (
      givenUriToRename: string,
      contentTransformFn: (content: string, newUri: string, previousUri: string) => Promise<string>,
    ) => {
      let treeViewMediator;
      let currentUri;
      if (givenUriToRename == null) {
        treeViewMediator = bifrost.views.getById<TreeViewMediator>('std/file-explorer/open-solution');
        const selectedElements = treeViewMediator.getSelectedMetadata();
        currentUri = selectedElements[0]?.uri;
      } else {
        currentUri = givenUriToRename;
      }

      assertNotNull(currentUri, 'currentUri');

      const currentName = bifrost.files.getLocalBasename(currentUri);
      const currentPathWithoutExtension = bifrost.files.getLocalBasename(currentUri, true);

      const dialogOptions: DialogOptions = {
        title: `Duplicate file`,
        content: [
          {
            type: 'text_input',
            id: 'name',
            focus: true,
            value: currentName,
            defaultSelection: {
              startIndex: 0,
              endIndex: currentPathWithoutExtension.length,
            },
          },
        ],
        actions: [
          {
            label: 'Duplicate',
            response: 'submit',
            default: true,
          },
        ],
      };

      const dialogValidationFn = async (dialogResultToValidate: DialogResult): Promise<DialogValidationResult> => {
        if (dialogResultToValidate.response === 'submit') {
          const newName = dialogResultToValidate.formData?.name;

          const lastIndexOfDot = newName?.lastIndexOf('.');
          const extension = lastIndexOfDot !== -1 ? newName.substr(lastIndexOfDot) : '';
          const replaceExtensionRegex = new RegExp(`${extension}$`, 'g');
          const newNameWithoutExtension = newName?.replace(replaceExtensionRegex, '');

          if (
            newName == null ||
            newName.trim() === '' ||
            newNameWithoutExtension == null ||
            newNameWithoutExtension.trim() === ''
          ) {
            return {
              closeDialog: false,
              validationErrors: [{ contentId: 'name', errorLabel: "Name can't be blank" }],
            };
          }

          const illegalNameGiven = bifrost.files.isInvalidFilename(newName);

          if (illegalNameGiven) {
            return {
              closeDialog: false,
              validationErrors: [{ contentId: 'name', errorLabel: "Name can't contain illegal characters" }],
            };
          }

          const newPath = bifrost.files.joinPaths(bifrost.files.getContainingDirectory(currentUri), newName);
          const nameDoesAlreadyExist = await bifrost.files.doesFileOrDirectoryExist(newPath);

          if (nameDoesAlreadyExist && newName !== currentName) {
            return {
              closeDialog: false,
              validationErrors: [{ contentId: 'name', errorLabel: 'Name already exists' }],
            };
          }
        }

        return { closeDialog: true };
      };

      const dialogResult = await bifrost.dialog.open(dialogOptions, dialogValidationFn);
      const newName = dialogResult.formData?.name;

      if (dialogResult.wasCancelled) {
        return;
      }

      const editorDocument = bifrost.editors.getEditorDocumentByUri(currentUri);
      const newNameWithExtension =
        editorDocument != null
          ? bifrost.commands.executeCommand('std.editor.addFileExtensionIfMissing', [editorDocument, newName])
          : newName;

      const newPath = bifrost.files.joinPaths(bifrost.files.getContainingDirectory(currentUri), newNameWithExtension);
      const newUri = bifrost.files.getUriForFilename(newPath);

      const unmodifiedContent = await bifrost.files.load(currentUri);
      const content = await contentTransformFn(unmodifiedContent, newUri, currentUri);
      const success = await bifrost.files.save(newUri, content);
      if (!success) {
        throw new Error(`Could not duplicate at URI: ${currentUri}`);
      }

      bifrost.commands.executeCommand('std.editor.focusOrOpenDocument', [newUri]);

      await bifrost.solution.onElementAdded(newUri);
      if (treeViewMediator != null) {
        try {
          await treeViewMediator.waitForAndSelectEntriesByMetadataFilter((metadata) => metadata.uri === newUri);
        } catch {
          // Entry may have been removed before appearing in tree
        }
      }
    },
    { enabledWhen: () => bifrost.solution.hasOpenSolution() },
  );

  commands.register(
    'std.solution.renameFileOrDirectory',
    async (givenUriToRename?: string) => {
      let treeViewMediator;
      let currentUri;
      if (givenUriToRename == null) {
        treeViewMediator = bifrost.views.getById<TreeViewMediator>('std/file-explorer/open-solution');
        const seletedElements = treeViewMediator.getSelectedMetadata();
        currentUri = seletedElements[0]?.uri;
      } else {
        currentUri = givenUriToRename;
      }

      if (currentUri == null) {
        // TODO: This should throw an error once the solution default selection mechanism is in place
        return;
      }
      const elementType = (await bifrost.files.isDirectory(currentUri)) ? 'directory' : 'file';
      const currentName = bifrost.files.getLocalBasename(currentUri);
      const currentPathWithoutExtension = bifrost.files.getLocalBasename(currentUri, true);

      const dialogOptions: DialogOptions = {
        title: `Rename ${elementType}`,
        content: [
          {
            type: 'text_input',
            id: 'name',
            focus: true,
            value: currentName,
            defaultSelection: {
              startIndex: 0,
              endIndex: currentPathWithoutExtension.length,
            },
          },
        ],
        actions: [
          {
            label: 'Rename',
            response: 'submit',
            default: true,
          },
        ],
      };

      const dialogValidationFn = async (dialogResultToValidate: DialogResult): Promise<DialogValidationResult> => {
        if (dialogResultToValidate.response === 'submit') {
          const newName = dialogResultToValidate.formData?.name;

          const lastIndexOfDot = newName?.lastIndexOf('.');
          const extension = lastIndexOfDot !== -1 ? newName.substr(lastIndexOfDot) : '';
          const replaceExtensionRegex = new RegExp(`${extension}$`, 'g');
          const newNameWithoutExtension = newName?.replace(replaceExtensionRegex, '');

          if (
            newName == null ||
            newName.trim() === '' ||
            newNameWithoutExtension == null ||
            newNameWithoutExtension.trim() === ''
          ) {
            return {
              closeDialog: false,
              validationErrors: [{ contentId: 'name', errorLabel: "Name can't be blank" }],
            };
          }

          const illegalNameGiven = bifrost.files.isInvalidFilename(newName);

          if (illegalNameGiven) {
            return {
              closeDialog: false,
              validationErrors: [{ contentId: 'name', errorLabel: "Name can't contain illegal characters" }],
            };
          }

          const newPath = bifrost.files.joinPaths(bifrost.files.getContainingDirectory(currentUri), newName);
          const nameDoesAlreadyExist = await bifrost.files.doesFileOrDirectoryExist(newPath);

          if (nameDoesAlreadyExist && newName != currentName) {
            return {
              closeDialog: false,
              validationErrors: [{ contentId: 'name', errorLabel: 'Name already exists' }],
            };
          }
        }

        return { closeDialog: true };
      };

      const dialogResult = await bifrost.dialog.open(dialogOptions, dialogValidationFn);
      if (dialogResult.wasCancelled) {
        return;
      }

      const newName = dialogResult.formData?.name;

      const editorDocument = bifrost.editors.getEditorDocumentByUri(currentUri);
      const newNameWithExtension =
        editorDocument != null
          ? bifrost.commands.executeCommand('std.editor.addFileExtensionIfMissing', [editorDocument, newName])
          : newName;

      const newPath = bifrost.files.joinPaths(bifrost.files.getContainingDirectory(currentUri), newNameWithExtension);
      const newUri = bifrost.files.getUriForFilename(newPath);

      const success = await bifrost.files.renameFileOrDirectory(currentUri, newUri);
      if (!success) {
        throw new Error(`Could not rename ${elementType} at URI: ${currentUri}`);
      }

      if (editorDocument != null) {
        const editorDocumentModel = await bifrost.editors.getEditorDocumentModel(editorDocument);
        editorDocumentModel.resetUriAndData(newUri, editorDocument.data.original, editorDocument.data.current);
      }

      await bifrost.solution.onElementRenamed(newUri);
      if (treeViewMediator != null) {
        try {
          await treeViewMediator.waitForAndSelectEntriesByMetadataFilter((metadata) => metadata.uri === newUri);
        } catch {
          // Entry may have been removed before appearing in tree
        }
      }
    },
    { enabledWhen: () => bifrost.solution.hasOpenSolution() },
  );

  commands.register('std.solution.openDirectory', async (uri: string) => {
    const localPath = bifrost.files.getLocalFilenameForUri(uri);

    if (!(await bifrost.files.doesFileOrDirectoryExist(localPath))) {
      removeStaleRecentEntry(bifrost, uri);
      throw new Error(`'${uri}' does not exist. It has been removed from the recently opened list.`);
    }

    const isElectron = bifrost.commands.isRegistered('std.window.focusOrOpenWithSolution');
    const hasSolutionOpen = bifrost.solution.hasOpenSolution();

    if (isElectron) {
      if (isTargetAlreadyOpenHere(bifrost, uri)) {
        return;
      }

      const isOpenInAnotherWindow = bifrost.commands.isCommandEnabled('std.window.focusOrOpenWithSolution', [uri]);
      if (isOpenInAnotherWindow && !hasSolutionOpen) {
        return bifrost.commands.executeCommand('std.window.focusOrOpenWithSolution', [uri]);
      }
    }

    if (hasSolutionOpen) {
      const action = await promptForOpenAction(bifrost, uri, isElectron);
      if (action === 'cancel') {
        return;
      }
      if (action === 'open-new-window') {
        return bifrost.commands.executeCommand('std.window.focusOrOpenWithSolution', [uri]);
      }
    }

    await openSolutionOrDirectory(bifrost, uri, localPath);
  });

  commands.register('std.solution.toggleHiddenFiles', () => bifrost.solution.toggleHiddenFiles(), {
    visibleInSearch: true,
    enabledWhen: () => bifrost.solution.hasOpenSolution(),
  });
}

type OpenAction = 'open-here' | 'open-new-window' | 'cancel';

function removeStaleRecentEntry(bifrost: Bifrost, uri: string): void {
  const staleEntry = bifrost.recentlyOpened.getRecentlyOpenedSolutions().find((item) => item.uri === uri);
  if (staleEntry != null) {
    bifrost.recentlyOpened.removeRecentlyOpenedSolutionItem(staleEntry);
  }
}

function isTargetAlreadyOpenHere(bifrost: Bifrost, uri: string): boolean {
  const currentSolution = bifrost.solution.getSolution();
  const currentUri = currentSolution?.solutionFileUri ?? currentSolution?.baseUri;
  return currentUri === uri;
}

async function promptForOpenAction(
  bifrost: Bifrost,
  targetUri: string,
  canOpenInNewWindow: boolean,
): Promise<OpenAction> {
  const savedPreference = bifrost.settings.get('std.solution.openDirectory.rememberChoice');
  if (savedPreference === true) {
    const defaultAction = bifrost.settings.get('std.solution.openDirectory.defaultChoice');
    return defaultAction === 'open-new-window' ? 'open-new-window' : 'open-here';
  }

  const currentSolution = bifrost.solution.getSolution();
  const solutionLabel = currentSolution?.isExplicitSolution ? 'Solution' : 'Folder';
  const solutionName = currentSolution?.name ?? 'current folder';
  const targetName = bifrost.files.getFilename(targetUri);

  const actions: { label: string; response: string; cancel?: boolean; default?: boolean }[] = [
    { label: 'Cancel', response: 'cancel', cancel: true },
    { label: 'Open Here', response: 'open-same-window', default: true },
  ];

  if (canOpenInNewWindow) {
    actions.push({ label: 'Open in New Window', response: 'open-new-window' });
  }

  const dialogResult = await bifrost.dialog.open({
    title: 'Open Solution',
    content: [
      {
        type: 'text',
        text: `${solutionLabel} \`${solutionName}\` is currently open.\nHow would you like to open \`${targetName}\`?`,
      },
      { type: 'divider' },
      {
        type: 'checkbox',
        id: 'remember',
        label: `Remember my choice and don't ask again`,
      },
    ],
    actions,
  } as DialogOptions);

  if (dialogResult.wasCancelled || dialogResult.response === 'cancel') {
    return 'cancel';
  }

  if (dialogResult.formData?.remember === true) {
    bifrost.settings.set('std.solution.openDirectory.rememberChoice', true);
    bifrost.settings.set('std.solution.openDirectory.defaultChoice', dialogResult.response);
  }

  return dialogResult.response === 'open-new-window' ? 'open-new-window' : 'open-here';
}

async function openSolutionOrDirectory(bifrost: Bifrost, uri: string, localPath: string): Promise<void> {
  if (localPath.endsWith('.essln')) {
    await bifrost.solution.openSolutionFile(uri);
  } else {
    bifrost.solution.openDirectoryAsSolution(uri);
  }
}
