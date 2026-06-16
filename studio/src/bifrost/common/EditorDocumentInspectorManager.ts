type InspectorMap = { [id: string]: any };

/**
 * Holds information about the various editor document inspectors used to inspect a document by use of the bottom pane area.
 */
export class EditorDocumentInspectorManager {
  private inspectorMap: InspectorMap = {};

  /**
   * Internal: Registers the given `editorDocumentInspector` with the given `id`.
   */
  register(id: string, editorDocumentInspector: any): void {
    if (this.inspectorMap[id] != null) {
      throw new Error(`An inspector with the given id already exists: ${id}`);
    }
    this.inspectorMap[id] = editorDocumentInspector;
  }

  /**
   * Internal: Removes the inspector with the given `id`.
   */
  unregister(id: string): void {
    delete this.inspectorMap[id];
  }

  /**
   * Internal: Returns the editor document inspector with the given `id`.
   */
  getById(id: string): any {
    const inspector = this.inspectorMap[id];

    if (inspector == null) {
      throw new Error(`Could not find an inspector with this key: ${id}`);
    }
    return inspector;
  }
}
