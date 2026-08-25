import type { Debugger } from 'debug';
import Debug from 'debug';
import gridModule from 'diagram-js-grid';
import minimapModule from 'diagram-js-minimap';
import type CommandStack from 'diagram-js/lib/command/CommandStack';
import type Canvas from 'diagram-js/lib/core/Canvas';
import type { CanvasViewbox } from 'diagram-js/lib/core/Canvas';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type Overlays from 'diagram-js/lib/features/overlays/Overlays';
import type Selection from 'diagram-js/lib/features/selection/Selection';
import type { Rect } from 'diagram-js/lib/util/Types';

import type { Studio } from '@evil/bifrost_fw_sdk';
import { AbstractEmitter } from '@evil/bifrost_fw_sdk';

import { DmnCommandHandler } from './dmn-js/CommandHandler/index';
import { PluginDmnContextPadProvider } from './dmn-js/Provider/PluginDmnContextPadProvider';
import { PluginDmnPaletteProvider } from './dmn-js/Provider/PluginDmnPaletteProvider';
import { type DmnSanitizerBridgeApi, createDmnSanitizerModule } from './sanitizer/SanitizerBridge';

export const EVENT_DMN_ADAPTER_READY_FOR_INTERACTION = 'EVENT_DMN_ADAPTER_READY_FOR_INTERACTION';
export const EVENT_DMN_ADAPTER_ATTACHED_TO_HTML = 'EVENT_DMN_ADAPTER_ATTACHED_TO_HTML';
export const EVENT_DMN_ADAPTER_LOCATION_CHANGED = 'EVENT_DMN_ADAPTER_LOCATION_CHANGED';
export const EVENT_DMN_ADAPTER_SELECTION_CHANGED = 'EVENT_DMN_ADAPTER_SELECTION_CHANGED';
export const EVENT_DMN_ADAPTER_XML_CHANGED = 'EVENT_DMN_ADAPTER_XML_CHANGED';
export const EVENT_DMN_ADAPTER_XML_LOADED = 'EVENT_DMN_ADAPTER_XML_LOADED';
export const EVENT_DMN_ADAPTER_VIEW_CHANGED = 'EVENT_DMN_ADAPTER_VIEW_CHANGED';

export type DmnViewType = 'drd' | 'decisionTable' | 'literalExpression' | 'boxedExpression';

export type DmnView = {
  element: any;
  id: string;
  name: string;
  type: DmnViewType;
};

const MERGE_CONFLICT_MARKER_REGEX = /^<{7}\s/m;

export default class DmnModelerComponentAdapter extends AbstractEmitter {
  private log: Debugger;
  private modeler: any;
  private readyForInteraction: boolean = false;
  private activeViewerEventCleanup: (() => void) | null = null;
  private drdCommandStackListenerRegistered: boolean = false;

  constructor(
    uri: string,
    private studio: Studio,
    additionalModules: unknown[] = [],
  ) {
    super();
    this.log = Debug(`dmn/${this.constructor.name}(${uri})`);

    PluginDmnPaletteProvider.setStudio(studio);
    PluginDmnContextPadProvider.setStudio(studio);

    // dmn-js is ESM; Rspack handles the import at bundle time

    const DmnModeler = require('dmn-js/lib/Modeler').default;

    this.modeler = new DmnModeler({
      drd: {
        additionalModules: [gridModule, minimapModule, createDmnSanitizerModule(studio), ...additionalModules],
        drdRenderer: {
          defaultFillColor: 'var(--color-dmn-defaultFillColor)',
          defaultStrokeColor: 'var(--color-dmn-defaultStrokeColor)',
        },
      },
    });

    // dmn-js does not natively stamp exporter metadata (unlike bpmn-js which
    // uses @bpmn-io/add-exporter). The Manager-level saveXML.start event is
    // the correct hook: it fires before moddle serialization and provides the
    // definitions object that becomes the XML root element.
    this.modeler.on('saveXML.start', (event: any) => {
      event.definitions.exporter = studio.env.productName;
      event.definitions.exporterVersion = studio.env.version;
    });

    this.modeler.on('import.done', (event: any) => {
      if (event.warnings?.length) {
        this.log('Warnings found while importing the DMN diagram', event.warnings);
      }

      this.registerCommandHandlersOnDrdViewer();
      this.emit(EVENT_DMN_ADAPTER_XML_LOADED);
    });

    this.modeler.on('views.changed', (event: any) => {
      this.log('views.changed', event.activeView?.type);
      this.rewireActiveViewerEvents();
      this.emit(EVENT_DMN_ADAPTER_VIEW_CHANGED, [{ views: event.views, activeView: event.activeView }]);

      if (event.activeView?.type === 'drd') {
        this.triggerSanitizerReanalysis();
      }
    });
  }

  async initialize(xml: string, metadata: Record<string, unknown> | null = null): Promise<string> {
    this.once(EVENT_DMN_ADAPTER_READY_FOR_INTERACTION, async () => {
      if (this.isDrdActive()) {
        if (metadata?.viewbox == null) {
          this.zoomToViewport();
        } else {
          this.getDrdCanvas().viewbox(metadata.viewbox as Rect);
        }
      }
    });

    this.once(EVENT_DMN_ADAPTER_ATTACHED_TO_HTML, () => {
      this.readyForInteraction = true;
      this.emit(EVENT_DMN_ADAPTER_READY_FOR_INTERACTION);
    });

    return this.setXml(xml);
  }

  dispose(): void {
    this.cleanupActiveViewerEvents();
    this.modeler.destroy();
  }

  async setXml(currentXml: string): Promise<string> {
    try {
      const result = await this.modeler.importXML(currentXml);
      const { warnings } = result;
      if (warnings?.length) {
        console.warn('[DmnModelerComponentAdapter] Import warnings:', warnings);
      }
      return currentXml;
    } catch (error: any) {
      if (MERGE_CONFLICT_MARKER_REGEX.test(currentXml)) {
        throw new Error(
          `ERROR: failed to import DMN xml because of unresolved merge conflicts.\n\nXML given:\n\n${currentXml}`,
          { cause: error },
        );
      }

      const message =
        error instanceof Error ? error.message : (error?.error?.message ?? error?.message ?? JSON.stringify(error));

      throw new Error(`ERROR: failed to import DMN xml\n\nError given:\n\n${message}\n\nXML given:\n\n${currentXml}`, {
        cause: error,
      });
    }
  }

  async getXml(): Promise<string> {
    try {
      const { xml } = await this.modeler.saveXML({ format: true });
      return xml!;
    } catch (error) {
      throw new Error(`ERROR: while saving XML for DMN\n\n${error}`, { cause: error });
    }
  }

  attachToHtmlElement(htmlElementOrQuery: string | HTMLElement): void {
    const emitAttachedToHtml = () => {
      this.modeler.off('attach', emitAttachedToHtml);

      // dmn-js Manager.attachTo does not call canvas.resized() on the active
      // viewer (unlike bpmn-js BaseViewer.attachTo which does). During importXML
      // the DRD viewer attached to the Manager's _container while it was still
      // detached from the DOM, so the canvas cached 0×0 outer dimensions. Now
      // that the container is in the live DOM we must tell the viewer to
      // recalculate, otherwise hit-testing and zoom-to-viewport silently fail.
      this.resizeActiveViewer();

      this.emit(EVENT_DMN_ADAPTER_ATTACHED_TO_HTML);
    };
    this.modeler.on('attach', emitAttachedToHtml);
    this.modeler.attachTo(htmlElementOrQuery as HTMLElement);
  }

  isReadyForInteraction(): boolean {
    return this.readyForInteraction;
  }

  onceInteractive(callbackFn: () => void | Promise<void>): void {
    setTimeout(() => {
      if (this.isReadyForInteraction()) {
        callbackFn();
      } else {
        this.once(EVENT_DMN_ADAPTER_READY_FOR_INTERACTION, () => callbackFn());
      }
    }, 1);
  }

  //#region View Management

  getViews(): DmnView[] {
    return this.modeler.getViews() as DmnView[];
  }

  getActiveView(): DmnView | null {
    return (this.modeler.getActiveView() as DmnView) ?? null;
  }

  getActiveViewType(): DmnViewType | null {
    return this.getActiveView()?.type ?? null;
  }

  getActiveViewer(): any | null {
    return this.modeler.getActiveViewer() ?? null;
  }

  openView(view: DmnView): void {
    this.modeler.open(view);
  }

  openDrd(): void {
    const drdView = this.getViews().find((view) => view.type === 'drd');
    if (drdView) {
      this.openView(drdView);
    }
  }

  isDrdActive(): boolean {
    return this.getActiveViewType() === 'drd';
  }

  //#endregion View Management

  //#region Canvas (DRD-only)

  getZoom(): number {
    if (!this.isDrdActive()) {
      return 1;
    }
    return this.getDrdCanvas().zoom();
  }

  zoomToViewport(): void {
    if (!this.isDrdActive()) {
      return;
    }

    const ZOOM_CORRECTION = 0.9;
    const canvas = this.getDrdCanvas();
    const viewbox = canvas.viewbox(false as any) as CanvasViewbox;

    if (viewbox.outer.width === 0 || viewbox.outer.height === 0) {
      return;
    }

    const newScale =
      Math.min(1, viewbox.outer.width / viewbox.inner.width, viewbox.outer.height / viewbox.inner.height) *
      ZOOM_CORRECTION;

    const newViewbox = {
      x: viewbox.inner.x + viewbox.inner.width / 2 - viewbox.outer.width / newScale / 2,
      y: viewbox.inner.y + viewbox.inner.height / 2 - viewbox.outer.height / newScale / 2,
      width: viewbox.outer.width / newScale,
      height: viewbox.outer.height / newScale,
    };

    canvas.viewbox(newViewbox);
  }

  zoomToElement(elementId: string): void {
    if (!this.isDrdActive()) {
      return;
    }

    const canvas = this.getDrdCanvas();
    const viewbox = canvas.viewbox(false as any) as CanvasViewbox;
    const elementRegistry = this.getDrdElementRegistry();
    const element = elementRegistry.get(elementId);

    const hasValidBounds =
      element != null && Number.isFinite((element as any).x) && Number.isFinite((element as any).y);

    if (!hasValidBounds) {
      return this.zoomToViewport();
    }

    const newViewbox = {
      x: (element as any).x + ((element as any).width ?? 0) / 2 - viewbox.outer.width / 2,
      y: (element as any).y + ((element as any).height ?? 0) / 2 - viewbox.outer.height / 2,
      width: viewbox.outer.width,
      height: viewbox.outer.height,
    };

    canvas.viewbox(newViewbox);
    canvas.zoom(1);
  }

  isElementOnDrd(elementId: string): boolean {
    if (!this.isDrdActive()) {
      return false;
    }

    try {
      const elementRegistry = this.getDrdElementRegistry();
      const element = elementRegistry.get(elementId);

      return element != null && Number.isFinite((element as any).x) && Number.isFinite((element as any).y);
    } catch {
      return false;
    }
  }

  setZoom(percentage: number): void {
    if (!this.isDrdActive()) {
      return;
    }

    const canvas = this.getDrdCanvas();
    const viewbox = canvas.viewbox(false as any) as CanvasViewbox;

    if (viewbox.outer.width === 0 || viewbox.outer.height === 0) {
      return;
    }

    const center = {
      x: viewbox.outer.width / 2,
      y: viewbox.outer.height / 2,
    };

    canvas.zoom(percentage, center);
  }

  async restoreViewboxAfterNavigation(partialMetadata: Record<string, any> | null): Promise<void> {
    const viewbox = partialMetadata?.viewbox;
    if (viewbox == null || !this.isDrdActive()) {
      return;
    }
    this.getDrdCanvas().viewbox(viewbox as Rect);
  }

  //#endregion Canvas

  //#region Export

  async getSvg(): Promise<string> {
    const drdViewer = this.getDrdViewer();
    if (!drdViewer) {
      throw new Error('No DRD viewer available for SVG export');
    }
    const { svg } = await drdViewer.saveSVG();
    return svg;
  }

  //#endregion Export

  //#region Undo / Redo (proxied to active viewer)

  canUndo(): boolean {
    return this.getActiveCommandStack()?.canUndo() ?? false;
  }

  canRedo(): boolean {
    return this.getActiveCommandStack()?.canRedo() ?? false;
  }

  undo(): void {
    this.getActiveCommandStack()?.undo();
  }

  redo(): void {
    this.getActiveCommandStack()?.redo();
  }

  deleteSelectedElements(): void {
    if (!this.isDrdActive()) {
      return;
    }

    const drdViewer = this.getDrdViewer();
    if (drdViewer == null) {
      return;
    }

    try {
      const editorActions = drdViewer.get('editorActions') as { trigger: (action: string, context?: object) => void };
      editorActions.trigger('removeSelection', {});
    } catch {
      // DRD viewer may not expose editor actions during teardown
    }
  }

  selectAllElements(): void {
    if (!this.isDrdActive()) {
      return;
    }

    const drdViewer = this.getDrdViewer();
    if (drdViewer == null) {
      return;
    }

    try {
      const editorActions = drdViewer.get('editorActions') as { trigger: (action: string, context?: object) => void };
      editorActions.trigger('selectElements', {});
    } catch {
      // DRD viewer may not expose editor actions during teardown
    }
  }

  //#endregion Undo / Redo

  //#region Accessor helpers

  getModdle(): any {
    return this.modeler._moddle;
  }

  getModeler(): any {
    return this.modeler;
  }

  getDrdViewer(): any | null {
    const drdView = this.getViews().find((view) => view.type === 'drd');
    if (!drdView) {
      return null;
    }
    return this.modeler._getViewer(drdView);
  }

  getDrdCanvas(): Canvas {
    const viewer = this.getDrdViewer();
    return viewer.get('canvas') as Canvas;
  }

  getDrdElementRegistry(): ElementRegistry {
    const viewer = this.getDrdViewer();
    return viewer.get('elementRegistry') as ElementRegistry;
  }

  getDrdSelection(): Selection {
    const viewer = this.getDrdViewer();
    return viewer.get('selection') as Selection;
  }

  getDrdOverlays(): Overlays {
    const viewer = this.getDrdViewer();
    return viewer.get('overlays') as Overlays;
  }

  getDrdCommandStack(): CommandStack {
    const viewer = this.getDrdViewer();
    return viewer.get('commandStack') as CommandStack;
  }

  getDrdModeling(): any | null {
    const viewer = this.getDrdViewer();
    if (!viewer) {
      return null;
    }
    return viewer.get('modeling');
  }

  getDrdEventBus(): any | null {
    const viewer = this.getDrdViewer();
    if (!viewer) {
      return null;
    }
    return viewer.get('eventBus');
  }

  getDrdPalette(): any | null {
    const viewer = this.getDrdViewer();
    if (!viewer) {
      return null;
    }
    try {
      return viewer.get('palette');
    } catch {
      return null;
    }
  }

  getDrdContextPad(): any | null {
    const viewer = this.getDrdViewer();
    if (!viewer) {
      return null;
    }
    try {
      return viewer.get('contextPad');
    } catch {
      return null;
    }
  }

  getModelerComponentByName<T = any>(name: string): T | null {
    const viewer = this.getDrdViewer();
    if (!viewer) {
      return null;
    }
    try {
      return viewer.get(name) as T;
    } catch {
      return null;
    }
  }

  getGrid(): any {
    const drdViewer = this.getDrdViewer();
    return drdViewer?.get('grid');
  }

  getMinimap(): any {
    const drdViewer = this.getDrdViewer();
    return drdViewer?.get('minimap');
  }

  getDmnSanitizerBridge(): DmnSanitizerBridgeApi | null {
    try {
      return this.getDrdViewer()?.get('dmnSanitizerBridge') ?? null;
    } catch {
      return null;
    }
  }

  //#endregion Accessor helpers

  //#region Private internals

  private triggerSanitizerReanalysis(): void {
    const drdViewer = this.getDrdViewer();
    if (!drdViewer) {
      return;
    }
    try {
      const eventBus = drdViewer.get('eventBus');
      eventBus.fire('sanitizer.requestReanalysis', {});
    } catch {
      // Sanitizer bridge may not be initialized yet
    }
  }

  private getActiveCommandStack(): CommandStack | null {
    const viewer = this.getActiveViewer();
    if (!viewer) {
      return null;
    }
    try {
      return viewer.get('commandStack') as CommandStack;
    } catch {
      return null;
    }
  }

  private resizeActiveViewer(): void {
    const viewer = this.getActiveViewer();
    if (!viewer) {
      return;
    }
    try {
      (viewer.get('canvas') as Canvas).resized();
    } catch {
      // Table and expression viewers do not expose a diagram-js canvas
    }
  }

  private registerCommandHandlersOnDrdViewer(): void {
    const drdViewer = this.getDrdViewer();
    if (!drdViewer) {
      return;
    }

    const commandStack = drdViewer.get('commandStack') as CommandStack & {
      _handlerMap: Record<string, unknown>;
    };

    this.log('registerCommandHandlers on DRD viewer');

    Object.entries(DmnCommandHandler).forEach(([handlerKey, handlerFunction]) => {
      if (commandStack._handlerMap[handlerKey] == null) {
        commandStack.registerHandler(handlerKey, handlerFunction as any);
      }
    });

    this.registerPermanentDrdCommandStackListener(drdViewer);
  }

  /**
   * Property pane writes for expression-view elements (hit policy, aggregation,
   * literal expression text, etc.) are executed on the DRD command stack because
   * the business objects belong to the DRD model. When the active view is not
   * DRD, the rewired event listeners do not cover the DRD viewer's command stack
   * changes. This permanent listener ensures XML serialization happens for any
   * DRD command stack mutation, regardless of the active view.
   */
  private registerPermanentDrdCommandStackListener(drdViewer: any): void {
    if (this.drdCommandStackListenerRegistered) {
      return;
    }

    this.drdCommandStackListenerRegistered = true;
    drdViewer.on('commandStack.changed', () => {
      if (this.isDrdActive()) {
        return;
      }
      this.getXml()
        .then((xml: string) => {
          this.emit(EVENT_DMN_ADAPTER_XML_CHANGED, [xml]);
        })
        .catch((error) => {
          console.error('[DmnModelerComponentAdapter] XML serialization after DRD command stack change failed:', error);
        });
    });
  }

  /**
   * When the active view changes, re-subscribe to the new viewer's
   * commandStack.changed and selection.changed events so that XML_CHANGED
   * and SELECTION_CHANGED are emitted regardless of which view is active.
   */
  private rewireActiveViewerEvents(): void {
    this.cleanupActiveViewerEvents();

    const viewer = this.getActiveViewer();
    if (!viewer) {
      return;
    }

    const onCommandStackChanged = () => {
      this.getXml()
        .then((xml: string) => {
          this.emit(EVENT_DMN_ADAPTER_XML_CHANGED, [xml]);
        })
        .catch((error) => {
          console.error('[DmnModelerComponentAdapter] XML serialization failed:', error);
        });
    };

    const onSelectionChanged = (event: any) => {
      const raw = event.newSelection ?? event.selection;
      let normalized: any[];
      if (raw == null) {
        normalized = [];
      } else if (Array.isArray(raw)) {
        normalized = raw;
      } else {
        normalized = [raw];
      }
      this.emit(EVENT_DMN_ADAPTER_SELECTION_CHANGED, [normalized]);
    };

    const onCanvasViewboxChanged = () => {
      if (!this.isDrdActive()) {
        return;
      }
      const viewbox = this.getDrdCanvas().viewbox(false as any) as CanvasViewbox;
      this.emit(EVENT_DMN_ADAPTER_LOCATION_CHANGED, [{ viewbox: structuredClone(viewbox), zoom: this.getZoom() }]);
    };

    try {
      viewer.on('commandStack.changed', onCommandStackChanged);
    } catch {
      // Table/expression viewers may not have a commandStack event bus
    }

    try {
      viewer.on('selection.changed', onSelectionChanged);
    } catch {
      // Not all viewers have selection events
    }

    try {
      viewer.on('canvas.viewbox.changed', onCanvasViewboxChanged);
    } catch {
      // Only DRD viewer has canvas events
    }

    this.activeViewerEventCleanup = () => {
      try {
        viewer.off('commandStack.changed', onCommandStackChanged);
      } catch {
        /* already destroyed */
      }
      try {
        viewer.off('selection.changed', onSelectionChanged);
      } catch {
        /* already destroyed */
      }
      try {
        viewer.off('canvas.viewbox.changed', onCanvasViewboxChanged);
      } catch {
        /* already destroyed */
      }
    };
  }

  private cleanupActiveViewerEvents(): void {
    this.activeViewerEventCleanup?.();
    this.activeViewerEventCleanup = null;
  }

  //#endregion Private internals
}
