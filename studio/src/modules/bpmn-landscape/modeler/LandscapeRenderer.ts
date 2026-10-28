import type EventBus from 'diagram-js/lib/core/EventBus';
import BaseRenderer from 'diagram-js/lib/draw/BaseRenderer';
import { createLine } from 'diagram-js/lib/util/RenderUtil';
import Text from 'diagram-js/lib/util/Text';

import type {
  LandscapeConnector,
  LandscapeElement,
  LandscapeMapLinkElement,
  LandscapePoint,
  LandscapeProcessElement,
} from '../LandscapeMapFile';
import type { RelationLine } from '../buildRelationLines';
import type { ReferenceStatus } from '../resolveProcessReference';

export type LandscapeRendererConfig = {
  /** The text shown on a process shape: its own label, the process name from the solution, or the process id. */
  getProcessLabel(element: LandscapeProcessElement): string;
  /** The number of decisions the process references; a badge shows it when it is above zero. */
  getDecisionCount(element: LandscapeProcessElement): number;
  /** `missing` and `ambiguous` shapes are drawn greyed with a warning. */
  getProcessStatus(element: LandscapeProcessElement): ReferenceStatus;
  /** `missing` when the map the link names does not exist. */
  getMapLinkStatus(element: LandscapeMapLinkElement): Exclude<ReferenceStatus, 'ambiguous'>;
  /** Why a connector is drawn with a warning (it repeats a relation line); `null` when it is fine. */
  getConnectorWarning(connector: LandscapeConnector): string | null;
  /** Runs a command a plugin registered, for a palette or context pad entry the plugin contributes. */
  executePluginCommand(pluginName: string, command: string, args: unknown[]): void;
};

const BROKEN_OPACITY = 0.45;
const PROCESS_WARNING_TITLES: Record<Exclude<ReferenceStatus, 'resolved'>, string> = {
  missing: 'This process is not found in the solution.',
  ambiguous: 'This process is defined in several files. Choose one in the properties pane.',
};
const MAP_LINK_WARNING_TITLE = 'This map is not found in the landscape folder.';

function statusOf(element: LandscapeElement, config: LandscapeRendererConfig): ReferenceStatus {
  switch (element.type) {
    case 'process':
      return config.getProcessStatus(element);
    case 'mapLink':
      return config.getMapLinkStatus(element);
    default:
      return 'resolved';
  }
}

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const DEFAULT_FILL = 'var(--color-bpmn-defaultFillColor)';
const DEFAULT_STROKE = 'var(--color-bpmn-defaultStrokeColor)';
const NOTE_CORNER = 14;
export const BAND_HEADER_WIDTH = 32;
const LINE_LABEL_WIDTH = 160;
const LINE_STYLES: Record<RelationLine['kind'] | 'connector', { width: number; dash: string | null; arrow: string }> = {
  callActivity: { width: 2, dash: null, arrow: 'filled' },
  message: { width: 1.5, dash: '8 4', arrow: 'open' },
  signal: { width: 1.5, dash: '2 4', arrow: 'open' },
  connector: { width: 1.5, dash: null, arrow: 'filled' },
};
export const RELATION_TITLES: Record<RelationLine['kind'], string> = {
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
    // Styles are inline, not in the stylesheet, so an exported image looks the same.
    const fillOpacity = element.type === 'group' || element.type === 'band' ? ' fill-opacity: 0.6;' : '';
    const style = `fill: ${fill};${fillOpacity} stroke: ${stroke}; stroke-width: 2px;`;
    const status = statusOf(element, this.config);
    const isBroken = status !== 'resolved';
    const dashedStyle = element.type === 'placeholder' || isBroken ? `${style} stroke-dasharray: 6 4;` : style;
    let visual: SVGElement;
    if (element.type === 'note') {
      visual = createSvgElement('path', { ['d']: this.notePath(shape.width, shape.height), style });
    } else if (hasChevronShape(element)) {
      visual = createSvgElement('path', { ['d']: chevronPath(shape.width, shape.height), style: dashedStyle });
    } else {
      visual = createSvgElement('rect', {
        width: shape.width,
        height: shape.height,
        rx: element.type === 'process' || element.type === 'placeholder' || element.type === 'mapLink' ? 10 : 4,
        style: dashedStyle,
      });
    }
    visual.classList.add(`landscape-${element.type}`);
    parentGraphics.appendChild(visual);
    if (element.type === 'mapLink') {
      this.drawMapLinkDecoration(parentGraphics, shape.width, shape.height, stroke, isBroken);
    }

    const isCollapsedGroup = element.type === 'group' && element.collapsed;
    if (isCollapsedGroup) {
      this.drawCollapsedGroupDecoration(parentGraphics, shape.width, shape.height, stroke);
    }
    if (element.type === 'band') {
      this.drawBandHeader(parentGraphics, shape.height, element.label, stroke);
      return visual;
    }

    const isContainer = element.type === 'group' && !isCollapsedGroup;
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

    if (status !== 'resolved') {
      visual.setAttribute('opacity', String(BROKEN_OPACITY));
      text.setAttribute('opacity', String(BROKEN_OPACITY));
      this.drawWarning(
        parentGraphics,
        element.type === 'process' ? PROCESS_WARNING_TITLES[status] : MAP_LINK_WARNING_TITLE,
      );
    }

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
    if (!isRelation) {
      this.drawConnectorWarning(parentGraphics, connection);
    }
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

  /** A relation line that ends at a collapsed group stands for several relations; its label is their count. */
  private lineLabelOf(connection: any): string {
    if (connection.type !== 'relation') {
      return (connection.businessObject as LandscapeConnector).label;
    }
    const relationLine: RelationLine = connection.businessObject;
    const hidden = new Set(relationLine.hiddenKeys);
    const visibleRelations = relationLine.relations.filter((relation) => !hidden.has(relation.key));
    if (connection.relationSource.type === 'group' || connection.relationTarget.type === 'group') {
      return String(visibleRelations.length);
    }
    return visibleRelations
      .filter((relation) => relation.name != null)
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
    // A halo in the fill colour keeps the label readable where it crosses a line.
    text.setAttribute(
      'style',
      `stroke: ${DEFAULT_FILL}; stroke-width: 4px; stroke-linejoin: round; paint-order: stroke;`,
    );
    parentGraphics.appendChild(text);
  }

  /** An inner border and a plus in a square mark a group that is collapsed. */
  private drawCollapsedGroupDecoration(
    parentGraphics: SVGElement,
    width: number,
    height: number,
    stroke: string,
  ): void {
    const lineStyle = `fill: none; stroke: ${stroke}; stroke-width: 1px;`;
    parentGraphics.appendChild(
      createSvgElement('rect', { x: 4, y: 4, width: width - 8, height: height - 8, rx: 2, style: lineStyle }),
    );
    const glyph = createSvgElement('path', {
      ['d']: 'M0,0H10V10H0ZM5,2V8M2,5H8',
      transform: `translate(${width - 22}, 8)`,
      style: lineStyle,
    });
    parentGraphics.appendChild(glyph);
  }

  /** A band has a strip on its left edge that carries the label, written upwards. */
  private drawBandHeader(parentGraphics: SVGElement, height: number, label: string, stroke: string): void {
    parentGraphics.appendChild(
      createSvgElement('rect', {
        x: 0,
        y: 0,
        width: BAND_HEADER_WIDTH,
        height,
        style: `fill: ${stroke}; fill-opacity: 0.12; stroke: ${stroke}; stroke-width: 2px;`,
      }),
    );
    const text = this.textRenderer.createText(label, {
      box: { width: height, height: BAND_HEADER_WIDTH },
      align: 'center-middle',
      padding: 4,
    });
    text.classList.add('landscape-label');
    text.setAttribute('transform', `translate(0, ${height}) rotate(-90)`);
    text.setAttribute('style', `fill: ${stroke};`);
    parentGraphics.appendChild(text);
  }

  /** A second border inside the rounded rectangle and a folded-map glyph mark a link to another map. */
  private drawMapLinkDecoration(
    parentGraphics: SVGElement,
    width: number,
    height: number,
    stroke: string,
    isBroken: boolean,
  ): void {
    const lineStyle = `fill: none; stroke: ${stroke}; stroke-width: 1px;`;
    const opacity = isBroken ? String(BROKEN_OPACITY) : '1';
    const inner = createSvgElement('rect', {
      x: 4,
      y: 4,
      width: width - 8,
      height: height - 8,
      rx: 7,
      style: lineStyle,
    });
    const glyph = createSvgElement('path', {
      ['d']: 'M0,2L4,0L8,2L12,0V8L8,10L4,8L0,10ZM4,0V8M8,2V10',
      transform: `translate(${width - 22}, 7)`,
      style: lineStyle,
    });
    for (const decoration of [inner, glyph]) {
      decoration.setAttribute('opacity', opacity);
      parentGraphics.appendChild(decoration);
    }
  }

  /** The warning triangle sits above the middle of the connector, where its label is. */
  private drawConnectorWarning(parentGraphics: SVGElement, connection: any): void {
    const title = this.config.getConnectorWarning(connection.businessObject as LandscapeConnector);
    if (title == null) {
      return;
    }
    const point = connectorLabelPoint(connection.waypoints);
    this.drawWarning(parentGraphics, title, { x: point.x - 7, y: point.y - 22 });
  }

  private drawWarning(parentGraphics: SVGElement, title: string, position: LandscapePoint = { x: 7, y: 6 }): void {
    const warning = createSvgElement('g', { transform: `translate(${position.x}, ${position.y})` });
    warning.classList.add('landscape-reference-warning');
    warning.appendChild(
      createSvgElement('path', {
        ['d']: 'M7,0L14,13H0Z',
        style: 'fill: #f59e0b; stroke: #92400e; stroke-width: 1px; stroke-linejoin: round;',
      }),
    );
    warning.appendChild(
      createSvgElement('path', {
        ['d']: 'M7,4.5V8.5M7,10.2V11',
        style: 'fill: none; stroke: #451a03; stroke-width: 1.5px;',
      }),
    );
    const warningTitle = createSvgElement('title', {});
    warningTitle.textContent = title;
    warning.appendChild(warningTitle);
    parentGraphics.appendChild(warning);
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
