const TOKEN_RADIUS = 8;
const TOKEN_CLASS = 'token-sim-token';
const LAYER_NAME = 'token-simulation';

interface TokenEntry {
  circle: SVGCircleElement;
  elementId: string;
}

export class TokenRenderer {
  private canvas: any;
  private tokens = new Map<string, TokenEntry[]>();

  constructor(canvas: any) {
    this.canvas = canvas;
  }

  private getLayer(): SVGGElement {
    return this.canvas.getLayer(LAYER_NAME, 1);
  }

  addToken(element: any): void {
    const layer = this.getLayer();
    const center = this.getElementCenter(element);

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', String(center.x));
    circle.setAttribute('cy', String(center.y));
    circle.setAttribute('r', String(TOKEN_RADIUS));
    circle.setAttribute('class', TOKEN_CLASS);
    layer.appendChild(circle);

    const entry: TokenEntry = { circle, elementId: element.id };

    if (!this.tokens.has(element.id)) {
      this.tokens.set(element.id, []);
    }
    this.tokens.get(element.id)!.push(entry);
  }

  removeTokensForElement(elementId: string): void {
    const entries = this.tokens.get(elementId);
    if (!entries) {
      return;
    }

    for (const entry of entries) {
      entry.circle.remove();
    }
    this.tokens.delete(elementId);
  }

  fadeTokensForElement(elementId: string): void {
    const entries = this.tokens.get(elementId);
    if (!entries) {
      return;
    }
    for (const entry of entries) {
      entry.circle.style.opacity = '0.3';
    }
  }

  clear(): void {
    for (const [, entries] of this.tokens) {
      for (const entry of entries) {
        entry.circle.remove();
      }
    }
    this.tokens.clear();
  }

  private getElementCenter(element: any): { x: number; y: number } {
    return {
      x: element.x + (element.width || 0) / 2,
      y: element.y + (element.height || 0) / 2,
    };
  }
}
