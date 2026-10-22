import type { LandscapeMap } from '../LandscapeMapFile';

export type LandscapeMapProperties = Pick<LandscapeMap, 'name' | 'relationLayers' | 'hiddenRelations'>;

export const UPDATE_ELEMENT_COMMAND = 'landscape.updateElement';
export const UPDATE_MAP_COMMAND = 'landscape.updateMap';

function pickOld<T extends object>(source: T, properties: Partial<T>): Partial<T> {
  return Object.fromEntries(Object.keys(properties).map((name) => [name, (source as any)[name]])) as Partial<T>;
}

/**
 * Undoable property changes. `landscape.updateElement` assigns `{ element, properties }` to the file element a shape
 * or connector carries; `landscape.updateMap` assigns `{ properties }` to the map-level properties held here.
 * Values are replaced, never changed in place, so the old values kept for undo stay intact.
 */
export default class LandscapeUpdates {
  static $inject = ['commandStack'];

  private mapProperties: LandscapeMapProperties = {
    name: '',
    relationLayers: { callActivity: true, message: true, signal: true },
    hiddenRelations: [],
  };

  constructor(commandStack: any) {
    commandStack.register(UPDATE_ELEMENT_COMMAND, {
      execute: (context: any) => {
        context.oldProperties = pickOld(context.element.businessObject, context.properties);
        Object.assign(context.element.businessObject, context.properties);
        return [context.element];
      },
      revert: (context: any) => {
        Object.assign(context.element.businessObject, context.oldProperties);
        return [context.element];
      },
    });
    commandStack.register(UPDATE_MAP_COMMAND, {
      execute: (context: any) => {
        context.oldProperties = pickOld(this.mapProperties, context.properties);
        this.mapProperties = { ...this.mapProperties, ...context.properties };
        return [];
      },
      revert: (context: any) => {
        this.mapProperties = { ...this.mapProperties, ...context.oldProperties };
        return [];
      },
    });
  }

  getMapProperties(): LandscapeMapProperties {
    return this.mapProperties;
  }

  /** Sets the properties of a freshly imported map; not undoable. */
  setMapProperties(properties: LandscapeMapProperties): void {
    this.mapProperties = properties;
  }
}
