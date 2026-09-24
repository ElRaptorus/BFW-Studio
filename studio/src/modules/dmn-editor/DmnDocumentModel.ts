import type { Bifrost } from '#bifrost/Bifrost';
import type { AbstractSubscription } from '#bifrost/common/AbstractEmitter';
import { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { FileEventType, WatcherDisposable } from '#bifrost/common/FileHandlingService';
import { waitForAcceptance } from '#bifrost/common/WaitingFunctions';
import type { ILoadable } from '#bifrost/contracts/LoaderTypes';
import { EVENT_METADATA_UPDATED } from '#bifrost/contracts/internal/EditorEvents';
import { dmnModelerModuleRegistry } from '#modules/dmn-core/DmnModelerModuleRegistry';
import type { Debugger } from 'debug';
import Debug from 'debug';

import { PLUGIN_DMN_OVERLAY_MANAGER_KEY } from '../../bifrost/electron-renderer/plugin-host/DmnApiBridge';
import DmnModelerComponentAdapter, {
  type DmnView,
  type DmnViewType,
  EVENT_DMN_ADAPTER_LOCATION_CHANGED,
  EVENT_DMN_ADAPTER_SELECTION_CHANGED,
  EVENT_DMN_ADAPTER_VIEW_CHANGED,
  EVENT_DMN_ADAPTER_XML_CHANGED,
} from '../dmn-core/DmnModelerComponentAdapter';
import DmnDocumentElementAccess, { EVENT_DMN_ELEMENT_PROPERTY_UPDATED } from './DmnDocumentElementAccess';
import DmnDocumentSelection, { EVENT_DMN_SELECTION_ELEMENTS_UPDATED } from './DmnDocumentSelection';
import type { DmnPluginOverlayManager } from './DmnPluginOverlayManager';
import DmnValidationOverlayManager from './DmnValidationOverlayManager';

const MERGE_CONFLICT_MARKER_REGEX = /^<{7}\s/m;

const DMN_EMPTY_DOCUMENT = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/"
  xmlns:dmndi="https://www.omg.org/spec/DMN/20191111/DMNDI/"
  xmlns:dc="http://www.omg.org/spec/DMN/20180521/DC/"
  id="Definitions_1"
  name="New DMN Diagram"
  namespace="https://www.omg.org/spec/DMN/20191111/MODEL/">
  <dmndi:DMNDI>
    <dmndi:DMNDiagram id="DMNDiagram_1" />
  </dmndi:DMNDI>
</definitions>`;

export default class DmnDocumentModel extends EditorDocumentModel {
  public xmlLoaded: boolean;
  public readonly elements: DmnDocumentElementAccess;
  public readonly selection: DmnDocumentSelection;
  public readonly validationManager: DmnValidationOverlayManager;

  private xml: string;
  private originalXml: string;
  private currentXmlFromPreviousSession: string | null;
  private restoredMetadata: any;

  private log: Debugger;
  private dmnComponentAdapter: DmnModelerComponentAdapter;
  private studio: Bifrost;
  private watcherDisposable?: WatcherDisposable;

  private subscriptions: AbstractSubscription[] = [];

  private manualSaveTriggered = false;

  private constructor(
    uri: string,
    xmlOnFile: string,
    currentXmlFromPreviousSession: string | null = null,
    restoredMetadataFromPreviousSession: any | null = null,
    studio: Bifrost,
  ) {
    super(uri);

    this.log = Debug(`dmn/${this.constructor.name}(${this.getUri()})`);
    this.log('constructor');
    this.studio = studio;

    this.originalXml = xmlOnFile;
    this.currentXmlFromPreviousSession = currentXmlFromPreviousSession;
    this.xml = currentXmlFromPreviousSession || xmlOnFile || DMN_EMPTY_DOCUMENT;
    this.restoredMetadata = restoredMetadataFromPreviousSession;
    this.xmlLoaded = false;

    this.dmnComponentAdapter = new DmnModelerComponentAdapter(uri, this.studio, dmnModelerModuleRegistry.getAll());
    this.elements = new DmnDocumentElementAccess(this.dmnComponentAdapter);
    this.selection = new DmnDocumentSelection(this.dmnComponentAdapter, this.elements);
    this.validationManager = new DmnValidationOverlayManager(this.dmnComponentAdapter);

    const autoValidateSetting = this.studio.settings.get('dmn.editor.autoValidate', this.getUri());
    this.validationManager.setEnabled(autoValidateSetting !== false);

    this.subscriptions.push(
      this.dmnComponentAdapter.on(EVENT_DMN_ADAPTER_LOCATION_CHANGED, (metadata: any) =>
        this.emit(EVENT_METADATA_UPDATED, [metadata]),
      ),
      this.dmnComponentAdapter.on(EVENT_DMN_ADAPTER_XML_CHANGED, (xml: string) => {
        this.xml = xml;
        this.updateCurrentData(xml);
        this.validationManager.requestValidation();
        this.refreshPluginOverlays();
      }),
      this.dmnComponentAdapter.on(EVENT_DMN_ADAPTER_SELECTION_CHANGED, () => {
        this.refreshPluginOverlays();
      }),
      this.elements.on(EVENT_DMN_ELEMENT_PROPERTY_UPDATED, () => {
        this.validationManager.requestValidation();
      }),
      this.selection.on(EVENT_DMN_SELECTION_ELEMENTS_UPDATED, (selectedElements: any[]) =>
        this.updateMetadata({ selection: selectedElements, hasSelection: selectedElements.length > 0 }),
      ),
      this.dmnComponentAdapter.on(
        EVENT_DMN_ADAPTER_VIEW_CHANGED,
        (viewData: { views: DmnView[]; activeView: DmnView | null }) => {
          this.updateMetadata({
            activeViewType: viewData.activeView?.type ?? null,
            views: viewData.views,
          });
          this.refreshPluginOverlays();
        },
      ),
      this.studio.settings.onDidChange(
        (settingName: string) => {
          if (settingName === 'dmn.editor.showGrid') {
            this.toggleGrid();
          } else if (settingName === 'dmn.editor.showMinimap') {
            this.toggleMinimap();
          } else if (settingName === 'dmn.editor.autoValidate') {
            this.validationManager.setEnabled(
              this.studio.settings.get('dmn.editor.autoValidate', this.getUri()) !== false,
            );
          }
        },
        () => this.getUri(),
      ),
      studio.events.on('pluginDmnOverlayFactoriesChanged', () => {
        this.refreshPluginOverlays();
      }),
    );

    this.onceInteractive(() => {
      this.toggleGrid();
      this.toggleMinimap();
      this.refreshPluginOverlays();
    });

    this.startFileWatcher();
  }

  get currentXml(): string {
    return this.xml;
  }

  get modelerAdapter(): DmnModelerComponentAdapter {
    return this.dmnComponentAdapter;
  }

  getActiveViewType(): DmnViewType | null {
    return this.dmnComponentAdapter.getActiveViewType();
  }

  static async create(
    uri: string,
    restoredCurrentData: any,
    restoredMetadata: any,
    fileLoader: ILoadable,
    studio: Bifrost,
  ): Promise<DmnDocumentModel> {
    const isUnsavedBuffer = uri.startsWith('buffer:');
    let contentOnFile: string;

    if (isUnsavedBuffer) {
      contentOnFile = '';
    } else {
      contentOnFile = await fileLoader.load(uri);
      if (contentOnFile == null || typeof contentOnFile !== 'string') {
        throw new Error(`DmnDocumentModel.create: Error while loading: ${uri}`);
      }
    }

    if (
      (contentOnFile == null || contentOnFile === '') &&
      (restoredCurrentData == null || restoredCurrentData === '')
    ) {
      contentOnFile = DMN_EMPTY_DOCUMENT;
    }

    const hasMergeConflicts = MERGE_CONFLICT_MARKER_REGEX.test(contentOnFile);

    const model = new DmnDocumentModel(uri, contentOnFile, restoredCurrentData, restoredMetadata, studio);

    if (hasMergeConflicts) {
      model.updateMetadata({ mergeConflict: true });
    }

    await model.initialize();

    if (!hasMergeConflicts) {
      await waitForAcceptance(() => model.xmlLoaded, `Could not load DMN XML into component: ${uri}`);
    }

    return model;
  }

  async initialize(): Promise<void> {
    if (MERGE_CONFLICT_MARKER_REGEX.test(this.xml)) {
      this.xmlLoaded = true;
      this.updateMetadata({ isInitialized: true, mergeConflict: true });
      return;
    }

    const loadedXml = await this.dmnComponentAdapter.initialize(this.xml, this.restoredMetadata);
    const notRestoredFromPreviousSession = this.currentXmlFromPreviousSession == null;
    if (notRestoredFromPreviousSession) {
      this.originalXml = loadedXml;
    }

    this.xmlLoaded = true;
    this.updateMetadata({ isInitialized: true });
    this.validationManager.requestValidation();
  }

  onEditorDocumentWillSave(willCloseAfterSave = false): void {
    this.watcherDisposable?.dispose();
    if (!willCloseAfterSave && this.studio.env.isMac) {
      this.manualSaveTriggered = true;
    }
  }

  onEditorDocumentDidSave(willCloseAfterSave = false): void {
    if (willCloseAfterSave) {
      return;
    }
    this.originalXml = this.xml = this.getCurrentData();
    this.updateMetadata({
      errorOnReloadingFile: null,
      fileChangedFromOutside: false,
      fileRenamedFromOutside: null,
      removedFromFileSystem: null,
    });
    this.startFileWatcher();
  }

  onEditorDocumentWillClose(): void {
    this.subscriptions.forEach((subscription) => subscription.dispose());
    this.subscriptions = [];
    this.eventEmitter.removeAllListeners();
    this.watcherDisposable?.dispose();
    this.validationManager?.dispose();
    this.getPluginOverlayManager()?.clearForUri(this.uri);
    this.dmnComponentAdapter?.dispose();
    (this.dmnComponentAdapter as any) = undefined;
  }

  attachToHtmlElement(htmlElementOrQuery: string | HTMLElement): void {
    this.dmnComponentAdapter.attachToHtmlElement(htmlElementOrQuery);
  }

  isReadyForInteraction(): boolean {
    return this.dmnComponentAdapter.isReadyForInteraction();
  }

  onceInteractive(callbackFn: () => void | Promise<void>): void {
    this.dmnComponentAdapter.onceInteractive(callbackFn);
  }

  //#region Canvas

  getZoom(): number {
    return this.dmnComponentAdapter.getZoom();
  }

  zoomToElement(elementId: string): void {
    this.dmnComponentAdapter.zoomToElement(elementId);
  }

  zoomToViewport(): void {
    this.dmnComponentAdapter.zoomToViewport();
  }

  setZoom(percentage: number): void {
    this.dmnComponentAdapter.setZoom(percentage);
  }

  //#endregion Canvas

  //#region Undo / Redo

  canUndo(): boolean {
    return this.dmnComponentAdapter.canUndo();
  }

  canRedo(): boolean {
    return this.dmnComponentAdapter.canRedo();
  }

  undo(): void {
    this.dmnComponentAdapter.undo();
  }

  redo(): void {
    this.dmnComponentAdapter.redo();
  }

  //#endregion Undo / Redo

  onEditorDocumentModelDidRegister(): void {
    this.updateOriginalAndCurrentData(this.originalXml, this.xml);
    this.updateMetadata({ isInitialized: false });
  }

  renameCurrentFile(filename: string): void {
    const newUri = this.studio.files.getUriForFilename(
      this.studio.files.joinPaths(this.studio.files.getContainingDirectory(this.uri), filename),
    );

    this.updateUri(newUri);
    this.updateLabel(filename);
    this.updateMetadata({ fileRenamedFromOutside: null });
  }

  getCurrentFilename(): string {
    return this.studio.files.getFilename(this.uri);
  }

  async restoreMetadataAfterNavigation(partialMetadata: any): Promise<void> {
    await this.waitForInteractivity();
    await this.dmnComponentAdapter.restoreViewboxAfterNavigation(partialMetadata);
  }

  private async waitForInteractivity(): Promise<void> {
    return new Promise((resolve) => {
      this.onceInteractive(() => resolve());
    });
  }

  get showGrid(): boolean {
    return this.studio.settings.get('dmn.editor.showGrid', this.getUri()) !== false;
  }

  private get showMinimap(): boolean {
    return this.studio.settings.get('dmn.editor.showMinimap', this.getUri()) === true;
  }

  private toggleGrid(): void {
    const grid = this.dmnComponentAdapter.getGrid();
    if (grid) {
      grid.toggle(this.showGrid);
    }
  }

  private toggleMinimap(): void {
    const minimap = this.dmnComponentAdapter.getMinimap();
    if (minimap) {
      if (this.showMinimap) {
        minimap.open();
      } else {
        minimap.close();
      }
    }
  }

  private refreshPluginOverlays(): void {
    const overlayManager = this.getPluginOverlayManager();
    if (overlayManager == null) {
      return;
    }

    if (!this.dmnComponentAdapter.isDrdActive()) {
      overlayManager.refresh(this.dmnComponentAdapter, [], this.uri).catch((error) => {
        console.warn('[DmnDocumentModel] Plugin overlay refresh failed:', error);
      });
      return;
    }

    const elementRegistry = this.dmnComponentAdapter.getDrdElementRegistry();
    const elements = this.elements.getAllElements().map((typed) => {
      const registryElement = elementRegistry.get(typed.id) as { parent?: { id?: string } } | undefined;
      return {
        id: typed.id,
        type: typed.type,
        name: typed.name || null,
        parentId: registryElement?.parent?.id ?? null,
        properties: {},
        incoming: [] as string[],
        outgoing: [] as string[],
      };
    });

    overlayManager.refresh(this.dmnComponentAdapter, elements, this.uri).catch((error) => {
      console.warn('[DmnDocumentModel] Plugin overlay refresh failed:', error);
    });
  }

  private getPluginOverlayManager(): DmnPluginOverlayManager | null {
    try {
      return this.studio.getSharedRessource<DmnPluginOverlayManager>(PLUGIN_DMN_OVERLAY_MANAGER_KEY);
    } catch {
      return null;
    }
  }

  private startFileWatcher(): void {
    const isUnsavedBuffer = this.uri.startsWith('buffer:');
    if (isUnsavedBuffer) {
      return;
    }

    this.watcherDisposable = this.studio.files.watchFile(
      this.uri,
      async (eventType: FileEventType, _filename: string) => {
        const editorDocument = this.studio.editors.getEditorDocumentByUri(this.uri);
        const hasErrorOnLoadingFile = editorDocument?.metadata?.errorOnReloadingFile != null;

        const updateDmnModeler = async (xml: string): Promise<void> => {
          try {
            await this.dmnComponentAdapter.setXml(xml);
            this.updateOriginalAndCurrentData(xml, xml);
            this.updateMetadata({ errorOnReloadingFile: null });
          } catch (error) {
            this.updateOriginalAndCurrentData(xml, this.originalXml);
            this.updateMetadata({ errorOnReloadingFile: error });
          }
        };

        const onChange = async () => {
          const newXml = await this.studio.files.load(this.uri);
          const currentData = this.getCurrentData();

          if (hasErrorOnLoadingFile && newXml === currentData) {
            this.updateOriginalAndCurrentData(currentData, currentData);
            this.updateMetadata({ errorOnReloadingFile: null });
            return;
          }

          await updateDmnModeler(newXml);
        };

        const onChangeWithUnsavedChanges = async () => {
          const newXml = await this.studio.files.load(this.uri);
          const isSameContentAsBefore =
            editorDocument?.metadata?.fileChangedFromOutside === true && editorDocument?.data.original === newXml;
          if (isSameContentAsBefore) {
            this.updateMetadata({ fileChangedFromOutside: false });
          } else {
            this.updateMetadata({ fileChangedFromOutside: true });
          }
        };

        if (eventType === 'change') {
          if (!editorDocument?.hasUnsavedChanges || hasErrorOnLoadingFile) {
            if (this.manualSaveTriggered) {
              this.manualSaveTriggered = false;
            } else {
              await onChange();
            }
          } else {
            await onChangeWithUnsavedChanges();
          }
        } else if (eventType === 'unlink') {
          this.updateMetadata({ removedFromFileSystem: true });
          this.updateOriginalAndCurrentData(null, this.getCurrentData());
        } else if (eventType === 'add') {
          await onChange();
          this.updateMetadata({ removedFromFileSystem: false });
        }
      },
    );
  }
}
