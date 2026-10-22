import type EventBus from 'diagram-js/lib/core/EventBus';
import BaseRenderer from 'diagram-js/lib/draw/BaseRenderer';
import { createLine } from 'diagram-js/lib/util/RenderUtil';
import Text from 'diagram-js/lib/util/Text';

import type { LandscapeElement, LandscapeProcessElement } from '../LandscapeMapFile';

export type LandscapeRendererConfig = {
  /** The text shown on a process shape: its own label, the process name from the solution, or the process id. */
  getProcessLabel(element: LandscapeProcessElement): string;
};

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const DEFAULT_FILL = 'var(--color-bpmn-defaultFillColor)';
const DEFAULT_STROKE = 'var(--color-bpmn-defaultStrokeColor)';
const NOTE_CORNER = 14;

function createSvgElement(tagName: string, attributes: Record<string, string | number>): SVGElement {
  const element = document.createElementNS(SVG_NAMESPACE, tagName);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, String(value));
  }
  return element;
}

function labelOf(element: LandscapeElement, config: LandscapeRendererConfig): string {
  switch (element.type) {
    case 'process':
      return config.getProcessLabel(element);
    case 'note':
      return element.text;
    default:
      return element.label;
  }
}

/** Draws landscape elements from the file element each shape carries as `businessObject`. */
export default class LandscapeRenderer extends BaseRenderer {
  static $inject = ['eventBus', 'config.landscape'];

  private readonly config: LandscapeRendererConfig;
  private readonly textRenderer: Text;

  constructor(eventBus: EventBus, config: LandscapeRendererConfig) {
    super(eventBus, 1500);
    this.config = config;
    this.textRenderer = new Text({
      style: { fontFamily: 'Arial, sans-serif', fontSize: 12, lineHeight: 1.2, fill: DEFAULT_STROKE },
    });
  }

  canRender(element: any): boolean {
    return element.businessObject != null;
  }

  drawShape(parentGraphics: SVGElement, shape: any): SVGElement {
    const element: LandscapeElement = shape.businessObject;
    const fill = element.style?.fill ?? DEFAULT_FILL;
    const stroke = element.style?.stroke ?? DEFAULT_STROKE;
    const style = `fill: ${fill}; stroke: ${stroke}; stroke-width: 2px;`;
    const visual =
      element.type === 'note'
        ? createSvgElement('path', { ['d']: this.notePath(shape.width, shape.height), style })
        : createSvgElement('rect', {
            width: shape.width,
            height: shape.height,
            rx: element.type === 'process' || element.type === 'placeholder' ? 10 : 4,
            style: element.type === 'placeholder' ? `${style} stroke-dasharray: 6 4;` : style,
          });
    visual.classList.add(`landscape-${element.type}`);
    parentGraphics.appendChild(visual);

    const isContainer = element.type === 'group' || element.type === 'band';
    const text = this.textRenderer.createText(labelOf(element, this.config), {
      box: { width: shape.width, height: shape.height },
      align: isContainer ? 'center-top' : 'center-middle',
      padding: isContainer ? 8 : 6,
    });
    text.classList.add('landscape-label');
    text.setAttribute('style', `fill: ${stroke};`);
    parentGraphics.appendChild(text);
    return visual;
  }

  drawConnection(parentGraphics: SVGElement, connection: any): SVGElement {
    const line = createLine(connection.waypoints, {
      fill: 'none',
      stroke: DEFAULT_STROKE,
      strokeWidth: 1.5,
    });
    line.classList.add('landscape-connector');
    parentGraphics.appendChild(line);
    return line;
  }

  getShapePath(shape: any): string {
    const { x, y, width, height } = shape;
    return `M${x},${y}h${width}v${height}h${-width}z`;
  }

  getConnectionPath(connection: any): string {
    return `M${connection.waypoints.map((point: { x: number; y: number }) => `${point.x},${point.y}`).join('L')}`;
  }

  private notePath(width: number, height: number): string {
    return `M0,0H${width - NOTE_CORNER}L${width},${NOTE_CORNER}V${height}H0Z`;
  }
}
