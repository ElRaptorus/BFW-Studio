import type { ILoadable, Studio } from '@evil/bifrost_fw_sdk';
import { EditorDocumentModel } from '@evil/bifrost_fw_sdk';

export class EditorDocumentDefaultModel extends EditorDocumentModel {
  private readonly studio: Studio;

  private constructor(uri: string, contentOnFile: string, restoredCurrentData: string | null = null, studio: Studio) {
    super(uri);

    this.studio = studio;

    // EditorDocuments differentiate between `originalData` and `currentData`.
    //
    // If we picture an EditorDocument which represents a Markdown File Editor,
    // then the `originalData` is the data on disk and the `currentData` is the current text
    // in our editor (the unsaved state, so to speak)
    this.updateOriginalAndCurrentData(contentOnFile, restoredCurrentData || contentOnFile);
  }

  static async create(
    uri: string,
    restoredCurrentData: any,
    restoredMetadata: any,
    fileLoader: ILoadable,
    studio: Studio,
  ): Promise<EditorDocumentDefaultModel> {
    const isUnsavedBuffer = uri.startsWith('buffer:');
    let contentOnFile;

    if (isUnsavedBuffer) {
      contentOnFile = '';
    } else {
      contentOnFile = await fileLoader.load(uri);
      if (contentOnFile == null || typeof contentOnFile !== 'string') {
        throw new Error(`EditorDocumentJsonEditorModel.create: Error while loading: ${uri}`);
      }
    }

    const model = new EditorDocumentDefaultModel(uri, contentOnFile, restoredCurrentData, studio);

    return model;
  }

  setValue(data: string): void {
    this.updateCurrentData(data);
  }

  getValue(): string {
    return this.getCurrentData() || '';
  }

  public getCurrentData() {
    return super.getCurrentData();
  }
}
