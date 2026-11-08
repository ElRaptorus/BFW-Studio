import { replaceThemeColorsInSvg } from '#modules/bpmn-core/ImageExportFunctions';
import Diagram from 'diagram-js';
import MinimapModule from 'diagram-js-minimap';
import ModelingModule from 'diagram-js/lib/features/modeling';
import OutlineModule from 'diagram-js/lib/features/outline';
import OverlaysModule from 'diagram-js/lib/features/overlays';
import RootElementsModule from 'diagram-js/lib/features/root-elements';
import SelectionModule from 'diagram-js/lib/features/selection';
import TooltipsModule from 'diagram-js/lib/features/tooltips';
import { getMid } from 'diagram-js/lib/layout/LayoutUtil';
import MoveCanvasModule from 'diagram-js/lib/navigation/movecanvas';
import ZoomScrollModule from 'diagram-js/lib/navigation/zoomscroll';

import type { InteractionGraph } from '../buildInteractionGraph';
import type { InteractionGraphLayout } from '../layoutInteractionGraph';
import { INTERACTION_PROCESS_HEIGHT, INTERACTION_PROCESS_WIDTH, PORT_SIZE } from '../layoutInteractionGraph';
import InteractionsRenderer from './InteractionsRenderer';
import InteractionsOutlineModule from './features/InteractionsOutline';
import InteractionsSearchModule from './features/InteractionsSearch';
import InteractionsTextRendererModule from './features/InteractionsTextRenderer';

const INTERACTIONS_MODULES = [
  SelectionModule,
  OutlineModule,
  OverlaysModule,
  ZoomScrollModule,
  MoveCanvasModule,
  RootElementsModule,
  ModelingModule,
  MinimapModule,
  TooltipsModule,
  InteractionsTextRendererModule,
  InteractionsOutlineModule,
  InteractionsSearchModule,
  {
    __init__: ['interactionsRenderer'],
    interactionsRenderer: ['type', InteractionsRenderer],
  },
];

const EXPORT_PADDING = 10;
export const INTERACTIONS_FOCUSED_MARKER = 'interactions-focused';

function boundsOf(elements: any[]): { x: number; y: number; width: number; height: number } {
  const horizontalPositions: number[] = [];
  const verticalPositions: number[] = [];
  for (const element of elements) {
    if (element.waypoints != null) {
      element.waypoints.forEach((point: { x: number; y: number }) => {
        horizontalPositions.push(point.x);
        verticalPositions.push(point.y);
      });
    } else {
      horizontalPositions.push(element.x, element.x + element.width);
      verticalPositions.push(element.y, element.y + element.height);
    }
  }
  if (horizontalPositions.length === 0) {
    return { x: 0, y: 0, width: 200, height: 100 };
  }
  const x = Math.min(...horizontalPositions);
  const y = Math.min(...verticalPositions);
  return {
    x,
    y,
    width: Math.max(...horizontalPositions) - x,
    height: Math.max(...verticalPositions) - y,
  };
}

/** Read-only diagram-js canvas for the generated interactions view. */
export default class InteractionsViewer {
  readonly container: HTMLDivElement;
  private readonly diagram: Diagram;

  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'interactions-map__canvas';
    this.diagram = new Diagram({
      canvas: { container: this.container },
      keyboard: { bind: false },
      modules: INTERACTIONS_MODULES,
    });
  }

  get<T = any>(serviceName: string): T {
    return this.diagram.get<T>(serviceName);
  }

  importLayout(graph: InteractionGraph, layout: InteractionGraphLayout): void {
    this.diagram.clear();
    const canvas = this.get('canvas');
    const elementFactory = this.get('elementFactory');
    const root = canvas.getRootElement();
    const processesById = new Map<string, any>();

    for (const process of graph.processes) {
      const bounds = layout.processes.get(process.id);
      if (bounds == null) {
        continue;
      }
      const shape = elementFactory.createShape({
        id: process.id,
        type: 'interactions-process',
        x: bounds.x,
        y: bounds.y,
        width: bounds.width || INTERACTION_PROCESS_WIDTH,
        height: bounds.height || INTERACTION_PROCESS_HEIGHT,
        businessObject: process,
      });
      canvas.addShape(shape, root);
      processesById.set(process.id, shape);
    }

    for (const port of graph.ports) {
      const processShape = processesById.get(`process:${port.uri}#${port.processId}`);
      const absolute = layout.ports.get(port.id);
      if (processShape == null || absolute == null) {
        continue;
      }
      const portShape = elementFactory.createShape({
        id: port.id,
        type: 'interactions-port',
        x: absolute.x,
        y: absolute.y,
        width: PORT_SIZE,
        height: PORT_SIZE,
        businessObject: port,
      });
      canvas.addShape(portShape, processShape);
    }

    for (const station of graph.stations) {
      const bounds = layout.stations.get(station.id);
      if (bounds == null) {
        continue;
      }
      const shape = elementFactory.createShape({
        id: station.id,
        type: 'interactions-station',
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        businessObject: station,
      });
      canvas.addShape(shape, root);
    }

    const shapesById = new Map<string, any>([
      ...processesById.entries(),
      ...graph.ports.map((port) => [port.id, this.get('elementRegistry').get(port.id)] as const),
      ...graph.stations.map((station) => [station.id, this.get('elementRegistry').get(station.id)] as const),
    ]);

    for (const line of graph.lines) {
      const source = shapesById.get(line.sourceId);
      const target = shapesById.get(line.targetId);
      if (source == null || target == null) {
        continue;
      }
      const waypoints = layout.edges.get(line.id)?.waypoints ?? [getMid(source), getMid(target)];
      const connection = elementFactory.createConnection({
        id: line.id,
        type: 'interactions-line',
        source,
        target,
        waypoints: waypoints.map((point) => ({ ...point })),
        businessObject: line,
      });
      canvas.addConnection(connection, root);
    }

    this.get('commandStack').clear();
  }

  exportSvg(): string {
    const canvas = this.get('canvas');
    const activeLayer: Element = canvas.getActiveLayer();
    const elements = this.get('elementRegistry').filter((element: any) => element.parent != null);
    const bounds = boundsOf(elements);
    const layer = activeLayer.cloneNode(true) as Element;
    layer
      .querySelectorAll('.djs-hit, .djs-outline, .djs-selection-outline, .djs-resizer')
      .forEach((node) => node.remove());
    const serializer = new XMLSerializer();
    const definitions = [...canvas._svg.querySelectorAll(':scope > defs')]
      .map((node: Element) => serializer.serializeToString(node))
      .join('');
    const originX = Math.floor(bounds.x - EXPORT_PADDING);
    const originY = Math.floor(bounds.y - EXPORT_PADDING);
    const exportWidth = Math.ceil(bounds.width + 2 * EXPORT_PADDING);
    const exportHeight = Math.ceil(bounds.height + 2 * EXPORT_PADDING);
    return replaceThemeColorsInSvg(
      `<?xml version="1.0" encoding="utf-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${exportWidth}" height="${exportHeight}" viewBox="${originX} ${originY} ${exportWidth} ${exportHeight}">${definitions}${serializer.serializeToString(layer)}</svg>`,
    );
  }

  updateFocus(enabled: boolean): void {
    const canvas = this.get('canvas');
    const elementRegistry = this.get('elementRegistry');
    const elements = elementRegistry.filter((element: any) => element.parent != null);
    for (const element of elements) {
      canvas.removeMarker(element, INTERACTIONS_FOCUSED_MARKER);
    }
    const selected: any[] = this.get('selection').get();
    const active = enabled && selected.length > 0;
    this.container.classList.toggle('interactions-map--focus', active);
    if (!active) {
      return;
    }
    const focused = new Set<any>();
    const addWithParent = (element: any): void => {
      focused.add(element);
      if (element.type === 'interactions-port' && element.parent != null) {
        focused.add(element.parent);
      }
      if (element.type === 'interactions-process') {
        element.children.forEach((port: any) => focused.add(port));
      }
    };
    const addLine = (connection: any): void => {
      focused.add(connection);
      addWithParent(connection.source);
      addWithParent(connection.target);
    };
    selected.forEach((element) => (element.waypoints == null ? addWithParent(element) : addLine(element)));
    for (const element of [...focused]) {
      if (element.waypoints == null) {
        [...element.incoming, ...element.outgoing].forEach(addLine);
      }
    }
    for (const element of focused) {
      if (element?.parent != null) {
        canvas.addMarker(element, INTERACTIONS_FOCUSED_MARKER);
      }
    }
  }

  zoomToViewport(): void {
    this.get('canvas').zoom('fit-viewport', 'auto');
  }

  zoomToActualSize(): void {
    this.get('canvas').zoom(1, 'auto');
  }

  zoomToSelectedElement(): void {
    const selected = this.get('selection').get()[0];
    if (selected != null) {
      this.get('canvas').zoom(1);
      this.get('canvas').scrollToElement(selected);
    }
  }

  getViewbox(): { x: number; y: number; width: number; height: number } {
    const viewbox = this.get('canvas').viewbox();
    return { x: viewbox.x, y: viewbox.y, width: viewbox.width, height: viewbox.height };
  }

  setViewbox(viewbox: { x: number; y: number; width: number; height: number }): void {
    this.get('canvas').viewbox(viewbox);
  }

  select(elementId: string): void {
    const element = this.get('elementRegistry').get(elementId);
    if (element != null) {
      this.get('selection').select(element);
    }
  }

  reveal(elementId: string): void {
    const element = this.get('elementRegistry').get(elementId);
    if (element != null) {
      this.get('canvas').scrollToElement(element);
      this.get('selection').select(element);
    }
  }

  toggleSearch(): void {
    this.get('searchPad').toggle();
  }

  destroy(): void {
    this.diagram.destroy();
  }
}
