import type EventBus from 'diagram-js/lib/core/EventBus';

import type { LandscapeElement } from '../LandscapeMapFile';
import { createElementId } from '../LandscapeMapFile';
import { shapeAttributesOf } from './landscapeCanvasMapping';

type NewElementFields =
  | { type: 'band'; label: string }
  | { type: 'group'; label: string; collapsed: boolean }
  | { type: 'placeholder'; label: string; shape: 'box' }
  | { type: 'note'; text: string };

export default class LandscapePaletteProvider {
  static $inject = [
    'palette',
    'create',
    'elementFactory',
    'elementRegistry',
    'handTool',
    'lassoTool',
    'canvas',
    'eventBus',
  ];

  private canvas: any;
  private create: any;
  private elementFactory: any;
  private elementRegistry: any;
  private handTool: any;
  private lassoTool: any;

  constructor(
    palette: any,
    create: any,
    elementFactory: any,
    elementRegistry: any,
    handTool: any,
    lassoTool: any,
    canvas: any,
    eventBus: EventBus,
  ) {
    this.canvas = canvas;
    this.create = create;
    this.elementFactory = elementFactory;
    this.elementRegistry = elementRegistry;
    this.handTool = handTool;
    this.lassoTool = lassoTool;
    palette.registerProvider(this);
    // A band belongs on the map, not on the plane of a group; the entries depend on which one is on screen.
    eventBus.on('root.set', () => palette._rebuild());
  }

  getPaletteEntries(): Record<string, unknown> {
    const startCreate = (fields: NewElementFields, width: number, height: number) => (event: Event) => {
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
      this.create.start(event, this.elementFactory.createShape(shapeAttributesOf(element)));
    };
    const createEntry = (className: string, title: string, action: (event: Event) => void) => ({
      group: 'create',
      className,
      title,
      action: { dragstart: action, click: action },
    });

    const entries: Record<string, unknown> = {
      'hand-tool': {
        group: 'tools',
        className: 'ph ph-hand',
        title: 'Move the canvas',
        action: { click: (event: Event) => this.handTool.activateHand(event) },
      },
      'lasso-tool': {
        group: 'tools',
        className: 'ph ph-selection',
        title: 'Select several elements',
        action: { click: (event: Event) => this.lassoTool.activateSelection(event) },
      },
      'tool-separator': { group: 'tools', separator: true },
      'create-band': createEntry(
        'ph ph-rows',
        'Create a band that spans the map',
        startCreate({ type: 'band', label: 'Band' }, 1200, 240),
      ),
      'create-group': createEntry(
        'ph ph-bounding-box',
        'Create a group',
        startCreate({ type: 'group', label: 'Group', collapsed: false }, 400, 240),
      ),
      'create-placeholder': createEntry(
        'ph ph-rectangle-dashed',
        'Create a placeholder for a process that is not modelled yet',
        startCreate({ type: 'placeholder', label: 'Placeholder', shape: 'box' }, 140, 60),
      ),
      'create-note': createEntry('ph ph-note', 'Create a note', startCreate({ type: 'note', text: 'Note' }, 160, 80)),
    };
    if (this.canvas.getRootElement().group != null) {
      delete entries['create-band'];
    }
    return entries;
  }
}
