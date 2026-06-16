import type { EditorAreaLayout_Editor, EditorDocument, EditorDocumentModel } from '../../index';
import type {
  EditorDocumentTypeDefinition,
  EditorDocumentTypeDefinitionWithoutName,
} from '../common/EditorDocumentTypeManager';
import type { SearchQuery } from '../contracts/SearchTypes';

export declare class EditorMediator {
  /**
   * Creates a new EditorDocument in the editor and focuses it.
   *
   * Returns the created EditorDocument
   */
  createNewEditorDocument(uri: string, initialData: string): Promise<EditorDocument>;

  /**
   * Creates a new EditorDocument in the editor and focuses it.
   *
   * Returns the created EditorDocument
   */
  createNewEditorDocumentAsBuffer(documentType: string, initialData?: string | null): EditorDocument;

  /**
   * Focuses or opens and then focuses the given `EditorDocument` or a document with the given URI.
   *
   * Returns the focused EditorDocument
   */
  focusOrOpenEditorDocument(editorDocumentOrUri: EditorDocument | string, optionalLabel?: string): EditorDocument;

  /**
   * Focuses the given `editorDocument`, if that document is already open in an editor and waits for it to be visible.
   * Throws an error otherwise.
   *
   * Returns the focused EditorDocument
   */
  focusEditorDocumentAndWaitForVisible(editorDocument: EditorDocument): Promise<EditorDocument>;

  /**
   * Attempts to close the given `editorDocument`.
   * Returns `true`, if the document was closed successfully.
   *
   * Invokes lifecycle hooks on the associated EditorDocumentModel.
   */
  closeEditorDocument(editorDocument: EditorDocument): Promise<boolean>;

  /**
   * Saves the given `editorDocument`.
   * Returns `true`, if the document was saved successfully.
   *
   * @editorDocument     The document to save.
   * @willCloseAfterSave Indicates, wether the document will be closed after it was saved.
   *
   * Invokes lifecycle hooks on the associated EditorDocumentModel.
   */
  saveEditorDocument(editorDocument: EditorDocument, willCloseAfterSave?: boolean): Promise<boolean>;

  /**
   * Attempts to save the given list of `editorDocuments`.
   * If the user cancels a save dialog, the whole saving process stops.
   * Returns `true`, if all documents were saved successfully.
   *
   * Invokes lifecycle hooks on the associated EditorDocumentModel.
   */
  saveEditorDocumentsUntilUserCancels(editorDocuments: EditorDocument[]): Promise<boolean>;

  /**
   * Saves the given `editorDocument` via a 'save as' dialog.
   * Returns `true`, if the document was saved successfully.
   *
   * Invokes lifecycle hooks on the associated EditorDocumentModel.
   */
  saveEditorDocumentAs(editorDocument: EditorDocument): Promise<boolean>;

  /**
   * Returns the `EditorDocument` object for a given `uri`.
   */
  getEditorDocumentByUri(uri: string): EditorDocument | null;

  /**
   * Returns a document model, if one has been initialized before.
   */
  getEditorDocumentModelIfPresent<T = EditorDocumentModel>(editorDocument: EditorDocument | null): T | null;

  /**
   * Returns a document model for the given `editorDocument` (initializes it lazily in case it does not exist yet).
   */
  getEditorDocumentModel<T = EditorDocumentModel>(
    editorDocument: EditorDocument,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- accepts private-constructor classes for instanceof checks
    verifyInstanceOf?: Function,
  ): Promise<T>;

  /**
   * Returns the focused EditorDocument, if present.
   */
  getFocusedEditorDocument(): EditorDocument | null;

  /**
   * Registers the given `editorDocumentTypeDefinition` with the given `id`.
   *
   * Examples:
   *
   *    studio.editors.registerDocumentType('bpmn', {
   *        uriMatch: /\.bpmn$/,
   *        modelKey: 'BpmnDocumentModel',
   *        modelConstructor: BpmnDocumentModel,
   *        rendererKey: 'BpmnRenderer',
   *        rendererConstructor: BpmnDocumentRenderer,
   *        icon: 'ph-duotone ph-file'
   *      });
   *
   */
  registerDocumentType(id: string, typeDefinition: EditorDocumentTypeDefinitionWithoutName): void;

  /**
   * Removes a previously registered document type, along with its renderer, model constructor,
   * inspector, and merge resolver entries. Force-closes all open editor tabs of that type first.
   */
  unregisterDocumentType(id: string): Promise<void>;

  /**
   * Updates the label of the given `editorDocument` to the given `newLabel`.
   */
  updateEditorDocumentLabel(editorDocument: EditorDocument, newLabel: string): void;

  /**
   * Retrieves an EditorDocumentTypeDefinition by its `uri`.
   *
   *    studio.editors.getDocumentTypeDefinitionByUri('file:///tmp/foo.bpmn')
   */
  getDocumentTypeDefinitionByUri(uri: string): EditorDocumentTypeDefinition;

  hasDocumentTypeDefinitionForUri(uri: string): boolean;

  getEditorById(editorIdOrNull: string | null): EditorAreaLayout_Editor | null;

  getEditorNextToFocusedEditor(): EditorAreaLayout_Editor | null;

  getOpenEditorDocuments(): EditorDocument[];

  moveAndActivateEditorDocumentByEditorIdAndIndex(
    origEditorId: string,
    origIndex: number,
    destEditorId: string,
    destIndex: number,
    shouldCloseEditorIfEmpty?: boolean,
  ): void;

  updateEditorInlineSearch(editorDocument: EditorDocument, visible: boolean, searchQuery: SearchQuery): void;
}
