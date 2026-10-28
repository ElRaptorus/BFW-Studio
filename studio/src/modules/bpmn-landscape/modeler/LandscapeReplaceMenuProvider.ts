import { createElementId } from '../LandscapeMapFile';
import type { LandscapeShape } from '../LandscapeMapFile';
import type { ReplacementType } from './LandscapeReplace';
import { convertLandscapeElement } from './LandscapeReplace';
import { UPDATE_ELEMENT_COMMAND } from './LandscapeUpdates';
import { shapeAttributesOf } from './landscapeCanvasMapping';

const PROVIDER_ID = 'landscape-replace';
const POPUP_OFFSET = 5;
const POPUP_WIDTH = 300;

type MenuEntry = { label: string; description: string; icon: string };

const TYPE_ENTRIES: Record<ReplacementType, MenuEntry> = {
  placeholder: { label: 'Placeholder', description: 'A process that is not modelled yet', icon: 'ph-rectangle-dashed' },
  note: { label: 'Note', description: 'Free text on the map', icon: 'ph-note' },
};

const SHAPE_ENTRIES: Record<LandscapeShape, MenuEntry> = {
  box: { label: 'Box shape', description: 'Rounded rectangle', icon: 'ph-rectangle' },
  chevron: { label: 'Chevron shape', description: 'Arrow shape for value chains', icon: 'ph-caret-double-right' },
};

/**
 * A popup entry with a Phosphor icon. The icon goes into `imageHtml`: diagram-js puts `className` on the element that
 * also holds the label, and Phosphor's class sets the icon font on that element, so the label would be drawn in it.
 */
export function popupEntry(entry: MenuEntry): { label: string; description: string; imageHtml: string } {
  return {
    label: entry.label,
    description: entry.description,
    imageHtml: `<i class="ph ${entry.icon}" aria-hidden="true"></i>`,
  };
}

/** Where a popup for the element opens: below its context pad, else below the element; in viewport coordinates. */
export function popupPositionOf(
  element: any,
  contextPad: any,
  elementRegistry: any,
  cursor?: { x: number; y: number },
): { x: number; y: number; cursor?: { x: number; y: number } } {
  const anchor = contextPad.isOpen(element) ? contextPad.getPad(element).html : elementRegistry.getGraphics(element);
  const rectangle = anchor.getBoundingClientRect();
  return { x: rectangle.left, y: rectangle.bottom + POPUP_OFFSET, cursor };
}

/** The types an element can change to: a process becomes a placeholder or a note, the others swap with each other. */
function replacementTypesOf(elementType: string): ReplacementType[] {
  switch (elementType) {
    case 'process':
      return ['placeholder', 'note'];
    case 'placeholder':
      return ['note'];
    case 'note':
      return ['placeholder'];
    default:
      return [];
  }
}

/** The "Change element" popup of processes, placeholders and notes; picking an entry is one undo step. */
export default class LandscapeReplaceMenuProvider {
  static $inject = ['popupMenu', 'modeling', 'elementRegistry', 'selection', 'commandStack', 'contextPad'];

  constructor(
    private readonly popupMenu: any,
    private readonly modeling: any,
    private readonly elementRegistry: any,
    private readonly selection: any,
    private readonly commandStack: any,
    private readonly contextPad: any,
  ) {
    popupMenu.registerProvider(PROVIDER_ID, this);
  }

  /** Whether the popup has entries for the element. */
  canReplace(element: any): boolean {
    return replacementTypesOf(element.type).length > 0;
  }

  /** Opens the popup below the element's context pad, or below the element when it has none. */
  open(element: any, cursor?: { x: number; y: number }): void {
    this.popupMenu.open(element, PROVIDER_ID, popupPositionOf(element, this.contextPad, this.elementRegistry, cursor), {
      title: 'Change element',
      width: POPUP_WIDTH,
      search: true,
    });
  }

  getPopupMenuEntries(element: any): Record<string, unknown> {
    const entries: Record<string, unknown> = {};
    for (const type of replacementTypesOf(element.type)) {
      entries[`replace-with-${type}`] = {
        ...popupEntry(TYPE_ENTRIES[type]),
        group: { id: 'type', name: 'Type' },
        action: () => this.replace(element, type),
      };
    }
    if (element.type === 'process' || element.type === 'placeholder') {
      for (const shape of ['box', 'chevron'] as const) {
        if (element.businessObject.shape !== shape) {
          entries[`shape-${shape}`] = {
            ...popupEntry(SHAPE_ENTRIES[shape]),
            group: { id: 'shape', name: 'Shape' },
            action: () => this.commandStack.execute(UPDATE_ELEMENT_COMMAND, { element, properties: { shape } }),
          };
        }
      }
    }
    return entries;
  }

  private replace(shape: any, type: ReplacementType): void {
    const element = convertLandscapeElement(
      shape.businessObject,
      type,
      createElementId(type, (id) => this.elementRegistry.get(id) != null),
    );
    const replacement = this.modeling.replaceShape(shape, {
      ...shapeAttributesOf(element),
      x: shape.x + shape.width / 2,
      y: shape.y + shape.height / 2,
    });
    this.selection.select(replacement);
  }
}
