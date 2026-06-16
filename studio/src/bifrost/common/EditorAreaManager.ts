import type {
  EditorAreaLayout,
  EditorAreaLayout_Column,
  EditorAreaLayout_Editor,
  EditorAreaLayout_Row,
  EditorAreaSerialized,
  EditorDocument} from '@evil/bifrost_fw_sdk';
import {
  AbstractEmitter,
  assertNotNull,
  getUrlForOpenInNewTab,
  isUrlForOpenInNewTab,
  parseOpenInNewTabUrl,
} from '@evil/bifrost_fw_sdk';

import {
  EVENT_EDITOR_AREA_DOCUMENT_CLOSED,
  EVENT_EDITOR_AREA_FOCUS_UPDATED,
  EVENT_EDITOR_AREA_LAYOUT_UPDATED,
  EVENT_EDITOR_DOCUMENT_METADATA_UPDATED,
} from '../../../../studio-sdk/src/contracts/internal/EditorEvents';
import type { SearchQuery } from '../../../../studio-sdk/src/contracts/internal/SearchTypes';
import type { ISerializable } from '../contracts/SerializableTypes';
import type { Bifrost } from '../Bifrost';

type EditorDocumentLocation = {
  editorId: string;
  documentIndex: number;
};

type SplitEditorCallbackFn = (
  editor: EditorAreaLayout_Editor,
  newEditor: EditorAreaLayout_Editor,
  columnOrRow: EditorAreaLayout_Column | EditorAreaLayout_Row,
) => void;

type TraverseLayoutCallbackFn = (node: any) => void;

export function layoutRow(...args: any[]): EditorAreaLayout_Row {
  return { type: 'row', columns: args };
}

export function layoutColumn(...args: any[]): EditorAreaLayout_Column {
  return { type: 'column', rows: args };
}

const NEW_DOCUMENT_PROTOCOL = 'buffer';
const UNTITLED_TITLE_PREFIX = `Untitled-`;
const UNTITLED_TITLE_TEST_REGEX = /Untitled-(\d+)/;
const EDITOR_ID_TEST_REGEX = /(\d+)$/;

export class EditorAreaManager extends AbstractEmitter implements ISerializable {
  private bifrost: Bifrost;
  private layout: EditorAreaLayout;
  private focusedEditorId: string | null;
  private editorTabsVisible: boolean;

  constructor(bifrost: Bifrost) {
    super();

    this.bifrost = bifrost;
    this.focusedEditorId = null;
    this.editorTabsVisible = true;
    this.layout = { type: 'row', columns: [] };

    this.bifrost.events.on('settingsUpdate', (key, value) => {
      if(key === 'workbench.editor.temporaryTabs' && value === false) {
        this.persistAllTemporaryEditorDocuments();
      }
    });
  }

  get temporaryTabsActive(): boolean {
    return this.bifrost.settings.get('workbench.editor.temporaryTabs');
  }

  persistAllTemporaryEditorDocuments(): void {
    this.getOpenEditorDocuments().filter((doc) => doc.isTemporary).forEach((doc) => this.persistEditorDocument(doc));
  }

  openEditorDocumentByUri(
    uri: string,
    documentType: string,
    rendererKey: string,
    modelKey: string | null,
    inspectorKey: string | undefined,
    icon: string,
    optionalLabel?: string,
    editor?: EditorAreaLayout_Editor,
  ): EditorDocument {
    const existingDocument = this.getOpenEditorDocuments().find(doc => doc.uri === uri);
    let editorDocument: EditorDocument;

    if (existingDocument) {
      editorDocument = existingDocument;
      const targetEditor = editor ?? this.getFocusedEditor() ?? this.resetEditor();
      this.moveAndActivateEditorDocumentToEditor(editorDocument, targetEditor);
    } else {
      const label = optionalLabel ?? this.getEditorDocumentLabel(uri);
      const targetEditor = editor ?? this.getFocusedEditor() ?? this.resetEditor();

      const isOpenInNewTabRenderer = isUrlForOpenInNewTab(uri);

      const temporaryDoc = this.getTemporaryDocumentFromEditor(targetEditor);
      if (temporaryDoc && !isOpenInNewTabRenderer) {
        const docIndex = targetEditor.editorDocuments.indexOf(temporaryDoc);
        if (docIndex !== -1) {
          this.emit(EVENT_EDITOR_AREA_DOCUMENT_CLOSED, [temporaryDoc]);
          targetEditor.editorDocuments.splice(docIndex, 1);
        }
      }

      editorDocument = this.addEditorDocumentToEditor(
        targetEditor,
        label,
        uri,
        documentType,
        rendererKey,
        modelKey,
        inspectorKey,
        icon,
        null,
        null,
        this.temporaryTabsActive && !isOpenInNewTabRenderer,
      );

      this.setActiveEditorDocument(editorDocument);
    }

    this.emit(EVENT_EDITOR_AREA_LAYOUT_UPDATED);
    return editorDocument;
  }

  private getTemporaryDocumentFromEditor(editor: EditorAreaLayout_Editor): EditorDocument | null {
    for (const doc of editor.editorDocuments) {
      if (doc.isTemporary) {
        return doc;
      }
    }
    return null;
  }

  persistEditorDocument(editorDocument: EditorDocument): void {
    if (editorDocument.isTemporary) {
      this.UNSAFE_updateEditorDocument(editorDocument, { isTemporary: false });
      this.emit(EVENT_EDITOR_AREA_LAYOUT_UPDATED);
    }
  }

  updateEditorDocumentUri(editorDocument: EditorDocument, newUri: string): void {
    const fragmentEditorDocuments = this.getFragmentEditorDocumentsByParentUri(editorDocument.uri);

    fragmentEditorDocuments.forEach((fragmentEditorDocument: EditorDocument) => {
      const fragmentUri = parseOpenInNewTabUrl(fragmentEditorDocument.uri);
      const newFragmentUri = getUrlForOpenInNewTab(fragmentUri.type, newUri, fragmentUri.fragmentId);

      this.UNSAFE_updateEditorDocument(fragmentEditorDocument, { uri: newFragmentUri });
    });

    // TODO: this might overwrite titles set by extensions
    this.UNSAFE_updateEditorDocument(editorDocument, {
      label: this.getEditorDocumentLabel(newUri),
      uri: newUri,
      isTemporary: false,
    });
  }

  updateEditorDocumentFragmentId(parentUri: any, oldFragmentId: string, newFragmentId: string): void {
    const fragmentEditorDocuments = this.getFragmentEditorDocumentsByParentUri(parentUri);

    fragmentEditorDocuments.forEach((fragmentEditorDocument: EditorDocument) => {
      const fragmentUri = parseOpenInNewTabUrl(fragmentEditorDocument.uri);
      if (fragmentUri.fragmentId === oldFragmentId) {
        const newFragmentUri = getUrlForOpenInNewTab(fragmentUri.type, fragmentUri.parentUri, newFragmentId);

        this.updateEditorDocumentUri(fragmentEditorDocument, newFragmentUri);
      }
    });
  }

  updateEditorDocumentMetadata(editorDocument: EditorDocument, metadata: any): void {
    this.UNSAFE_updateEditorDocument(editorDocument, { metadata });
    this.emit(EVENT_EDITOR_DOCUMENT_METADATA_UPDATED);
  }

  /**
   * Updates the label of the given `editorDocument` to the given `newLabel`.
   */
  updateEditorDocumentLabel(editorDocument: EditorDocument, newLabel: string): void {
    if (editorDocument.label === newLabel) {
      return;
    }

    this.UNSAFE_updateEditorDocument(editorDocument, { label: newLabel });
    this.emit(EVENT_EDITOR_AREA_LAYOUT_UPDATED);
  }

  updateEditorInlineSearch(editorDocument: EditorDocument, visible: boolean, givenSearchQuery: SearchQuery): void {
    const searchQuery = visible ? givenSearchQuery : undefined;
    const metadataDiff = { searchQuery };

    const metadata = Object.assign(editorDocument.metadata || {}, metadataDiff);

    this.UNSAFE_updateEditorDocument(editorDocument, { metadata });
    this.emit(EVENT_EDITOR_AREA_LAYOUT_UPDATED);
  }

  /**
   * Internal: Creates a new `EditorDocument`.
   */
  createNewEditorDocument(
    documentType: string,
    rendererKey: string,
    modelKey: string | null,
    inspectorKey: string | undefined,
    icon: string | null,
    currentData: string | null = null,
    editor?: EditorAreaLayout_Editor,
  ): EditorDocument {
    const untitledNumber = this.getHighestUntitledEditorDocumentNumber() + 1;
    const modelString = modelKey || `noModel/${rendererKey}`;
    const title = `${UNTITLED_TITLE_PREFIX}${untitledNumber}`;
    const uri = `${NEW_DOCUMENT_PROTOCOL}:${modelString}__${Date.now()}-${Math.random().toString(36)}`;

    const editorDocument = this.addEditorDocumentToEditor(
      editor ?? null,
      title,
      uri,
      documentType,
      rendererKey,
      modelKey,
      inspectorKey,
      icon,
      currentData,
      null,
      this.temporaryTabsActive,
    );
    this.focusEditorDocumentByUri(uri);

    return editorDocument;
  }

  /**
   * Internal: Focuses the document with the given `uri` and returns it.
   */
  focusEditorDocumentByUri(uri: string): EditorDocument | null {
    const blurredEditorDocument = this.getFocusedEditorDocument();
    const location = this.findEditorAndDocumentIndexByUri(uri);

    if (location) {
      this.setFocusedEditorDocument(location.editorId, location.documentIndex);

      const activeEditorDocument = this.getFocusedEditorDocument();
      if (activeEditorDocument) {
        this.emitFocusChanged(blurredEditorDocument);

        return activeEditorDocument;
      } else {
        throw new Error('focusEditorDocumentByUri: could not focus document after opening');
      }
    }

    return null;
  }

  private findEditorAndDocumentIndexByUri(uri: string): EditorDocumentLocation {
    let result: any;

    this.traverse(this.layout, (editor: EditorAreaLayout_Editor) => {
      const index = editor.editorDocuments.findIndex((editorDocument: EditorDocument) => editorDocument.uri === uri);
      if (index !== -1) {
        result = {
          editorId: editor.editorId,
          documentIndex: index,
        };
      }
    });

    return result;
  }

  getEditorDocumentByUri(uri: string): EditorDocument | null {
    const foundEditorDocument = this.getOpenEditorDocuments().find(
      (editorDocument: EditorDocument) => editorDocument.uri === uri,
    );

    return foundEditorDocument == null ? null : foundEditorDocument;
  }

  getActiveEditorDocuments(): EditorDocument[] {
    const activeEditorDocuments: EditorDocument[] = [];

    this.traverse(this.layout, (editor: EditorAreaLayout_Editor) => {
      activeEditorDocuments.push(editor.editorDocuments[editor.activeEditorDocumentIndex]);
    });

    return activeEditorDocuments;
  }

  getEditorById(editorIdOrNull: string | null): EditorAreaLayout_Editor | null {
    const editorId = editorIdOrNull ? editorIdOrNull : this.getFocusedEditorId();

    let foundEditor: EditorAreaLayout_Editor | null = null;
    this.traverse(this.layout, (editor: EditorAreaLayout_Editor) => {
      if (editor.editorId === editorId) {
        foundEditor = editor;
      }
    });
    return foundEditor;
  }

  getEditorNextToFocusedEditor(): EditorAreaLayout_Editor | null {
    const focusedEditorId = this.getFocusedEditorId();
    assertNotNull(focusedEditorId, 'focusedEditorId');

    const editorColumnOrRow = this.getEditorColumnOrRowForEditor(focusedEditorId);
    assertNotNull(editorColumnOrRow, 'editorColumnOrRow');

    const findNextEditor = (editorLayoutElements: EditorAreaLayout[]): EditorAreaLayout_Editor | null => {
      const focusedEditorIndex = editorLayoutElements.findIndex((editorLayoutElement) => {
        return editorLayoutElement.type === 'editor' && editorLayoutElement.editorId === focusedEditorId;
      });

      const nextEditorLayout =
        editorLayoutElements[focusedEditorIndex + 1] || editorLayoutElements[focusedEditorIndex - 1];

      if (nextEditorLayout?.type === 'editor') {
        return nextEditorLayout;
      }
      return null;
    };

    let nextEditor: EditorAreaLayout_Editor | null;
    if (editorColumnOrRow.type === 'row') {
      nextEditor = findNextEditor(editorColumnOrRow.columns);
    } else if (editorColumnOrRow.type === 'column') {
      nextEditor = findNextEditor(editorColumnOrRow.rows);
    } else {
      throw new Error('Could not find next editor');
    }

    return nextEditor;
  }

  getEditorForEditorDocument(editorDocument: EditorDocument): EditorAreaLayout_Editor {
    let foundEditor: EditorAreaLayout_Editor | null = null;

    assertNotNull(editorDocument, 'editorDocument');

    this.traverse(this.layout, (editor: EditorAreaLayout_Editor) => {
      const containsEditorDocument = editor.editorDocuments.some(
        (editorDocumentInEditor) => editorDocumentInEditor.uri === editorDocument.uri,
      );
      if (containsEditorDocument) {
        foundEditor = editor;
      }
    });

    if (foundEditor == null) {
      throw new Error(`Could not find editor for editorDocument: ${JSON.stringify(editorDocument, null, 2)}`);
    }

    return foundEditor;
  }

  getOpenEditorDocuments(): EditorDocument[] {
    let activeEditorDocuments: EditorDocument[] = [];

    this.traverse(this.layout, (editor: EditorAreaLayout_Editor) => {
      activeEditorDocuments = activeEditorDocuments.concat(editor.editorDocuments);
    });

    return activeEditorDocuments;
  }

  getOpenEditors() {
    let activeEditors: EditorAreaLayout_Editor[] = [];

    this.traverse(this.layout, (editor: EditorAreaLayout_Editor) => {
      activeEditors = activeEditors.concat(editor);
    });

    return activeEditors;
  }

  getEditorIds(): string[] {
    const editorIds: string[] = [];
    this.traverse(this.layout, (editor: EditorAreaLayout_Editor) => {
      editorIds.push(editor.editorId);
    });
    return editorIds;
  }

  getFocusedEditor(): EditorAreaLayout_Editor | null {
    const editorId = this.getFocusedEditorId();

    return editorId == null ? null : this.fetchEditorById(editorId);
  }

  getFocusedEditorId(): string | null {
    return this.focusedEditorId;
  }

  getFocusedEditorDocument(): EditorDocument | null {
    if (this.focusedEditorId == null) {
      return null;
    }
    const editor = this.fetchEditorById(this.focusedEditorId);

    return editor.editorDocuments[editor.activeEditorDocumentIndex];
  }

  private setFocusedEditor(editorId: string): void {
    const blurredEditorDocument = this.getFocusedEditorDocument();
    const editor = this.fetchEditorById(editorId);

    // can not focus editor without documents
    if (editor.editorDocuments.length === 0) {
      return;
    }

    if (this.focusedEditorId != editorId) {
      this.focusedEditorId = editorId;

      this.emitFocusChanged(blurredEditorDocument);
    }
  }

  private setFocusedEditorDocument(editorId: string, activeEditorDocumentIndex: number): void {
    const editor = this.fetchEditorById(editorId);
    this.UNSAFE_updateActiveDocumentIndex(editor, activeEditorDocumentIndex);

    this.setFocusedEditor(editorId);
  }

  private setActiveEditorDocument(activeEditorDocument: EditorDocument): void {
    const editor = this.getEditorForEditorDocument(activeEditorDocument);

    const activeEditorDocumentIndex = editor.editorDocuments.findIndex(
      (editorDocument) => editorDocument.uri === activeEditorDocument.uri,
    );
    if (activeEditorDocumentIndex === -1) {
      throw new Error('Could not find active EditorDocument');
    }
    this.UNSAFE_updateActiveDocumentIndex(editor, activeEditorDocumentIndex);

    this.emitFocusChanged(null);
  }

  moveAndActivateEditorDocumentToEditor(editorDocument: EditorDocument, destEditor: EditorAreaLayout_Editor): void {
    const origEditor = this.getEditorForEditorDocument(editorDocument);
    const origIndex = origEditor.editorDocuments.findIndex((doc) => doc.uri === editorDocument.uri);

    const indexInDestEditor = destEditor.editorDocuments.findIndex((doc) => doc.uri === editorDocument.uri);
    const existsInDestEditor = indexInDestEditor !== -1;
    const destIndex = existsInDestEditor ? indexInDestEditor : destEditor.editorDocuments.length;

    if (editorDocument.isTemporary && origEditor.editorId !== destEditor.editorId) {
      this.persistEditorDocument(editorDocument);
    }

    this.moveAndActivateEditorDocumentByEditorIdAndIndex(
      origEditor.editorId,
      origIndex,
      destEditor.editorId,
      destIndex,
    );
  }

  moveAndActivateEditorDocumentByEditorIdAndIndex(
    origEditorId: string,
    origIndex: number,
    destEditorId: string,
    destIndex: number,
    shouldCloseEditorIfEmpty: boolean = true,
  ): void {
    const origEditor = this.fetchEditorById(origEditorId);
    const destEditor = this.fetchEditorById(destEditorId);

    if (origIndex < 0 || origIndex >= origEditor.editorDocuments.length) {
      throw new Error(
        `origIndex is out of bounds while performing moveAndActivateEditorDocument("${origEditorId}", ${origIndex}, "${destEditorId}", ${destIndex}, ${shouldCloseEditorIfEmpty})`,
      );
    }
    if (destIndex < 0 || destIndex > destEditor.editorDocuments.length) {
      throw new Error(
        `destIndex is out of bounds while performing moveAndActivateEditorDocument("${origEditorId}", ${origIndex}, "${destEditorId}", ${destIndex}, ${shouldCloseEditorIfEmpty})`,
      );
    }

    const blurredEditorDocument = this.getFocusedEditorDocument();

    const origItemToMove = origEditor.editorDocuments[origIndex];
    const origItemToMoveWasActiveTab = origEditor.activeEditorDocumentIndex === origIndex;
    const origItemToMoveWasLeftOfActiveTab = origIndex < origEditor.activeEditorDocumentIndex;

    if (origItemToMove.isTemporary && origEditorId !== destEditorId) {
      this.persistEditorDocument(origItemToMove);
    }

    origEditor.editorDocuments.splice(origIndex, 1);
    destEditor.editorDocuments.splice(destIndex, 0, origItemToMove);

    if (origItemToMoveWasActiveTab) {
      const activeEditorDocumentIndex = Math.min(origIndex, origEditor.editorDocuments.length - 1);
      this.UNSAFE_updateActiveDocumentIndex(origEditor, activeEditorDocumentIndex);
    }
    if (origItemToMoveWasLeftOfActiveTab) {
      const activeEditorDocumentIndex = Math.max(origEditor.activeEditorDocumentIndex - 1, 0);
      this.UNSAFE_updateActiveDocumentIndex(origEditor, activeEditorDocumentIndex);
    }

    this.UNSAFE_updateActiveDocumentIndex(destEditor, destIndex);

    if (shouldCloseEditorIfEmpty) {
      this.closeEditorIfEmpty(origEditorId);
    }

    this.emitFocusChanged(blurredEditorDocument);
  }

  getEditorDocumentByEditorIdAndIndex(editorId: string, index: number): EditorDocument {
    const editor = this.fetchEditorById(editorId);

    if (index < 0 || index >= editor.editorDocuments.length) {
      throw new Error(`index out of bounds: ${index}`);
    }

    const editorDocument = editor.editorDocuments[index];

    return editorDocument;
  }

  closeEditorDocument(editorDocument: EditorDocument): void {
    const location = this.findEditorAndDocumentIndexByUri(editorDocument.uri);

    if (location == null) {
      console.warn(`The location of "${editorDocument.uri}" while closing the EditorDocument, could not be found.`);
      return;
    }

    const { editorId, documentIndex } = location;
    const editor = this.fetchEditorById(editorId);

    if (documentIndex < 0 || documentIndex >= editor.editorDocuments.length) {
      throw new Error(`documentIndex out of bounds: ${documentIndex}`);
    }

    this.getFragmentEditorDocumentsByParentUri(editorDocument.uri).forEach((fragmentEditorDocument) => {
      this.closeEditorDocument(fragmentEditorDocument);
    });

    const blurredEditorDocument = this.getFocusedEditorDocument();

    const removedDocumentWasActiveTab = editor.activeEditorDocumentIndex === documentIndex;
    const removedDocumentWasLeftOfActiveTab = documentIndex < editor.activeEditorDocumentIndex;

    editor.editorDocuments.splice(documentIndex, 1);

    if (removedDocumentWasActiveTab) {
      const activeEditorDocumentIndex = Math.max(0, Math.min(documentIndex, editor.editorDocuments.length - 1));
      this.UNSAFE_updateActiveDocumentIndex(editor, activeEditorDocumentIndex);
    }
    if (removedDocumentWasLeftOfActiveTab) {
      const activeEditorDocumentIndex = Math.max(editor.activeEditorDocumentIndex - 1, 0);
      this.UNSAFE_updateActiveDocumentIndex(editor, activeEditorDocumentIndex);
    }

    this.closeEditorIfEmpty(editorId);

    this.emit(EVENT_EDITOR_AREA_DOCUMENT_CLOSED, [editorDocument]);

    this.emitFocusChanged(blurredEditorDocument);
  }

  closeEditor(editorId: string): void {
    const blurredEditorDocument = this.getFocusedEditorDocument();

    this.traverseLayout(this.layout, (thing: any) => {
      const columnsOrRows = thing.rows || thing.columns;
      if (columnsOrRows) {
        const index = this.indexOfEditor(columnsOrRows, editorId);

        if (index != -1) {
          columnsOrRows.splice(index, 1);
        }
      }
    });
    if (this.focusedEditorId === editorId) {
      this.focusedEditorId = this.getEditorIds()[0];
    }

    this.emitFocusChanged(blurredEditorDocument);
  }

  splitEditorToTheRight(editorDocument: EditorDocument): EditorAreaLayout_Editor | null {
    const newEditor = this.splitEditorToColumnOrRow(
      editorDocument,
      (
        editor: EditorAreaLayout_Editor,
        newEditor: EditorAreaLayout_Editor,
        columnOrRow: EditorAreaLayout_Column | EditorAreaLayout_Row,
      ) => {
        if (columnOrRow.type === 'row') {
          columnOrRow.columns.push(newEditor);
        } else if (columnOrRow.type === 'column') {
          const oldIndexOfEditor = columnOrRow.rows.indexOf(editor);
          const newEditorRow: EditorAreaLayout_Row = {
            type: 'row',
            columns: [editor, newEditor],
          };
          columnOrRow.rows[oldIndexOfEditor] = newEditorRow;
        }
      },
    );

    return newEditor;
  }

  splitEditorToTheBottom(editorDocument: EditorDocument): EditorAreaLayout_Editor | null {
    const newEditor = this.splitEditorToColumnOrRow(
      editorDocument,
      (
        editor: EditorAreaLayout_Editor,
        newEditor: EditorAreaLayout_Editor,
        columnOrRow: EditorAreaLayout_Column | EditorAreaLayout_Row,
      ) => {
        if (columnOrRow.type === 'row') {
          const oldIndexOfEditor = columnOrRow.columns.indexOf(editor);
          const newEditorColumn: EditorAreaLayout_Column = {
            type: 'column',
            rows: [editor, newEditor],
          };

          columnOrRow.columns[oldIndexOfEditor] = newEditorColumn;
        } else if (columnOrRow.type === 'column') {
          columnOrRow.rows.push(newEditor);
        }
      },
    );

    return newEditor;
  }

  splitFocusedEditorToTheRight(): EditorAreaLayout_Editor {
    const newEditor = this.splitNewEditorToColumnOrRow(
      (
        editor: EditorAreaLayout_Editor,
        newEditor: EditorAreaLayout_Editor,
        columnOrRow: EditorAreaLayout_Column | EditorAreaLayout_Row,
      ) => {
        if (columnOrRow.type === 'row') {
          columnOrRow.columns.push(newEditor);
        } else if (columnOrRow.type === 'column') {
          const oldIndexOfEditor = columnOrRow.rows.indexOf(editor);
          const newEditorRow: EditorAreaLayout_Row = {
            type: 'row',
            columns: [editor, newEditor],
          };
          columnOrRow.rows[oldIndexOfEditor] = newEditorRow;
        }
      },
    );

    return newEditor;
  }

  canSplitEditor(editorDocument: EditorDocument | null): boolean {
    if (editorDocument == null) {
      return false;
    }

    try {
      const editor = this.getEditorForEditorDocument(editorDocument);

      return editor.editorDocuments.length > 1;
    } catch {
      // Errors can occur, when trying to get the Editor for a non-existing document (for instance, a document which was already closed).
      return false;
    }
  }

  private splitEditorToColumnOrRow(
    editorDocument: EditorDocument,
    callbackFn: SplitEditorCallbackFn,
  ): EditorAreaLayout_Editor | null {
    if (!this.canSplitEditor(editorDocument)) {
      return null;
    }

    const editor = this.getEditorForEditorDocument(editorDocument);
    assertNotNull(editor, 'editor');

    const columnOrRow = this.getEditorColumnOrRowForEditor(editor.editorId);
    assertNotNull(columnOrRow, 'columnOrRow');
    const newEditor = this.createEditor();

    callbackFn(editor, newEditor, columnOrRow);

    const docIndex = editor.editorDocuments.findIndex(
      (otherEditorDocument) => otherEditorDocument.uri === editorDocument.uri
    );

    if (editorDocument.isTemporary) {
      this.persistEditorDocument(editorDocument);
    }

    this.moveAndActivateEditorDocumentByEditorIdAndIndex(
      editor.editorId,
      docIndex,
      newEditor.editorId,
      0,
      false,
    );

    this.emit(EVENT_EDITOR_AREA_LAYOUT_UPDATED);

    return newEditor;
  }

  private splitNewEditorToColumnOrRow(callbackFn: SplitEditorCallbackFn): EditorAreaLayout_Editor {
    const editor = this.getFocusedEditor();
    assertNotNull(editor, 'editor');

    const columnOrRow = this.getEditorColumnOrRowForEditor(editor.editorId);
    assertNotNull(columnOrRow, 'columnOrRow');
    const newEditor = this.createEditor();

    callbackFn(editor, newEditor, columnOrRow);

    this.emit(EVENT_EDITOR_AREA_LAYOUT_UPDATED);

    return newEditor;
  }

  reset(): void {
    this.focusedEditorId = null;
    this.editorTabsVisible = true;
    this.layout = { type: 'row', columns: [] };
  }

  private createEditor(): EditorAreaLayout_Editor {
    const highestEditorNumber = this.getHighestEditorNumber();
    const editorId = `Editor${highestEditorNumber + 1}`;

    return {
      type: 'editor',
      editorId: editorId,
      editorDocuments: [],
      activeEditorDocumentIndex: 0,
    };
  }

  private fetchEditorById(editorId: string): EditorAreaLayout_Editor {
    let foundEditor;
    this.traverse(this.layout, (editor: EditorAreaLayout_Editor) => {
      if (editor.editorId == editorId) {
        foundEditor = editor;
      }
    });

    if (!foundEditor) {
      throw new Error(`Could not find editor with id: ${editorId}`);
    }

    return foundEditor;
  }

  setEditorTabsVisibility(visible: boolean): void {
    this.editorTabsVisible = visible;

    this.emit(EVENT_EDITOR_AREA_LAYOUT_UPDATED);
  }

  // Internal: used to restore state from serialized dump
  deserialize(dump: any): void {
    if (!dump) {
      return;
    }
    const deepCopy = JSON.parse(JSON.stringify(dump));

    this.layout = deepCopy.layout;
    this.focusedEditorId = deepCopy.focusedEditorId;
  }

  // Internal: used to create serialized dump of internal state
  serialize(): EditorAreaSerialized {
    const focusedEditorDocument = this.getFocusedEditorDocument();
    const focusedEditorDocumentUri = focusedEditorDocument == null ? null : focusedEditorDocument.uri;

    return {
      layout: this.layout,
      focusedEditorId: this.focusedEditorId,
      focusedEditorDocumentUri: focusedEditorDocumentUri,
      editorTabsVisible: this.editorTabsVisible,
    };
  }

  private resetEditor(): EditorAreaLayout_Editor {
    const firstEditor = this.createEditor();
    this.layout = layoutRow(firstEditor);
    this.focusedEditorId = firstEditor.editorId;

    return firstEditor;
  }

  private getFragmentEditorDocuments(): EditorDocument[] {
    return this.getOpenEditorDocuments().filter((editorDocument: EditorDocument): boolean => {
      return isUrlForOpenInNewTab(editorDocument.uri);
    });
  }

  private getFragmentEditorDocumentsByParentUri(uri: string): EditorDocument[] {
    return this.getFragmentEditorDocuments().filter((editorDocument: EditorDocument): boolean => {
      const fragment = parseOpenInNewTabUrl(editorDocument.uri);
      return fragment.parentUri === uri;
    });
  }

  private getHighestUntitledEditorDocumentNumber(): number {
    const numbersAsStrings = this.getOpenEditorDocuments()
      .map((editorDocument) => {
        const match = editorDocument.label.match(UNTITLED_TITLE_TEST_REGEX);
        return match ? <string>match[1] : null;
      })
      .filter((str: string | null): str is string => str != null);

    const numbers = this.sortNumbersGivenAsStrings(numbersAsStrings);

    return numbers.length === 0 ? 0 : numbers[0];
  }

  private getHighestEditorNumber(): number {
    const numbersAsStrings = this.getEditorIds()
      .map((editorId) => {
        const match = editorId.match(EDITOR_ID_TEST_REGEX);
        return match ? match[1] as string : null;
      })
      .filter((str: string | null): str is string => str != null);

    const numbers = this.sortNumbersGivenAsStrings(numbersAsStrings);

    return numbers.length === 0 ? 0 : numbers[0];
  }

  private sortNumbersGivenAsStrings(numbersAsStrings: string[]): number[] {
    const untitledNumbers: number[] = numbersAsStrings
      .map((str: string) => parseInt(str))
      .sort((left: number, right: number) => right - left);

    return untitledNumbers;
  }

  private addEditorDocumentToEditor(
    editor: EditorAreaLayout_Editor | null,
    title: string,
    uri: string,
    documentType: string,
    rendererKey: string,
    modelKey: string | null,
    inspectorKey: string | undefined,
    icon: string | null,
    currentData: string | null = null,
    originalData: string | null = null,
    isTemporary: boolean | undefined,
  ): EditorDocument {
    if (editor == null) {
      if (this.getEditorIds().length === 0) {
        editor = this.resetEditor();
      } else {
        editor = this.getFocusedEditor();
      }
    }
    if (editor == null) {
      throw new Error('Could not add document: Editor is null');
    }

    const newDocument: EditorDocument = {
      label: title,
      icon: icon || '',
      hasUnsavedChanges: false,
      uri: uri,
      documentType: documentType,
      rendererKey: rendererKey,
      modelKey: modelKey,
      data: { original: originalData, current: currentData },
      metadata: {},
      isTemporary: isTemporary,
    };
    editor.editorDocuments.push(newDocument);

    return newDocument;
  }

  private closeEditorIfEmpty(editorId: string): void {
    const editor = this.fetchEditorById(editorId);
    const editorIsEmpty = editor.editorDocuments.length === 0;

    if (editorIsEmpty) {
      this.closeEditor(editorId);
    }
  }

  private getEditorColumnOrRowForEditor(editorId: string): EditorAreaLayout_Column | EditorAreaLayout_Row | null {
    let columnOrRow: EditorAreaLayout_Column | EditorAreaLayout_Row | null = null;
    this.traverseLayout(this.layout, (thing: any) => {
      const columnsOrRows = thing.rows || thing.columns;
      if (columnsOrRows) {
        const index = this.indexOfEditor(columnsOrRows, editorId);

        if (index != -1) {
          columnOrRow = thing;
        }
      }
    });

    if (columnOrRow == null) {
      throw new Error(`Could not find column or row for editorId: ${editorId}`);
    }

    return columnOrRow;
  }

  private indexOfEditor(columnsOrRows: EditorAreaLayout_Column[] | EditorAreaLayout_Row[], editorId: string): number {
    return columnsOrRows.findIndex((thing: any) => thing.editorId === editorId);
  }

  private traverse(thing: any, callbackFn: TraverseLayoutCallbackFn): void {
    if (thing == null) {
      return;
    } else if (thing.rows) {
      this.traverseList(thing.rows, callbackFn);
    } else if (thing.columns) {
      this.traverseList(thing.columns, callbackFn);
    } else {
      callbackFn(thing);
    }
  }

  private traverseList(list: any[], callbackFn: TraverseLayoutCallbackFn): void {
    for (const element of list) {
      this.traverse(element, callbackFn);
    }
  }

  private traverseLayout(thing: any, callbackFn: TraverseLayoutCallbackFn): void {
    callbackFn(thing);
    if (thing == null) {
      return;
    } else if (thing.rows) {
      this.traverseLayoutList(thing.rows, callbackFn);
    } else if (thing.columns) {
      this.traverseLayoutList(thing.columns, callbackFn);
    }
  }

  private traverseLayoutList(list: any[], callbackFn: TraverseLayoutCallbackFn): void {
    for (const element of list) {
      this.traverseLayout(element, callbackFn);
    }
  }

  private getEditorDocumentLabel(uri: string): string {
    if (uri.match(/^fragment\+/)) {
      const fragmentMatch = uri.match(/([^!]+)$/);
      const fragmentId = fragmentMatch ? fragmentMatch[1] : `${uri}`;

      return `↳ ${fragmentId}`;
    }

    const uriMatch = uri.match(/([^/|\\]+)$/);
    const title = uriMatch ? uriMatch[1] : `${uri}`;

    return title;
  }

  private UNSAFE_updateEditorDocument(editorDocument: EditorDocument, properties: any): void {
    // EditorDocument objects are read-only in user-space
    // DO NOT USE this "any trick" without knowing the implications!
    Object.keys(properties).forEach((name: string) => {
      (editorDocument as any)[name] = properties[name];
    });
  }

  private UNSAFE_updateActiveDocumentIndex(editor: EditorAreaLayout_Editor, newIndex: number): void {
    // EditorAreaLayout_Editor objects are read-only in user-space
    // DO NOT USE this "any trick" without knowing the implications!
    (editor as any).activeEditorDocumentIndex = newIndex;
  }

  private emitFocusChanged(blurredEditorDocument: EditorDocument | null): void {
    this.emit(EVENT_EDITOR_AREA_FOCUS_UPDATED, [this.getFocusedEditorDocument(), blurredEditorDocument]);
    this.emit(EVENT_EDITOR_AREA_LAYOUT_UPDATED);
  }
}
