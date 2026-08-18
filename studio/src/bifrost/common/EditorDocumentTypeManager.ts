export type CanOpenDocumentResult = {
  /**
   * whether the document can be opened
   */
  documentCanBeOpened: boolean;
  /**
   * optional error message if the document cannot be opened
   */
  error?: string;
};

export type EditorDocumentTypeDefinitionWithoutName = {
  /**
   * a regex which tests if a definition is applicable to a given URI
   */
  uriMatch: RegExp;
  /**
   * the icon id for the editor document type
   */
  icon: string;
  /**
   * the key under which the document renderer is registered
   */
  rendererKey: string;
  /**
   * the constructor of the document renderer
   */
  rendererConstructor: any;
  /**
   * the key under which the document model is registered
   */
  modelKey: string | null;
  /**
   * the constructor of the document renderer
   */
  modelConstructor?: any;
  /**
   * the key under which the editor document inspector is registered
   */
  inspectorKey?: string;
  /**
   * the constructor of the editor document inspector
   */
  inspectorConstructor?: any;
  /**
   * the key under which the merge resolver is registered
   */
  mergeResolverKey?: string;
  /**
   * the constructor of the merge resolver
   */
  mergeResolverConstructor?: any;
  /**
   * optional preflight check to determine if the document can be opened
   */
  canOpen?: (uri: string) => CanOpenDocumentResult;
};
export type EditorDocumentTypeDefinition = EditorDocumentTypeDefinitionWithoutName & { documentType: string };

/**
 * Holds information about connecting various document renderers and models to different types of documents.
 */
export class EditorDocumentTypeManager {
  private documentTypeMap: { [documentType: string]: EditorDocumentTypeDefinition } = {};

  /**
   * Internal: Registers an `editorDocumentTypeDefinition` with the given `id`.
   */
  register(documentType: string, editorDocumentTypeDefinition: EditorDocumentTypeDefinitionWithoutName): void {
    if (this.documentTypeMap[documentType] != null) {
      throw new Error(`There is already a editor document type registered with this key: ${documentType}`);
    }
    this.documentTypeMap[documentType] = { documentType, ...editorDocumentTypeDefinition };
  }

  /**
   * Internal: Removes the document type with the given `documentType` key.
   */
  unregister(documentType: string): void {
    delete this.documentTypeMap[documentType];
  }

  /**
   * Internal: Retrieves an `EditorDocumentTypeDefinition` by its `name`.
   */
  getById(id: string): EditorDocumentTypeDefinition {
    const type = this.documentTypeMap[id];
    if (type == null) {
      throw new Error(`Could not find an editor document type with this key: ${id}`);
    }

    return type;
  }

  /**
   * Internal: Retrieves an `EditorDocumentTypeDefinition` by its `name`.
   */
  getByUri(uri: string): EditorDocumentTypeDefinition {
    const type = this.getByUriOrNull(uri);
    if (type == null) {
      throw new Error(`Could not find an editor document type for uri: ${uri}`);
    }

    return type;
  }

  /**
   * Internal: Returns true if there is an `EditorDocumentTypeDefinition` for the given `uri`.
   */
  hasTypeForUri(uri: string): boolean {
    const type = this.getByUriOrNull(uri);

    return type != null;
  }

  private getByUriOrNull(uri: string): EditorDocumentTypeDefinition | null {
    for (const documentType in this.documentTypeMap) {
      const documentTypeDefinition = this.documentTypeMap[documentType];
      if (this.match(uri, documentTypeDefinition)) {
        return documentTypeDefinition;
      }
    }

    return null;
  }

  private match(uri: string, documentType: EditorDocumentTypeDefinitionWithoutName): boolean {
    return uri.match(documentType.uriMatch) != null;
  }
}
