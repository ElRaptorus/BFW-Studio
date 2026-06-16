export declare type CanOpenDocumentResult = {
  /**
   * whether the document can be opened
   */
  documentCanBeOpened: boolean;
  /**
   * optional error message if the document cannot be opened
   */
  error?: string;
};

export declare type EditorDocumentTypeDefinitionWithoutName = {
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
   * the key under which the document inspector is registered
   */
  inspectorKey?: string;
  /**
   * the constructor of the document inspector
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
export declare type EditorDocumentTypeDefinition = EditorDocumentTypeDefinitionWithoutName & {
  documentType: string;
};
/**
 * Holds information about connecting various document renderers and models to different types of documents.
 */
export declare class EditorDocumentTypeManager {}
