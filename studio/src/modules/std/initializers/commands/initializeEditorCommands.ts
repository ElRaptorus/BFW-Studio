import type { Bifrost } from '#bifrost/Bifrost';

import type React from 'react';

import type {
  DialogContent,
  DialogContentObject,
  DialogFormData,
  DialogOptions,
  DialogResult,
  DialogValidationResult,
  EditorDocument,
  TreeViewMediator,
} from '@evil/bifrost_fw_sdk';
import {
  StandardDialogResponse,
  assertNotNull,
  parseOpenInNewTabUrl,
  validateFormData,
  validateFormDataIsNotEmpty,
  validateFormDataOnSubmit,
} from '@evil/bifrost_fw_sdk';

import type { EditorInlineSearchViewMediator } from '../../../../../../studio-sdk/src/browser/internal/EditorInlineSearchViewMediator';

export function initializeEditorCommands(bifrost: Bifrost): void {
  const commands = bifrost.commands;

  commands.register(
    'std.solution.newFile',
    async (givenTargetDirectoryUri?: string) => {
      const viewMediatorId = 'std/file-explorer/open-solution';
      let treeViewMediator: TreeViewMediator | null = null;

      if (bifrost.views.isRegistered(viewMediatorId)) {
        treeViewMediator = bifrost.views.getById<TreeViewMediator>(viewMediatorId);
      }

      let uri;
      let targetPath;
      let targetFileExtension;
      if (givenTargetDirectoryUri == null) {
        const seletedElements = treeViewMediator?.getSelectedMetadata();
        uri = seletedElements?.[0]?.uri ?? bifrost.solution.getSolution()?.projects[0].baseUri;
      } else {
        uri = givenTargetDirectoryUri;
      }
      const targetDirectoryPath = await bifrost.files.getLocalDirectory(uri);

      const dialogContent: DialogContentObject[] = [
        {
          type: 'text_input',
          id: 'filename',
          placeholder: 'Enter a filename, e.g. example.bpmn',
          focus: true,
        },
      ];

      const dialogOptions: DialogOptions = {
        title: 'Filename',
        content: dialogContent,
        actions: [
          {
            label: 'Create',
            response: StandardDialogResponse.Submit,
            default: true,
          },
        ],
      };

      const dialogValidationFn = validateFormDataOnSubmit(
        validateFormDataIsNotEmpty('filename', "Filename can't be blank"),
        validateFormData('filename', "Filename can't contain illegal characters", async (filename: string) =>
          bifrost.files.isValidFilename(filename),
        ),
        async (formData: DialogFormData): Promise<DialogValidationResult> => {
          let filename = formData.filename as string;
          let extension = '.bpmn';

          // Checks if the filename contains an extension and if any registered Document type is able to handle it.
          // If either condition is not fulfilled, '.bpmn' is used as a fallback.
          const fileNameParts = filename.split('.');
          if (fileNameParts.length > 1) {
            const fullFilename = bifrost.files.joinPaths(targetDirectoryPath, filename);
            if (bifrost.editors.hasDocumentTypeDefinitionForUri(fullFilename)) {
              const givenExtension = fileNameParts[fileNameParts.length - 1];
              extension = `.${givenExtension}`;
            }
          }

          if (
            bifrost.commands.isRegistered(`std.editor.addFileExtensionIfMissing${extension}`) &&
            bifrost.commands.isCommandEnabled(`std.editor.addFileExtensionIfMissing${extension}`)
          ) {
            filename = bifrost.commands.executeCommand(`std.editor.addFileExtensionIfMissing${extension}`, [filename]);
          } else {
            if (!filename.endsWith(extension)) {
              filename = `${filename}${extension}`;
            }
          }

          targetPath = bifrost.files.joinPaths(targetDirectoryPath, filename);
          targetFileExtension = extension;

          const fileOrDirectoryDoesExist = await bifrost.files.doesFileOrDirectoryExist(targetPath);
          if (fileOrDirectoryDoesExist) {
            return {
              closeDialog: false,
              validationErrors: [{ contentId: 'filename', errorLabel: 'Filename already exists' }],
            };
          }

          return { closeDialog: true };
        },
      );

      const dialogResult = await bifrost.dialog.open(dialogOptions, dialogValidationFn);
      if (dialogResult.wasCancelled) {
        return;
      }

      const targetUri = bifrost.files.getUriForFilename(targetPath);

      let initialFileContent = '';

      if (
        bifrost.commands.isRegistered(`std.solution.newFile${targetFileExtension}`) &&
        bifrost.commands.isCommandEnabled(`std.solution.newFile${targetFileExtension}`)
      ) {
        initialFileContent = await commands.executeCommand(`std.solution.newFile${targetFileExtension}`, [
          dialogResult.formData?.filename,
          targetUri,
        ]);
      }

      await bifrost.files.save(targetUri, initialFileContent);

      bifrost.editors.focusOrOpenEditorDocument(targetUri);

      bifrost.panes.setPaneCollapsed('pane/left/explorer', false);

      await bifrost.solution.onElementAdded(targetUri);
      try {
        await treeViewMediator?.waitForAndSelectEntriesByMetadataFilter((metadata) => metadata.uri === targetUri);

        const fileEntry = document.querySelector(treeViewMediator?.domSelector + ' .treeview__entry--selected') as any;
        fileEntry?.scrollIntoViewIfNeeded();

        if (bifrost.views.isRegistered('std/file-explorer/open-editors')) {
          const openEditorsTreeViewMediator = bifrost.views.getById<TreeViewMediator>('std/file-explorer/open-editors');

          const openEditorsEntry = document.querySelector(
            openEditorsTreeViewMediator.domSelector + ' .treeview__entry--selected',
          ) as any;
          openEditorsEntry?.scrollIntoViewIfNeeded();
        }
      } catch {
        // Entry may have been removed before appearing in tree
      }
    },
    { enabledWhen: () => bifrost.solution.hasOpenSolution() },
  );

  commands.register(
    'std.editor.navigateToPreviousEditorDocumentInHistory',
    () => bifrost.editors.navigateToPreviousEditorDocument(),
    { enabledWhen: () => bifrost.editors.hasPreviousEditorDocument() },
  );

  commands.register(
    'std.editor.navigateToNextEditorDocumentInHistory',
    () => bifrost.editors.navigateToNextEditorDocument(),
    { enabledWhen: () => bifrost.editors.hasNextEditorDocument() },
  );

  commands.register('std.editor.openDocument', () => bifrost.showOpenFileDialogAndFocusOrOpenFileOrDirectory(), {
    visibleInSearch: true,
    description: 'Editor: Open Document ...',
  });

  commands.register(
    'std.editor.openFolderAsSolution',
    () => bifrost.showOpenDirectoryDialogAndOpenDirectoryAsSolution(),
    { visibleInSearch: true, description: 'Editor: Open Directory as Solution...' },
  );

  commands.register(
    'std.editor.reopenRecentlyClosedDocument',
    () => {
      const item = bifrost.recentlyClosed.shiftMostRecentByType('editor_document');
      assertNotNull(item, 'item');

      commands.executeCommand('std.editor.focusOrOpenDocument', [item.uri, item.label]);
    },
    { visibleInSearch: true, enabledWhen: () => bifrost.recentlyClosed.hasMostRecentByType('editor_document') },
  );

  commands.register(
    'std.editor.clearRecentlyOpened',
    () => bifrost.recentlyOpened.resetRecentlyOpenedSolutionsAndEditorDocumentItems(),
    { visibleInSearch: true, enabledWhen: () => bifrost.recentlyOpened.hasRecentlyOpenedSolutionsOrFiles() },
  );

  commands.register(
    'std.editor.splitToTheRight',
    (editorDocument?: EditorDocument) => {
      const editorDocumentToSplit = editorDocument ?? bifrost.editors.getFocusedEditorDocument();
      assertNotNull(editorDocumentToSplit, 'editorDocumentToSplit');

      bifrost.editors.splitEditorDocumentToTheRight(editorDocumentToSplit);
    },
    {
      visibleInSearch: true,
      description: 'Editor: Split Focused Editor to the Right',
      enabledWhen: (editorDocument) => {
        const editorDocumentToSplit = editorDocument ?? bifrost.editors.getFocusedEditorDocument();
        return bifrost.editors.canSplitEditor(editorDocumentToSplit);
      },
    },
  );

  commands.register(
    'std.editor.splitToTheBottom',
    (editorDocument?: EditorDocument) => {
      const editorDocumentToSplit = editorDocument ?? bifrost.editors.getFocusedEditorDocument();
      assertNotNull(editorDocumentToSplit, 'editorDocumentToSplit');

      bifrost.editors.splitEditorDocumentToTheBottom(editorDocumentToSplit);
    },
    {
      visibleInSearch: true,
      description: 'Editor: Split Focused Editor to the Bottom',
      enabledWhen: (editorDocument) => {
        const editorDocumentToSplit = editorDocument ?? bifrost.editors.getFocusedEditorDocument();
        return bifrost.editors.canSplitEditor(editorDocumentToSplit);
      },
    },
  );

  commands.register('std.editor.openUrlInBrowser', async (url: string) => {
    const confirmOpeningRemoteUrl = async (): Promise<DialogResult> => {
      const dialogContent: DialogContent = [
        {
          type: 'text',
          text: 'This will open a new browser window outside Studio. Continue?',
        },
        {
          type: 'checkbox',
          id: 'doNotShowAgain',
          label: "Don't ask again.",
          checked: false,
        },
      ];

      const dialogOptions: DialogOptions = {
        title: 'Open external URL',
        content: dialogContent,
        actions: [
          { label: 'Cancel', response: 'cancel', cancel: true },
          { label: 'Confirm', response: 'Confirm', default: true },
        ],
      };

      const dialogResult = await bifrost.dialog.open(dialogOptions);
      return dialogResult;
    };

    const askForConfirmation = bifrost.settings.get('std.editor.askConfirmationForOpeningUriInBrowser');
    if (askForConfirmation) {
      const dialogResult = await confirmOpeningRemoteUrl();

      if (dialogResult.response != 'Confirm') {
        return;
      }

      if (dialogResult.formData?.doNotShowAgain) {
        bifrost.settings.set('std.editor.askConfirmationForOpeningUriInBrowser', false);
      }
    }

    bifrost.commands.executeCommand('std.shell.openUrlInBrowser', [url]);
  });

  commands.register('std.editor.focusOrOpenDocument', async (uri: string, optionalTitle?: string) => {
    if (bifrost.files.isLocalFilename(uri)) {
      await ensureLocalFileExists(uri);
    }

    try {
      bifrost.editors.focusOrOpenEditorDocument(uri, optionalTitle);

      setTimeout(() => {
        const viewMediatorId = 'std/file-explorer/open-editors';

        if (bifrost.views.isRegistered(viewMediatorId)) {
          const openEditorsTreeViewMediator = bifrost.views.getById<TreeViewMediator>(viewMediatorId);

          const openEditorsEntry = document.querySelector(
            openEditorsTreeViewMediator.domSelector + ' .treeview__entry--selected',
          ) as any;
          openEditorsEntry?.scrollIntoViewIfNeeded();
        }
      }, 0);
    } catch {
      const notificationId = bifrost.notifications.open(
        {
          type: 'info',
          content: `Could not open document in ${bifrost.env.productName}: ${uri}`,
          actions: [
            {
              label: 'Open in external program',
              default: true,
              action: 'open',
            },
          ],
        },
        (response) => {
          if (response.action === 'open') {
            bifrost.commands.executeCommand('std.shell.openUrl', [uri]);
            bifrost.notifications.close(notificationId);
          }
        },
      );
    }
  });

  commands.register('std.editor.persistTemporaryTabIfExists', async (uri: string) => {
    const existingDoc = bifrost.editors.getEditorDocumentByUri(uri);
    if (!existingDoc || !existingDoc.isTemporary) {
      return;
    }
    bifrost.editors.persistEditorDocument(existingDoc);
  });

  async function ensureLocalFileExists(uri: string): Promise<void> {
    const filename = bifrost.files.getLocalFilenameForUri(uri);
    const fileDoesNotExist = !(await bifrost.files.doesFileOrDirectoryExist(filename));

    if (fileDoesNotExist) {
      removeFileUriFromRecentItemList(uri);
      throw new Error(`Cannot open file, because it was renamed or removed: ${filename}`);
    }
  }

  function removeFileUriFromRecentItemList(uri: string): void {
    const recentlyOpenedItemToRemove = bifrost.recentlyOpened.getRecentlyOpenedFiles().find((item) => item.uri === uri);

    if (recentlyOpenedItemToRemove) {
      bifrost.recentlyOpened.removeRecentlyOpenedEditorDocumentItem(recentlyOpenedItemToRemove);
    }
  }

  commands.register(
    'std.editor.openDocumentToTheSide',
    (uri: string, optionalTitle?: string) => {
      const hasFocusedEditor = bifrost.editors.getFocusedEditorDocument() != null;

      if (hasFocusedEditor) {
        const editorNextToFocusedEditor = bifrost.editors.splitFocusedEditorToTheRight();

        assertNotNull(editorNextToFocusedEditor, 'editorNextToFocusedEditor');

        bifrost.editors.openEditorDocumentByUriInEditor(editorNextToFocusedEditor, uri, optionalTitle);
      } else {
        bifrost.editors.focusOrOpenEditorDocument(uri, optionalTitle);
      }
    },
    { enabledWhen: (uri: string) => uri != null },
  );

  commands.register(
    'std.editor.openMultipleDocumentsToTheSide',
    (uris: string[]) => {
      const hasFocusedEditor = bifrost.editors.getFocusedEditorDocument() != null;

      if (hasFocusedEditor) {
        const newEditor = bifrost.editors.splitFocusedEditorToTheRight();
        assertNotNull(newEditor, 'newEditor');

        for (const uri of uris) {
          bifrost.editors.openEditorDocumentByUriInEditor(newEditor, uri);
        }
      } else {
        for (const uri of uris) {
          bifrost.editors.focusOrOpenEditorDocument(uri);
        }
      }
    },
    { enabledWhen: (uris: string[]) => uris != null && uris.length > 0 },
  );

  commands.register(
    'std.editor.saveFocusedDocument',
    () => {
      const focusedEditorDocument = bifrost.editors.getFocusedEditorDocument();
      if (focusedEditorDocument == null) {
        return false;
      }

      const isFragmentEditorBpmnDocument = focusedEditorDocument.uri.includes('fragment+bpmn');

      if (isFragmentEditorBpmnDocument) {
        const parentEditorDocument = getParentEditorDocument(focusedEditorDocument.uri);

        if (parentEditorDocument == null) {
          return false;
        }

        return bifrost.editors.saveEditorDocument(parentEditorDocument);
      }

      return bifrost.editors.saveEditorDocument(focusedEditorDocument);
    },
    {
      visibleInSearch: true,
      enabledWhen: () => {
        const focusedEditorDocument = bifrost.editors.getFocusedEditorDocument();
        if (focusedEditorDocument == null) {
          return false;
        }

        const isFragmentEditorDocument = focusedEditorDocument.uri.includes('fragment+bpmn');

        let parentHasUnsavedChanges = false;

        if (isFragmentEditorDocument) {
          const parentEditorDocument = getParentEditorDocument(focusedEditorDocument.uri);

          parentHasUnsavedChanges = parentEditorDocument != null && parentEditorDocument?.hasUnsavedChanges;
        }

        return (focusedEditorDocument != null && focusedEditorDocument.hasUnsavedChanges) || parentHasUnsavedChanges;
      },
    },
  );

  function getParentEditorDocument(fragmentUri: string): EditorDocument | null {
    const parsedFragmentUri = parseOpenInNewTabUrl(fragmentUri);
    const parentEditorDocument = bifrost.editors.getEditorDocumentByUri(parsedFragmentUri.parentUri);

    return parentEditorDocument;
  }

  commands.register(
    'std.editor.showAndFocusInlineSearch',
    () => {
      const focusedEditorDocument = bifrost.editors.getFocusedEditorDocument();
      assertNotNull(focusedEditorDocument, 'focusedEditorDocument');

      const viewMediatorId = `std/inline-search:${focusedEditorDocument.uri}`;
      const hasInlineSearch = bifrost.views.isRegistered(viewMediatorId);

      if (hasInlineSearch) {
        const search = bifrost.views.getById<EditorInlineSearchViewMediator>(viewMediatorId);
        search.showAndFocus();
      }
    },
    { enabledWhen: () => bifrost.editors.getFocusedEditorDocument() != null },
  );

  commands.register(
    'std.editor.closeInlineSearch',
    () => {
      const focusedEditorDocument = bifrost.editors.getFocusedEditorDocument();
      assertNotNull(focusedEditorDocument, 'focusedEditorDocument');

      const search = bifrost.views.getById<EditorInlineSearchViewMediator>(
        `std/inline-search:${focusedEditorDocument.uri}`,
      );
      search.hide();
    },
    { enabledWhen: () => bifrost.editors.getFocusedEditorDocument() != null },
  );

  commands.register(
    'std.editor.showExportDialog',
    () => {
      const editorDocument = bifrost.editors.getFocusedEditorDocument();
      assertNotNull(editorDocument, 'editorDocument');

      bifrost.commands.executeCommand(`std.editor.showExportDialog.${editorDocument.documentType}`);
    },
    {
      visibleInSearch: true,
      enabledWhen: (model?: any) => {
        const editorDocument = bifrost.editors.getFocusedEditorDocument();

        return (
          editorDocument != null &&
          bifrost.commands.isRegistered(`std.editor.showExportDialog.${editorDocument.documentType}`) &&
          bifrost.commands.isCommandEnabled(`std.editor.showExportDialog.${editorDocument.documentType}`, [model])
        );
      },
    },
  );

  commands.register(
    'std.editor.reexportFile',
    () => {
      const editorDocument = bifrost.editors.getFocusedEditorDocument();
      assertNotNull(editorDocument, 'editorDocument');

      bifrost.commands.executeCommand(`std.editor.reexportFile.${editorDocument.documentType}`);
    },
    {
      visibleInSearch: true,
      enabledWhen: () => {
        const editorDocument = bifrost.editors.getFocusedEditorDocument();

        return (
          editorDocument != null &&
          bifrost.commands.isRegistered(`std.editor.reexportFile.${editorDocument.documentType}`) &&
          bifrost.commands.isCommandEnabled(`std.editor.reexportFile.${editorDocument.documentType}`)
        );
      },
    },
  );

  commands.register(
    'std.editor.saveFocusedDocumentAs',
    () => {
      const focusedDoc = bifrost.editors.getFocusedEditorDocument();
      if (focusedDoc == null) {
        return false;
      }

      return bifrost.editors.saveEditorDocumentAs(focusedDoc);
    },
    {
      visibleInSearch: true,
      enabledWhen: () => {
        const focusedEditorDocument = bifrost.editors.getFocusedEditorDocument();
        return focusedEditorDocument != null && bifrost.files.canSave(focusedEditorDocument.uri);
      },
    },
  );

  commands.register(
    'std.editor.saveUnsavedDocuments',
    async () => {
      const openEditorDocuments = bifrost.editors.getOpenEditorDocuments();
      bifrost.editors.saveEditorDocumentsUntilUserCancels(openEditorDocuments);
    },
    { visibleInSearch: true },
  );

  commands.register('std.editor.closeEditorDocument', (editorDocument: EditorDocument) => {
    bifrost.editors.closeEditorDocument(editorDocument);
  });

  commands.register('std.editor.closeOtherEditorDocuments', async (editorDocument: EditorDocument) => {
    const otherEditorDocuments = bifrost.editors.getOpenEditorDocuments().filter((openEditorDocument) => {
      return openEditorDocument.uri !== editorDocument.uri;
    });

    await bifrost.editors.closeEditorDocumentsUntilUserCancels(otherEditorDocuments);
  });

  commands.register('std.editor.closeAllEditorDocuments', async () => {
    const editorDocuments = bifrost.editors.getOpenEditorDocuments();

    await bifrost.editors.closeEditorDocumentsUntilUserCancels(editorDocuments);
  });

  commands.register('std.editor.closeSavedEditorDocuments', async () => {
    const editorDocuments = bifrost.editors.getOpenEditorDocuments();

    const editorDocumentsWithoutChanges = editorDocuments.filter((currentEditorDocument) => {
      return !currentEditorDocument.hasUnsavedChanges;
    });

    await bifrost.editors.closeEditorDocumentsUntilUserCancels(editorDocumentsWithoutChanges);
  });

  commands.register('std.editor.closeAllEditorDocumentsInTabGroup', async (editorDocuments: EditorDocument[]) => {
    await bifrost.editors.closeEditorDocumentsUntilUserCancels(editorDocuments);
  });

  commands.register('std.editor.saveAllEditorDocumentsInTabGroup', async (editorDocuments: EditorDocument[]) => {
    const editorDocumentsWithChanges = editorDocuments.filter((editorDocument) => {
      return editorDocument.hasUnsavedChanges;
    });

    await bifrost.editors.saveEditorDocumentsUntilUserCancels(editorDocumentsWithChanges);
  });

  commands.register(
    'std.editor.closeFocusedDocumentOrWindow',
    () => {
      const editorDocument = bifrost.editors.getFocusedEditorDocument();
      if (editorDocument) {
        bifrost.commands.executeCommand('std.editor.closeEditorDocument', [editorDocument]);
      } else {
        bifrost.commands.executeCommand('std.window.close');
      }
    },
    { visibleInSearch: true },
  );

  commands.register(
    'std.editor.closeFocusedDocument',
    () => {
      const editorDocument = bifrost.editors.getFocusedEditorDocument();
      if (editorDocument) {
        bifrost.commands.executeCommand('std.editor.closeEditorDocument', [editorDocument]);
      }
    },
    { visibleInSearch: true },
  );

  commands.register(
    'std.editor.focusNextDocument',
    () => {
      bifrost.editors.focusNextEditorDocument();
    },
    { visibleInSearch: true },
  );

  commands.register(
    'std.editor.copyEditorDocumentFileName',
    (uri: string) => {
      navigator.clipboard.writeText(bifrost.files.getFilename(uri));
    },
    { visibleInSearch: true, enabledWhen: (uri: string) => uri != null && bifrost.files.isLocalFilename(uri) },
  );

  commands.register(
    'std.editor.copyEditorDocumentFilePath',
    (uri: string) => {
      navigator.clipboard.writeText(bifrost.files.getLocalFilenameForUri(uri));
    },
    { visibleInSearch: true, enabledWhen: (uri: string) => uri != null && bifrost.files.isLocalFilename(uri) },
  );

  commands.register('std.fileExplorer.copyMultipleFileNames', (uris: string[]) => {
    const names = uris.map((uri) => bifrost.files.getFilename(uri));
    navigator.clipboard.writeText(names.join('\n'));
  });

  commands.register('std.fileExplorer.copyMultipleFilePaths', (uris: string[]) => {
    const paths = uris
      .filter((uri) => bifrost.files.isLocalFilename(uri))
      .map((uri) => bifrost.files.getLocalFilenameForUri(uri));
    navigator.clipboard.writeText(paths.join('\n'));
  });

  commands.register(
    'std.editor.focusPrevDocument',
    () => {
      bifrost.editors.focusPreviousEditorDocument();
    },
    { visibleInSearch: true },
  );

  commands.register(
    'std.editor.undoInFocusedEditorDocument',
    async () => {
      const editorDocument = bifrost.editors.getFocusedEditorDocument();
      if (editorDocument) {
        const editorDocumentModel = await bifrost.editors.getEditorDocumentModel(editorDocument);
        if (editorDocumentModel.canUndo()) {
          editorDocumentModel.undo();
        }
      }
    },
    {
      visibleInSearch: true,
      description: 'Editor: Undo',
      enabledWhen: () => {
        const focusedEditorDocument = bifrost.editors.getFocusedEditorDocument();
        if (focusedEditorDocument == null) {
          return false;
        }

        const editorDocumentModel = bifrost.editors.getEditorDocumentModelIfPresent(focusedEditorDocument);
        if (editorDocumentModel == null) {
          return false;
        }

        return editorDocumentModel.canUndo();
      },
    },
  );

  commands.register(
    'std.editor.redoInFocusedEditorDocument',
    async () => {
      const editorDocument = bifrost.editors.getFocusedEditorDocument();
      if (editorDocument) {
        const editorDocumentModel = await bifrost.editors.getEditorDocumentModel(editorDocument);
        if (editorDocumentModel.canRedo()) {
          editorDocumentModel.redo();
        }
      }
    },
    {
      visibleInSearch: true,
      description: 'Editor: Redo',
      enabledWhen: () => {
        const focusedEditorDocument = bifrost.editors.getFocusedEditorDocument();
        if (focusedEditorDocument == null) {
          return false;
        }

        const editorDocumentModel = bifrost.editors.getEditorDocumentModelIfPresent(focusedEditorDocument);
        if (editorDocumentModel == null) {
          return false;
        }

        return editorDocumentModel.canRedo();
      },
    },
  );

  commands.register(
    'std.editor.zoomToActualSize',
    (givenEditorDocument?: EditorDocument) => {
      const editorDocument = givenEditorDocument ?? bifrost.editors.getFocusedEditorDocument();
      assertNotNull(editorDocument, 'editorDocument');

      bifrost.commands.executeCommand(`std.editor.zoomToActualSize.${editorDocument.documentType}`, [editorDocument]);
    },
    {
      visibleInSearch: true,
      description: ['Editor: Zoom to actual size (100%)'],
      enabledWhen: (givenEditorDocument?: EditorDocument) => {
        const editorDocument = givenEditorDocument ?? bifrost.editors.getFocusedEditorDocument();

        return (
          editorDocument != null &&
          bifrost.commands.isRegistered(`std.editor.zoomToActualSize.${editorDocument.documentType}`) &&
          bifrost.commands.isCommandEnabled(`std.editor.zoomToActualSize.${editorDocument.documentType}`)
        );
      },
    },
  );

  commands.register(
    'std.editor.zoomToViewport',
    (givenEditorDocument?: EditorDocument) => {
      const editorDocument = givenEditorDocument ?? bifrost.editors.getFocusedEditorDocument();
      assertNotNull(editorDocument, 'editorDocument');

      bifrost.commands.executeCommand(`std.editor.zoomToViewport.${editorDocument.documentType}`, [editorDocument]);
    },
    {
      visibleInSearch: true,
      description: ['Editor: Zoom to viewport', 'Editor: Fit document onto screen'],
      enabledWhen: (givenEditorDocument?: EditorDocument) => {
        const editorDocument = givenEditorDocument ?? bifrost.editors.getFocusedEditorDocument();

        return (
          editorDocument != null &&
          bifrost.commands.isRegistered(`std.editor.zoomToViewport.${editorDocument.documentType}`) &&
          bifrost.commands.isCommandEnabled(`std.editor.zoomToViewport.${editorDocument.documentType}`)
        );
      },
    },
  );

  commands.register(
    'std.editor.zoomToSelectedElement',
    (givenEditorDocument?: EditorDocument) => {
      const editorDocument = givenEditorDocument ?? bifrost.editors.getFocusedEditorDocument();
      assertNotNull(editorDocument, 'editorDocument');

      bifrost.commands.executeCommand(`std.editor.zoomToSelectedElement.${editorDocument.documentType}`, [
        editorDocument,
      ]);
    },
    {
      visibleInSearch: true,
      description: ['Editor: Zoom to element', 'Editor: Fit element onto screen'],
      enabledWhen: (givenEditorDocument?: EditorDocument) => {
        const editorDocument = givenEditorDocument ?? bifrost.editors.getFocusedEditorDocument();

        return (
          editorDocument != null &&
          bifrost.commands.isRegistered(`std.editor.zoomToSelectedElement.${editorDocument.documentType}`) &&
          bifrost.commands.isCommandEnabled(`std.editor.zoomToSelectedElement.${editorDocument.documentType}`)
        );
      },
    },
  );

  commands.register('std.editor.gotoSymbolInDocument', async (editorDocumentUri: string, symbolId: string) => {
    const editorDocument = bifrost.editors.focusOrOpenEditorDocument(editorDocumentUri);

    bifrost.commands.executeCommand(`std.editor.gotoSymbolInDocument.${editorDocument.documentType}`, [
      editorDocument,
      symbolId,
    ]);
  });

  commands.register(
    'std.editor.gotoSymbolInDocumentAndCloseCurrentDialog',
    async (editorDocumentUri: string, symbolId: string) => {
      bifrost.dialog.close();
      commands.executeCommand('std.editor.gotoSymbolInDocument', [editorDocumentUri, symbolId]);
    },
  );

  commands.register('std.editor.addFileExtensionIfMissing', (editorDocument: EditorDocument, filename: string) => {
    const commandName = `std.editor.addFileExtensionIfMissing.${editorDocument.documentType}`;

    if (bifrost.commands.isRegistered(commandName)) {
      return bifrost.commands.executeCommand(commandName, [filename]);
    }

    return filename;
  });

  const editorEmptyStateExtraActions: React.JSX.Element[] = [];
  commands.register('std.editorEmptyState.setExtraAction', (reactComponent: React.JSX.Element) => {
    editorEmptyStateExtraActions.push(reactComponent);
  });
  commands.register('std.editorEmptyState.getExtraActions', () => editorEmptyStateExtraActions);
}
