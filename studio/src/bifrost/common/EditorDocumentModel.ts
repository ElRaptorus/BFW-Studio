import {
  EVENT_DATA_UPDATED,
  EVENT_LABEL_CHANGED,
  EVENT_METADATA_UPDATED,
  EVENT_URI_CHANGED,
} from '#bifrost/contracts/internal/EditorEvents';

import { AbstractEmitterWithInitialBuffer } from './internal/AbstractEmitterWithInitialBuffer';

/**
 * An `EditorDocumentModel` represents the business model of an editor document, meaning that it holds any business
 * logic associated with creating and updating that type of document.
 *
 * Each `EditorDocumentModel` has a private constructor and a static `create` method that is invoked by Studio's
 * `EditorDocumentModelManager`.
 *
 * Example:
 *
 *    class FooDocumentModel extends EditorDocumentModel {
 *      private constructor(
 *          uri: string,
 *          contentOnFile: string,
 *          restoredCurrentData: any,
 *          restoredMetadata: any,
 *          fileLoader: ILoadable,
 *          studio: Bifrost
 *        ) {
 *        super(uri);
 *        // do your thing
 *      }
 *
 *      static async create(
 *        uri: string,
 *        restoredCurrentData: any,
 *        restoredMetadata: any,
 *        fileLoader: ILoadable,
 *        studio: Bifrost
 *      ): Promise<BpmnDocumentModel> {
 *        const contentOnFile = await fileLoader.load(uri);
 *        const model = new FooDocumentModel(uri, contentOnFile, restoredCurrentData, restoredMetadata, studio);
 *
 *        return model;
 *      }
 *    }
 */
export abstract class EditorDocumentModel extends AbstractEmitterWithInitialBuffer {
  /** The URI is the primary key by which documents are identified. */
  protected uri: string;
  private originalData: any;
  private currentData: any;

  constructor(uri: string) {
    super();

    this.uri = uri;
  }

  /**
   * Returns whether or not the document contains steps which can be undone.
   *
   * By default, this returns `false`, but you can override this method to implement individual undo capabilities.
   */
  canUndo(): boolean {
    return false;
  }

  /**
   * Returns whether or not the document contains steps which can be redone.
   *
   * By default, this returns `false`, but you can override this method to implement individual redo capabilities.
   */
  canRedo(): boolean {
    return false;
  }

  undo(): void {}

  redo(): void {}

  /**
   * Returns the URI of the document model.
   */
  getUri(): string {
    return this.uri;
  }

  /**
   * `onEditorDocumentModelDidRegister()` is invoked directly after a model has been registered with the
   * `EditorDocumentModelManager`.
   *
   * This is where you perform any necessary bootstrapping like emitting your first events or
   * calling `updateOriginalAndCurrentData`.
   */
  onEditorDocumentModelDidRegister(): void {}

  /**
   * `onEditorDocumentWillSave()` is invoked directly before a model will be saved.
   */
  onEditorDocumentWillSave(willCloseAfterSave = false): void {}

  /**
   * `onEditorDocumentDidSave()` is invoked directly after a model has been saved.
   */
  onEditorDocumentDidSave(willCloseAfterSave = false): void {}

  /**
   * `onEditorDocumentWillClose()` is invoked directly before a document is closed.
   *
   * This is where you perform any necessary cleanup, such as invalidating timers, canceling network requests or
   * removing any listeners that were added in `onEditorDocumentModelDidRegister()`.
   */
  onEditorDocumentWillClose(): void {}

  /**
   * `onEditorDocumentDidClose()` is invoked directly after a document is closed.
   */
  onEditorDocumentDidClose(): void {}

  /**
   * `onEditorDocumentDidFocus()` is invoked directly after a document is focused.
   */
  onEditorDocumentDidFocus(): void {}

  /**
   * `onEditorDocumentDidBlur()` is invoked directly after a document is blurred.
   */
  onEditorDocumentDidBlur(): void {}

  /**
   * `saveEditorDocument()` is invoked to save a document. Returns whether or not the document has been saved successfully.
   *
   * By default, this returns `null` to tell Studio to save the file to disk, but you can override this method
   * to implement individual saving mechanisms.
   *
   * NOTE: If you implement an individual saving mechanism, you have to do *all* the saving & data management yourself
   *        (i.e. call `updateOriginalAndCurrentData`).
   */
  async saveEditorDocument(): Promise<boolean | null> {
    return null;
  }

  /**
   * `closeEditorDocument()` is invoked when the user tries to close a document. Returns whether or not the document should be
   * closed.
   *
   * By default, this returns `null` to tell Studio to check if the document has unsaved changes and otherwise close it,
   * but you can override this method to implement individual closing conditions.
   */
  async closeEditorDocument(): Promise<boolean | null> {
    return null;
  }

  /**
   * Internal: Used by Studio after saving or moving a file.
   */
  resetUriAndData(uri: string, data: string, optionalCurrentData?: string): void {
    this.updateUri(uri);
    this.updateOriginalAndCurrentData(data, optionalCurrentData || data);
  }

  protected getCurrentData(): any {
    return this.currentData;
  }

  protected updateUri(uri: string): void {
    const originalUri = '' + this.uri;
    const uriChanged = originalUri !== uri;
    this.uri = uri;

    if (uriChanged) {
      this.emit(EVENT_URI_CHANGED, [originalUri, uri]);
    }
  }

  protected updateLabel(label: string): void {
    this.emit(EVENT_LABEL_CHANGED, [label]);
  }

  /**
   * Emits the given `currentData` to be put into the associated EditorDocument's `data` field.
   *
   *    updateCurrentData("my document content")
   *    updateCurrentData({structured_data: 'as well'})
   */
  protected updateCurrentData(currentData: any): void {
    if (this.currentData !== currentData) {
      this.currentData = currentData;
      this.emit(EVENT_DATA_UPDATED, [{ current: currentData }]);
    }
  }

  protected updateOriginalAndCurrentData(originalData: any, currentData: any): void {
    this.originalData = originalData;
    this.currentData = currentData;
    this.emit(EVENT_DATA_UPDATED, [{ original: originalData, current: currentData }]);
  }

  /**
   * Emits the given `partialMetadata` to be put into the associated EditorDocument's `metadata` field.
   *
   *    updateMetadata({selection: ['id1', 'id2']})
   *    updateMetadata({zoom: 0.5})
   */
  protected updateMetadata(partialMetadata: any): void {
    this.emit(EVENT_METADATA_UPDATED, [partialMetadata]);
  }

  async restoreMetadataAfterNavigation(partialMetadata: any): Promise<void> {}

  /**
   * Internal: Called by EditorDocumentModelManager after its listeners are registered.
   */
  UNSAFE_onEditorDocumentModelManagerListens(): void {
    this.releaseEventBuffer();
  }
}
