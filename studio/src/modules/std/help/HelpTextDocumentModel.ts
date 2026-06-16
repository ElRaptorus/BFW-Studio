import type { Studio } from '@evil/bifrost_fw_sdk';
import { EditorDocumentModel } from '@evil/bifrost_fw_sdk';

export class HelpTextDocumentModel extends EditorDocumentModel {
  private helpText: any;

  constructor(uri: string, studio: Studio) {
    super(uri);

    const helpTextId = uri.replace(/^help:\/\//, '');

    this.helpText = studio.helpTexts.getHelpText(helpTextId);

    if (this.helpText.metadata.title != null) {
      this.updateLabel(this.helpText.metadata.title);
    }
  }

  getMarkdown(): string {
    return this.helpText.markdown;
  }

  static async create(
    uri: string,
    restoredCurrentData: any,
    restoredMetadata: any,
    fileLoader: any,
    studio: Studio,
  ): Promise<HelpTextDocumentModel> {
    return new HelpTextDocumentModel(uri, studio);
  }
}
