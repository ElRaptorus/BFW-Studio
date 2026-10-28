import { NOTE_CORNER, chevronPath, hasChevronShape } from '../LandscapeRenderer';

/** The gap diagram-js keeps between a shape and its outline. */
const OFFSET = 5;
const ROUNDED_TYPES = new Set(['process', 'placeholder', 'mapLink']);
const ROUNDED_RADIUS = 10;
const BOX_RADIUS = 4;

function roundedRectanglePath(width: number, height: number, radius: number): string {
  const arc = `A${radius},${radius} 0 0 1`;
  return [
    `M${radius},0H${width - radius}`,
    `${arc} ${width},${radius}V${height - radius}`,
    `${arc} ${width - radius},${height}H${radius}`,
    `${arc} 0,${height - radius}V${radius}`,
    `${arc} ${radius},0Z`,
  ].join('');
}

/** The outline path of a shape, `OFFSET` outside its border, in the shape's own coordinates. */
function outlinePathOf(shape: any): string {
  const width = shape.width + 2 * OFFSET;
  const height = shape.height + 2 * OFFSET;
  if (shape.type === 'note') {
    return `M0,0H${width - NOTE_CORNER}L${width},${NOTE_CORNER}V${height}H0Z`;
  }
  if (hasChevronShape(shape.businessObject)) {
    return chevronPath(width, height);
  }
  return roundedRectanglePath(width, height, (ROUNDED_TYPES.has(shape.type) ? ROUNDED_RADIUS : BOX_RADIUS) + OFFSET);
}

/**
 * Selection and hover outlines that follow the drawn shape: rounded boxes, chevrons and folded notes. One path serves
 * every shape, so a shape that changes from box to chevron keeps its outline element.
 */
class LandscapeOutline {
  static $inject = ['outline', 'styles'];

  private readonly outlineStyle: Record<string, unknown>;

  constructor(outline: any, styles: any) {
    this.outlineStyle = styles.cls('djs-outline', ['no-fill']);
    outline.registerProvider(this);
  }

  getOutline(element: any): SVGElement | undefined {
    if (element.waypoints != null || element.businessObject == null) {
      return undefined;
    }
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    for (const [name, value] of Object.entries(this.outlineStyle)) {
      path.setAttribute(name, String(value));
    }
    return path;
  }

  updateOutline(element: any, outline: SVGElement): boolean {
    if (element.waypoints != null || element.businessObject == null || outline.tagName !== 'path') {
      return false;
    }
    outline.setAttribute('d', outlinePathOf(element));
    outline.setAttribute('transform', `translate(${-OFFSET}, ${-OFFSET})`);
    return true;
  }
}

export default {
  __init__: ['landscapeOutline'],
  landscapeOutline: ['type', LandscapeOutline],
};
