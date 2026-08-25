import type { EditorDocument, EditorDocumentModel } from '@evil/bifrost_fw_sdk';
import { AbstractEmitter, assertNotNull } from '@evil/bifrost_fw_sdk';

import {
  EVENT_DATA_UPDATED,
  EVENT_EDITOR_DOCUMENT_DATA_UPDATED,
  EVENT_EDITOR_DOCUMENT_FRAGMENT_ID_UPDATED,
  EVENT_EDITOR_DOCUMENT_LABEL_UPDATED,
  EVENT_EDITOR_DOCUMENT_METADATA_UPDATED,
  EVENT_EDITOR_DOCUMENT_URI_UPDATED,
  EVENT_FRAGMENT_ID_UPDATED,
  EVENT_LABEL_CHANGED,
  EVENT_METADATA_UPDATED,
  EVENT_URI_CHANGED,
} from '../../../../studio-sdk/src/contracts/internal/EditorEvents';

type EditorDocumentModelFactory = {
  create(
    uri: string,
    restoredCurrentData: unknown,
    metadata: unknown,
    ...appended: any[]
  ): Promise<EditorDocumentModel | null>;
};

/**
 * Holds all instantiated document models.
 */
export class EditorDocumentModelManager extends AbstractEmitter {
  private classOrModuleMap: any = {};
  private editorDocumentModelInstanceMap: Record<string, EditorDocumentModel | any> = {};
  private appendedArgumentsForCreateCallback: any[];

  constructor(appendedArgumentsForCreateCallback: any[]) {
    super();
    this.appendedArgumentsForCreateCallback = appendedArgumentsForCreateCallback;
  }

  /**
   * Internal: Works like `getEditorDocumentModelInstance()`, but does not lazily initialize the document model.
   * If no model is found, this function returns `null`.
   */
  getEditorDocumentModelInstanceFromCache<T = EditorDocumentModel>(editorDocument: EditorDocument | null): T | null {
    assertNotNull(editorDocument, 'editorDocument');

    const existingModel = this.editorDocumentModelInstanceMap[editorDocument.uri];

    if (existingModel == null || this.isPromise(existingModel)) {
      return null;
    }

    return existingModel;
  }

  /**
   * Internal: Returns a document model for the given `editorDocument`.
   */
  async getEditorDocumentModelInstance<T>(
    editorDocument: EditorDocument,
    verifyInstanceOf?: abstract new (...args: any[]) => any,
  ): Promise<T> {
    const { uri } = editorDocument;

    if (editorDocument.modelKey == null) {
      throw new Error(`There is no model registered for EditorDocument: ${JSON.stringify(editorDocument, null, 2)}`);
    }

    const editorDocumentModelClassOrModule = this.getClassOrModule(editorDocument.modelKey);
    const restoredCurrentData = editorDocument.data?.current;

    let existingModel = this.editorDocumentModelInstanceMap[uri];

    if (existingModel != null) {
      if (this.isPromise(existingModel)) {
        existingModel = await existingModel;
      }
      if (verifyInstanceOf != null) {
        this.assertInstanceOf(existingModel, verifyInstanceOf);
      }

      return existingModel;
    }

    this.editorDocumentModelInstanceMap[uri] = new Promise(async (resolve, reject) => {
      let model: EditorDocumentModel | null;
      try {
        model = await editorDocumentModelClassOrModule.create(
          uri,
          restoredCurrentData,
          editorDocument.metadata,
          ...this.appendedArgumentsForCreateCallback,
        );
      } catch (error) {
        this.editorDocumentModelInstanceMap[uri] = null;
        return reject(error);
      }

      if (model == null) {
        return reject(
          new Error(`Could not get EditorDocumentModel: ${editorDocumentModelClassOrModule}.create returned null`),
        );
      }

      if (verifyInstanceOf != null) {
        this.assertInstanceOf(model, verifyInstanceOf);
      }

      this.editorDocumentModelInstanceMap[uri] = model;

      model = this.addEventListeners(model, editorDocument);

      model.UNSAFE_onEditorDocumentModelManagerListens();

      model.onEditorDocumentModelDidRegister();

      resolve(model);
    });

    return this.editorDocumentModelInstanceMap[uri];
  }

  /**
   * Returns `true` if an EditorDocumentModel has been created for the given `editorDocument`.
   */
  hasDocumentModel(editorDocument: EditorDocument): boolean {
    return this.editorDocumentModelInstanceMap[editorDocument.uri] != null;
  }

  /**
   * Internal: Registers the given `editorDocumentModelClassOrModule` with the given `id`.
   */
  registerConstructor(id: string, editorDocumentModelClassOrModule: EditorDocumentModelFactory): void {
    if (this.classOrModuleMap[id] != null) {
      throw new Error(`There is already a DocumentModelConstructor registered with this id: ${id}`);
    }

    this.classOrModuleMap[id] = editorDocumentModelClassOrModule;
  }

  /**
   * Internal: Removes the model constructor with the given `id`.
   */
  unregisterConstructor(id: string): void {
    delete this.classOrModuleMap[id];
  }

  /**
   * Internal: Removes the document model for the given `editorDocument`.
   */
  tryRemoveEditorDocumentModelInstance(editorDocument: EditorDocument): void {
    if (editorDocument == null) {
      throw new Error(`Could remove DocumentModel instance for 'null'`);
    }

    if (editorDocument.modelKey == null) {
      return;
    }

    const editorDocumentModel = this.editorDocumentModelInstanceMap[editorDocument.uri];
    if (editorDocumentModel == null) {
      return;
    }

    editorDocumentModel.onEditorDocumentWillClose();

    delete this.editorDocumentModelInstanceMap[editorDocument.uri];
  }

  reset(): void {
    this.editorDocumentModelInstanceMap = {};
  }

  private assertInstanceOf(model: any, verifyInstanceOf: abstract new (...args: any[]) => any): void {
    if (!(model instanceof verifyInstanceOf)) {
      throw new Error(
        `${model} was supposed to be an instance of \`${verifyInstanceOf}\`, got \`${model.constructor.name}\`.`,
      );
    }
  }

  private getClassOrModule(id: string): any {
    const documentModelClassOrModuleMap = this.classOrModuleMap[id];
    if (documentModelClassOrModuleMap == null) {
      throw new Error(`Could not find a DocumentModel with this id: ${id}`);
    }
    return documentModelClassOrModuleMap;
  }

  private addEventListeners(model: EditorDocumentModel, editorDocument: EditorDocument): EditorDocumentModel {
    model.on(EVENT_DATA_UPDATED, (dataDiff: any) => {
      const data = Object.assign(editorDocument.data || {}, dataDiff);
      const hasUnsavedChanges = editorDocument.data.current != editorDocument.data.original;

      this.UNSAFE_updateEditorDocument(editorDocument, { data, hasUnsavedChanges });

      this.emit(EVENT_EDITOR_DOCUMENT_DATA_UPDATED, [editorDocument]);
    });

    model.on(EVENT_METADATA_UPDATED, (metadataDiff: any) => {
      Object.assign(editorDocument.metadata || {}, metadataDiff);
      this.emit(EVENT_EDITOR_DOCUMENT_METADATA_UPDATED, [model.getUri(), metadataDiff]);
    });

    model.on(EVENT_URI_CHANGED, (originalUri: any, newUri: string) => {
      this.editorDocumentModelInstanceMap[newUri] = model;
      this.editorDocumentModelInstanceMap[originalUri] = null;

      this.emit(EVENT_EDITOR_DOCUMENT_URI_UPDATED, [originalUri, newUri]);
    });

    model.on(EVENT_LABEL_CHANGED, (label: string) => {
      this.emit(EVENT_EDITOR_DOCUMENT_LABEL_UPDATED, [model.getUri(), label]);
    });

    model.on(EVENT_FRAGMENT_ID_UPDATED, (parentUri: any, oldFragmentId: string, newFragmentId: string) => {
      this.emit(EVENT_EDITOR_DOCUMENT_FRAGMENT_ID_UPDATED, [parentUri, oldFragmentId, newFragmentId]);
    });

    return model;
  }

  private UNSAFE_updateEditorDocument(editorDocument: EditorDocument, properties: any): void {
    // EditorDocument objects are read-only in user-space
    // DO NOT USE this "any trick" without knowing the implications!
    Object.keys(properties).forEach((name: string) => {
      (editorDocument as any)[name] = properties[name];
    });
  }

  private isPromise(thing: any): boolean {
    return typeof thing?.then === 'function';
  }
}
