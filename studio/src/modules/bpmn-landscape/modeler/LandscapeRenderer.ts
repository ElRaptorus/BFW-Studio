import type EventBus from 'diagram-js/lib/core/EventBus';
import BaseRenderer from 'diagram-js/lib/draw/BaseRenderer';
import { createLine } from 'diagram-js/lib/util/RenderUtil';
import Text from 'diagram-js/lib/util/Text';

import type {
  LandscapeConnector,
  LandscapeElement,
  LandscapePoint,
  LandscapeProcessElement,
} from '../LandscapeMapFile';
import type { RelationLine } from '../buildRelationLines';

export type LandscapeRendererConfig = {
  /** The text shown on a process shape: its own label, the process name from the solution, or the process id. */
  getProcessLabel(element: LandscapeProcessElement): string;
  /** The number of decisions the process references; a badge shows it when it is above zero. */
  getDecisionCount(element: LandscapeProcessElement): number;
};

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const DEFAULT_FILL = 'var(--color-bpmn-defaultFillColor)';
const DEFAULT_STROKE = 'var(--color-bpmn-defaultStrokeColor)';
const NOTE_CORNER = 14;
const LINE_LABEL_WIDTH = 160;
const LINE_STYLES: Record<RelationLine['kind'] | 'connector', { width: number; dash: string | null; arrow: string }> = {
  callActivity: { width: 2, dash: null, arrow: 'filled' },
  message: { width: 1.5, dash: '8 4', arrow: 'open' },
  signal: { width: 1.5, dash: '2 4', arrow: 'open' },
  connector: { width: 1.5, dash: null, arrow: 'filled' },
};
const RELATION_TITLES: Record<RelationLine['kind'], string> = {
  callActivity: 'calls',
  message: 'sends message',
  signal: 'throws signal',
};

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

/** Where a line's label sits: the middle of its longest segment. */
export function connectorLabelPoint(waypoints: LandscapePoint[]): LandscapePoint {
  let best = { length: -1, point: waypoints[0] ?? { x: 0, y: 0 } };
  for (let i = 1; i < waypoints.length; i++) {
    const start = waypoints[i - 1];
    const end = waypoints[i];
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    if (length > best.length) {
      best = { length, point: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 } };
    }
  }
  return best.point;
}

function chevronPath(width: number, height: number): string {
  const notch = Math.min(height / 2, width / 4);
  return `M0,0H${width - notch}L${width},${height / 2}L${width - notch},${height}H0L${notch},${height / 2}Z`;
}

function hasChevronShape(element: LandscapeElement): boolean {
  return (element.type === 'process' || element.type === 'placeholder') && element.shape === 'chevron';
}

/** Draws landscape elements from the file element each shape carries as `businessObject`. */
export default class LandscapeRenderer extends BaseRenderer {
  static $inject = ['eventBus', 'config.landscape', 'canvas'];

  private readonly config: LandscapeRendererConfig;
  private readonly textRenderer: Text;
  /** Marker ids are unique per canvas, because several maps can be open in one document. */
  private readonly markerIdPrefix = `landscape-marker-${crypto.randomUUID()}`;

  constructor(eventBus: EventBus, config: LandscapeRendererConfig, canvas: any) {
    super(eventBus, 1500);
    this.config = config;
    this.textRenderer = new Text({
      style: { fontFamily: 'Arial, sans-serif', fontSize: 12, lineHeight: 1.2, fill: DEFAULT_STROKE },
    });
    this.addMarkers(canvas._svg);
  }

  canRender(element: any): boolean {
    return element.businessObject != null;
  }

  drawShape(parentGraphics: SVGElement, shape: any): SVGElement {
    const element: LandscapeElement = shape.businessObject;
    const fill = element.style?.fill ?? DEFAULT_FILL;
    const stroke = element.style?.stroke ?? DEFAULT_STROKE;
    const style = `fill: ${fill}; stroke: ${stroke}; stroke-width: 2px;`;
    const dashedStyle = element.type === 'placeholder' ? `${style} stroke-dasharray: 6 4;` : style;
    let visual: SVGElement;
    if (element.type === 'note') {
      visual = createSvgElement('path', { ['d']: this.notePath(shape.width, shape.height), style });
    } else if (hasChevronShape(element)) {
      visual = createSvgElement('path', { ['d']: chevronPath(shape.width, shape.height), style: dashedStyle });
    } else {
      visual = createSvgElement('rect', {
        width: shape.width,
        height: shape.height,
        rx: element.type === 'process' || element.type === 'placeholder' ? 10 : 4,
        style: dashedStyle,
      });
    }
    visual.classList.add(`landscape-${element.type}`);
    parentGraphics.appendChild(visual);

    const isContainer = element.type === 'group' || element.type === 'band';
    let padding: number | { left: number; right: number; top: number; bottom: number } = isContainer ? 8 : 6;
    if (hasChevronShape(element)) {
      padding = { left: 18, right: 18, top: 6, bottom: 6 };
    }
    const text = this.textRenderer.createText(labelOf(element, this.config), {
      box: { width: shape.width, height: shape.height },
      align: isContainer ? 'center-top' : 'center-middle',
      padding,
    });
    text.classList.add('landscape-label');
    text.setAttribute('style', `fill: ${stroke};`);
    parentGraphics.appendChild(text);

    if (element.type === 'process') {
      this.drawDecisionBadge(parentGraphics, shape.width, this.config.getDecisionCount(element), stroke);
    }
    return visual;
  }

  drawConnection(parentGraphics: SVGElement, connection: any): SVGElement {
    const isRelation = connection.type === 'relation';
    const lineStyle = LINE_STYLES[isRelation ? (connection.businessObject as RelationLine).kind : 'connector'];
    const line = createLine(connection.waypoints, {
      fill: 'none',
      stroke: DEFAULT_STROKE,
      strokeWidth: lineStyle.width,
    });
    line.setAttribute('marker-end', `url(#${this.markerIdPrefix}-${lineStyle.arrow})`);
    if (lineStyle.dash != null) {
      line.setAttribute('stroke-dasharray', lineStyle.dash);
    }
    line.classList.add(isRelation ? 'landscape-relation' : 'landscape-connector');
    parentGraphics.appendChild(line);

    if (isRelation) {
      const relationLine: RelationLine = connection.businessObject;
      const title = createSvgElement('title', {});
      title.textContent = relationLine.relations
        .map(
          (relation) =>
            `${relation.source.processId} ${RELATION_TITLES[relation.kind]} ${relation.target.processId}${relation.name == null ? '' : `: ${relation.name}`}`,
        )
        .join('\n');
      line.appendChild(title);
    }
    this.drawLineLabel(parentGraphics, connection.waypoints, this.lineLabelOf(connection));
    return line;
  }

  getShapePath(shape: any): string {
    const { x, y, width, height } = shape;
    if (shape.businessObject != null && hasChevronShape(shape.businessObject)) {
      const notch = Math.min(height / 2, width / 4);
      return `M${x},${y}h${width - notch}l${notch},${height / 2}l${-notch},${height / 2}h${notch - width}l${notch},${-height / 2}z`;
    }
    return `M${x},${y}h${width}v${height}h${-width}z`;
  }

  getConnectionPath(connection: any): string {
    return `M${connection.waypoints.map((point: { x: number; y: number }) => `${point.x},${point.y}`).join('L')}`;
  }

  private lineLabelOf(connection: any): string {
    if (connection.type !== 'relation') {
      return (connection.businessObject as LandscapeConnector).label;
    }
    const relationLine: RelationLine = connection.businessObject;
    const hidden = new Set(relationLine.hiddenKeys);
    return relationLine.relations
      .filter((relation) => relation.name != null && !hidden.has(relation.key))
      .map((relation) => relation.name)
      .join(', ');
  }

  private drawLineLabel(parentGraphics: SVGElement, waypoints: LandscapePoint[], label: string): void {
    if (label === '') {
      return;
    }
    const point = connectorLabelPoint(waypoints);
    const text = this.textRenderer.createText(label, {
      box: { width: LINE_LABEL_WIDTH, height: 0 },
      align: 'center-middle',
      padding: 0,
    });
    text.classList.add('landscape-label', 'landscape-line-label');
    text.setAttribute('transform', `translate(${point.x - LINE_LABEL_WIDTH / 2}, ${point.y})`);
    parentGraphics.appendChild(text);
  }

  private drawDecisionBadge(parentGraphics: SVGElement, width: number, count: number, stroke: string): void {
    if (count <= 0) {
      return;
    }
    const badge = createSvgElement('g', { transform: `translate(${width - 30}, 5)` });
    badge.classList.add('landscape-decision-badge');
    const lineStyle = `fill: none; stroke: ${stroke}; stroke-width: 1px;`;
    badge.appendChild(createSvgElement('rect', { x: 0, y: 1, width: 12, height: 9, style: lineStyle }));
    badge.appendChild(createSvgElement('path', { ['d']: 'M0,4.5H12M4.5,1V10', style: lineStyle }));
    const countText = createSvgElement('text', {
      x: 15,
      y: 9.5,
      style: `fill: ${stroke}; font: 10px Arial, sans-serif;`,
    });
    countText.textContent = String(count);
    badge.appendChild(countText);
    const title = createSvgElement('title', {});
    title.textContent = `${count} ${count === 1 ? 'decision' : 'decisions'}`;
    badge.appendChild(title);
    parentGraphics.appendChild(badge);
  }

  private addMarkers(svg: SVGElement): void {
    const defs = createSvgElement('defs', {});
    const filled = createSvgElement('marker', {
      id: `${this.markerIdPrefix}-filled`,
      viewBox: '0 0 10 10',
      refX: 10,
      refY: 5,
      markerWidth: 8,
      markerHeight: 8,
      orient: 'auto-start-reverse',
      markerUnits: 'userSpaceOnUse',
    });
    filled.appendChild(createSvgElement('path', { ['d']: 'M0,0L10,5L0,10Z', style: `fill: ${DEFAULT_STROKE};` }));
    const open = createSvgElement('marker', {
      id: `${this.markerIdPrefix}-open`,
      viewBox: '0 0 10 10',
      refX: 10,
      refY: 5,
      markerWidth: 9,
      markerHeight: 9,
      orient: 'auto-start-reverse',
      markerUnits: 'userSpaceOnUse',
    });
    open.appendChild(
      createSvgElement('path', {
        ['d']: 'M1,1L10,5L1,9',
        style: `fill: none; stroke: ${DEFAULT_STROKE}; stroke-width: 1.5px;`,
      }),
    );
    defs.append(filled, open);
    svg.appendChild(defs);
  }

  private notePath(width: number, height: number): string {
    return `M0,0H${width - NOTE_CORNER}L${width},${NOTE_CORNER}V${height}H0Z`;
  }
}
