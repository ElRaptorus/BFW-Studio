import SearchModule from 'diagram-js/lib/features/search';
import SearchPadModule from 'diagram-js/lib/features/search-pad';

import type {
  InteractionGraphPort,
  InteractionGraphProcess,
  InteractionGraphStation,
} from '../../buildInteractionGraph';

type SearchableItem = {
  element: any;
  title: string;
  detail: string;
  processLabel: string | null;
  elementName: string | null;
};

/** `title` and `detail` are what a result row shows; the other fields only widen what a pattern matches. */
function searchFieldsOf(element: any): Omit<SearchableItem, 'element'> | null {
  const businessObject = element.businessObject;
  if (businessObject == null) {
    return null;
  }
  if (element.type === 'interactions-process') {
    const process = businessObject as InteractionGraphProcess;
    return { title: process.label, detail: process.processId, processLabel: null, elementName: null };
  }
  if (element.type === 'interactions-port') {
    const port = businessObject as InteractionGraphPort;
    return {
      title: port.name ?? port.nameWarning ?? port.flowNodeId,
      detail: port.flowNodeId,
      processLabel: port.processLabel,
      elementName: port.flowNodeName,
    };
  }
  if (element.type === 'interactions-station') {
    const station = businessObject as InteractionGraphStation;
    return { title: station.name, detail: station.kind, processLabel: null, elementName: null };
  }
  return null;
}

/**
 * Search pad over process labels, port names, element names and ids, and station names on the interactions canvas.
 */
class InteractionsSearch {
  static $inject = ['searchPad', 'search', 'elementRegistry', 'canvas', 'eventBus'];

  constructor(
    searchPad: any,
    private readonly search: any,
    private readonly elementRegistry: any,
    private readonly canvas: any,
    eventBus: any,
  ) {
    searchPad.registerProvider(this);
    eventBus.on('root.set', () => searchPad.close(false));
  }

  find(pattern: string): { element: any; primaryTokens: unknown; secondaryTokens: unknown }[] {
    const root = this.canvas.getRootElement();
    const items: SearchableItem[] = this.elementRegistry
      .getAll()
      .filter((element: any) => element.parent != null && this.canvas.findRoot(element) === root)
      .flatMap((element: any) => {
        const fields = searchFieldsOf(element);
        return fields == null ? [] : [{ element, ...fields }];
      });
    return this.search(items, pattern, { keys: ['title', 'detail', 'processLabel', 'elementName'] }).map(
      ({ item, tokens }: any) => ({
        element: item.element,
        primaryTokens: tokens.title,
        secondaryTokens: tokens.detail,
      }),
    );
  }
}

export default {
  __depends__: [SearchModule, SearchPadModule],
  __init__: ['interactionsSearch'],
  interactionsSearch: ['type', InteractionsSearch],
};
