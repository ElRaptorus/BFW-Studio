import type { Studio } from '../../types/Studio';

export type EditorAreaLayout = EditorAreaLayout_Column | EditorAreaLayout_Row | EditorAreaLayout_Editor;

/**
 * Represents a column of split editors, e.g. several editors stacked on top of each other.
 */
export type EditorAreaLayout_Column = {
  type: 'column';
  rows: EditorAreaLayout[];
};

/**
 * Represents a row of split editors, e.g. several editors placed next to each other.
 */
export type EditorAreaLayout_Row = {
  readonly type: 'row';
  readonly columns: EditorAreaLayout[];
};

export type EditorAreaLayout_Editor = {
  readonly type: 'editor';
  readonly editorId: string;
  readonly editorDocuments: EditorDocument[];
  readonly activeEditorDocumentIndex: number;
};

/**
 * EditorDocuments represent documents opened in Studio's editor area.
 *
 * Every opened document has an `EditorDocument`, which represents the bare minimum of data necessary to represent
 * a document in an editor, but not necessarily an `EditorDocumentModel`, which can implement business logic e.g.
 * around manipulating the document within its domain.
 */
export type EditorDocument = {
  /**
   * Text to be displayed in the editor tab
   */
  readonly label: string;

  /**
   * icon id for the icon component, e.g. 'std/menubar/save' or 'ph-light ph-chess-king'
   */
  readonly icon: string;

  /**
   * Set to `true` if the document has unsaved changes
   */
  readonly hasUnsavedChanges: boolean;

  /**
   * URI of the document, which can be a "fragment URI"
   */
  readonly uri: string;

  /**
   * The type of the document (types are registered by modules)
   */
  readonly documentType: string;

  /**
   * Key pointing to a renderer function that can visualize the document
   */
  readonly rendererKey: string;

  /**
   * Key pointing to a model function that can act as a model of the document
   */
  readonly modelKey: string | null;

  /**
   * the key under which the document inspector is registered
   */
  readonly inspectorKey?: string;

  /**
   * the constructor of the document inspector
   */
  readonly inspectorConstructor?: any;

  /**
   * Indicates whether the document is persistent or not
   */
  isTemporary?: boolean;

  /**
   * Data concerning the content saved to the file system/persistence layer,
   * like the original XML and the current XML.
   */
  readonly data: {
    readonly original: any;
    readonly current: any;
  };

  /**
   * Additional data NOT saved to the file system/persistence layer,
   * like the location, selection, zoom level, etc.
   */
  readonly metadata: any;
};

/**
 * Props given to the component registered via `registerDocumentType` as `rendererConstructor`.
 */
export type EditorDocumentRendererProps = {
  readonly studio: Studio;
  readonly editorDocument: EditorDocument;
  readonly uri: string;
};

export type EditorAreaViewData = {
  readonly layout: EditorAreaLayout;
  readonly focusedEditorId: string | null;
  readonly focusedEditorDocumentUri: string | null;
  readonly editorTabsVisible: boolean;
};

// the serialized data that goes into storage is the same as the data handed to the view (for now)
// but these are two conceptually different things, which is why we alias them here
export type EditorAreaSerialized = EditorAreaViewData;
