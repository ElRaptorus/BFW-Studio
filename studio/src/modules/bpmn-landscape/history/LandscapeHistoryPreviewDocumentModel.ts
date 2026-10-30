import type { Bifrost } from '#bifrost/Bifrost';
import { parseOpenInNewTabUrl } from '#bifrost/common/OpenInNewTabUrl';
import type { ILoadable } from '#bifrost/contracts/LoaderTypes';
import type { ElementLike } from 'diagram-js/lib/model/Types';

import LandscapeDiffDocumentModel from '../diff/LandscapeDiffDocumentModel';
import { LandscapeViewerWithSync } from '../diff/LandscapeViewerWithSync';

type ViewerMode = 'preview' | 'diff';

/** One historical version of a map: on its own (`preview`) or against the current file (`diff`). */
export default class LandscapeHistoryPreviewDocumentModel extends LandscapeDiffDocumentModel {
  private readonly parentUri: string;
  private readonly commitHash: string;
  private readonly commitMessage: string;
  private readonly commitAuthor: string;
  private readonly commitDate: string;
  private readonly previewViewer: LandscapeViewerWithSync;
  private historicalText: string | null = null;
  private viewerMode: ViewerMode = 'diff';
  private onViewerModeChangedHandler: ((mode: ViewerMode) => void) | null = null;

  constructor(uri: string, restoredCurrentData: any, restoredMetadata: any, fileLoader: ILoadable, bifrost: Bifrost) {
    super(uri, restoredCurrentData, restoredMetadata, fileLoader, bifrost);
    const { parentUri, data } = parseOpenInNewTabUrl(uri);
    this.parentUri = parentUri;
    this.commitHash = data.commitHash;
    this.commitMessage = data.message ?? '';
    this.commitAuthor = data.author ?? '';
    this.commitDate = data.date ?? '';
    this.previewViewer = new LandscapeViewerWithSync(this.viewerConfig);
  }

  static override async create(
    uri: string,
    restoredCurrentData: any,
    restoredMetadata: any,
    fileLoader: ILoadable,
    bifrost: Bifrost,
  ): Promise<LandscapeHistoryPreviewDocumentModel> {
    const model = new LandscapeHistoryPreviewDocumentModel(
      uri,
      restoredCurrentData,
      restoredMetadata,
      fileLoader,
      bifrost,
    );
    await model.initialize();
    return model;
  }

  getViewerMode(): ViewerMode {
    return this.viewerMode;
  }

  setViewerMode(mode: ViewerMode): void {
    this.viewerMode = mode;
    this.onViewerModeChangedHandler?.(mode);
  }

  onViewerModeChanged(callback: (mode: ViewerMode) => void): void {
    this.onViewerModeChangedHandler = callback;
  }

  attachPreview(htmlElement: HTMLDivElement): void {
    if (this.afterMap != null) {
      this.previewViewer.loadMap(this.afterMap);
      this.previewViewer.attachTo(htmlElement);
      requestAnimationFrame(() => this.previewViewer.resetZoom());
    }
  }

  getParentUri(): string {
    return this.parentUri;
  }

  getShortHash(): string {
    return this.commitHash.substring(0, 7);
  }

  getCommitMessage(): string {
    return this.commitMessage.split('\n')[0];
  }

  getCommitAuthor(): string {
    return this.commitAuthor;
  }

  getCommitDate(): string {
    return this.commitDate;
  }

  getFilename(): string {
    return this.bifrost.files.getLocalBasename(this.parentUri);
  }

  getHistoricalText(): string | null {
    return this.historicalText;
  }

  override selectElements(elementIds: string[]): void {
    if (this.viewerMode === 'diff') {
      super.selectElements(elementIds);
      return;
    }
    this.previewViewer.selectWithoutSync(elementIds);
    void this.zoomToElements(elementIds);
  }

  override getSelectedElements(): ElementLike[] {
    return this.viewerMode === 'preview' ? this.previewViewer.getSelection().get() : super.getSelectedElements();
  }

  override zoomToViewport(): void {
    if (this.viewerMode === 'preview') {
      this.previewViewer.zoomToViewport();
    } else {
      super.zoomToViewport();
    }
  }

  override setZoom(percentage: number): void {
    if (this.viewerMode === 'preview') {
      this.previewViewer.setZoom(percentage);
    } else {
      super.setZoom(percentage);
    }
  }

  override async zoomToElements(elementIds: string[]): Promise<void> {
    if (this.viewerMode === 'preview') {
      const registry = this.previewViewer.getElementRegistry();
      await this.previewViewer.focusViewOnElements(elementIds.filter((elementId) => registry.get(elementId) != null));
      return;
    }
    await super.zoomToElements(elementIds);
  }

  protected override describeSides(): [before: string, after: string] {
    return ['current', `historical (${this.getShortHash()})`];
  }

  protected override async loadTexts(): Promise<[before: string, after: string]> {
    this.historicalText = await this.bifrost.commands.executeCommand<string>('git.getFileAtRef', [
      this.parentUri,
      this.commitHash,
    ]);
    if (this.historicalText == null || this.historicalText.trim() === '') {
      throw new Error(`Could not load file at ref ${this.getShortHash()}`);
    }
    return [await this.bifrost.files.load(this.parentUri), this.historicalText];
  }

  protected override async initialize(): Promise<void> {
    await super.initialize();
    this.readyForInteraction = true;
  }
}
