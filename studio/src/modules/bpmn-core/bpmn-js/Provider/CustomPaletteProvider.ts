import type { ElementLike } from 'diagram-js/lib/model/Types';

class CustomPaletteProvider {
  static $inject: string[];

  private palette;
  private canvas;

  constructor(palette, canvas, eventBus) {
    this.palette = palette;
    this.canvas = canvas;
    palette.registerProvider(this);

    eventBus.on('root.set', () => {
      palette._rebuild();
    });
  }

  getPaletteEntries(element: ElementLike) {
    const rootType = this.canvas.getRootElement()?.businessObject?.$type;
    const isInsideSubprocess =
      rootType === 'bpmn:SubProcess' || rootType === 'bpmn:Transaction' || rootType === 'bpmn:AdHocSubProcess';

    return function (entries) {
      if (isInsideSubprocess) {
        const { 'create.participant-expanded': _removed, ...rest } = entries;
        return rest;
      }
      return { ...entries };
    };
  }
}

CustomPaletteProvider.$inject = ['palette', 'canvas', 'eventBus'];

export default {
  __init__: ['customPaletteProvider'],
  customPaletteProvider: ['type', CustomPaletteProvider],
};
