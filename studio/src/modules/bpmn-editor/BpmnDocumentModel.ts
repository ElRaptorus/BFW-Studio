import { bpmnModelerModuleRegistry } from '#modules/bpmn-core/BpmnModelerModuleRegistry';
import { DataObjectDetailLevel, showAllDataObjectDetails } from '#modules/bpmn-core/DataObjectDetailsSettings';
import type { Overlay } from '#modules/bpmn-core/overlays/BpmnElementOverlayManager';
import BpmnElementOverlayManager from '#modules/bpmn-core/overlays/BpmnElementOverlayManager';
import type { Debugger } from 'debug';
import Debug from 'debug';

import type { AbstractSubscription, BpmnElement, ILoadable, Studio } from '@evil/bifrost_fw_sdk';
import { EditorDocumentModel, waitForAcceptance } from '@evil/bifrost_fw_sdk';
import type { FileEventType, WatcherDisposable } from '@evil/bifrost_fw_sdk/types/common';

import {
  EVENT_FRAGMENT_ID_UPDATED,
  EVENT_METADATA_UPDATED,
} from '../../../../studio-sdk/src/contracts/internal/EditorEvents';
import { PLUGIN_OVERLAY_STORE_KEY } from '../../bifrost/electron-renderer/plugin-host/BpmnApiBridge';
import type { PluginOverlayStore } from '../../bifrost/electron-renderer/plugin-host/PluginOverlayStore';
import BpmnModelerComponentAdapter, {
  EVENT_BPMN_MODELER_ADAPTER_LOCATION_CHANGED,
  EVENT_BPMN_MODELER_ADAPTER_ROOT_CHANGED,
  EVENT_BPMN_MODELER_ADAPTER_XML_CHANGED,
} from '../bpmn-core/BpmnModelerComponentAdapter';
import BpmnDocumentElementAccess, { EVENT_BPMN_ELEMENT_ID_UPDATED } from './BpmnDocumentElementAccess';
import BpmnDocumentSelection, { EVENT_BPMN_SELECTION_ELEMENTS_UPDATED } from './BpmnDocumentSelection';
import { createFlowNodeOverlays } from './OverlayFactory';

export const EVENT_BPMN_PROPERTY_UPDATED = 'EVENT_BPMN_PROPERTY_UPDATED';

const ELEMENTS_WITHOUT_OVERLAY_SUPPORT = [
  'SequenceFlow',
  'MessageFlow',
  'Association',
  'DataInputAssociation',
  'DataOutputAssociation',
  'Label',
  'Lane',
  'LaneSet',
  'Group',
  'TextAnnotation',
  'uncasted<label>',
];

type BpmnElementObject = any;

/**
 * Represents a BPMN document in the editor.
 */
export default class BpmnDocumentModel extends EditorDocumentModel {
  public elements: BpmnDocumentElementAccess;
  public selection: BpmnDocumentSelection;
  public overlays: BpmnElementOverlayManager;
  public xmlLoaded: boolean;

  private xml: string;
  private originalXml: string;
  private currentXmlFromPreviousSession: string | null;
  private restoredMetadata: any;

  private log: Debugger;
  private bpmnComponentAdapter: BpmnModelerComponentAdapter;
  private studio: Studio;
  private watcherDisposable?: WatcherDisposable;

  private subscriptions: AbstractSubscription[] = [];

  private manualSaveTriggered = false;
  private pluginOverlayDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private lastPluginOverlaySnapshot: Overlay[] | null = null;

  private constructor(
    uri: string,
    xmlOnFile: string,
    currentXmlFromPreviousSession: string | null = null,
    restoredMetadataFromPreviousSession: any | null = null,
    newUniqueXml: string,
    studio: Studio,
  ) {
    super(uri);

    this.log = Debug(`bpmn/${this.constructor.name}(${this.getUri()})`);
    this.log('constructor');
    this.studio = studio;

    this.originalXml = xmlOnFile;
    this.currentXmlFromPreviousSession = currentXmlFromPreviousSession;
    this.xml = currentXmlFromPreviousSession || xmlOnFile || newUniqueXml;
    this.restoredMetadata = restoredMetadataFromPreviousSession;
    this.xmlLoaded = false;

    const bpmnComponentOptions = {
      bpmnRenderer: {
        defaultFillColor: 'var(--color-bpmn-defaultFillColor)',
        defaultStrokeColor: 'var(--color-bpmn-defaultStrokeColor)',
      },
    };

    this.bpmnComponentAdapter = new BpmnModelerComponentAdapter(
      uri,
      this.studio,
      bpmnComponentOptions,
      bpmnModelerModuleRegistry.getAll(),
    );
    this.elements = new BpmnDocumentElementAccess(this.bpmnComponentAdapter);
    this.selection = new BpmnDocumentSelection(this.bpmnComponentAdapter, this.elements);

    this.subscriptions.push(
      this.bpmnComponentAdapter.on(EVENT_BPMN_MODELER_ADAPTER_LOCATION_CHANGED, (metadata: any) => {
        const currentRootId = this.bpmnComponentAdapter.getCanvas().getRootElement()?.id ?? null;
        this.emit(EVENT_METADATA_UPDATED, [{ ...metadata, currentRootId }]);
      }),
      this.bpmnComponentAdapter.on(EVENT_BPMN_MODELER_ADAPTER_ROOT_CHANGED, () => {
        this.refreshOverlays();
        const currentRootId = this.bpmnComponentAdapter.getCanvas().getRootElement()?.id ?? null;
        this.updateMetadata({ currentRootId });
      }),
      this.bpmnComponentAdapter.on(EVENT_BPMN_MODELER_ADAPTER_XML_CHANGED, (xml: string) => {
        // `currentXml` reads `this.xml`; `updateCurrentData` only updates base `currentData`.
        this.xml = xml;
        this.updateCurrentData(xml);
      }),
      this.elements.on(EVENT_BPMN_ELEMENT_ID_UPDATED, (oldPropertyValue: string, newElementId: string) => {
        this.emit(EVENT_FRAGMENT_ID_UPDATED, [this.uri, oldPropertyValue, newElementId]);
        this.selection.updateSelectionIfIsCurrentlySelected(oldPropertyValue, newElementId);
      }),
      this.selection.on(EVENT_BPMN_SELECTION_ELEMENTS_UPDATED, (selectedElements: BpmnElementObject[]) =>
        this.updateMetadata({ selection: selectedElements, hasSelection: selectedElements.length > 0 }),
      ),
      studio.events.on('settingsUpdate', (settingName, value) => {
        if (settingName === 'bpmn.editor.showUnsupportedElements') {
          this.bpmnComponentAdapter.setShowUnsupportedElements(value);
        } else if (settingName === 'bpmn.editor.showGrid') {
          this.toggleGrid();
        } else if (
          settingName === 'bpmn.editor.showDocumentationMarker' ||
          settingName === 'bpmn.editor.showMultipleOutgoingSequenceFlowsMarkers'
        ) {
          this.refreshOverlays();
        } else if (settingName === 'bpmn.editor.dataObjectDetailLevel') {
          this.toggleDataObjectElementsVisibilityIfNecessary();
          this.refreshOverlays();
        }
      }),
      studio.events.on('pluginOverlayFactoriesChanged', () => {
        this.refreshOverlays();
      }),
      this.on('EVENT_DATA_UPDATED', () => {
        this.toggleDataObjectElementsVisibilityIfNecessary();
        this.refreshOverlays();
      }),
    );

    this.overlays = new BpmnElementOverlayManager(this.bpmnComponentAdapter);
    this.onceInteractive(() => {
      this.restoreMetadata(this.restoredMetadata);
      this.bpmnComponentAdapter.setShowUnsupportedElements(studio.settings.get('bpmn.editor.showUnsupportedElements'));

      this.toggleGrid();
      this.toggleDataObjectElementsVisibilityIfNecessary();

      if (this.showDocumentationMarker || this.showMultipleOutgoingSequenceFlowsMarkers) {
        this.refreshOverlays();
      }
    });

    this.startFileWatcher();
  }

  get currentXml(): string {
    return this.xml;
  }

  get dataObjectDetailLevel(): string {
    return this.studio.settings.get('bpmn.editor.dataObjectDetailLevel');
  }

  get modelerAdapter(): BpmnModelerComponentAdapter {
    return this.bpmnComponentAdapter;
  }

  get showDocumentationMarker(): boolean {
    return this.studio.settings.get('bpmn.editor.showDocumentationMarker');
  }

  get showGrid(): boolean {
    return this.studio.settings.get('bpmn.editor.showGrid');
  }

  get showMultipleOutgoingSequenceFlowsMarkers(): boolean {
    return this.studio.settings.get('bpmn.editor.showMultipleOutgoingSequenceFlowsMarkers');
  }

  static async create(
    uri: string,
    restoredCurrentData: any,
    restoredMetadata: any,
    fileLoader: ILoadable,
    studio: Studio,
  ): Promise<BpmnDocumentModel> {
    // TODO: this is bad, we should not couple this this tightly
    const isUnsavedBuffer = uri.startsWith('buffer:');
    let contentOnFile;

    if (isUnsavedBuffer) {
      contentOnFile = '';
    } else {
      contentOnFile = await fileLoader.load(uri);
      if (contentOnFile == null || typeof contentOnFile !== 'string') {
        throw new Error(`BpmnDocumentModel.create: Error while loading: ${uri}`);
      }
    }

    let newUniqueXml;
    if (
      (contentOnFile == null || contentOnFile === '') &&
      (restoredCurrentData == null || restoredCurrentData === '')
    ) {
      newUniqueXml = await studio.commands.executeCommand('bpmn.diagram.getNewUniqueXml');
    }

    const model = new BpmnDocumentModel(
      uri,
      contentOnFile,
      restoredCurrentData,
      restoredMetadata,
      newUniqueXml,
      studio,
    );
    await model.initialize();

    await waitForAcceptance(() => model.xmlLoaded, `Could not load XML into component: ${uri}`);

    return model;
  }

  async initialize(): Promise<void> {
    const loadedXml = await this.bpmnComponentAdapter.initialize(this.xml, this.restoredMetadata);
    const notRestoredFromPreviousSession = this.currentXmlFromPreviousSession == null;
    if (notRestoredFromPreviousSession) {
      // the BPMN component fixes the XML, resulting in an "unsaved changes" state for the editor document
      this.originalXml = loadedXml;
    }

    this.xmlLoaded = true;

    this.updateMetadata({ isInitialized: true });
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

    try {
      const eventBus = this.bpmnComponentAdapter?.getModelerComponentByName<{ fire(event: string): void }>('eventBus');
      eventBus?.fire('document.saved');
    } catch {
      // Modeler may have been disposed
    }
  }

  onEditorDocumentWillClose(): void {
    this.subscriptions.forEach((subsription) => subsription.dispose());
    this.subscriptions = [];
    this.eventEmitter.removeAllListeners();
    this.watcherDisposable?.dispose();
    if (this.pluginOverlayDebounceTimer != null) {
      clearTimeout(this.pluginOverlayDebounceTimer);
      this.pluginOverlayDebounceTimer = null;
    }
    this.lastPluginOverlaySnapshot = null;
    this.overlays?.dispose();
    this.bpmnComponentAdapter?.dispose();
    (this.overlays as any) = undefined;
    (this.bpmnComponentAdapter as any) = undefined;
  }

  //#region Frontend "this is actually on screen" stuff

  attachToHtmlElement(bpmnHtmlElementOrQuery: string | HTMLElement): void {
    this.bpmnComponentAdapter.attachToHtmlElement(bpmnHtmlElementOrQuery);
  }

  isReadyForInteraction(): boolean {
    return this.bpmnComponentAdapter.isReadyForInteraction();
  }

  /**
   * Run the given `callbackFn` once the modeler is interactive (i.e. has finished initializing, attaching *and* rendering).
   */
  onceInteractive(callbackFn: () => void | Promise<void>): void {
    this.bpmnComponentAdapter.onceInteractive(callbackFn);
  }

  //#endregion Frontend "this is actually on screen" stuff

  //#region Canvas

  getZoom(): number {
    return this.bpmnComponentAdapter.getZoom();
  }

  getSvg(callbackFn: (err: unknown, svg?: string) => void): void {
    // this.onceInteractive(() => this.modeler.saveSVG((err: any, svg: string) => callbackFn(err, svg)));
    throw new Error('not implemented yet');
  }

  zoomToElement(elementId: string): void {
    try {
      this.bpmnComponentAdapter.zoomToElement(elementId);
    } catch (error) {
      if (error.message.match(/(Could not get bounds|Cannot read property)/)) {
        error.message += ` (tried to zoom to element with ID '${elementId}')`;
      }
      throw error;
    }
  }

  zoomToViewport(): void {
    this.bpmnComponentAdapter.zoomToViewport();
  }

  setZoom(percentage: number): void {
    this.bpmnComponentAdapter.setZoom(percentage);
  }

  //#endregion Canvas

  //#region EditorDocumentModel Lifecycle Event Handlers

  canUndo(): boolean {
    return this.bpmnComponentAdapter.canUndo();
  }

  canRedo(): boolean {
    return this.bpmnComponentAdapter.canRedo();
  }

  undo(): void {
    this.bpmnComponentAdapter.undo();
  }

  redo(): void {
    this.bpmnComponentAdapter.redo();
  }

  deleteSelectedElements(): void {
    this.bpmnComponentAdapter.deleteSelectedElements();
  }

  copySelectedElements(): string | null {
    return this.bpmnComponentAdapter.copySelectedElements();
  }

  pasteElements(clipboardContent?: string): void {
    this.bpmnComponentAdapter.pasteElements(clipboardContent);
  }

  moveSelectedElements(direction: string, accelerated: boolean = false): void {
    this.bpmnComponentAdapter.moveSelectedElements(direction, accelerated);
  }

  alignSelectedElements(direction: string): void {
    this.bpmnComponentAdapter.alignSelectedElements(direction);
  }

  distributeSelectedElements(direction: string): void {
    this.bpmnComponentAdapter.distributeSelectedElements(direction);
  }

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

  //#endregion EditorDocumentModel Lifecycle Event Handlers

  UNSAFE_getSelectionFromModeler(): any {
    return this.bpmnComponentAdapter.getSelection()['_selectedElements'];
  }

  UNSAFE_getBusinessObjectFromModeler(elementId: string): any {
    const element = this.bpmnComponentAdapter.getElementRegistry().get(elementId);

    return element?.businessObject;
  }

  private restoreMetadata(metadata: any): void {
    if (metadata?.selection != null) {
      const elementIds = metadata?.selection.map((element: BpmnElementObject) => element.id);

      this.selection.selectElements(elementIds);

      this.updateMetadata(metadata);
    }
  }

  async restoreMetadataAfterNavigation(partialMetadata: any): Promise<void> {
    await this.waitForInteractivity();

    await this.restoreViewBoxAfterNavigation(partialMetadata);
    await this.restoreSelectionAfterNavigation(partialMetadata);
  }

  private async waitForInteractivity(): Promise<void> {
    return new Promise((resolve) => {
      this.onceInteractive(() => resolve());
    });
  }

  private toggleGrid(): void {
    this.bpmnComponentAdapter.getGrid().toggle(this.showGrid);
  }

  private toggleDataObjectElementsVisibilityIfNecessary(): void {
    const hideReadingAssociations = !showAllDataObjectDetails(this.dataObjectDetailLevel);
    const hideWritingAssociations =
      this.dataObjectDetailLevel === DataObjectDetailLevel.hideAllAssociations ||
      this.dataObjectDetailLevel === DataObjectDetailLevel.hideAll;
    const hideDataObjects = this.dataObjectDetailLevel === DataObjectDetailLevel.hideAll;

    const dataObjectElementTags = [
      'bpmn:DataObjectReference',
      'bpmn:DataInputAssociation',
      'bpmn:DataOutputAssociation',
    ];

    const setElementDisplayStyle = (element: any, newVisibility: 'none' | 'block'): void => {
      const elementIsHidden =
        this.bpmnComponentAdapter.getElementRegistry().getGraphics(element).style.display === 'none';

      const setAssociationVisibility = () => {
        // These types of associations connect to Text Annotations.
        element.outgoing
          ?.filter((association) => association.type === 'bpmn:Association')
          .forEach((association) => {
            this.bpmnComponentAdapter.getElementRegistry().getGraphics(association).style.display = newVisibility;
            this.bpmnComponentAdapter.getElementRegistry().getGraphics(association.target).style.display =
              newVisibility;
          });
      };

      if (elementIsHidden && newVisibility === 'none') {
        setAssociationVisibility();

        return;
      } else if (!elementIsHidden && newVisibility === 'block') {
        return;
      }

      this.bpmnComponentAdapter.getElementRegistry().getGraphics(element).style.display = newVisibility;
      element.labels?.forEach((label) => {
        this.bpmnComponentAdapter.getElementRegistry().getGraphics(label).style.display = newVisibility;
      });

      setAssociationVisibility();
    };

    this.bpmnComponentAdapter.onceInteractive(() => {
      this.bpmnComponentAdapter
        .getElementRegistry()
        .filter((element) => dataObjectElementTags.includes(element.type))
        .forEach((element) => {
          const hideElement =
            (element.type === 'bpmn:DataObjectReference' && hideDataObjects) ||
            (element.type === 'bpmn:DataOutputAssociation' && hideWritingAssociations) ||
            (element.type === 'bpmn:DataInputAssociation' && hideReadingAssociations);

          if (hideElement) {
            setElementDisplayStyle(element, 'none');
          } else {
            setElementDisplayStyle(element, 'block');
          }
        });
    });
  }

  private refreshOverlays(): void {
    this.bpmnComponentAdapter.onceInteractive(() => {
      const internalOverlays: Overlay[] = [];

      const elementsWithoutOverlays = [...ELEMENTS_WITHOUT_OVERLAY_SUPPORT];

      const hideDataObjects = this.dataObjectDetailLevel === DataObjectDetailLevel.hideAll;
      if (hideDataObjects) {
        elementsWithoutOverlays.push('DataObjectReference', 'DataObject');
      }

      const elementsWithOverlaySupport = this.elements
        .getVisibleElements()
        .filter((element) => !elementsWithoutOverlays.includes(element.type));

      for (const element of elementsWithOverlaySupport) {
        internalOverlays.push(...createFlowNodeOverlays(element, this.studio, this));
      }

      const pluginOverlayStore = this.getPluginOverlayStore();
      if (pluginOverlayStore == null || !pluginOverlayStore.hasFactories()) {
        this.lastPluginOverlaySnapshot = null;
        this.overlays.updateAll(internalOverlays);
        return;
      }

      if (this.lastPluginOverlaySnapshot != null) {
        this.overlays.updateAll(this.lastPluginOverlaySnapshot);
      } else {
        this.overlays.updateAll(internalOverlays);
      }

      this.schedulePluginOverlayResolution(elementsWithOverlaySupport, internalOverlays, pluginOverlayStore);
    });
  }

  private schedulePluginOverlayResolution(
    elementsWithOverlaySupport: BpmnElement[],
    internalOverlays: Overlay[],
    pluginOverlayStore: PluginOverlayStore,
  ): void {
    if (this.pluginOverlayDebounceTimer != null) {
      clearTimeout(this.pluginOverlayDebounceTimer);
    }

    this.pluginOverlayDebounceTimer = setTimeout(() => {
      this.pluginOverlayDebounceTimer = null;
      pluginOverlayStore
        .resolveWithOverlays(elementsWithOverlaySupport, this.uri, internalOverlays)
        .then((finalOverlays) => {
          this.lastPluginOverlaySnapshot = finalOverlays;
          this.overlays.updateAll(finalOverlays);
        })
        .catch((error) => {
          console.warn('[BpmnDocumentModel] Plugin overlay resolution failed:', error);
          this.lastPluginOverlaySnapshot = null;
          this.overlays.updateAll(internalOverlays);
        });
    }, 100);
  }

  private getPluginOverlayStore(): PluginOverlayStore | null {
    try {
      return this.studio.getSharedRessource<PluginOverlayStore>(PLUGIN_OVERLAY_STORE_KEY);
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
      async (eventType: FileEventType, filename: string) => {
        const editorDocument = this.studio.editors.getEditorDocumentByUri(this.uri);
        const hasErrorOnLoadingFile = editorDocument?.metadata?.errorOnReloadingFile != null;

        const updateBpmnModeler = async (xml: string): Promise<void> => {
          await this.bpmnComponentAdapter.pauseListeners(async () => {
            try {
              await this.bpmnComponentAdapter.setXml(xml);
              this.updateOriginalAndCurrentData(xml, xml);
              this.updateMetadata({ errorOnReloadingFile: null });
            } catch (error) {
              this.updateOriginalAndCurrentData(xml, this.originalXml);
              this.updateMetadata({ errorOnReloadingFile: error });
            }
          });
        };

        const onChange = async () => {
          const newXml = await this.studio.files.load(this.uri);

          const currentData = this.getCurrentData();

          if (hasErrorOnLoadingFile && newXml === currentData) {
            this.updateOriginalAndCurrentData(currentData, currentData);
            this.updateMetadata({ errorOnReloadingFile: null });
            return;
          }

          await updateBpmnModeler(newXml);
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
            // On macOS the "change" event is fired a lot later than on other systems, leading to the 'change' event also being triggered on manual saves.
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

  private async restoreViewBoxAfterNavigation(partialMetadata: any): Promise<void> {
    if (partialMetadata?.viewbox == null && partialMetadata?.currentRootId == null) {
      return;
    }

    this.log('restoreViewBoxAfterNavigation start');

    await this.bpmnComponentAdapter.restoreViewboxAfterNavigation(partialMetadata);

    this.log('restoreViewBoxAfterNavigation end');
  }

  private async restoreSelectionAfterNavigation(partialMetadata: any): Promise<void> {
    const selection = partialMetadata?.selection;
    if (selection == null) {
      return;
    }

    const elementIds = selection.map((element: BpmnElementObject) => element.id);

    this.selection.selectElements(elementIds);
  }
}
