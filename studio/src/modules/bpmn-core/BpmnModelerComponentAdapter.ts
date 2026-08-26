import type { Bifrost } from '#bifrost/Bifrost';
import { AbstractEmitter } from '#bifrost/common/AbstractEmitter';
import AddExporter from '@bpmn-io/add-exporter';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import type { Debugger } from 'debug';
import Debug from 'debug';
import gridModule from 'diagram-js-grid';
import minimapModule from 'diagram-js-minimap';
import type CommandStack from 'diagram-js/lib/command/CommandStack';
import type Canvas from 'diagram-js/lib/core/Canvas';
import type { CanvasViewbox } from 'diagram-js/lib/core/Canvas';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type { Event as DjsEvent } from 'diagram-js/lib/core/EventBus';
import type Clipboard from 'diagram-js/lib/features/clipboard/Clipboard';
import type EditorActions from 'diagram-js/lib/features/editor-actions/EditorActions';
import type Modeling from 'diagram-js/lib/features/modeling/Modeling';
import type Overlays from 'diagram-js/lib/features/overlays/Overlays';
import type Selection from 'diagram-js/lib/features/selection/Selection';
import type { ElementLike, Shape } from 'diagram-js/lib/model/Types';
import type { Rect } from 'diagram-js/lib/util/Types';
import type { Injector } from 'didi';

import { CommandHandler } from './bpmn-js/CommandHandler/index';
import ColorContextPadProvider from './bpmn-js/Provider/ColorContextPadProvider';
import CustomPaletteProvider from './bpmn-js/Provider/CustomPaletteProvider';
import CustomPopupProvider from './bpmn-js/Provider/CustomPopupProvider';
import { PluginContextPadProvider } from './bpmn-js/Provider/PluginContextPadProvider';
import { PluginPaletteProvider } from './bpmn-js/Provider/PluginPaletteProvider';
import CustomResizeRule from './bpmn-js/Rules/CustomResizeRule';
import evilPlatformBehaviorsModule from './bpmn-js/behaviors';
import evilPlatformModdleDescriptor from './bpmn-js/moddle/evil-platform.json';
import { createSanitizerModule } from './sanitizer/SanitizerBridge';

const EVIL_NS_CURRENT_URI = 'https://evilengine.dev/schema/bpmn';
const EVIL_NS_LEGACY_URIS = ['https://evil.studio/schema/bpmn/platform/1.0'];

export const EVENT_BPMN_MODELER_ADAPTER_READY_FOR_INTERACTION = 'EVENT_BPMN_ADAPTER_READY_FOR_INTERACTION';
export const EVENT_BPMN_MODELER_ADAPTER_ATTACHED_TO_HTML = 'EVENT_BPMN_ADAPTER_ATTACHED_TO_HTML';

export const EVENT_BPMN_MODELER_ADAPTER_LOCATION_CHANGED = 'EVENT_BPMN_ADAPTER_LOCATION_CHANGED';
export const EVENT_BPMN_MODELER_ADAPTER_ROOT_CHANGED = 'EVENT_BPMN_ADAPTER_ROOT_CHANGED';
export const EVENT_BPMN_MODELER_ADAPTER_SELECTION_CHANGED = 'EVENT_BPMN_ADAPTER_SELECTION_CHANGED';
export const EVENT_BPMN_MODELER_ADAPTER_XML_CHANGED = 'EVENT_BPMN_ADAPTER_XML_CHANGED';
export const EVENT_BPMN_MODELER_ADAPTER_XML_LOADED = 'EVENT_BPMN_ADAPTER_XML_LOADED';

const MODDLE_BPMN_PARTICIPANT_TYPE = 'bpmn:Participant';
const MODDLE_BPMN_PROCESS_SELECTOR = 'processRef';

const DEFAULT_MODELER_OPTIONS = {
  canvas: {
    autoFocus: true,
  },
};

const MERGE_CONFLICT_MARKER_REGEX = /^<{7}\s/m;

export default class BpmnModelerComponentAdapter extends AbstractEmitter {
  private log: Debugger;
  private modeler: BpmnModeler;
  private modelerEventsMap: Record<string, (event: DjsEvent & Record<string, any>) => void> | null = null;
  private readyForInteraction: boolean = false;

  constructor(
    uri: string,
    studio: Bifrost,
    bpmnComponentOptions: Record<string, unknown> = {},
    additionalModules: unknown[] = [],
  ) {
    super();
    this.log = Debug(`bpmn/${this.constructor.name}(${uri})`);

    this.modeler = new BpmnModeler({
      additionalModules: [
        evilPlatformBehaviorsModule,
        CustomResizeRule,
        CustomPaletteProvider,
        CustomPopupProvider,
        ColorContextPadProvider,
        gridModule,
        minimapModule,
        AddExporter,
        createSanitizerModule(studio),
        ...additionalModules,
      ],
      moddleExtensions: {
        evil: evilPlatformModdleDescriptor,
      },
      exporter: {
        name: studio.env.productName,
        version: studio.env.version,
      },
      ...DEFAULT_MODELER_OPTIONS,
      ...bpmnComponentOptions,
    });

    const importDoneCallback = (event: DjsEvent & Record<string, any>) => {
      if (event.warnings) {
        this.log('Warnings found while importing the diagram', event.warnings);
      }

      const commandStack = this.modeler.get('commandStack') as CommandStack & { _handlerMap: Record<string, unknown> };

      this.log('registerCommandHandlers');
      Object.entries(CommandHandler).forEach((handlerEntry) => {
        const handlerKey = handlerEntry[0];
        const handlerFunction = handlerEntry[1];

        if (commandStack._handlerMap[handlerKey] == null) {
          commandStack.registerHandler(handlerKey, handlerFunction as any);
        }
      });

      this.modeler.off('import.done', importDoneCallback);
    };

    this.modeler.on('import.done', importDoneCallback);

    const colorContextPadProvider = this.getColorContextProvider();
    colorContextPadProvider.setStudio(studio);

    PluginPaletteProvider.setStudio(studio);
    PluginContextPadProvider.setStudio(studio);
  }

  async initialize(xml: string, metadata: Record<string, unknown> | null = null): Promise<string> {
    this.once(EVENT_BPMN_MODELER_ADAPTER_READY_FOR_INTERACTION, async () => {
      const rootId = metadata?.currentRootId as string | undefined;
      if (rootId != null) {
        const canvas = this.getCanvas();
        const targetRoot = canvas.findRoot(rootId);
        if (targetRoot != null) {
          canvas.setRootElement(targetRoot);
        }
      }

      if (metadata?.viewbox == null) {
        this.zoomToViewport();
      } else {
        this.getCanvas().viewbox(metadata.viewbox as Rect);
      }

      await this.awaitNextLocationChange();
    });
    this.once(EVENT_BPMN_MODELER_ADAPTER_ATTACHED_TO_HTML, async () => {
      this.initializeEventListeners();
      this.readyForInteraction = true;
      this.emit(EVENT_BPMN_MODELER_ADAPTER_READY_FOR_INTERACTION);
    });

    return this.setXml(xml);
  }

  dispose(): void {
    this.removeEventListeners();

    // Close the context pad before tearing down the modeler.
    // diagram-js schedules ContextPad._updatePosition via setTimeout; if the
    // Canvas is already destroyed when the callback fires it will crash with
    // "Cannot read properties of undefined (reading 'getBoundingClientRect')"
    // because Canvas._destroy deletes its _container reference.
    // Closing the pad first marks it as !isOpen(), so the scheduled callback
    // short-circuits harmlessly.
    try {
      const contextPad = this.modeler.get('contextPad') as { close?: () => void } | undefined;
      contextPad?.close?.();
    } catch {
      // best-effort; may already be torn down
    }

    this.modeler.detach();
    this.modeler.destroy();
  }

  private awaitNextLocationChange(): Promise<void> {
    return new Promise((resolve, _reject) => {
      const resolveCallbackFn = () => {
        this.modeler.off('canvas.viewbox.changed', resolveCallbackFn);

        resolve();
      };
      this.modeler.on('canvas.viewbox.changed', resolveCallbackFn);
    });
  }

  private initializeEventListeners(): void {
    this.log('initializeEventListeners');

    this.modelerEventsMap = {
      'shape.added': (event) => this.onShapeAdded(event),
      'connection.added': () => this.onContentChange(),
      'shape.removed': () => this.onContentChange(),
      'connection.removed': () => this.onContentChange(),
      'element.changed': (event) => this.onElementChanged(event),
      'elements.changed': () => this.onContentChange(),
      'canvas.viewbox.changed': (event) => this.onLocationChange(event),
      'selection.changed': (event) => this.onSelectionChange(event),
      'root.set': (event) => this.onRootChanged(event),
      'contextPad.create': (event) => this.onContextPadCreate(event),
    };

    this.addEventListeners();
  }

  async setXml(currentXml: string): Promise<string> {
    try {
      const normalizedXml = this.migrateNamespaceUris(currentXml);

      const result = await this.modeler.importXML(normalizedXml);
      const { warnings } = result;
      if (warnings.length !== 0) {
        console.warn(warnings);
      }

      return normalizedXml;
    } catch (error) {
      if (MERGE_CONFLICT_MARKER_REGEX.test(currentXml)) {
        throw new Error(
          `ERROR: failed to import xml because of unresolved merge conflicts.\n\nXML given:\n\n${currentXml}`,
          { cause: error },
        );
      }
      throw new Error(
        `ERROR: failed to import xml\n\nError given:\n\n${JSON.stringify(error)}\n\nXML given:\n\n${currentXml}`,
        { cause: error },
      );
    }
  }

  /**
   * Replace legacy evil namespace URIs with the current one so that moddle
   * recognises evil:* extension elements as typed rather than falling back to
   * generic handling (which loses the URI and produces "no namespace uri given
   * for prefix <ns0>" during serialization).
   *
   * Foreign vendor namespaces (camunda, zeebe, flowable, etc.) are left
   * untouched — bpmn-moddle already handles them correctly as generic elements
   * with their original URIs intact.
   */
  private migrateNamespaceUris(xml: string): string {
    let migrated = xml;
    for (const legacyUri of EVIL_NS_LEGACY_URIS) {
      migrated = migrated.replace(`xmlns:evil="${legacyUri}"`, `xmlns:evil="${EVIL_NS_CURRENT_URI}"`);
    }

    if (migrated !== xml) {
      this.log('Migrated legacy evil namespace URI to %s', EVIL_NS_CURRENT_URI);
    }

    return migrated;
  }

  async getXml(): Promise<string> {
    try {
      const { xml } = await this.modeler.saveXML({ format: true });
      return xml!;
    } catch (error) {
      throw new Error(`ERROR: while saving XML for BPMN\n\n${error}`, { cause: error });
    }
  }

  attachToHtmlElement(bpmnHtmlElementOrQuery: string | HTMLElement): void {
    const emitAttachedToHtml = () => {
      const bjsContainer = (this.modeler as any)._container as HTMLDivElement;
      const djsPalette = bjsContainer.querySelector('.djs-palette');
      djsPalette?.classList.add('djs-container');

      if (djsPalette) {
        bjsContainer.insertBefore(djsPalette, bjsContainer.firstChild);
      }

      this.modeler.off('attach', emitAttachedToHtml);
      this.emit(EVENT_BPMN_MODELER_ADAPTER_ATTACHED_TO_HTML);
    };
    this.modeler.on('attach', emitAttachedToHtml);

    this.modeler.attachTo(bpmnHtmlElementOrQuery as HTMLElement);
  }

  isReadyForInteraction(): boolean {
    return this.readyForInteraction;
  }

  /**
   * Run the given `callbackFn` once the modeler is interactive (i.e. has finished initializing, attaching *and* rendering).
   */
  onceInteractive(callbackFn: () => void | Promise<void>): void {
    // This is an really ugly hack
    // we must find a way to delay this by a frame or so
    setTimeout(() => {
      if (this.isReadyForInteraction()) {
        callbackFn();
      } else {
        this.once(EVENT_BPMN_MODELER_ADAPTER_READY_FOR_INTERACTION, () => callbackFn());
      }
    }, 1);
  }

  //#endregion Frontend "this is actually on screen" stuff

  //#region Canvas

  getZoom(): number {
    return this.getCanvas().zoom();
  }

  getSvg(callbackFn: (err: unknown, svg?: string) => void): void {
    this.onceInteractive(async () => {
      try {
        const { svg } = await this.modeler.saveSVG();
        callbackFn(null, svg);
      } catch (error) {
        callbackFn(error);
      }
    });
  }

  zoomToElement(elementId: string): void {
    const canvas = this.getCanvas();
    const viewbox = canvas.viewbox(false as any) as CanvasViewbox;
    const elementRegistry = this.getElementRegistry();
    const element = elementRegistry.get(elementId);

    const isDefinitionOrOtherInvisibleBpmnElement = element == null;

    if (isDefinitionOrOtherInvisibleBpmnElement) {
      return this.zoomToViewport();
    }

    const rect = this.getBounds(element);
    const newViewbox = {
      x: rect.x + rect.width / 2 - viewbox.outer.width / 2,
      y: rect.y + rect.height / 2 - viewbox.outer.height / 2,
      width: viewbox.outer.width,
      height: viewbox.outer.height,
    };

    canvas.viewbox(newViewbox);
    canvas.zoom(1);
  }

  private getBounds(element: ElementLike, abort: boolean = false): Rect {
    const elements = [element];
    let minX: number | null = null;
    let minY: number | null = null;
    let maxX: number | null = null;
    let maxY: number | null = null;
    abort = !!abort;

    elements.forEach((element: ElementLike) => {
      let bbox: { x: number; y: number; width?: number; height?: number } = element as Shape;
      if (element.waypoints && !abort) {
        bbox = this.getBounds(element.waypoints[0] as ElementLike, true);
      }

      const x = bbox.x,
        y = bbox.y,
        height = bbox.height || 0,
        width = bbox.width || 0;

      if (minX == null || x < minX) {
        minX = x;
      }
      if (minY == null || y < minY) {
        minY = y;
      }

      if (maxX == null || x + width > maxX) {
        maxX = x + width;
      }
      if (maxY == null || y + height > maxY) {
        maxY = y + height;
      }
    });

    if (minX == null || maxX == null || minY == null || maxY == null) {
      throw new Error('Could not get bounds');
    }

    return {
      x: minX,
      y: minY,
      height: maxY - minY,
      width: maxX - minX,
    };
  }

  zoomToViewport(): void {
    const ZOOM_CORRECTION = 0.9; // zoom out to ensure white-space padding around diagram
    const PADDING_CORRECTION = 36; // width of tools in pixels

    const canvas = this.getCanvas();
    const viewbox = canvas.viewbox(false as any) as CanvasViewbox;

    if (viewbox.outer.width === 0 || viewbox.outer.height === 0) {
      return;
    }

    const newScale =
      Math.min(1, viewbox.outer.width / viewbox.inner.width, viewbox.outer.height / viewbox.inner.height) *
      ZOOM_CORRECTION;

    const newViewbox = {
      x: viewbox.inner.x + viewbox.inner.width / 2 - viewbox.outer.width / newScale / 2 - PADDING_CORRECTION,
      y: viewbox.inner.y + viewbox.inner.height / 2 - viewbox.outer.height / newScale / 2,
      width: viewbox.outer.width / newScale + PADDING_CORRECTION,
      height: viewbox.outer.height / newScale,
    };

    canvas.viewbox(newViewbox);
  }

  setZoom(percentage: number): void {
    const PADDING_CORRECTION = 36; // width of tools in pixels

    const canvas = this.getCanvas();
    const viewbox = canvas.viewbox(false as any) as CanvasViewbox;

    if (viewbox.outer.width === 0 || viewbox.outer.height === 0) {
      return;
    }

    const center = {
      x: viewbox.outer.width / 2 + PADDING_CORRECTION * 4,
      y: viewbox.outer.height / 2,
    };

    this.getCanvas().zoom(percentage, center);
  }

  //#endregion Canvas

  //#region Internal Event Handlers

  onShapeAdded(event: DjsEvent & Record<string, any>): void {
    if (event.element.type === MODDLE_BPMN_PARTICIPANT_TYPE && event.element.businessObject.processRef !== undefined) {
      const processRef = event.element.businessObject.get(MODDLE_BPMN_PROCESS_SELECTOR);

      processRef.isExecutable = true;
    }

    this.onContentChange();
  }

  onElementChanged(event: DjsEvent & Record<string, any>): void {
    if (event.element.type === MODDLE_BPMN_PARTICIPANT_TYPE && event.element.businessObject.processRef !== undefined) {
      const processRef = event.element.businessObject.get(MODDLE_BPMN_PROCESS_SELECTOR);

      processRef.name = event.element.businessObject.name;
    }

    this.onContentChange();
  }

  onContentChange(): void {
    this.getXml()
      .then((xml: string) => {
        this.emit(EVENT_BPMN_MODELER_ADAPTER_XML_CHANGED, [xml]);
      })
      .catch((error) => {
        console.error('[BpmnModelerComponentAdapter] XML serialization failed — edits will not be saved:', error);
      });
  }

  onLocationChange(_event: DjsEvent & Record<string, any>): void {
    const viewbox = this.getCanvas().viewbox(false as any) as CanvasViewbox;
    const viewboxCopy = this.deepCopy(viewbox);

    this.log('onLocationChange', 'viewbox:', viewboxCopy);

    this.log('onLocationChange.emitEvents');

    this.emit(EVENT_BPMN_MODELER_ADAPTER_LOCATION_CHANGED, [{ viewbox: viewboxCopy, zoom: this.getZoom() }]);
  }

  onSelectionChange(event: DjsEvent & Record<string, any>): void {
    this.emit(EVENT_BPMN_MODELER_ADAPTER_SELECTION_CHANGED, [event.newSelection]);
  }

  onRootChanged(event: DjsEvent & Record<string, any>): void {
    this.emit(EVENT_BPMN_MODELER_ADAPTER_ROOT_CHANGED, [event.element]);
  }

  onContextPadCreate(event: DjsEvent & Record<string, any>): void {
    if (event.target.type !== MODDLE_BPMN_PARTICIPANT_TYPE) {
      return;
    }
  }

  //#endregion Internal Event Handlers

  //#region Event Listener handling

  private addEventListeners(): void {
    if (this.modelerEventsMap == null) {
      return;
    }

    this.log('addEventListeners', Date.now());

    for (const eventName of Object.keys(this.modelerEventsMap)) {
      this.modeler.on(eventName, this.modelerEventsMap[eventName]);
    }
  }

  private removeEventListeners(): void {
    if (this.modelerEventsMap == null) {
      return;
    }

    this.log('removeEventListeners', Date.now());

    for (const eventName of Object.keys(this.modelerEventsMap)) {
      this.modeler.off(eventName, this.modelerEventsMap[eventName]);
    }
  }

  async pauseListeners(callbackFn: () => void | Promise<void>): Promise<void> {
    this.removeEventListeners();
    await callbackFn();
    this.addEventListeners();
  }

  async restoreViewboxAfterNavigation(partialMetadata: Record<string, any> | null): Promise<void> {
    const canvas = this.getCanvas();

    const rootId = partialMetadata?.currentRootId;
    if (rootId != null) {
      const targetRoot = canvas.findRoot(rootId);
      if (targetRoot != null) {
        canvas.setRootElement(targetRoot);
      }
    }

    const viewbox = partialMetadata?.viewbox;
    if (viewbox == null) {
      return;
    }

    canvas.viewbox(viewbox as Rect);
  }

  //#endregion Event Listener handling

  private deepCopy<T>(obj: T): T {
    return structuredClone(obj);
  }

  canUndo(): boolean {
    return this.getCommandStack().canUndo();
  }

  canRedo(): boolean {
    return this.getCommandStack().canRedo();
  }

  undo(): void {
    this.getCommandStack().undo();
  }

  redo(): void {
    this.getCommandStack().redo();
  }

  moveSelectedElements(direction: string, accelerated: boolean = false): void {
    this.getEditorActions().trigger('moveSelection', { direction, accelerated });
  }

  alignSelectedElements(direction: string): void {
    this.getEditorActions().trigger('alignElements', { type: direction });
  }

  distributeSelectedElements(direction: string): void {
    this.getEditorActions().trigger('distributeElements', { type: direction });
  }

  deleteSelectedElements(): void {
    this.getEditorActions().trigger('removeSelection', {});
  }

  copySelectedElements(): string | null {
    this.getEditorActions().trigger('copy', {});
    const clipboardContent = this.getClipboard().get();

    if (clipboardContent == null) {
      return null;
    }

    return JSON.stringify(clipboardContent);
  }

  pasteElements(rawClipboardContent?: string): void {
    if (rawClipboardContent == null || rawClipboardContent?.trim() === '') {
      return;
    }

    const clipboardContent = JSON.parse(rawClipboardContent, this.getPasteObjectReviver(this.getModdle()));
    this.getClipboard().set(clipboardContent);
    const elements = this.getElementRegistry().getAll();
    const rootElement = elements[0];
    this.getSelection().select(rootElement);
    this.getEditorActions().trigger('paste', {});
  }

  //
  // Private getters for modeler dependencies
  //

  getModelerComponentByName<TComponent>(name: string): TComponent {
    return this.modeler.get(name) as TComponent;
  }

  getEditorActions(): EditorActions {
    return this.modeler.get('editorActions') as EditorActions;
  }

  getOverlays(): Overlays {
    return this.modeler.get('overlays') as Overlays;
  }

  getGrid(): any {
    return this.modeler.get('grid');
  }

  // bpmn-moddle has no TypeScript declarations
  getModdle(): any {
    return this.modeler.get('moddle');
  }

  getElementRegistry(): ElementRegistry {
    return this.modeler.get('elementRegistry') as ElementRegistry;
  }

  getCanvas(): Canvas {
    return this.modeler.get('canvas') as Canvas;
  }

  getSelection(): Selection {
    return this.modeler.get('selection') as Selection;
  }

  getModeling(): Modeling {
    return this.modeler.get('modeling') as Modeling;
  }

  getCommandStack(): CommandStack {
    return this.modeler.get('commandStack') as CommandStack;
  }

  getBpmnFactory(): any {
    return this.modeler.get('bpmnFactory');
  }

  getClipboard(): Clipboard {
    return this.modeler.get('clipboard') as Clipboard;
  }

  getModeler(): BpmnModeler {
    return this.modeler;
  }

  getInjector(): Injector {
    return this.modeler.get('injector') as unknown as Injector;
  }

  getColorContextProvider(): any {
    const injector = this.getInjector();

    return injector.get('colorContextPadProvider');
  }

  private getPasteObjectReviver(moddle: any): any {
    return (_key: string, object: any) => {
      if (object != null && typeof object === 'object' && typeof object.$type === 'string') {
        const type = object.$type;
        const properties = Object.assign({}, object);

        delete properties.$type;

        const newElement = moddle.create(type, properties);

        return newElement;
      }

      return object;
    };
  }
}
