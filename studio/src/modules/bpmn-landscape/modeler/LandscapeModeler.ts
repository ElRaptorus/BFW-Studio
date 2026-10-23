import Diagram from 'diagram-js';
import DirectEditingModule from 'diagram-js-direct-editing';
import GridModule from 'diagram-js-grid';
import MinimapModule from 'diagram-js-minimap';
import type EventBus from 'diagram-js/lib/core/EventBus';
import AlignElementsModule from 'diagram-js/lib/features/align-elements';
import AutoResizeModule from 'diagram-js/lib/features/auto-resize';
import BendpointsModule from 'diagram-js/lib/features/bendpoints';
import ConnectModule from 'diagram-js/lib/features/connect';
import ContextPadModule from 'diagram-js/lib/features/context-pad';
import CopyPasteModule from 'diagram-js/lib/features/copy-paste';
import CreateModule from 'diagram-js/lib/features/create';
import DistributeElementsModule from 'diagram-js/lib/features/distribute-elements';
import EditorActionsModule from 'diagram-js/lib/features/editor-actions';
import GridSnappingModule from 'diagram-js/lib/features/grid-snapping';
import HandToolModule from 'diagram-js/lib/features/hand-tool';
import KeyboardModule from 'diagram-js/lib/features/keyboard';
import KeyboardMoveSelectionModule from 'diagram-js/lib/features/keyboard-move-selection';
import LassoToolModule from 'diagram-js/lib/features/lasso-tool';
import ModelingModule from 'diagram-js/lib/features/modeling';
import MoveModule from 'diagram-js/lib/features/move';
import OverlaysModule from 'diagram-js/lib/features/overlays';
import PaletteModule from 'diagram-js/lib/features/palette';
import ResizeModule from 'diagram-js/lib/features/resize';
import RootElementsModule from 'diagram-js/lib/features/root-elements';
import SelectionModule from 'diagram-js/lib/features/selection';
import CroppingConnectionDocking from 'diagram-js/lib/layout/CroppingConnectionDocking';
import MoveCanvasModule from 'diagram-js/lib/navigation/movecanvas';
import ZoomScrollModule from 'diagram-js/lib/navigation/zoomscroll';

import type { LandscapeConnector, LandscapeElement, LandscapeMap } from '../LandscapeMapFile';
import { createElementId } from '../LandscapeMapFile';
import type { RelationLine } from '../buildRelationLines';
import LandscapeContextPadProvider from './LandscapeContextPadProvider';
import LandscapeGroupMembership from './LandscapeGroupMembership';
import LandscapeLabelEditing from './LandscapeLabelEditing';
import LandscapeLayouter from './LandscapeLayouter';
import LandscapeOrdering from './LandscapeOrdering';
import LandscapePaletteProvider from './LandscapePaletteProvider';
import LandscapeRelationLayer from './LandscapeRelationLayer';
import type { LandscapeRendererConfig } from './LandscapeRenderer';
import LandscapeRenderer from './LandscapeRenderer';
import LandscapeRules from './LandscapeRules';
import LandscapeUpdates from './LandscapeUpdates';
import { canvasToMap, mapToCanvasDescriptors, shapeAttributesOf } from './landscapeCanvasMapping';

/** Copies keep the file element, so a pasted shape is drawn and exported like its original, under a new id. */
class LandscapeCopyPaste {
  static $inject = ['eventBus', 'elementRegistry'];

  constructor(eventBus: EventBus, elementRegistry: any) {
    eventBus.on('copyPaste.copyElement', ({ descriptor, element }: any) => {
      descriptor.type = element.type;
      descriptor.businessObject = structuredClone(element.businessObject);
    });
    eventBus.on('copyPaste.pasteElement', ({ descriptor }: any) => {
      const id = createElementId(descriptor.type, (candidate) => elementRegistry.get(candidate) != null);
      descriptor.businessObject = { ...structuredClone(descriptor.businessObject), id };
    });
    // Copy-paste creates its elements without an id, so diagram-js would give them its own (`shape_15`).
    eventBus.on(
      ['commandStack.shape.create.preExecute', 'commandStack.connection.create.preExecute'],
      ({ context }: any) => {
        const element = context.shape ?? context.connection;
        if (element.businessObject?.id != null) {
          element.id = element.businessObject.id;
        }
      },
    );
  }
}

/** A connector drawn with the connect tool gets its file element; the exporter fills in ends and waypoints. */
class LandscapeConnectors {
  static $inject = ['eventBus'];

  constructor(eventBus: EventBus) {
    eventBus.on('commandStack.connection.create.preExecute', ({ context }: any) => {
      const connection = context.connection;
      if (connection.type === 'connector' && connection.businessObject == null) {
        connection.businessObject = {
          id: connection.id,
          sourceId: context.source.businessObject.id,
          targetId: context.target.businessObject.id,
          label: '',
          waypoints: [],
        } satisfies LandscapeConnector;
      }
    });
  }
}

const LANDSCAPE_MODULE = {
  __init__: [
    'landscapeRenderer',
    'landscapeRules',
    'landscapeLabelEditing',
    'landscapeCopyPaste',
    'landscapeConnectors',
    'orderingProvider',
    'landscapeGroupMembership',
    'landscapeRelationLayer',
    'landscapeUpdates',
    'paletteProvider',
    'contextPadProvider',
  ],
  landscapeRenderer: ['type', LandscapeRenderer],
  landscapeRules: ['type', LandscapeRules],
  landscapeLabelEditing: ['type', LandscapeLabelEditing],
  landscapeCopyPaste: ['type', LandscapeCopyPaste],
  landscapeConnectors: ['type', LandscapeConnectors],
  orderingProvider: ['type', LandscapeOrdering],
  landscapeGroupMembership: ['type', LandscapeGroupMembership],
  landscapeRelationLayer: ['type', LandscapeRelationLayer],
  landscapeUpdates: ['type', LandscapeUpdates],
  paletteProvider: ['type', LandscapePaletteProvider],
  contextPadProvider: ['type', LandscapeContextPadProvider],
  connectionDocking: ['type', CroppingConnectionDocking],
  layouter: ['type', LandscapeLayouter],
};

const EXPORT_PADDING = 10;

/** The rectangle around shapes, line labels and the bends of lines; an empty map has a small default frame. */
function boundsOf(elements: any[]): { x: number; y: number; width: number; height: number } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const element of elements) {
    if (element.waypoints != null) {
      element.waypoints.forEach((point: { x: number; y: number }) => {
        xs.push(point.x);
        ys.push(point.y);
      });
    } else {
      xs.push(element.x, element.x + element.width);
      ys.push(element.y, element.y + element.height);
    }
  }
  if (xs.length === 0) {
    return { x: 0, y: 0, width: 200, height: 100 };
  }
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

const isContainer = (element: any): boolean => element.type === 'group' || element.type === 'band';
const FOCUSED_MARKER = 'landscape-focused';

/** The diagram-js canvas of one landscape map. It draws into a detached container that the renderer attaches. */
export default class LandscapeModeler {
  readonly container: HTMLDivElement;
  private readonly diagram: Diagram;

  constructor(config: LandscapeRendererConfig) {
    this.container = document.createElement('div');
    this.container.className = 'landscape-map__canvas';
    this.diagram = new Diagram({
      canvas: { container: this.container },
      keyboard: { bind: false },
      landscape: config,
      modules: [
        SelectionModule,
        MoveModule,
        ResizeModule,
        AutoResizeModule,
        ModelingModule,
        CreateModule,
        ConnectModule,
        BendpointsModule,
        LassoToolModule,
        HandToolModule,
        AlignElementsModule,
        DistributeElementsModule,
        CopyPasteModule,
        KeyboardModule,
        KeyboardMoveSelectionModule,
        EditorActionsModule,
        GridSnappingModule,
        RootElementsModule,
        OverlaysModule,
        ContextPadModule,
        PaletteModule,
        ZoomScrollModule,
        MoveCanvasModule,
        GridModule,
        MinimapModule,
        DirectEditingModule,
        LANDSCAPE_MODULE,
      ],
    });
  }

  get<T = any>(serviceName: string): T {
    return this.diagram.get<T>(serviceName);
  }

  /** Replaces the canvas content with `map`; the import is not undoable. */
  importMap(map: LandscapeMap): void {
    this.diagram.clear();
    const canvas = this.get('canvas');
    const elementFactory = this.get('elementFactory');
    const root = canvas.getRootElement();
    const shapesById = new Map<string, any>();
    const { shapes, connections } = mapToCanvasDescriptors(map);
    for (const element of shapes) {
      const shape = elementFactory.createShape(shapeAttributesOf(structuredClone(element)));
      canvas.addShape(shape, element.parentId == null ? root : shapesById.get(element.parentId));
      shapesById.set(element.id, shape);
    }
    for (const connector of connections) {
      const connection = elementFactory.createConnection({
        id: connector.id,
        type: 'connector',
        source: shapesById.get(connector.sourceId),
        target: shapesById.get(connector.targetId),
        waypoints: connector.waypoints.map((point) => ({ ...point })),
        businessObject: structuredClone(connector),
      });
      if (connection.waypoints.length < 2) {
        connection.waypoints = this.get('layouter').layoutConnection(connection);
      }
      canvas.addConnection(connection, root);
    }
    const { name, relationLayers, hiddenRelations } = structuredClone(map);
    this.get<LandscapeUpdates>('landscapeUpdates').setMapProperties({ name, relationLayers, hiddenRelations });
    this.get('commandStack').clear();
  }

  exportMap(previousMap: LandscapeMap): LandscapeMap {
    const mapProperties = this.get<LandscapeUpdates>('landscapeUpdates').getMapProperties();
    return canvasToMap(this.get('canvas').getRootElement(), { ...previousMap, ...mapProperties });
  }

  /** Adds a shape centred on the point, inside the smallest group or band that contains the point. */
  addElementShape(element: LandscapeElement, center: { x: number; y: number }): any {
    const containers = this.get('elementRegistry')
      .filter(
        (candidate: any) =>
          isContainer(candidate) &&
          center.x >= candidate.x &&
          center.x <= candidate.x + candidate.width &&
          center.y >= candidate.y &&
          center.y <= candidate.y + candidate.height,
      )
      .sort((first: any, second: any) => first.width * first.height - second.width * second.height);
    const shape = this.get('elementFactory').createShape(shapeAttributesOf(element));
    return this.get('modeling').createShape(shape, center, containers[0] ?? this.get('canvas').getRootElement());
  }

  /** Replaces a shape by one for `element` at the same place, in one undo step; connectors follow. */
  replaceWithElement(shape: any, element: LandscapeElement): any {
    return this.get('modeling').replaceShape(shape, {
      ...shapeAttributesOf(element),
      x: shape.x + shape.width / 2,
      y: shape.y + shape.height / 2,
    });
  }

  /**
   * The whole map as a standalone SVG: the content layer and its marker definitions, framed by the bounds of the
   * elements with a margin. Selection outlines, hit areas, the grid and the minimap are not part of it. Colours are
   * still theme variables; the caller maps them.
   */
  exportSvg(): string {
    const canvas = this.get('canvas');
    const activeLayer: Element = canvas.getActiveLayer();
    // A line label may stick out of the line's bends; a detached canvas measures every text as empty.
    const lineLabelBoxes = [...activeLayer.querySelectorAll<SVGGraphicsElement>('.landscape-line-label')]
      .map((text) => text.getBBox())
      .filter((box) => box.width > 0 && box.height > 0);
    const bounds = boundsOf([
      ...this.get('elementRegistry').filter((element: any) => element.parent != null),
      ...lineLabelBoxes,
    ]);
    const layer = activeLayer.cloneNode(true) as Element;
    layer
      .querySelectorAll('.djs-hit, .djs-outline, .djs-selection-outline, .djs-resizer')
      .forEach((node) => node.remove());
    const serializer = new XMLSerializer();
    const definitions = [...canvas._svg.querySelectorAll(':scope > defs')]
      .map((node: Element) => serializer.serializeToString(node))
      .join('');
    const x = Math.floor(bounds.x - EXPORT_PADDING);
    const y = Math.floor(bounds.y - EXPORT_PADDING);
    const width = Math.ceil(bounds.width + 2 * EXPORT_PADDING);
    const height = Math.ceil(bounds.height + 2 * EXPORT_PADDING);
    return `<?xml version="1.0" encoding="utf-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${width}" height="${height}" viewBox="${x} ${y} ${width} ${height}">${definitions}${serializer.serializeToString(layer)}</svg>`;
  }

  showRelationLines(lines: RelationLine[]): void {
    this.get<LandscapeRelationLayer>('landscapeRelationLayer').show(lines);
  }

  /**
   * In focus mode with a selection, dims everything except the selected elements, their descendants, the lines
   * that touch any of them and the elements at the other ends. Only an element's own visual is dimmed, so the
   * children of a dimmed group keep their look.
   */
  updateFocus(enabled: boolean): void {
    const canvas = this.get('canvas');
    const elements = this.get('elementRegistry').filter((element: any) => element.parent != null);
    for (const element of elements) {
      canvas.removeMarker(element, FOCUSED_MARKER);
    }
    const selected: any[] = this.get('selection').get();
    const active = enabled && selected.length > 0;
    this.container.classList.toggle('landscape-map--focus', active);
    if (!active) {
      return;
    }
    const focused = new Set<any>();
    const addLine = (connection: any): void => {
      focused.add(connection).add(connection.source).add(connection.target);
    };
    const addWithDescendants = (element: any): void => {
      focused.add(element);
      (element.children ?? []).forEach(addWithDescendants);
    };
    selected.forEach((element) => (element.waypoints == null ? addWithDescendants(element) : addLine(element)));
    for (const element of [...focused]) {
      if (element.waypoints == null) {
        [...element.incoming, ...element.outgoing].forEach(addLine);
      }
    }
    for (const element of focused) {
      if (element?.parent != null) {
        canvas.addMarker(element, FOCUSED_MARKER);
      }
    }
  }

  findProcessShape(processId: string): any {
    return this.get('elementRegistry').find(
      (element: any) => element.type === 'process' && element.businessObject.processId === processId,
    );
  }

  /** Converts a mouse position on screen into diagram coordinates. */
  toCanvasPoint(clientX: number, clientY: number): { x: number; y: number } {
    const viewbox = this.get('canvas').viewbox();
    const bounds = this.container.getBoundingClientRect();
    return {
      x: Math.round(viewbox.x + (clientX - bounds.left) / viewbox.scale),
      y: Math.round(viewbox.y + (clientY - bounds.top) / viewbox.scale),
    };
  }

  destroy(): void {
    this.get('contextPad').close();
    this.diagram.destroy();
  }
}
