import type { TextLayoutConfig } from 'diagram-js/lib/util/Text';
import Text from 'diagram-js/lib/util/Text';

const FONT_FAMILY = 'Arial, sans-serif';
const FONT_SIZE = 11;
const LINE_HEIGHT = 1.2;

/** Shared font for labels on the interactions canvas. */
export class InteractionsTextRenderer {
  private readonly text = new Text({
    style: { fontFamily: FONT_FAMILY, fontSize: FONT_SIZE, lineHeight: LINE_HEIGHT },
  });

  createText(label: string, options: TextLayoutConfig): SVGElement {
    return this.text.createText(label, options);
  }

  getDimensions(label: string, options: TextLayoutConfig): { width: number; height: number } {
    return this.text.getDimensions(label, options);
  }
}

export default {
  interactionsTextRenderer: ['type', InteractionsTextRenderer],
};
