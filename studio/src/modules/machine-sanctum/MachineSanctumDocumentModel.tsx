import type { Bifrost } from '#bifrost/Bifrost';
import { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { ILoadable } from '#bifrost/contracts/LoaderTypes';

export default class MachineSanctumDocumentModel extends EditorDocumentModel {
  private readonly bifrost: Bifrost;

  constructor(uri: string, bifrost: Bifrost) {
    super(uri);

    this.bifrost = bifrost;
  }

  static async create(
    uri: string,
    restoredCurrentData: any,
    restoredMetadata: any,
    fileLoader: ILoadable,
    bifrost: Bifrost,
  ): Promise<MachineSanctumDocumentModel> {
    return new MachineSanctumDocumentModel(uri, bifrost);
  }

  setExampleData(exampleName: string, data: any): void {
    this.updateMetadata({ [exampleName]: data });
  }

  getExampleData(exampleName: string): any | undefined {
    const editorDocument = this.bifrost.editors.getEditorDocumentByUri(this.uri);
    const exampleData = editorDocument?.metadata[exampleName];

    return exampleData;
  }

  resetExampleData(exampleName: string): void {
    this.updateMetadata({ [exampleName]: undefined });
  }
}
