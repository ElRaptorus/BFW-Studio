import type { Bifrost } from '#bifrost/Bifrost';
import { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import { parseOpenInNewTabUrl } from '#bifrost/common/OpenInNewTabUrl';
import type { ILoadable } from '#bifrost/contracts/LoaderTypes';

import { canCompareAsText } from './textDiffContent';

/**
 * Compares one file between two versions as text. The URI carries `repositoryRoot`, `path`, optional `previousPath`,
 * `beforeRef`, `afterRef`, `beforeLabel` and `afterLabel`. A ref is a commit hash, `HEAD`, `WORKING` (the file on
 * disk) or `NONE` (the file does not exist on that side).
 */
export default class TextDiffDocumentModel extends EditorDocumentModel {
  private readonly bifrost: Bifrost;

  private beforeText = '';
  private afterText = '';
  private fileExists = false;
  private revision = 0;

  constructor(
    uri: string,
    _restoredCurrentData: any,
    _restoredMetadata: any,
    _fileLoader: ILoadable,
    bifrost: Bifrost,
  ) {
    super(uri);

    this.bifrost = bifrost;
  }

  static async create(
    uri: string,
    restoredCurrentData: any,
    restoredMetadata: any,
    fileLoader: ILoadable,
    bifrost: Bifrost,
  ): Promise<TextDiffDocumentModel> {
    const model = new TextDiffDocumentModel(uri, restoredCurrentData, restoredMetadata, fileLoader, bifrost);
    await model.load();
    return model;
  }

  getBeforeText(): string {
    return this.beforeText;
  }

  getAfterText(): string {
    return this.afterText;
  }

  getRelativePath(): string {
    return parseOpenInNewTabUrl(this.uri).data.path;
  }

  getBeforeLabel(): string {
    return parseOpenInNewTabUrl(this.uri).data.beforeLabel;
  }

  getAfterLabel(): string {
    return parseOpenInNewTabUrl(this.uri).data.afterLabel;
  }

  getFileUri(): string {
    return parseOpenInNewTabUrl(this.uri).parentUri;
  }

  /** Whether the file is still in the working tree, so "Open File" can work. */
  getFileExists(): boolean {
    return this.fileExists;
  }

  canCompare(): boolean {
    return canCompareAsText(this.beforeText) && canCompareAsText(this.afterText);
  }

  /** Increases when the compared texts were reloaded; used to re-create the mounted diff. */
  getRevision(): number {
    return this.revision;
  }

  /** The working file may have changed since this tab was last shown. */
  onEditorDocumentDidFocus(): void {
    const { data } = parseOpenInNewTabUrl(this.uri);
    if (data.beforeRef === 'WORKING' || data.afterRef === 'WORKING') {
      void this.reloadWorkingFile();
    }
  }

  private async reloadWorkingFile(): Promise<void> {
    const previousBefore = this.beforeText;
    const previousAfter = this.afterText;
    try {
      await this.load();
    } catch {
      // the file may have been removed in the meantime; keep showing the last texts
      return;
    }
    if (this.beforeText !== previousBefore || this.afterText !== previousAfter) {
      this.revision++;
      this.updateMetadata({ revision: this.revision });
    }
  }

  private async load(): Promise<void> {
    const { data, parentUri } = parseOpenInNewTabUrl(this.uri);

    const [beforeText, afterText] = await Promise.all([
      this.loadSide(data.beforeRef, data.previousPath ?? data.path, parentUri, data.repositoryRoot),
      this.loadSide(data.afterRef, data.path, parentUri, data.repositoryRoot),
    ]);
    this.beforeText = beforeText;
    this.afterText = afterText;
    this.fileExists = await this.bifrost.files.doesFileOrDirectoryExist(
      this.bifrost.files.getLocalFilenameForUri(parentUri),
    );
  }

  private async loadSide(ref: string, relativePath: string, fileUri: string, repositoryRoot: string): Promise<string> {
    if (ref === 'NONE') {
      return '';
    }
    if (ref === 'WORKING') {
      return this.bifrost.files.load(fileUri);
    }
    return this.bifrost.sourceControl.getFileContentAtRevision(repositoryRoot, ref, relativePath);
  }
}
