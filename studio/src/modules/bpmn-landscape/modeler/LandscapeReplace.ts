import type { LandscapeNoteElement, LandscapePlaceholderElement, LandscapeProcessElement } from '../LandscapeMapFile';

export type ReplacementType = 'placeholder' | 'note';
type ReplaceableElement = LandscapeProcessElement | LandscapePlaceholderElement | LandscapeNoteElement;

/** The name an element shows, which a replacement keeps: a process without its own label shows its process id. */
function nameOf(element: ReplaceableElement): string {
  switch (element.type) {
    case 'process':
      return element.label ?? element.processId;
    case 'placeholder':
      return element.label;
    case 'note':
      return element.text;
  }
}

/**
 * The element `element` becomes when its type changes to `type`, under the new `id`: same place, size, group and
 * colours, and the name carried over. A note's text is the name; a placeholder's label is the first line of it.
 */
export function convertLandscapeElement(
  element: ReplaceableElement,
  type: ReplacementType,
  id: string,
): LandscapePlaceholderElement | LandscapeNoteElement {
  const { parentId, x, y, width, height, style } = element;
  const base = { id, parentId, x, y, width, height, style };
  const name = nameOf(element);
  if (type === 'note') {
    return { ...base, type, text: name };
  }
  return { ...base, type, label: name.split('\n')[0] ?? '', shape: element.type === 'note' ? 'box' : element.shape };
}
