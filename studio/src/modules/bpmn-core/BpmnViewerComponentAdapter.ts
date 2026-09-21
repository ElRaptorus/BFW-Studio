import { AbstractEmitter } from '#bifrost/common/AbstractEmitter';
import BpmnViewer from 'bpmn-js/lib/Viewer';
import OutlineModule from 'bpmn-js/lib/features/outline';
import type { Debugger } from 'debug';
import Debug from 'debug';
import minimapModule from 'diagram-js-minimap';
import type CommandStack from 'diagram-js/lib/command/CommandStack';
import type Canvas from 'diagram-js/lib/core/Canvas';
import type { CanvasViewbox } from 'diagram-js/lib/core/Canvas';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type { Event as DjsEvent } from 'diagram-js/lib/core/EventBus';
import type EventBus from 'diagram-js/lib/core/EventBus';
import type Clipboard from 'diagram-js/lib/features/clipboard/Clipboard';
import type EditorActions from 'diagram-js/lib/features/editor-actions/EditorActions';
import type Modeling from 'diagram-js/lib/features/modeling/Modeling';
import type Overlays from 'diagram-js/lib/features/overlays/Overlays';
import type Selection from 'diagram-js/lib/features/selection/Selection';
import type { ElementLike, Shape } from 'diagram-js/lib/model/Types';
import MoveCanvasModule from 'diagram-js/lib/navigation/movecanvas';
import ZoomScrollModule from 'diagram-js/lib/navigation/zoomscroll';
import type { Rect } from 'diagram-js/lib/util/Types';

import bfwPlatformModdleDescriptor from './bpmn-js/moddle/bfw-platform.json';

export const EVENT_BPMN_VIEWER_ADAPTER_ATTACHED_TO_HTML = 'EVENT_BPMN_VIEWER_ADAPTER_ATTACHED_TO_HTML';
export const EVENT_BPMN_VIEWER_ADAPTER_READY_FOR_INTERACTION = 'EVENT_BPMN_ADAPTER_READY_FOR_INTERACTION';

export const EVENT_BPMN_VIEWER_ADAPTER_LOCATION_CHANGED = 'EVENT_BPMN_ADAPTER_LOCATION_CHANGED';
export const EVENT_BPMN_VIEWER_ADAPTER_SELECTION_CHANGED = 'EVENT_BPMN_ADAPTER_SELECTION_CHANGED';
export const EVENT_BPMN_VIEWER_ADAPTER_XML_CHANGED = 'EVENT_BPMN_ADAPTER_XML_CHANGED';
export const EVENT_BPMN_VIEWER_ADAPTER_ROOT_CHANGED = 'EVENT_BPMN_VIEWER_ADAPTER_ROOT_CHANGED';

const MODDLE_BPMN_PARTICIPANT_TYPE = 'bpmn:Participant';
const MODDLE_BPMN_PROCESS_SELECTOR = 'processRef';

const DEFAULT_VIEWER_OPTIONS = {
  canvas: {
    autoFocus: true,
  },
};

export class BpmnViewerComponentAdapter extends AbstractEmitter {
  private log: Debugger;
  private viewer: BpmnViewer;
  private modelerEventsMap: Record<string, (event: DjsEvent & Record<string, any>) => void> | null = null;
  private readyForInteraction: boolean = false;
  private initializationStarted: boolean = false;
  private xmlImportInProgress: boolean = false;
  private lastSetViewbox: CanvasViewbox | null = null;

  constructor(uri: string, bpmnComponentOptions: Record<string, unknown> = {}, additionalModules: unknown[] = []) {
    super();
    this.log = Debug(`bpmn/${this.constructor.name}(${uri})`);

    this.viewer = new BpmnViewer({
      additionalModules: [ZoomScrollModule, MoveCanvasModule, minimapModule, OutlineModule, ...additionalModules],
      moddleExtensions: {
        bfw: bfwPlatformModdleDescriptor,
      },
      ...DEFAULT_VIEWER_OPTIONS,
      ...bpmnComponentOptions,
    });

    const importDoneCallback = (event: DjsEvent & Record<string, any>) => {
      if (event.warnings) {
        this.log('Warnings found while importing the diagram', event.warnings);
      }

      this.viewer.off('import.done', importDoneCallback);
    };

    this.viewer.on('import.done', importDoneCallback);
  }

  async initialize(xml: string, metadata: Record<string, unknown> | null = null): Promise<string> {
    // Due to some Events happening at unlucky timings and a poorly scheduled class lifecycle it might happen, that the EngineDebugerDocumentModel calls initialze for this class twice.
    // This causes some eventlisteners to be registered twice, what leads to bugs.
    // With a refactoring of the EngineDebugerDocumentModels lifecycle this check could be removed.
    if (this.initializationStarted) {
      return xml;
    }
    this.initializationStarted = true;
    this.once(EVENT_BPMN_VIEWER_ADAPTER_READY_FOR_INTERACTION, async () => {
      this.zoomToViewport();
      await this.awaitNextLocationChange();
    });
    this.once(EVENT_BPMN_VIEWER_ADAPTER_ATTACHED_TO_HTML, async () => {
      this.initializeEventListeners();
      this.readyForInteraction = true;
      this.emit(EVENT_BPMN_VIEWER_ADAPTER_READY_FOR_INTERACTION);
    });

    return this.setXml(xml);
  }

  async updateXml(xml: string): Promise<string> {
    this.once(EVENT_BPMN_VIEWER_ADAPTER_READY_FOR_INTERACTION, async () => {
      this.zoomToViewport();
      await this.awaitNextLocationChange();
    });

    return this.setXml(xml);
  }

  dispose(): void {
    this.removeEventListeners();
    this.viewer.detach();
    this.viewer.destroy();
  }

  attachToHtmlElement(bpmnHtmlElementOrQuery: string | HTMLElement): void {
    const emitAttachedToHtml = () => {
      this.viewer.off('canvas.resized', emitAttachedToHtml);
      this.emit(EVENT_BPMN_VIEWER_ADAPTER_ATTACHED_TO_HTML);
    };
    this.viewer.on('canvas.resized', emitAttachedToHtml);

    this.viewer.attachTo(bpmnHtmlElementOrQuery as HTMLElement);
  }

  isReadyForInteraction(): boolean {
    return this.readyForInteraction;
  }

  /**
   * Run the given `callbackFn` once the viewer is interactive and no XML
   * import is in progress. If an import is currently running, the callback
   * is deferred until the next `READY_FOR_INTERACTION` event (emitted at
   * the end of `setXml`).
   */
  onceInteractive(callbackFn: () => void | Promise<void>): void {
    setTimeout(() => {
      if (this.isReadyForInteraction() && !this.xmlImportInProgress) {
        callbackFn();
      } else {
        this.once(EVENT_BPMN_VIEWER_ADAPTER_READY_FOR_INTERACTION, () => callbackFn());
      }
    }, 1);
  }

  getZoom(): number {
    return this.getCanvas().zoom();
  }

  zoomInOnElement(elementId: string): void {
    const canvas = this.getCanvas();
    const viewbox = canvas.viewbox();
    const elementRegistry = this.getElementRegistry();

    const element = elementRegistry.get(elementId);
    if (element == null) {
      return;
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

  async focusViewOnElements(elementIds: string[]): Promise<void> {
    const canvas = this.getCanvas();
    const viewbox = canvas.viewbox();
    const elementRegistry = this.getElementRegistry();

    const elements = elementIds.map((elementId) => elementRegistry.get(elementId)).filter((el) => el != null);
    const rect = this.getBounds(elements);
    const newViewbox = {
      x: rect.x + rect.width / 2 - viewbox.outer.width / 2,
      y: rect.y + rect.height / 2 - viewbox.outer.height / 2,
      width: viewbox.outer.width,
      height: viewbox.outer.height,
    };

    const locationChanged = this.awaitNextLocationChange();
    canvas.viewbox(newViewbox);
    canvas.zoom(1);

    await locationChanged;
  }

  zoomToViewport(): void {
    const ZOOM_CORRECTION = 0.9; // zoom out to ensure white-space padding around diagram
    const PADDING_CORRECTION = 36; // width of tools in pixels

    const canvas = this.getCanvas();
    const viewbox = canvas.viewbox();
    const center = {
      x: viewbox.outer.width / 2 + PADDING_CORRECTION * 4,
      y: viewbox.outer.height / 2,
    };
    canvas.zoom('fit-viewport', center);

    const viewboxAfter = canvas.viewbox();
    const zoomAfter = viewboxAfter.scale * ZOOM_CORRECTION;

    this.getCanvas().zoom(zoomAfter, center);
  }

  setZoom(percentage: number): void {
    const PADDING_CORRECTION = 36; // width of tools in pixels

    const canvas = this.getCanvas();
    const viewbox = canvas.viewbox();
    const center = {
      x: viewbox.outer.width / 2 + PADDING_CORRECTION * 4,
      y: viewbox.outer.height / 2,
    };

    this.getCanvas().zoom(percentage, center);
  }

  async getSvg(): Promise<string> {
    const result = await this.viewer.saveSVG();
    return result.svg;
  }

  getViewerComponentByName<T>(name: string): T {
    return this.viewer.get(name) as T;
  }

  getEditorActions(): EditorActions {
    return this.viewer.get('editorActions') as EditorActions;
  }

  getOverlays(): Overlays {
    return this.viewer.get('overlays') as Overlays;
  }

  // bpmn-moddle has no TypeScript declarations
  getModdle(): any {
    return this.viewer.get('moddle');
  }

  getElementRegistry(): ElementRegistry {
    return this.viewer.get('elementRegistry') as ElementRegistry;
  }

  getCanvas(): Canvas {
    return this.viewer.get('canvas') as Canvas;
  }

  getSelection(): Selection {
    return this.viewer.get('selection') as Selection;
  }

  getModeling(): Modeling {
    return this.viewer.get('modeling') as Modeling;
  }

  getCommandStack(): CommandStack {
    return this.viewer.get('commandStack') as CommandStack;
  }

  getClipboard(): Clipboard {
    return this.viewer.get('clipboard') as Clipboard;
  }

  getEventBus(): EventBus {
    return this.viewer.get('eventBus') as EventBus;
  }

  getModeler(): BpmnViewer {
    return this.viewer;
  }

  private awaitNextLocationChange(): Promise<void> {
    return new Promise((resolve, reject) => {
      const resolveCallbackFn = () => {
        this.viewer.off('canvas.viewbox.changed', resolveCallbackFn);

        resolve();
      };
      this.viewer.on('canvas.viewbox.changed', resolveCallbackFn);
    });
  }

  private initializeEventListeners(): void {
    this.log('initializeEventListeners');

    this.modelerEventsMap = {
      'shape.added': () => this.onContentChange(),
      'connection.added': () => this.onContentChange(),
      'shape.removed': () => this.onContentChange(),
      'connection.removed': () => this.onContentChange(),
      'element.changed': (event) => this.onElementChanged(event),
      'elements.changed': () => this.onContentChange(),
      'canvas.viewbox.changed': (event) => this.onLocationChange(event),
      'selection.changed': (event) => this.onSelectionChange(event),
      'root.set': (event) => this.onRootChanged(event),
    };

    this.addEventListeners();
  }

  private addEventListeners(): void {
    if (this.modelerEventsMap == null) {
      return;
    }

    this.log('addEventListeners', Date.now());

    for (const eventName of Object.keys(this.modelerEventsMap)) {
      this.viewer.on(eventName, this.modelerEventsMap[eventName]);
    }
  }

  private removeEventListeners(): void {
    if (this.modelerEventsMap == null) {
      return;
    }

    this.log('removeEventListeners', Date.now());

    for (const eventName of Object.keys(this.modelerEventsMap)) {
      this.viewer.off(eventName, this.modelerEventsMap[eventName]);
    }
  }

  private onElementChanged(event: DjsEvent & Record<string, any>): void {
    if (event.element.type === MODDLE_BPMN_PARTICIPANT_TYPE && event.element.businessObject.processRef !== undefined) {
      const processRef = event.element.businessObject.get(MODDLE_BPMN_PROCESS_SELECTOR);

      processRef.name = event.element.businessObject.name;
    }

    this.onContentChange();
  }

  private onContentChange(): void {
    this.getXml().then((xml: string) => {
      this.emit(EVENT_BPMN_VIEWER_ADAPTER_XML_CHANGED, [xml]);
    });
  }

  private onLocationChange(event: DjsEvent & Record<string, any>): void {
    const viewbox = this.deepCopy(event.viewbox) as CanvasViewbox;

    this.log('onLocationChange', 'viewbox:', viewbox, 'isValidViewbox:', this.isValidViewbox(viewbox));

    // The Modeler sometimes caches an invalid viewbox and distributes it through the event "viewbox.changed"
    // it's unclear why this happens at this point
    // the following code fixes the immediate problem
    const viewboxIsBroken = !this.isValidViewbox(viewbox);

    if (viewboxIsBroken) {
      if (this.lastSetViewbox) {
        this.setViewbox(this.lastSetViewbox);
      }

      return;
    } else {
      this.lastSetViewbox = null;
    }

    this.log('onLocationChange.emitEvents', 'isValidViewbox:', this.isValidViewbox(viewbox));

    this.emit(EVENT_BPMN_VIEWER_ADAPTER_LOCATION_CHANGED, [{ viewbox: viewbox, zoom: this.getZoom() }]);
  }

  private onSelectionChange(event: DjsEvent & Record<string, any>): void {
    this.emit(EVENT_BPMN_VIEWER_ADAPTER_SELECTION_CHANGED, [event.newSelection]);
  }

  private onRootChanged(event: DjsEvent & Record<string, any>): void {
    this.emit(EVENT_BPMN_VIEWER_ADAPTER_ROOT_CHANGED, [event.element]);
  }

  private async setXml(currentXml: string): Promise<string> {
    this.xmlImportInProgress = true;
    try {
      const result = await this.viewer.importXML(currentXml);
      const { warnings } = result;
      if (warnings.length !== 0) {
        console.warn(warnings);
      }

      return currentXml;
    } catch (error) {
      throw new Error(
        `ERROR: failed to import xml\n\nError given:\n\n${JSON.stringify(error)}\n\nXML given:\n\n${currentXml}`,
        { cause: error },
      );
    } finally {
      this.xmlImportInProgress = false;
      if (this.readyForInteraction) {
        this.emit(EVENT_BPMN_VIEWER_ADAPTER_READY_FOR_INTERACTION);
      }
    }
  }

  private async getXml(): Promise<string> {
    try {
      const { xml } = await this.viewer.saveXML();
      return xml!;
    } catch (error) {
      throw new Error(`ERROR: while saving XML\n\n${error}`, { cause: error });
    }
  }

  private isValidViewbox(viewbox: CanvasViewbox): boolean {
    return (
      typeof viewbox.width === 'number' &&
      typeof viewbox.height === 'number' &&
      viewbox.width !== 0 &&
      viewbox.height !== 0
    );
  }

  private setViewbox(viewbox: Rect): CanvasViewbox {
    const updatedViewbox = this.getCanvas().viewbox(viewbox);
    this.lastSetViewbox = updatedViewbox;

    return updatedViewbox;
  }

  private getBounds(elementOrElements: ElementLike | ElementLike[], abort: boolean = false): Rect {
    const elements = Array.isArray(elementOrElements) ? elementOrElements : [elementOrElements];
    let minX: number | null = null;
    let minY: number | null = null;
    let maxX: number | null = null;
    let maxY: number | null = null;
    abort = !!abort;

    elements.forEach((element: ElementLike) => {
      let bbox: { x: number; y: number; width?: number; height?: number } = element as Shape;
      if (element.waypoints && !abort) {
        bbox = this.getBounds(element.waypoints as ElementLike[], true);
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

  private deepCopy<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }
}
