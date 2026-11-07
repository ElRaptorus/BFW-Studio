import SearchModule from 'diagram-js/lib/features/search';
import SearchPadModule from 'diagram-js/lib/features/search-pad';

import type { LandscapeRendererConfig } from '../LandscapeRenderer';

/** The text an element shows on the map; hidden connectors are not searched. */
function labelOf(element: any, config: LandscapeRendererConfig): string | null {
  const businessObject = element.businessObject;
  if (businessObject == null || element.hidden === true) {
    return null;
  }
  if (element.type === 'process') {
    return config.getProcessLabel(businessObject);
  }
  return element.type === 'note' ? businessObject.text : (businessObject.label ?? '');
}

/**
 * The search pad (Ctrl/Cmd+F, command `bpmn.landscape.find`) over the labels, ids and process ids of the shapes and
 * connectors of the plane on screen. Other planes stay out: a root switch closes the search pad.
 */
class LandscapeSearch {
  static $inject = ['searchPad', 'search', 'elementRegistry', 'canvas', 'config.landscape', 'eventBus'];

  constructor(
    searchPad: any,
    private readonly search: any,
    private readonly elementRegistry: any,
    private readonly canvas: any,
    private readonly config: LandscapeRendererConfig,
    eventBus: any,
  ) {
    searchPad.registerProvider(this);
    // Without `false`, closing would switch back to the plane the search pad was opened on.
    eventBus.on('root.set', () => searchPad.close(false));
  }

  find(pattern: string): { element: any; primaryTokens: unknown; secondaryTokens: unknown }[] {
    const root = this.canvas.getRootElement();
    const items = this.elementRegistry
      .getAll()
      .filter((element: any) => this.canvas.findRoot(element) === root)
      .map((element: any) => ({
        element,
        label: labelOf(element, this.config),
        id: element.id,
        processId: element.businessObject?.processId,
      }))
      .filter((item: { label: string | null }) => item.label != null);
    return this.search(items, pattern, { keys: ['label', 'id', 'processId'] }).map(({ item, tokens }: any) => ({
      element: item.element,
      primaryTokens: tokens.label,
      secondaryTokens: tokens.id,
    }));
  }
}

export default {
  __depends__: [SearchModule, SearchPadModule],
  __init__: ['landscapeSearch'],
  landscapeSearch: ['type', LandscapeSearch],
};
