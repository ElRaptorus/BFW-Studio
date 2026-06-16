import type { Bifrost } from '#bifrost/Bifrost';
import type { ILoadable } from '#bifrost/contracts/LoaderTypes';

import { parseOpenInNewTabUrl } from '@evil/bifrost_fw_sdk';

import { BpmnViewerComponentAdapter } from '../../bpmn-core/BpmnViewerComponentAdapter';
import BpmnDiffDocumentModel, { type ElementLike } from '../BpmnDiffDocumentModel';

export default class BpmnHistoryPreviewDocumentModel extends BpmnDiffDocumentModel {
  private parentUri: string;
  private commitHash: string;
  private commitMessage: string;
  private commitAuthor: string;
  private commitDate: string;

  private historicalXml: string | null = null;

  private previewViewer: BpmnViewerComponentAdapter;
  private viewerMode: 'preview' | 'diff' = 'diff';
  private onViewerModeChangedHandler: ((mode: 'preview' | 'diff') => void) | null = null;

  constructor(uri: string, restoredCurrentData: any, restoredMetadata: any, fileLoader: ILoadable, bifrost: Bifrost) {
    super(uri, restoredCurrentData, restoredMetadata, fileLoader, bifrost);

    const parsed = parseOpenInNewTabUrl(uri);
    this.parentUri = parsed.parentUri;
    this.commitHash = parsed.data.commitHash;
    this.commitMessage = parsed.data.message ?? '';
    this.commitAuthor = parsed.data.author ?? '';
    this.commitDate = parsed.data.date ?? '';

    this.previewViewer = new BpmnViewerComponentAdapter(this.uri, {
      bpmnRenderer: {
        defaultFillColor: 'var(--color-bpmn-defaultFillColor)',
        defaultStrokeColor: 'var(--color-bpmn-defaultStrokeColor)',
      },
    });
  }

  static override async create(
    uri: string,
    restoredCurrentData: any,
    restoredMetadata: any,
    fileLoader: ILoadable,
    bifrost: Bifrost,
  ): Promise<BpmnHistoryPreviewDocumentModel> {
    const model = new BpmnHistoryPreviewDocumentModel(uri, restoredCurrentData, restoredMetadata, fileLoader, bifrost);
    await model.initialize();
    return model;
  }

  protected override async initialize(): Promise<void> {
    if (this.isInitializing()) {
      return;
    }

    this.initializing = true;
    this.cachedChangeSummary = null;
    try {
      this.historicalXml = await this.bifrost.commands.executeCommand<string>('git.getFileAtRef', [
        this.parentUri,
        this.commitHash,
      ]);
      const currentXml = await this.bifrost.files.load(this.parentUri);

      await this.initializeDiffViewers(currentXml, this.historicalXml!);

      this.readyForInteraction = true;
    } finally {
      this.initializing = false;
    }
  }

  // --- Preview mode ---

  getViewerMode(): 'preview' | 'diff' {
    return this.viewerMode;
  }

  setViewerMode(mode: 'preview' | 'diff'): void {
    this.viewerMode = mode;
    this.onViewerModeChangedHandler?.(mode);
  }

  onViewerModeChanged(callback: (mode: 'preview' | 'diff') => void): void {
    this.onViewerModeChangedHandler = callback;
  }

  async attachPreview(htmlElement: HTMLDivElement): Promise<void> {
    await this.previewViewer.initialize(this.historicalXml!);
    this.previewViewer.attachToHtmlElement(htmlElement);
  }

  // --- Commit metadata ---

  getParentUri(): string {
    return this.parentUri;
  }

  getCommitHash(): string {
    return this.commitHash;
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

  getHistoricalXml(): string | null {
    return this.historicalXml;
  }

  // --- Viewer-mode-aware overrides ---

  override getSelectedElements(): ElementLike[] {
    if (this.viewerMode === 'preview') {
      return this.previewViewer?.getSelection().get() ?? [];
    }
    return super.getSelectedElements();
  }

  override zoomToViewport(): void {
    if (this.viewerMode === 'preview') {
      this.previewViewer?.zoomToViewport();
    } else {
      super.zoomToViewport();
    }
  }

  override setZoom(percentage: number): void {
    if (this.viewerMode === 'preview') {
      this.previewViewer?.setZoom(percentage);
    } else {
      super.setZoom(percentage);
    }
  }

  override async zoomToElements(elementIds: string[]): Promise<void> {
    if (this.viewerMode === 'preview') {
      try {
        return await this.previewViewer?.focusViewOnElements(elementIds);
      } catch (error) {
        if (error.message.match(/(Could not get bounds|Cannot read property)/)) {
          error.message += ` (tried to zoom to elements with IDs '${elementIds.join(', ')}')`;
        }
        throw error;
      }
    }
    return super.zoomToElements(elementIds);
  }
}
