import type { Disposable } from './Disposable';
import type { RegisterWebviewDocumentTypeOptions } from './types';

/**
 * Editor document type registration and document opening API.
 *
 * Allows plugins to register iframe-backed editor document types
 * that handle specific URI patterns.
 */
export interface EditorsApi {
  /**
   * Register a webview-backed editor document type.
   *
   * The document type's ID is automatically namespaced to
   * `plugin.<pluginName>.<id>`. When a document matching the
   * `uriPattern` is opened, the Studio renders the webview
   * specified in `webviewOptions`.
   *
   * @param options - Document type configuration including webview settings.
   */
  registerWebviewDocumentType(options: RegisterWebviewDocumentTypeOptions): Promise<void>;

  /**
   * Open a document by URI. If a registered document type matches the URI,
   * its editor is activated.
   *
   * @param uri - The document URI to open.
   */
  openDocument(uri: string): Promise<void>;

  /**
   * Mark an open document as dirty (has unsaved changes) or clean.
   *
   * This is intended for model-less webview editors: the tab dot indicator
   * updates and the close-save dialog will be shown when appropriate.
   *
   * @param uri - The document URI.
   * @param isDirty - `true` to mark dirty, `false` to mark clean.
   */
  setDirty(uri: string, isDirty: boolean): Promise<void>;

  /**
   * Register a callback that is invoked when the user triggers a save
   * (Ctrl+S / Cmd+S) on the given document URI.
   *
   * The callback should persist the data and resolve when done.
   * On success, the dirty state is automatically cleared.
   *
   * Returns a dispose function to unregister the callback.
   *
   * @param uri - The document URI to attach the save handler to.
   * @param callback - The async save handler.
   */
  onSaveRequest(uri: string, callback: () => Promise<void>): Promise<Disposable>;

  /**
   * Subscribe to documents of a registered webview document type being opened.
   *
   * Prefer this over `RegisterWebviewDocumentTypeOptions.onDidOpen`, which the
   * host bridge ignores.
   *
   * @param documentTypeLocalId - The local (un-namespaced) document type id passed to {@link registerWebviewDocumentType}.
   * @param callback - Invoked with the iframe id and document URI.
   */
  onDidOpen(documentTypeLocalId: string, callback: (iframeId: string, uri: string) => void): Promise<Disposable>;

  /**
   * URI of the currently focused editor document, or `null` if none is focused.
   */
  getFocusedDocumentUri(): Promise<string | null>;
}
