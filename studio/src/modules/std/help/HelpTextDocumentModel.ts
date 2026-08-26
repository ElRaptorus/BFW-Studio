import type { Bifrost } from '#bifrost/Bifrost';
import { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';

export class HelpTextDocumentModel extends EditorDocumentModel {
  private helpText: any;

  constructor(uri: string, studio: Bifrost) {
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
    studio: Bifrost,
  ): Promise<HelpTextDocumentModel> {
    return new HelpTextDocumentModel(uri, studio);
  }
}
