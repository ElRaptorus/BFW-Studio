import AutoPlaceModule from 'diagram-js/lib/features/auto-place';

import type { LandscapeElement } from '../../LandscapeMapFile';
import { createElementId } from '../../LandscapeMapFile';
import { shapeAttributesOf } from '../landscapeCanvasMapping';

const APPEND_SOURCE_TYPES = new Set(['process', 'placeholder', 'mapLink', 'note']);

type AppendedFields = { type: 'placeholder'; label: string; shape: 'box' } | { type: 'note'; text: string };

/**
 * The context pad entries "Append placeholder" and "Append note". A click places the new shape to the right of the
 * element, a drag lets the user place it; both connect it to the element with a connector.
 */
class LandscapeAppend {
  static $inject = ['contextPad', 'autoPlace', 'create', 'elementFactory', 'elementRegistry'];

  constructor(
    contextPad: any,
    private readonly autoPlace: any,
    private readonly create: any,
    private readonly elementFactory: any,
    private readonly elementRegistry: any,
  ) {
    contextPad.registerProvider(this);
  }

  getContextPadEntries(element: any): Record<string, unknown> {
    if (!APPEND_SOURCE_TYPES.has(element.type)) {
      return {};
    }
    return {
      'append.placeholder': this.entry(
        element,
        'ph ph-rectangle-dashed',
        'Append placeholder',
        { type: 'placeholder', label: 'Placeholder', shape: 'box' },
        140,
        60,
      ),
      'append.note': this.entry(element, 'ph ph-note', 'Append note', { type: 'note', text: 'Note' }, 160, 80),
    };
  }

  private entry(
    source: any,
    className: string,
    title: string,
    fields: AppendedFields,
    width: number,
    height: number,
  ): Record<string, unknown> {
    const createShape = (): any => {
      const element = {
        id: createElementId(fields.type, (id) => this.elementRegistry.get(id) != null),
        parentId: null,
        x: 0,
        y: 0,
        width,
        height,
        style: null,
        ...fields,
      } as LandscapeElement;
      return this.elementFactory.createShape(shapeAttributesOf(element));
    };
    const appendWithConnector = (): void => {
      const id = createElementId('connector', (candidate) => this.elementRegistry.get(candidate) != null);
      this.autoPlace.append(source, createShape(), { connection: { type: 'connector', id } });
    };
    return {
      group: 'model',
      className,
      title,
      action: {
        click: appendWithConnector,
        dragstart: (event: Event) => this.create.start(event, createShape(), { source }),
      },
    };
  }
}

export default {
  __depends__: [AutoPlaceModule],
  __init__: ['landscapeAppend'],
  landscapeAppend: ['type', LandscapeAppend],
};
