import type { TextLayoutConfig } from 'diagram-js/lib/util/Text';
import Text from 'diagram-js/lib/util/Text';

const FONT_FAMILY = 'Arial, sans-serif';
const FONT_SIZE = 12;
const LINE_HEIGHT = 1.2;

/**
 * The one font of the map, for drawn text and the label editor. Text wraps and centres by the measured width of this
 * font, and diagram-js writes the font into the inline style of the `<text>`: colours go in through `options.style`,
 * because `setAttribute('style', …)` would drop the font.
 */
export class LandscapeTextRenderer {
  private readonly text = new Text({
    style: { fontFamily: FONT_FAMILY, fontSize: FONT_SIZE, lineHeight: LINE_HEIGHT },
  });

  createText(label: string, options: TextLayoutConfig): SVGElement {
    return this.text.createText(label, options);
  }

  /** The style of the direct editing box at the given zoom, matching the drawn text. */
  getEditingStyle(zoom: number): Record<string, string | number> {
    return { fontSize: `${FONT_SIZE * zoom}px`, lineHeight: LINE_HEIGHT, fontFamily: FONT_FAMILY, textAlign: 'center' };
  }
}

export default {
  landscapeTextRenderer: ['type', LandscapeTextRenderer],
};
