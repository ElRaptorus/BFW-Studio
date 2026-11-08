/** The gap diagram-js keeps between a shape and its outline. */
const OFFSET = 4;

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

class InteractionsOutline {
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
    const width = element.width + 2 * OFFSET;
    const height = element.height + 2 * OFFSET;
    const radius = element.type === 'interactions-station' ? height / 2 : 6;
    outline.setAttribute('d', roundedRectanglePath(width, height, radius + OFFSET));
    outline.setAttribute('transform', `translate(${-OFFSET}, ${-OFFSET})`);
    return true;
  }
}

export default {
  __init__: ['interactionsOutline'],
  interactionsOutline: ['type', InteractionsOutline],
};
