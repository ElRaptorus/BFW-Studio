type RendererMap = { [id: string]: any };

/**
 * Holds information about the various editor document renderers used to visualize different document types.
 */
export class EditorDocumentRendererManager {
  private rendererMap: RendererMap = {};

  /**
   * Internal: Registers the given `editorDocumentRenderer` with the given `id`.
   */
  register(id: string, editorDocumentRenderer: any): void {
    if (this.rendererMap[id] != null) {
      throw new Error(`There is already a renderer registered with this key: ${id}`);
    }
    this.rendererMap[id] = editorDocumentRenderer;
  }

  /**
   * Internal: Removes the renderer with the given `id`.
   */
  unregister(id: string): void {
    delete this.rendererMap[id];
  }

  /**
   * Internal: Returns the document renderer for the given `id`.
   */
  getById(id: string): any {
    const renderer = this.rendererMap[id];

    if (renderer == null) {
      throw new Error(`Could not find a renderer with this key: ${id}`);
    }
    return renderer;
  }
}
