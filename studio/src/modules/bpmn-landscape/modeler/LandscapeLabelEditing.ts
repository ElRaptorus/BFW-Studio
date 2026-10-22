import type Canvas from 'diagram-js/lib/core/Canvas';
import type EventBus from 'diagram-js/lib/core/EventBus';

import type { LandscapeElement } from '../LandscapeMapFile';

const UPDATE_LABEL_COMMAND = 'landscape.updateLabel';
const CONTAINER_TITLE_HEIGHT = 30;

function textOf(element: LandscapeElement): string | null {
  switch (element.type) {
    case 'note':
      return element.text;
    case 'process':
      return null;
    default:
      return element.label;
  }
}

function setTextOf(element: LandscapeElement, text: string): void {
  if (element.type === 'note') {
    element.text = text;
  } else if (element.type !== 'process') {
    element.label = text;
  }
}

/** Makes label edits undoable; returning the shape lets the command stack redraw it. */
class UpdateLabelHandler {
  execute(context: any): any[] {
    context.oldText = textOf(context.element.businessObject);
    setTextOf(context.element.businessObject, context.newText);
    return [context.element];
  }

  revert(context: any): any[] {
    setTextOf(context.element.businessObject, context.oldText);
    return [context.element];
  }
}

/** Double-click edits the label of a group, band, placeholder or map link and the text of a note. */
export default class LandscapeLabelEditing {
  static $inject = ['eventBus', 'canvas', 'directEditing', 'commandStack'];

  private canvas: Canvas;
  private commandStack: any;

  constructor(eventBus: EventBus, canvas: Canvas, directEditing: any, commandStack: any) {
    this.canvas = canvas;
    this.commandStack = commandStack;
    directEditing.registerProvider(this);
    commandStack.registerHandler(UPDATE_LABEL_COMMAND, UpdateLabelHandler);

    // Studio keybindings call preventDefault even for disabled commands and only spare INPUT and TEXTAREA,
    // so Backspace, arrows and Cmd/Ctrl+C/V would never reach the contenteditable text box.
    directEditing._textbox.content.addEventListener('keydown', (event: KeyboardEvent) => event.stopPropagation());

    // Double-click on a process is reserved for opening it in the Designer.
    eventBus.on('element.dblclick', ({ element }: any) => {
      if (element.businessObject != null && textOf(element.businessObject) != null) {
        directEditing.activate(element);
      }
    });
    eventBus.on(['canvas.viewbox.changing', 'drag.init', 'element.mousedown', 'shape.remove'], () => {
      if (directEditing.isActive()) {
        directEditing.complete();
      }
    });
  }

  activate(shape: any): any {
    const element: LandscapeElement | undefined = shape.businessObject;
    const text = element == null ? null : textOf(element);
    if (element == null || text == null) {
      return null;
    }
    const zoom = this.canvas.zoom();
    const bounds = this.canvas.getAbsoluteBBox(shape);
    const isContainer = element.type === 'group' || element.type === 'band';
    return {
      bounds: isContainer ? { ...bounds, height: CONTAINER_TITLE_HEIGHT * zoom } : bounds,
      text,
      style: { fontSize: `${12 * zoom}px`, lineHeight: 1.2, fontFamily: 'Arial, sans-serif', textAlign: 'center' },
      options: { centerVertically: !isContainer },
    };
  }

  update(shape: any, newText: string, previousText: string): void {
    if (newText !== previousText) {
      this.commandStack.execute(UPDATE_LABEL_COMMAND, { element: shape, newText });
    }
  }
}
