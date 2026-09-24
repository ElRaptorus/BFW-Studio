import { AbstractEmitter } from '#bifrost/common/AbstractEmitter';
import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import type { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import { isUrlForOpenInNewTab, parseOpenInNewTabUrl } from '#bifrost/common/OpenInNewTabUrl';
import type { DialogOptions } from '#bifrost/contracts/DialogTypes';
import type { EditorAreaLayout_Editor, EditorAreaViewData, EditorDocument } from '#bifrost/contracts/EditorTypes';
import {
  EVENT_EDITOR_AREA_DOCUMENT_CLOSED,
  EVENT_EDITOR_AREA_FOCUS_UPDATED,
  EVENT_EDITOR_AREA_LAYOUT_UPDATED,
  EVENT_EDITOR_DOCUMENT_DATA_UPDATED,
  EVENT_EDITOR_DOCUMENT_FRAGMENT_ID_UPDATED,
  EVENT_EDITOR_DOCUMENT_LABEL_UPDATED,
  EVENT_EDITOR_DOCUMENT_METADATA_UPDATED,
  EVENT_EDITOR_DOCUMENT_TITLE_UPDATED,
  EVENT_EDITOR_DOCUMENT_URI_UPDATED,
} from '#bifrost/contracts/internal/EditorEvents';
import type { SearchQuery } from '#bifrost/contracts/internal/SearchTypes';

import type { Bifrost } from '../Bifrost';
import { EditorAreaManager } from '../common/EditorAreaManager';
import { EditorDocumentInspectorManager } from '../common/EditorDocumentInspectorManager';
import { EditorDocumentMergeResolverManager } from '../common/EditorDocumentMergeResolverManager';
import { EditorDocumentModelManager } from '../common/EditorDocumentModelManager';
import { EditorDocumentRendererManager } from '../common/EditorDocumentRendererManager';
import type {
  EditorDocumentTypeDefinition,
  EditorDocumentTypeDefinitionWithoutName,
} from '../common/EditorDocumentTypeManager';
import { EditorDocumentTypeManager } from '../common/EditorDocumentTypeManager';
import type { LocalStorageItem } from '../common/LocalStorageItem';
import { RecentlyViewedMediator } from '../common/RecentlyViewedMediator';

export class EditorMediator extends AbstractEmitter {
  private bifrost: Bifrost;

  private editorAreaManager: EditorAreaManager;
  private editorAreaStorage: LocalStorageItem;

  private editorDocumentModelManager: EditorDocumentModelManager;
  private editorDocumentRenderer: EditorDocumentRendererManager;
  private editorDocumentInspectorManager: EditorDocumentInspectorManager;
  private editorDocumentMergeResolverManager: EditorDocumentMergeResolverManager;
  private editorDocumentTypeManager: EditorDocumentTypeManager;

  private readonly recentlyViewed: RecentlyViewedMediator;
  private emitLayoutChangedTimeout: any;

  /** Save delegates for model-less documents (plugin webview editors). */
  private saveDelegates = new Map<string, () => Promise<void>>();

  constructor(localStorage: LocalStorageItem, bifrost: Bifrost) {
    super();
    this.bifrost = bifrost;

    this.emitLayoutChangedTimeout = null;

    this.editorDocumentTypeManager = new EditorDocumentTypeManager();
    this.editorDocumentRenderer = new EditorDocumentRendererManager();
    this.editorDocumentInspectorManager = new EditorDocumentInspectorManager();
    this.editorDocumentMergeResolverManager = new EditorDocumentMergeResolverManager();

    this.editorAreaManager = new EditorAreaManager(this.bifrost);

    this.editorDocumentModelManager = new EditorDocumentModelManager([this.bifrost.files, this.bifrost]);
    this.editorDocumentModelManager.on(EVENT_EDITOR_DOCUMENT_DATA_UPDATED, (editorDocument: EditorDocument) => {
      this.emit(EVENT_EDITOR_DOCUMENT_DATA_UPDATED, [editorDocument]);

      if (editorDocument.hasUnsavedChanges && editorDocument.isTemporary) {
        this.editorAreaManager.persistEditorDocument(editorDocument);
      }
    });

    this.editorAreaManager.on(
      EVENT_EDITOR_AREA_FOCUS_UPDATED,
      (focusedEditorDocument: EditorDocument, blurredEditorDocument: EditorDocument) => {
        if (blurredEditorDocument != null) {
          const blurredEditorDocumentModel = this.getEditorDocumentModelIfPresent(blurredEditorDocument);
          blurredEditorDocumentModel?.onEditorDocumentDidBlur();
        }

        if (focusedEditorDocument != null) {
          const focusedEditorDocumentModel = this.getEditorDocumentModelIfPresent(focusedEditorDocument);
          focusedEditorDocumentModel?.onEditorDocumentDidFocus();
        }

        this.emit(EVENT_EDITOR_AREA_FOCUS_UPDATED, [focusedEditorDocument, blurredEditorDocument]);
      },
    );
    this.editorAreaManager.on(EVENT_EDITOR_AREA_LAYOUT_UPDATED, () => this.emit(EVENT_EDITOR_AREA_LAYOUT_UPDATED));

    this.editorAreaStorage = localStorage;

    const saveEditorAreaFn = (): void => {
      const editorAreaData = this.editorAreaManager.serialize();
      this.editorAreaStorage.save(editorAreaData);
    };

    this.editorAreaManager.on(EVENT_EDITOR_AREA_LAYOUT_UPDATED, saveEditorAreaFn);
    this.editorAreaManager.on(EVENT_EDITOR_AREA_FOCUS_UPDATED, saveEditorAreaFn);
    this.editorAreaManager.on(EVENT_EDITOR_DOCUMENT_METADATA_UPDATED, saveEditorAreaFn);
    this.editorDocumentModelManager.on(EVENT_EDITOR_DOCUMENT_DATA_UPDATED, saveEditorAreaFn);

    this.editorDocumentModelManager.on(EVENT_EDITOR_DOCUMENT_METADATA_UPDATED, (uri: string, metadataDiff: any) => {
      const editorDocument = this.editorAreaManager.getEditorDocumentByUri(uri);
      if (editorDocument == null) {
        return;
      }

      const metadataBefore = editorDocument.metadata ?? {};
      this.editorAreaManager.updateEditorDocumentMetadata(editorDocument, { ...metadataBefore, ...metadataDiff });
      this.emit(EVENT_EDITOR_DOCUMENT_METADATA_UPDATED, [editorDocument]);
    });
    this.editorDocumentModelManager.on(
      EVENT_EDITOR_DOCUMENT_FRAGMENT_ID_UPDATED,
      (parentUri: any, oldFragmentId: string, newFragmentId: string) => {
        this.editorAreaManager.updateEditorDocumentFragmentId(parentUri, oldFragmentId, newFragmentId);
      },
    );
    this.editorDocumentModelManager.on(EVENT_EDITOR_DOCUMENT_LABEL_UPDATED, (uri: string, newLabel: string) => {
      const editorDocument = this.editorAreaManager.getEditorDocumentByUri(uri);
      if (editorDocument == null) {
        return;
      }

      this.editorAreaManager.updateEditorDocumentLabel(editorDocument, newLabel);

      this.bifrost.recentlyOpened.updateRecentlyOpenedEditorDocumentLabel(editorDocument.uri, newLabel);

      this.emit(EVENT_EDITOR_DOCUMENT_TITLE_UPDATED, [editorDocument]);
    });
    this.editorDocumentModelManager.on(
      EVENT_EDITOR_DOCUMENT_URI_UPDATED,
      (editorDocumentUriBefore: string, editorDocumentUriAfter: string) => {
        this.bifrost.settings.resourceMoved(editorDocumentUriBefore, editorDocumentUriAfter);

        const editorDocument = this.editorAreaManager.getEditorDocumentByUri(editorDocumentUriBefore);
        if (editorDocument == null) {
          return;
        }

        this.editorAreaManager.updateEditorDocumentUri(editorDocument, editorDocumentUriAfter);

        const updatedEditorDocument = this.editorAreaManager.getEditorDocumentByUri(editorDocumentUriAfter);
        if (updatedEditorDocument == null) {
          return;
        }

        const recentlyOpenedItem = this.bifrost.recentlyOpened
          .getRecentlyOpenedEditorDocumentItems()
          .find((item) => item.uri === editorDocumentUriBefore);

        if (recentlyOpenedItem) {
          this.bifrost.recentlyOpened.removeRecentlyOpenedEditorDocumentItem(recentlyOpenedItem);
        }

        this.bifrost.recentlyOpened.addRecentlyOpenedEditorDocumentItem({
          uri: updatedEditorDocument.uri,
          label: updatedEditorDocument.label,
        });

        this.emit(EVENT_EDITOR_DOCUMENT_URI_UPDATED, [editorDocumentUriBefore, editorDocumentUriAfter]);
      },
    );
    this.editorAreaManager.on(EVENT_EDITOR_AREA_DOCUMENT_CLOSED, (editorDocument: EditorDocument) => {
      if (!isUrlForOpenInNewTab(editorDocument.uri)) {
        this.editorDocumentModelManager.tryRemoveEditorDocumentModelInstance(editorDocument);
      }

      this.bifrost.recentlyClosed.addItem('editor_document', { uri: editorDocument.uri, label: editorDocument.label });
      this.emit(EVENT_EDITOR_AREA_DOCUMENT_CLOSED, [editorDocument]);
    });

    this.recentlyViewed = new RecentlyViewedMediator();

    window.addEventListener('resize', () => this.onEditorSizeChanged());
  }

  filterRecentlyViewedHistory(filterFn: (item: any) => boolean): void {
    this.recentlyViewed.filterHistory(filterFn);
  }

  filterRecentlyOpenedHistory(filterFn: (item: any) => boolean): void {
    this.bifrost.recentlyOpened.filterRecentlyOpenedHistory(filterFn);
  }

  persistEditorDocument(editorDocument: EditorDocument): void {
    this.editorAreaManager.persistEditorDocument(editorDocument);
  }

  /**
   * Internal: Restores data from the last session.
   */
  restoreFromLastSession(): void {
    const editorAreaData = this.editorAreaStorage.load();
    this.editorAreaManager.deserialize(editorAreaData);

    const focusedEditorDocument = this.getFocusedEditorDocument();
    if (focusedEditorDocument != null) {
      this.recentlyViewed.addEditorDocument(focusedEditorDocument, null);
    }
  }

  /**
   * Clears all persistent information relating to this specific instance of EditorMediator.
   */
  clearInstance(): void {
    this.editorAreaStorage.clear();
  }

  /**
   * Creates a new EditorDocument in the editor and focuses it.
   *
   * Returns the created EditorDocument
   */
  async createNewEditorDocument(uri: string, initialData: string): Promise<EditorDocument> {
    await this.bifrost.files.save(uri, initialData);
    return this.focusOrOpenEditorDocument(uri);
  }

  /**
   * Creates a new EditorDocument in the editor and focuses it.
   *
   * Returns the created EditorDocument
   */
  createNewEditorDocumentAsBuffer(documentType: string, initialData: string | null = null): EditorDocument {
    const editorDocumentTypeDefinition = this.editorDocumentTypeManager.getById(documentType);
    if (editorDocumentTypeDefinition == null) {
      throw new Error(`Could not find editor document type definition: '${documentType}'`);
    }

    const blurredEditorDocument = this.getFocusedEditorDocument();

    const newEditorDocument = this.editorAreaManager.createNewEditorDocument(
      documentType,
      editorDocumentTypeDefinition.rendererKey,
      editorDocumentTypeDefinition.modelKey,
      editorDocumentTypeDefinition.inspectorKey,
      editorDocumentTypeDefinition.icon,
      initialData,
    );

    this.recentlyViewed.addEditorDocument(newEditorDocument, blurredEditorDocument);

    return newEditorDocument;
  }

  /**
   * Focuses or opens and then focuses the given `EditorDocument` or a document with the given URI.
   *
   * Returns the focused EditorDocument
   */
  focusOrOpenEditorDocument(editorDocumentOrUri: EditorDocument | string, optionalLabel?: string): EditorDocument {
    return this.doFocusOrOpenEditorDocument(editorDocumentOrUri, true, optionalLabel);
  }

  /**
   * Opens a document with the given `uri` in the given `editor` without focusing it.
   *
   * Returns the unfocused EditorDocument
   */
  openEditorDocumentByUriInEditor(
    editor: EditorAreaLayout_Editor,
    uri: string,
    optionalLabel?: string,
  ): EditorDocument {
    const currentlyFocussedEditorDocument = this.getFocusedEditorDocument();
    const editorDocumentTypeDefinition = this.editorDocumentTypeManager.getByUri(uri);
    const openedEditorDocument = this.editorAreaManager.openEditorDocumentByUri(
      uri,
      editorDocumentTypeDefinition.documentType,
      editorDocumentTypeDefinition.rendererKey,
      editorDocumentTypeDefinition.modelKey,
      editorDocumentTypeDefinition.inspectorKey,
      editorDocumentTypeDefinition.icon,
      optionalLabel,
      editor,
    );

    this.focusEditorDocumentAndWaitForVisible(openedEditorDocument);

    this.bifrost.recentlyOpened.addRecentlyOpenedEditorDocumentItem({
      uri: openedEditorDocument.uri,
      icon: openedEditorDocument.icon,
      label: openedEditorDocument.label,
    });
    this.recentlyViewed.addEditorDocument(openedEditorDocument, currentlyFocussedEditorDocument);

    return openedEditorDocument;
  }

  /**
   * Internal: Used by the navigator
   */
  hasPreviousEditorDocument(): boolean {
    return this.recentlyViewed.hasPreviousEditorDocument();
  }

  /**
   * Internal: Used by the navigator
   */
  hasNextEditorDocument(): boolean {
    return this.recentlyViewed.hasNextEditorDocument();
  }

  /**
   * Internal: Used by the navigator
   */
  async navigateToPreviousEditorDocument(): Promise<void> {
    const blurredEditorDocument = this.getFocusedEditorDocument();

    await this.recentlyViewed.lockForNavigation(async () => {
      const item = this.recentlyViewed.gotoPreviousEditorDocument();
      assertNotNull(item, 'item');

      await this.navigateToEditorDocument(item.uri, item.label, item.metadata);
    });

    this.emit(EVENT_EDITOR_AREA_FOCUS_UPDATED, [this.getFocusedEditorDocument(), blurredEditorDocument]);
  }

  /**
   * Internal: Used by the navigator
   */
  async navigateToNextEditorDocument(): Promise<void> {
    const blurredEditorDocument = this.getFocusedEditorDocument();

    await this.recentlyViewed.lockForNavigation(async () => {
      const item = this.recentlyViewed.gotoNextEditorDocument();
      assertNotNull(item, 'item');

      await this.navigateToEditorDocument(item.uri, item.label, item.metadata);
    });

    this.emit(EVENT_EDITOR_AREA_FOCUS_UPDATED, [this.getFocusedEditorDocument(), blurredEditorDocument]);
  }

  private async navigateToEditorDocument(uri: string, label: string, metadata: any): Promise<EditorDocument> {
    const editorDocument = this.doFocusOrOpenEditorDocument(uri, false, label);

    if (editorDocument.modelKey) {
      const editorDocumentModel = await this.getEditorDocumentModel(editorDocument);

      await editorDocumentModel.restoreMetadataAfterNavigation(metadata);
    }

    return editorDocument;
  }

  private doFocusOrOpenEditorDocument(
    editorDocumentOrUri: EditorDocument | string,
    shouldRecordForRecentManagers: boolean,
    optionalTitle?: string,
  ): EditorDocument {
    const blurredEditorDocument = this.getFocusedEditorDocument();

    const uri = typeof editorDocumentOrUri === 'string' ? editorDocumentOrUri : editorDocumentOrUri.uri;

    const focusedEditorDocument = this.editorAreaManager.focusEditorDocumentByUri(uri);

    if (focusedEditorDocument == null) {
      if (isUrlForOpenInNewTab(uri)) {
        try {
          parseOpenInNewTabUrl(uri);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          try {
            this.bifrost.notifications.open({
              type: 'error',
              content: `Cannot open fragment document: the URI is malformed. This is a bug in the module that created it.\n\n${message}`,
              source: 'EditorMediator.doFocusOrOpenEditorDocument',
            });
          } catch {
            console.error(`[EditorMediator] Malformed fragment URI (notification system unavailable): ${message}`);
          }

          const currentFocused = this.getFocusedEditorDocument();
          if (currentFocused) {
            return currentFocused;
          }

          throw new Error(`Malformed fragment URI: ${message}`, { cause: error });
        }
      }

      const hasDocumentTypeDefinition = this.editorDocumentTypeManager.hasTypeForUri(uri);
      if (!hasDocumentTypeDefinition) {
        throw new Error(`Could not find an editor document type for uri: ${uri}`);
      }
      const editorDocumentTypeDefinition = this.editorDocumentTypeManager.getByUri(uri);

      if (typeof editorDocumentTypeDefinition.canOpen === 'function') {
        const canOpenResult = editorDocumentTypeDefinition.canOpen(uri);
        if (!canOpenResult.documentCanBeOpened) {
          this.bifrost.notifications.open({
            type: 'error',
            content:
              canOpenResult.error || 'Cannot open document: Preflight check failed. See dev console for details.',
            source: 'EditorMediator.doFocusOrOpenEditorDocument',
          });

          const currentFocused = this.getFocusedEditorDocument();
          if (currentFocused) {
            return currentFocused;
          }

          throw new Error(canOpenResult.error);
        }
      }
      const openedEditorDocument = this.editorAreaManager.openEditorDocumentByUri(
        uri,
        editorDocumentTypeDefinition.documentType,
        editorDocumentTypeDefinition.rendererKey,
        editorDocumentTypeDefinition.modelKey,
        editorDocumentTypeDefinition.inspectorKey,
        editorDocumentTypeDefinition.icon,
        optionalTitle,
      );
      this.editorAreaManager.focusEditorDocumentByUri(uri);

      if (shouldRecordForRecentManagers) {
        if (!isUrlForOpenInNewTab(openedEditorDocument.uri)) {
          this.bifrost.recentlyOpened.addRecentlyOpenedEditorDocumentItem({
            uri: openedEditorDocument.uri,
            icon: openedEditorDocument.icon,
            label: openedEditorDocument.label,
          });
        }

        this.recentlyViewed.addEditorDocument(openedEditorDocument, blurredEditorDocument);
      }
      return openedEditorDocument;
    }

    if (shouldRecordForRecentManagers) {
      this.recentlyViewed.addEditorDocument(focusedEditorDocument, blurredEditorDocument);
    }

    return focusedEditorDocument;
  }

  /**
   * Focuses the given `editorDocument`, if that document is already open in an editor and waits for it to be visible.
   * Throws an error otherwise.
   *
   * Returns the focused EditorDocument
   */
  async focusEditorDocumentAndWaitForVisible(editorDocument: EditorDocument): Promise<EditorDocument> {
    const focusedEditorDocument = this.editorAreaManager.focusEditorDocumentByUri(editorDocument.uri);
    if (focusedEditorDocument == null) {
      throw new Error(`Unexpected error: Could not focus EditorDocument: ${JSON.stringify(editorDocument)}`);
    }

    // By now the `editorDocument` is focused and the new state is propagated through React.
    // We're using a Promise and setTimeout here to give React time to manipulate the DOM.
    // This is a very indirect mechanism to manipulate what's on screen, but for now, it seems like a good trade-off.
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(focusedEditorDocument);
      }, 100);
    });
  }

  /**
   * Attempts to save the given list of `editorDocuments`.
   * If the user cancels a save dialog, the whole saving process stops.
   * Returns `true`, if all documents were saved successfully.
   *
   * Invokes lifecycle hooks on the associated EditorDocumentModel.
   */
  async saveEditorDocumentsUntilUserCancels(editorDocuments: EditorDocument[]): Promise<boolean> {
    const editorDocumentsWithChanges = editorDocuments.filter((currentEditorDocument) => {
      return currentEditorDocument.hasUnsavedChanges;
    });

    const immediatelySavableEditorDocuments = editorDocumentsWithChanges.filter((currentEditorDocument) => {
      return this.bifrost.files.canSaveImmediately(currentEditorDocument.uri);
    });

    const notImmediatelySavableEditorDocuments = editorDocumentsWithChanges.filter((currentEditorDocument) => {
      return !this.bifrost.files.canSaveImmediately(currentEditorDocument.uri);
    });

    const editorDocumentsToSave = immediatelySavableEditorDocuments.concat(notImmediatelySavableEditorDocuments);

    for (const editorDocument of editorDocumentsToSave) {
      const documentWasSaved = await this.saveEditorDocument(editorDocument, false);
      if (!documentWasSaved) {
        return false;
      }
    }

    return true;
  }

  /**
   * Attempts to close the given list of `editorDocuments`.
   * As soon as the first closing is canceled the whole closing process stops.
   * Returns `true`, if all documents were closed successfully.
   *
   * Invokes lifecycle hooks on the associated EditorDocumentModel.
   */
  async closeEditorDocumentsUntilUserCancels(
    editorDocuments: EditorDocument[],
    skipAskUnsavedChanges = false,
  ): Promise<boolean> {
    const editorDocumentsWithoutChanges = editorDocuments.filter((currentEditorDocument) => {
      return !currentEditorDocument.hasUnsavedChanges;
    });

    const editorDocumentsWithChanges = editorDocuments.filter((currentEditorDocument) => {
      return currentEditorDocument.hasUnsavedChanges;
    });

    const editorDocumentsToClose = editorDocumentsWithChanges.concat(editorDocumentsWithoutChanges);

    let success = true;

    for (const editorDocumentToClose of editorDocumentsToClose) {
      const documentWasClosed = await this.closeEditorDocument(editorDocumentToClose, false, skipAskUnsavedChanges);
      if (!documentWasClosed) {
        success = false;
        break;
      }
    }

    if (this.editorAreaManager.getFocusedEditorDocument() == null) {
      this.navigateToNextAvailableOpenDocument();
    }
    return success;
  }

  /**
   * Attempts to close the given `editorDocument`.
   * Returns `true`, if the document was closed successfully.
   *
   * Invokes lifecycle hooks on the associated EditorDocumentModel.
   *
   * @param editorDocument The Editor Document to close.
   * @param navigateToNextOpenTabAfterClose If set to false, the Editor will not navigate to the next available open tab,
   *                                        after the given Editor Document was closed.
   */
  async closeEditorDocument(
    editorDocument: EditorDocument,
    navigateToNextOpenTabAfterClose = true,
    skipAskUnsavedChanges = false,
  ): Promise<boolean> {
    let shouldCloseEditorDocument = true;
    let editorDocumentModel: EditorDocumentModel | null = null;

    let documentToCloseIsFocused = editorDocument.uri === this.editorAreaManager.getFocusedEditorDocument()?.uri;

    if (editorDocument.modelKey != null) {
      try {
        editorDocumentModel = await this.getEditorDocumentModel(editorDocument);

        if (editorDocumentModel != null) {
          const closeResult = await editorDocumentModel.closeEditorDocument();
          if (closeResult == null) {
            if (skipAskUnsavedChanges) {
              shouldCloseEditorDocument = true;
            } else {
              shouldCloseEditorDocument = await this.saveChangesBeforeClosingDocument(editorDocumentModel);
              documentToCloseIsFocused = true;
            }
          } else {
            shouldCloseEditorDocument = closeResult;
          }
        }
      } catch {
        shouldCloseEditorDocument = true;
      }
    } else if (!skipAskUnsavedChanges && editorDocument.hasUnsavedChanges) {
      shouldCloseEditorDocument = await this.saveChangesBeforeClosingDelegateDocument(editorDocument);
      documentToCloseIsFocused = true;
    }

    if (shouldCloseEditorDocument) {
      if (editorDocumentModel != null) {
        editorDocumentModel.onEditorDocumentWillClose();
      }

      this.editorAreaManager.closeEditorDocument(editorDocument);

      if (editorDocumentModel != null) {
        editorDocumentModel.onEditorDocumentDidClose();
      }

      this.removeItemFromHistoryIfClosingUnsavedBuffer(editorDocument);

      if (documentToCloseIsFocused && navigateToNextOpenTabAfterClose) {
        this.navigateToNextAvailableOpenDocument();
      }

      this.emit(EVENT_EDITOR_AREA_LAYOUT_UPDATED);
    }

    return shouldCloseEditorDocument;
  }

  private navigateToNextAvailableOpenDocument(): void {
    const recentDocuments = this.recentlyViewed.getRecentlyViewedEditorDocumentItems().reverse() as EditorDocument[];

    const openEditors = this.getOpenEditorDocuments().reverse();

    const lastViewedOpenDocument = recentDocuments.find((historyItem) =>
      openEditors.some((document) => document?.uri === historyItem?.uri),
    );

    if (lastViewedOpenDocument != null) {
      this.navigateToEditorDocument(
        lastViewedOpenDocument.uri,
        lastViewedOpenDocument.label,
        lastViewedOpenDocument.metadata,
      );
    } else if (openEditors.length > 0) {
      this.navigateToEditorDocument(openEditors[0].uri, openEditors[0].label, openEditors[0].metadata);
    }
  }

  private removeItemFromHistoryIfClosingUnsavedBuffer(editorDocument: EditorDocument): void {
    if (editorDocument.uri.match(/^buffer:.+/)) {
      this.recentlyViewed.filterHistory((historyItem: any) => historyItem.uri !== editorDocument.uri);
    }
  }

  private async saveChangesBeforeClosingDelegateDocument(editorDocument: EditorDocument): Promise<boolean> {
    if (!editorDocument.hasUnsavedChanges) {
      return true;
    }

    await this.focusEditorDocumentAndWaitForVisible(editorDocument);

    const dialogOptions: DialogOptions = {
      type: 'message-box',
      content: 'Do you want to save your changes before closing the document?',
      actions: [
        { response: 'cancel', label: 'cancel', cancel: true },
        { response: 'close', label: "Don't save and close" },
        { response: 'save-and-close', label: 'Save and close', default: true },
      ],
    };

    const dialogResult = await this.bifrost.dialog.open(dialogOptions);

    if (dialogResult.response === 'close') {
      return true;
    }

    if (dialogResult.response === 'save-and-close') {
      return this.saveDelegateDocument(editorDocument);
    }

    return false;
  }

  private async saveChangesBeforeClosingDocument(editorDocumentModel: EditorDocumentModel): Promise<boolean> {
    const uri = editorDocumentModel.getUri();
    const editorDocument = this.getEditorDocumentByUri(uri);
    assertNotNull(editorDocument, 'editorDocument');

    if (!editorDocument.hasUnsavedChanges) {
      return true;
    }

    await this.focusEditorDocumentAndWaitForVisible(editorDocument);

    const dialogOptions: DialogOptions = {
      type: 'message-box',
      content: 'Do you want to save your changes before closing the document?',
      actions: [
        {
          response: 'cancel',
          label: 'cancel',
          cancel: true,
        },
        {
          response: 'close',
          label: "Don't save and close",
        },
        {
          response: 'save-and-close',
          label: 'Save and close',
          default: true,
        },
      ],
    };

    const dialogResult = await this.bifrost.dialog.open(dialogOptions);

    if (dialogResult.response === 'close') {
      return true;
    }

    if (dialogResult.response === 'save-and-close') {
      const success = await this.saveEditorDocument(editorDocument, true);

      return success;
    }

    return false;
  }

  /**
   * Focus the editor documents with unsaved changes and ask the user for saving them.
   * Returns `true` if all decisions were made and `false` if a dialog was cancelled or saving an editor document has failed.
   *
   * Invokes lifecycle hooks on the associated EditorDocumentModel.
   */
  warnAboutUnsavedEditorDocumentsAndAskForSaving(
    editorDocuments: EditorDocument[],
    willCloseAfterSave = false,
  ): Promise<boolean> {
    const dialogOptions: DialogOptions = {
      type: 'message-box',
      content: 'Do you want to save your changes before closing the window?',
      actions: [
        {
          response: 'cancel',
          label: 'cancel',
          cancel: true,
        },
        {
          response: 'save-not',
          label: "Don't save",
        },
        {
          response: 'save',
          label: 'Save',
          default: true,
        },
      ],
    };

    return new Promise(async (resolve) => {
      for (const editorDocument of editorDocuments) {
        if (!editorDocument.hasUnsavedChanges) {
          continue;
        }

        await this.focusEditorDocumentAndWaitForVisible(editorDocument);

        const dialogResult = await this.bifrost.dialog.open(dialogOptions);
        if (dialogResult.response === 'save') {
          const success = await this.saveEditorDocument(editorDocument, willCloseAfterSave);

          if (!success) {
            return resolve(success);
          }
        } else if (dialogResult.response === 'cancel') {
          return resolve(false);
        } else if (dialogResult.response === 'save-not') {
          if (editorDocument.modelKey != null) {
            const model = await this.getEditorDocumentModel(editorDocument);
            model.resetUriAndData(editorDocument.uri, editorDocument.data.original);
          } else {
            this.setDirty(editorDocument.uri, false);
          }
        }
      }

      return resolve(true);
    });
  }

  /**
   * Saves the given `editorDocument`.
   * Returns `true`, if the document was saved successfully.
   *
   * Invokes lifecycle hooks on the associated EditorDocumentModel.
   */
  async saveEditorDocument(editorDocument: EditorDocument, willCloseAfterSave = false): Promise<boolean> {
    return this.doSaveEditorDocument(editorDocument, false, willCloseAfterSave);
  }

  /**
   * Saves the given `editorDocument` via a 'save as' dialog.
   * Returns `true`, if the document was saved successfully.
   *
   * Invokes lifecycle hooks on the associated EditorDocumentModel.
   */
  async saveEditorDocumentAs(editorDocument: EditorDocument): Promise<boolean> {
    const docSavedSuccessfully = await this.doSaveEditorDocument(editorDocument, true, false);
    if (docSavedSuccessfully) {
      this.emit(EVENT_EDITOR_DOCUMENT_TITLE_UPDATED, [editorDocument]);
    }

    return docSavedSuccessfully;
  }

  private async doSaveEditorDocument(
    editorDocument: EditorDocument,
    forceSaveDialog: boolean,
    willCloseAfterSave: boolean,
  ): Promise<boolean> {
    if (editorDocument.modelKey == null) {
      return this.saveDelegateDocument(editorDocument);
    }

    const editorDocumentModel = await this.getEditorDocumentModel(editorDocument);

    editorDocumentModel.onEditorDocumentWillSave(willCloseAfterSave);

    let success;
    const saveResult = await editorDocumentModel.saveEditorDocument();
    if (saveResult == null) {
      success = await this.saveEditorDocumentModelViaFileHandlingService(
        editorDocumentModel,
        forceSaveDialog,
        willCloseAfterSave,
      );
    } else {
      success = saveResult;
    }

    if (success === true) {
      editorDocumentModel.onEditorDocumentDidSave(willCloseAfterSave);
    }

    return success;
  }

  /**
   * Invokes the save delegate for a model-less document.
   * Clears the dirty state on success.
   */
  private async saveDelegateDocument(editorDocument: EditorDocument): Promise<boolean> {
    const delegate = this.saveDelegates.get(editorDocument.uri);
    if (delegate == null) {
      return false;
    }

    try {
      await delegate();
      (editorDocument as any).hasUnsavedChanges = false;
      this.emit(EVENT_EDITOR_DOCUMENT_DATA_UPDATED, [editorDocument]);
      return true;
    } catch {
      return false;
    }
  }

  private async saveEditorDocumentModelViaFileHandlingService(
    editorDocumentModel: EditorDocumentModel,
    forceSaveDialog: boolean,
    willCloseAfterSave: boolean,
  ): Promise<boolean> {
    let uri = editorDocumentModel.getUri();
    const editorDocument = this.getEditorDocumentByUri(uri);
    assertNotNull(editorDocument, 'editorDocument');

    const content = editorDocument.data.current;

    if (!this.bifrost.files.canSave(uri)) {
      throw new Error(`Bifrost: can not save URI: ${uri}`);
    }

    if (!this.bifrost.files.canSaveImmediately(uri) || forceSaveDialog) {
      const isLocalFile = this.bifrost.files.isLocalFilename(editorDocument.uri);
      const initialFolder = isLocalFile ? await this.bifrost.files.getLocalDirectory(editorDocument.uri) : undefined;
      const chosenFilename: string | null = await this.bifrost.dialog.showSaveFile({ defaultPath: initialFolder });
      if (chosenFilename == null) {
        return false;
      }

      const filename = this.bifrost.commands.executeCommand('std.editor.addFileExtensionIfMissing', [
        editorDocument,
        chosenFilename,
      ]);

      uri = this.bifrost.files.getUriForFilename(filename);
    }

    const success = await this.bifrost.files.save(uri, content);

    if (success === true && !willCloseAfterSave) {
      editorDocumentModel.resetUriAndData(uri, content);

      return true;
    }

    throw new Error(`Could not save file: ${uri}`);
  }

  /**
   * Returns the `EditorDocument` object for a given `uri`.
   */
  getEditorDocumentByUri(uri: string): EditorDocument | null {
    return this.editorAreaManager.getEditorDocumentByUri(uri);
  }

  /**
   * Returns a document model, if one has been initialized before.
   */
  getEditorDocumentModelIfPresent<T = EditorDocumentModel>(editorDocument: EditorDocument | null): T | null {
    return this.editorDocumentModelManager.getEditorDocumentModelInstanceFromCache<T>(editorDocument);
  }

  /**
   * Returns a document model for the given `editorDocument` (initializes it lazily in case it does not exist yet).
   */
  async getEditorDocumentModel<T = EditorDocumentModel>(
    editorDocument: EditorDocument,
    verifyInstanceOf?: { prototype: object },
  ): Promise<T> {
    return this.editorDocumentModelManager.getEditorDocumentModelInstance<T>(editorDocument, verifyInstanceOf);
  }

  /**
   * Internal: Returns the document renderer for the given `id` (used by the editor).
   */
  getEditorDocumentRenderer(id: string): any {
    return this.editorDocumentRenderer.getById(id);
  }

  /**
   * Internal: Returns the Editor Document Inspector for the given `id` (used by the editor).
   */
  getEditorDocumentInspector(id: string): any {
    return this.editorDocumentInspectorManager.getById(id);
  }

  getMergeResolverForUri(uri: string): any | null {
    if (!this.editorDocumentTypeManager.hasTypeForUri(uri)) {
      return null;
    }
    const definition = this.editorDocumentTypeManager.getByUri(uri);
    if (definition.mergeResolverKey == null) {
      return null;
    }
    return this.editorDocumentMergeResolverManager.getByKey(definition.mergeResolverKey);
  }

  /**
   * Returns the focused EditorDocument, if present.
   */
  getFocusedEditorDocument(): EditorDocument | null {
    return this.editorAreaManager.getFocusedEditorDocument();
  }

  /**
   * Returns the active EditorDocuments.
   */
  getActiveEditorDocuments(): EditorDocument[] {
    return this.editorAreaManager.getActiveEditorDocuments();
  }

  /**
   * Registers the given `editorDocumentTypeDefinition` with the given `id`.
   *
   * Examples:
   *
   *    bifrost.editors.registerDocumentType('bpmn', {
   *        uriMatch: /\.bpmn$/,
   *        modelKey: 'BpmnDocumentModel',
   *        modelConstructor: BpmnDocumentModel,
   *        rendererKey: 'BpmnRenderer',
   *        rendererConstructor: BpmnDocumentRenderer,
   *        inspectorKey: 'BpmnInspector',
   *        inspectorConstructor: BpmnDocumentInspector,
   *        icon: 'ph-duotone ph-file'
   *      });
   *
   */
  registerDocumentType(id: string, typeDefinition: EditorDocumentTypeDefinitionWithoutName): void {
    this.editorDocumentTypeManager.register(id, typeDefinition);
    this.editorDocumentRenderer.register(typeDefinition.rendererKey, typeDefinition.rendererConstructor);
    if (typeDefinition.modelKey != null) {
      this.editorDocumentModelManager.registerConstructor(typeDefinition.modelKey, typeDefinition.modelConstructor);
    }
    if (typeDefinition.inspectorKey != null) {
      this.editorDocumentInspectorManager.register(typeDefinition.inspectorKey, typeDefinition.inspectorConstructor);
    }
    if (typeDefinition.mergeResolverKey != null) {
      this.editorDocumentMergeResolverManager.register(
        typeDefinition.mergeResolverKey,
        typeDefinition.mergeResolverConstructor,
      );
    }
  }

  /**
   * Registers the given `editorDocumentTypeDefinition` with the given `id`, replacing any
   * prior registration for the same `id` instead of throwing. Used to let a plugin's real
   * `registerWebviewDocumentType()` call (in `activate()`) replace a manifest-declared
   * placeholder type registered by `ContributionRegistrar` at discovery time (see
   * `contributes.editorDocumentTypes`).
   */
  registerOrReplaceDocumentType(id: string, typeDefinition: EditorDocumentTypeDefinitionWithoutName): void {
    this.editorDocumentTypeManager.registerOrReplace(id, typeDefinition);
    this.editorDocumentRenderer.register(typeDefinition.rendererKey, typeDefinition.rendererConstructor);
    if (typeDefinition.modelKey != null) {
      this.editorDocumentModelManager.registerConstructor(typeDefinition.modelKey, typeDefinition.modelConstructor);
    }
    if (typeDefinition.inspectorKey != null) {
      this.editorDocumentInspectorManager.register(typeDefinition.inspectorKey, typeDefinition.inspectorConstructor);
    }
    if (typeDefinition.mergeResolverKey != null) {
      this.editorDocumentMergeResolverManager.register(
        typeDefinition.mergeResolverKey,
        typeDefinition.mergeResolverConstructor,
      );
    }
  }

  /**
   * Removes a previously registered document type, along with its renderer, model constructor,
   * inspector, and merge resolver entries. Force-closes all open editor tabs of that type first.
   */
  async unregisterDocumentType(id: string): Promise<void> {
    const typeDef = this.editorDocumentTypeManager.getById(id);

    const openDocs = this.getOpenEditorDocuments().filter((doc) => doc.documentType === id);
    if (openDocs.length > 0) {
      await this.closeEditorDocumentsUntilUserCancels(openDocs);
    }

    this.editorDocumentTypeManager.unregister(id);
    this.editorDocumentRenderer.unregister(typeDef.rendererKey);
    if (typeDef.modelKey != null) {
      this.editorDocumentModelManager.unregisterConstructor(typeDef.modelKey);
    }
    if (typeDef.inspectorKey != null) {
      this.editorDocumentInspectorManager.unregister(typeDef.inspectorKey);
    }
    if (typeDef.mergeResolverKey != null) {
      this.editorDocumentMergeResolverManager.unregister(typeDef.mergeResolverKey);
    }
  }

  /**
   * Register a save delegate for a model-less document (plugin webview editors).
   * When Ctrl+S or the close-save dialog triggers a save for this URI, the delegate is called.
   */
  registerSaveDelegate(uri: string, delegate: () => Promise<void>): void {
    this.saveDelegates.set(uri, delegate);
  }

  unregisterSaveDelegate(uri: string): void {
    this.saveDelegates.delete(uri);
  }

  /**
   * Set the dirty state for a model-less document (plugin webview editors).
   * Directly mutates `hasUnsavedChanges` on the EditorDocument and emits an update.
   */
  setDirty(uri: string, isDirty: boolean): void {
    const editorDocument = this.getEditorDocumentByUri(uri);
    if (editorDocument == null) {
      throw new Error(`No open editor document found for URI: ${uri}`);
    }
    (editorDocument as any).hasUnsavedChanges = isDirty;
    this.emit(EVENT_EDITOR_DOCUMENT_DATA_UPDATED, [editorDocument]);
  }

  /**
   * Updates the label of the given `editorDocument` to the given `newLabel`.
   */
  updateEditorDocumentLabel(editorDocument: EditorDocument, newLabel: string): void {
    this.editorAreaManager.updateEditorDocumentLabel(editorDocument, newLabel);
  }

  /**
   * Retrieves an EditorDocumentTypeDefinition by its `uri`.
   *
   *    bifrost.editors.getDocumentTypeDefinitionByUri('file:///tmp/foo.bpmn')
   */
  getDocumentTypeDefinitionByUri(uri: string): EditorDocumentTypeDefinition {
    return this.editorDocumentTypeManager.getByUri(uri);
  }

  hasDocumentTypeDefinitionForUri(uri: string): boolean {
    return this.editorDocumentTypeManager.hasTypeForUri(uri);
  }

  getEditorById(editorIdOrNull: string | null): EditorAreaLayout_Editor | null {
    return this.editorAreaManager.getEditorById(editorIdOrNull);
  }

  getEditorNextToFocusedEditor(): EditorAreaLayout_Editor | null {
    return this.editorAreaManager.getEditorNextToFocusedEditor();
  }

  getOpenEditorDocuments(): EditorDocument[] {
    return this.editorAreaManager.getOpenEditorDocuments();
  }

  getOpenEditors() {
    return this.editorAreaManager.getOpenEditors();
  }

  moveAndActivateEditorDocumentByEditorIdAndIndex(
    origEditorId: string,
    origIndex: number,
    destEditorId: string,
    destIndex: number,
    shouldCloseEditorIfEmpty: boolean = true,
  ): void {
    this.editorAreaManager.moveAndActivateEditorDocumentByEditorIdAndIndex(
      origEditorId,
      origIndex,
      destEditorId,
      destIndex,
      shouldCloseEditorIfEmpty,
    );
  }

  canSplitEditor(editorDocument: EditorDocument): boolean {
    return this.editorAreaManager.canSplitEditor(editorDocument);
  }

  splitEditorDocumentToTheRight(editorDocument: EditorDocument): EditorAreaLayout_Editor | null {
    return this.editorAreaManager.splitEditorToTheRight(editorDocument);
  }

  splitEditorDocumentToTheBottom(editorDocument: EditorDocument): EditorAreaLayout_Editor | null {
    return this.editorAreaManager.splitEditorToTheBottom(editorDocument);
  }

  splitFocusedEditorToTheRight(): EditorAreaLayout_Editor {
    return this.editorAreaManager.splitFocusedEditorToTheRight();
  }

  focusNextEditorDocument(): void {
    const editorDocument = this.getFocusedEditorDocument();
    if (editorDocument == null) {
      return;
    }

    const editor = this.editorAreaManager.getEditorForEditorDocument(editorDocument);
    assertNotNull(editor, 'editor');

    let nextIndex = editor.activeEditorDocumentIndex + 1;
    if (nextIndex >= editor.editorDocuments.length) {
      nextIndex = 0;
    }

    this.focusOrOpenEditorDocument(editor.editorDocuments[nextIndex]);
  }

  focusPreviousEditorDocument(): void {
    const editorDocument = this.getFocusedEditorDocument();
    if (editorDocument == null) {
      return;
    }

    const editor = this.editorAreaManager.getEditorForEditorDocument(editorDocument);
    assertNotNull(editor, 'editor');

    let nextIndex = editor.activeEditorDocumentIndex - 1;
    if (nextIndex < 0) {
      nextIndex = editor.editorDocuments.length - 1;
    }

    this.focusOrOpenEditorDocument(editor.editorDocuments[nextIndex]);
  }

  setEditorTabsVisibility(visible: boolean): void {
    this.editorAreaManager.setEditorTabsVisibility(visible);
  }

  getViewData(): EditorAreaViewData {
    return this.editorAreaManager.serialize();
  }

  reset(): void {
    this.editorAreaManager.reset();
    this.editorDocumentModelManager.reset();

    this.emit(EVENT_EDITOR_AREA_LAYOUT_UPDATED);
  }

  updateEditorInlineSearch(editorDocument: EditorDocument, visible: boolean, searchQuery: SearchQuery): void {
    this.editorAreaManager.updateEditorInlineSearch(editorDocument, visible, searchQuery);
  }

  onEditorSizeChanged(): void {
    if (this.emitLayoutChangedTimeout != null) {
      clearTimeout(this.emitLayoutChangedTimeout);
    }

    this.emitLayoutChangedTimeout = setTimeout(() => {
      this.emitLayoutChangedTimeout = null;
      this.emit(EVENT_EDITOR_AREA_LAYOUT_UPDATED);
    }, 16);
  }
}
