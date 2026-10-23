import type Canvas from 'diagram-js/lib/core/Canvas';
import type EventBus from 'diagram-js/lib/core/EventBus';

import { connectorLabelPoint } from './LandscapeRenderer';
import { UPDATE_ELEMENT_COMMAND } from './LandscapeUpdates';

const CONTAINER_TITLE_HEIGHT = 30;
const CONNECTOR_LABEL_BOX = { width: 140, height: 40 };

/** The edited property of a canvas element; a process and a map link take their label from the properties pane. */
function textPropertyOf(element: any): 'label' | 'text' | null {
  switch (element.type) {
    case 'note':
      return 'text';
    case 'group':
    case 'band':
    case 'placeholder':
    case 'connector':
      return 'label';
    default:
      return null;
  }
}

/** Double-click edits the label of a group, band, placeholder or connector and the text of a note. */
export default class LandscapeLabelEditing {
  static $inject = ['eventBus', 'canvas', 'directEditing', 'commandStack'];

  private canvas: Canvas;
  private commandStack: any;

  constructor(eventBus: EventBus, canvas: Canvas, directEditing: any, commandStack: any) {
    this.canvas = canvas;
    this.commandStack = commandStack;
    directEditing.registerProvider(this);

    // Studio keybindings call preventDefault even for disabled commands and only spare INPUT and TEXTAREA,
    // so Backspace, arrows and Cmd/Ctrl+C/V would never reach the contenteditable text box.
    directEditing._textbox.content.addEventListener('keydown', (event: KeyboardEvent) => event.stopPropagation());

    // Double-click on a process or a map link is reserved for opening it.
    eventBus.on('element.dblclick', ({ element }: any) => {
      if (textPropertyOf(element) != null) {
        directEditing.activate(element);
      }
    });
    eventBus.on(['canvas.viewbox.changing', 'drag.init', 'element.mousedown', 'shape.remove'], () => {
      if (directEditing.isActive()) {
        directEditing.complete();
      }
    });
  }

  activate(element: any): any {
    const property = textPropertyOf(element);
    if (property == null) {
      return null;
    }
    const zoom = this.canvas.zoom();
    const style = { fontSize: `${12 * zoom}px`, lineHeight: 1.2, fontFamily: 'Arial, sans-serif', textAlign: 'center' };
    const text = element.businessObject[property];
    if (element.type === 'connector') {
      const point = connectorLabelPoint(element.waypoints);
      const viewbox = this.canvas.viewbox();
      const width = CONNECTOR_LABEL_BOX.width * zoom;
      const height = CONNECTOR_LABEL_BOX.height * zoom;
      return {
        bounds: {
          x: (point.x - viewbox.x) * zoom - width / 2,
          y: (point.y - viewbox.y) * zoom - height / 2,
          width,
          height,
        },
        text,
        style,
        options: { centerVertically: true },
      };
    }
    const bounds = this.canvas.getAbsoluteBBox(element);
    const isContainer = element.type === 'group' || element.type === 'band';
    return {
      bounds: isContainer ? { ...bounds, height: CONTAINER_TITLE_HEIGHT * zoom } : bounds,
      text,
      style,
      options: { centerVertically: !isContainer },
    };
  }

  update(element: any, newText: string, previousText: string): void {
    const property = textPropertyOf(element);
    if (property != null && newText !== previousText) {
      this.commandStack.execute(UPDATE_ELEMENT_COMMAND, { element, properties: { [property]: newText } });
    }
  }
}
