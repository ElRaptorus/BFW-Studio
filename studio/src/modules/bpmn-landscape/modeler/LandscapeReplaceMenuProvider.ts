import { createElementId } from '../LandscapeMapFile';
import type { LandscapeShape } from '../LandscapeMapFile';
import type { ReplacementType } from './LandscapeReplace';
import { convertLandscapeElement } from './LandscapeReplace';
import { UPDATE_ELEMENT_COMMAND } from './LandscapeUpdates';
import { shapeAttributesOf } from './landscapeCanvasMapping';

const PROVIDER_ID = 'landscape-replace';
const POPUP_OFFSET = 5;

const TYPE_ENTRIES: Record<ReplacementType, { label: string; className: string }> = {
  placeholder: { label: 'Placeholder', className: 'ph ph-rectangle-dashed' },
  note: { label: 'Note', className: 'ph ph-note' },
};

const SHAPE_ENTRIES: Record<LandscapeShape, { label: string; className: string }> = {
  box: { label: 'Box shape', className: 'ph ph-rectangle' },
  chevron: { label: 'Chevron shape', className: 'ph ph-caret-double-right' },
};

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

/** The "Change type" popup of processes, placeholders and notes; picking an entry is one undo step. */
export default class LandscapeReplaceMenuProvider {
  static $inject = ['popupMenu', 'modeling', 'elementRegistry', 'selection', 'commandStack', 'canvas', 'contextPad'];

  constructor(
    private readonly popupMenu: any,
    private readonly modeling: any,
    private readonly elementRegistry: any,
    private readonly selection: any,
    private readonly commandStack: any,
    private readonly canvas: any,
    private readonly contextPad: any,
  ) {
    popupMenu.registerProvider(PROVIDER_ID, this);
  }

  /** Whether the popup has entries for the element. */
  canReplace(element: any): boolean {
    return replacementTypesOf(element.type).length > 0;
  }

  /** Opens the popup below the element's context pad, or below the element when it has none; at the cursor if given. */
  open(element: any, cursor?: { x: number; y: number }): void {
    const containerRectangle = this.canvas.getContainer().getBoundingClientRect();
    const anchor = this.contextPad.getPad(element)?.html ?? this.elementRegistry.getGraphics(element);
    const anchorRectangle = anchor.getBoundingClientRect();
    const position = {
      x: anchorRectangle.left - containerRectangle.left,
      y: anchorRectangle.bottom - containerRectangle.top + POPUP_OFFSET,
      cursor,
    };
    this.popupMenu.open(element, PROVIDER_ID, position);
  }

  getPopupMenuEntries(element: any): Record<string, unknown> {
    const entries: Record<string, unknown> = {};
    for (const type of replacementTypesOf(element.type)) {
      entries[`replace-with-${type}`] = {
        ...TYPE_ENTRIES[type],
        group: 'type',
        action: () => this.replace(element, type),
      };
    }
    if (element.type === 'process' || element.type === 'placeholder') {
      for (const shape of ['box', 'chevron'] as const) {
        if (element.businessObject.shape !== shape) {
          entries[`shape-${shape}`] = {
            ...SHAPE_ENTRIES[shape],
            group: 'shape',
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
