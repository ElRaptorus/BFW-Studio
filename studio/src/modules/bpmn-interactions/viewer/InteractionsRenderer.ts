import type EventBus from 'diagram-js/lib/core/EventBus';
import BaseRenderer from 'diagram-js/lib/draw/BaseRenderer';
import { createLine } from 'diagram-js/lib/util/RenderUtil';
import type { TextLayoutConfig } from 'diagram-js/lib/util/Text';

import type {
  InteractionGraphLine,
  InteractionGraphPort,
  InteractionGraphProcess,
  InteractionGraphStation,
} from '../buildInteractionGraph';
import type { InteractionsTextRenderer } from './features/InteractionsTextRenderer';
import { drawPortGlyph } from './portGlyphs';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const MESSAGE_COLOR = '#2563eb';
const SIGNAL_COLOR = '#ea580c';
const DEFAULT_FILL = 'var(--color-bpmn-defaultFillColor)';
const DEFAULT_STROKE = 'var(--color-bpmn-defaultStrokeColor)';
const WARNING_COLOR = '#b45309';
const STUB_LENGTH = 16;

function lineColor(kind: 'message' | 'signal'): string {
  return kind === 'message' ? MESSAGE_COLOR : SIGNAL_COLOR;
}

function createSvgElement(tagName: string, attributes: Record<string, string | number>): SVGElement {
  const element = document.createElementNS(SVG_NAMESPACE, tagName);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, String(value));
  }
  return element;
}

export default class InteractionsRenderer extends BaseRenderer {
  static $inject = ['eventBus', 'interactionsTextRenderer', 'canvas'];

  private readonly textRenderer: InteractionsTextRenderer;
  private readonly markerIdPrefix = `interactions-marker-${crypto.randomUUID()}`;

  constructor(eventBus: EventBus, textRenderer: InteractionsTextRenderer, canvas: any) {
    super(eventBus, 1600);
    this.textRenderer = textRenderer;
    this.addArrowMarkers(canvas._svg);
  }

  canRender(element: any): boolean {
    return element.businessObject != null;
  }

  drawShape(parentGraphics: SVGElement, shape: any): SVGElement {
    if (shape.type === 'interactions-process') {
      return this.drawProcess(parentGraphics, shape);
    }
    if (shape.type === 'interactions-port') {
      return this.drawPort(parentGraphics, shape);
    }
    if (shape.type === 'interactions-station') {
      return this.drawStation(parentGraphics, shape);
    }
    const rectangle = createSvgElement('rect', { width: shape.width, height: shape.height, fill: 'none' });
    parentGraphics.appendChild(rectangle);
    return rectangle;
  }

  drawConnection(parentGraphics: SVGElement, connection: any): SVGElement {
    const line = connection.businessObject as InteractionGraphLine;
    const color = lineColor(line.kind);
    const path = createLine(connection.waypoints, {
      stroke: color,
      strokeWidth: 2,
      markerEnd: `url(#${this.markerIdPrefix}-arrow-${line.kind})`,
    });
    path.classList.add('interactions-line');
    parentGraphics.appendChild(path);
    return path;
  }

  getShapePath(shape: any): string {
    return `M${shape.x},${shape.y}h${shape.width}v${shape.height}h${-shape.width}z`;
  }

  getConnectionPath(connection: any): string {
    return `M${connection.waypoints.map((point: { x: number; y: number }) => `${point.x},${point.y}`).join('L')}`;
  }

  private drawProcess(parentGraphics: SVGElement, shape: any): SVGElement {
    const process = shape.businessObject as InteractionGraphProcess;
    const frame = createSvgElement('rect', {
      width: shape.width,
      height: shape.height,
      rx: 6,
      fill: DEFAULT_FILL,
      stroke: DEFAULT_STROKE,
      'stroke-width': 1,
    });
    parentGraphics.appendChild(frame);
    const label = this.textRenderer.createText(process.label, {
      box: { width: shape.width - 8, height: 18 },
      align: 'center-top',
      padding: 4,
      style: { fill: DEFAULT_STROKE, fontWeight: 'bold' },
    });
    label.setAttribute('transform', 'translate(4, 6)');
    parentGraphics.appendChild(label);
    const fileLabel = this.textRenderer.createText(process.fileLabel, {
      box: { width: shape.width - 8, height: 14 },
      align: 'center-top',
      padding: 2,
      style: { fill: '#64748b', fontSize: 9 },
    });
    fileLabel.setAttribute('transform', `translate(4, ${shape.height - 18})`);
    parentGraphics.appendChild(fileLabel);
    return frame;
  }

  private drawPort(parentGraphics: SVGElement, shape: any): SVGElement {
    const port = shape.businessObject as InteractionGraphPort;
    const group = createSvgElement('g', {});
    drawPortGlyph(group, port, shape.width);
    const labelText = port.name ?? port.nameWarning ?? '';
    if (labelText !== '') {
      const processWidth = shape.parent?.width ?? 200;
      const maxLabelWidth = Math.max(32, processWidth / 2 - shape.width - 8);
      const isCatch = port.direction === 'catch';
      const labelHeight = 12;
      const labelOptions: TextLayoutConfig = {
        box: { width: maxLabelWidth, height: labelHeight },
        align: 'center-top',
        padding: 0,
        style: { fill: port.nameWarning != null ? WARNING_COLOR : DEFAULT_STROKE, fontSize: 9 },
      };
      const fittedText = this.fitToOneLine(labelText, labelOptions);
      const label = this.textRenderer.createText(fittedText, labelOptions);
      if (fittedText !== labelText) {
        const title = createSvgElement('title', {});
        title.textContent = labelText;
        label.appendChild(title);
      }
      const labelX = isCatch ? shape.width + 2 : -maxLabelWidth - 2;
      const labelY = (shape.height - labelHeight) / 2;
      label.setAttribute('transform', `translate(${labelX}, ${labelY})`);
      label.setAttribute('data-test--interactions-port-label', '');
      parentGraphics.appendChild(label);
    }
    if (port.showPartnersOutsideViewStub) {
      this.drawStub(parentGraphics, port, shape);
    }
    if (port.showNoPartnerInSolutionGlyph) {
      this.drawNoPartnerGlyph(parentGraphics, shape);
    }
    parentGraphics.appendChild(group);
    return group;
  }

  /** Shortens a label with "…" until it fits on one line, so neighbouring port labels never overlap. */
  private fitToOneLine(labelText: string, options: TextLayoutConfig): string {
    const oneLineHeight = this.textRenderer.getDimensions('M', options).height;
    if (this.textRenderer.getDimensions(labelText, options).height <= oneLineHeight) {
      return labelText;
    }
    for (let length = labelText.length - 1; length > 0; length--) {
      const candidate = `${labelText.slice(0, length).trimEnd()}…`;
      if (this.textRenderer.getDimensions(candidate, options).height <= oneLineHeight) {
        return candidate;
      }
    }
    return '…';
  }

  /** A short line pointing away from the process, labelled with the number of partners outside the view. */
  private drawStub(parentGraphics: SVGElement, port: InteractionGraphPort, shape: any): void {
    const outward = port.direction === 'throw' ? 1 : -1;
    const start = port.direction === 'throw' ? shape.width : 0;
    const end = start + outward * STUB_LENGTH;
    const middle = shape.height / 2;
    const stubGroup = createSvgElement('g', { class: 'interactions-port-stub' });
    stubGroup.setAttribute('data-test--interactions-stub', '');
    stubGroup.appendChild(
      createSvgElement('path', {
        ['d']: `M${start},${middle}L${end},${middle}`,
        stroke: lineColor(port.kind),
        'stroke-width': 2,
        'stroke-dasharray': '3 2',
      }),
    );
    const text = createSvgElement('text', {
      x: end + outward * 2,
      y: middle - 3,
      'font-family': 'Arial, sans-serif',
      'font-size': 9,
      fill: DEFAULT_STROKE,
      'text-anchor': port.direction === 'throw' ? 'start' : 'end',
    });
    text.textContent =
      port.direction === 'throw'
        ? `→ ${port.partnersOutsideViewCount} outside the view`
        : `${port.partnersOutsideViewCount} outside the view ←`;
    stubGroup.appendChild(text);
    parentGraphics.appendChild(stubGroup);
  }

  private drawNoPartnerGlyph(parentGraphics: SVGElement, shape: any): void {
    const glyph = createSvgElement('g', {
      class: 'interactions-port-warning',
      transform: `translate(${shape.width - 2}, -8)`,
    });
    const title = createSvgElement('title', {});
    title.textContent = 'Unconnected: no process in the solution has a partner for this event';
    glyph.appendChild(title);
    glyph.appendChild(createSvgElement('circle', { cx: 5, cy: 5, ['r']: 5, fill: '#fef3c7', stroke: WARNING_COLOR }));
    const mark = createSvgElement('text', {
      x: 5,
      y: 8.5,
      'font-family': 'Arial, sans-serif',
      'font-size': 9,
      'font-weight': 'bold',
      fill: WARNING_COLOR,
      'text-anchor': 'middle',
    });
    mark.textContent = '!';
    glyph.appendChild(mark);
    parentGraphics.appendChild(glyph);
  }

  private drawStation(parentGraphics: SVGElement, shape: any): SVGElement {
    const station = shape.businessObject as InteractionGraphStation;
    const pill = createSvgElement('rect', {
      width: shape.width,
      height: shape.height,
      rx: shape.height / 2,
      fill: DEFAULT_FILL,
      stroke: lineColor(station.kind),
      'stroke-width': 2,
    });
    parentGraphics.appendChild(pill);
    const label = this.textRenderer.createText(station.name, {
      box: { width: shape.width - 6, height: shape.height },
      align: 'center-middle',
      padding: 2,
      style: { fill: DEFAULT_STROKE, fontSize: 10 },
    });
    label.setAttribute('transform', 'translate(3, 0)');
    parentGraphics.appendChild(label);
    return pill;
  }

  private addArrowMarkers(svgRoot: SVGSVGElement): void {
    const definitions = document.createElementNS(SVG_NAMESPACE, 'defs');
    for (const kind of ['message', 'signal'] as const) {
      const marker = createSvgElement('marker', {
        id: `${this.markerIdPrefix}-arrow-${kind}`,
        viewBox: '0 0 10 10',
        refX: 9,
        refY: 5,
        markerWidth: 6,
        markerHeight: 6,
        orient: 'auto',
      });
      const path = createSvgElement('path', {
        ['d']: 'M 0 0 L 10 5 L 0 10 z',
        fill: lineColor(kind),
      });
      marker.appendChild(path);
      definitions.appendChild(marker);
    }
    svgRoot.appendChild(definitions);
  }
}
