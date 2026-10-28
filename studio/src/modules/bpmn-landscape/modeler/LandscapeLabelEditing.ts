import type Canvas from 'diagram-js/lib/core/Canvas';
import type EventBus from 'diagram-js/lib/core/EventBus';

import { BAND_HEADER_WIDTH, connectorLabelPoint } from './LandscapeRenderer';
import { UPDATE_ELEMENT_COMMAND } from './LandscapeUpdates';
import type { LandscapeTextRenderer } from './features/LandscapeTextRenderer';
import { isCollapsedGroup } from './landscapeHierarchy';

const CONTAINER_TITLE_HEIGHT = 30;
const CONNECTOR_LABEL_BOX = { width: 140, height: 40 };

/**
 * The edited property of a canvas element; a process and a map link take their label from the properties pane, and so
 * does a collapsed group, whose double-click opens it.
 */
function textPropertyOf(element: any): 'label' | 'text' | null {
  if (isCollapsedGroup(element)) {
    return null;
  }
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
  static $inject = ['eventBus', 'canvas', 'directEditing', 'commandStack', 'landscapeTextRenderer'];

  private canvas: Canvas;
  private commandStack: any;
  private textRenderer: LandscapeTextRenderer;

  constructor(
    eventBus: EventBus,
    canvas: Canvas,
    directEditing: any,
    commandStack: any,
    textRenderer: LandscapeTextRenderer,
  ) {
    this.canvas = canvas;
    this.commandStack = commandStack;
    this.textRenderer = textRenderer;
    directEditing.registerProvider(this);

    // Studio keybindings call preventDefault even for disabled commands and only spare INPUT and TEXTAREA,
    // so Backspace, arrows and Cmd/Ctrl+C/V would never reach the contenteditable text box.
    directEditing._textbox.content.addEventListener('keydown', (event: KeyboardEvent) => event.stopPropagation());

    // Double-click on a process, a map link or a collapsed group is reserved for opening it.
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
    const style = this.textRenderer.getEditingStyle(zoom);
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
        options: { centerVertically: true, autoResize: true },
      };
    }
    const bounds = this.canvas.getAbsoluteBBox(element);
    if (element.type === 'band') {
      // The band writes its label upwards in the strip on its left edge; the box is laid flat, centred on the strip,
      // and turned the same way.
      const stripWidth = BAND_HEADER_WIDTH * zoom;
      return {
        bounds: {
          x: bounds.x + stripWidth / 2 - bounds.height / 2,
          y: bounds.y + bounds.height / 2 - stripWidth / 2,
          width: bounds.height,
          height: stripWidth,
        },
        text,
        style: { ...style, transform: 'rotate(-90deg)' },
        options: { centerVertically: true },
      };
    }
    const isGroup = element.type === 'group';
    return {
      bounds: isGroup ? { ...bounds, height: CONTAINER_TITLE_HEIGHT * zoom } : bounds,
      text,
      style,
      options: { centerVertically: !isGroup, autoResize: true },
    };
  }

  update(element: any, newText: string, previousText: string): void {
    const property = textPropertyOf(element);
    if (property != null && newText !== previousText) {
      this.commandStack.execute(UPDATE_ELEMENT_COMMAND, { element, properties: { [property]: newText } });
    }
  }
}
