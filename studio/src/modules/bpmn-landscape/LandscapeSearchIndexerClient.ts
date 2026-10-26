import type { ISearchIndexerClient, SearchIndexerResult, SearchResult } from '#bifrost/contracts/internal/SearchTypes';

import type { LandscapeElement } from './LandscapeMapFile';
import { parseLandscapeMap } from './LandscapeMapFile';

/** The name shown for the element, and the text a search finds it by. */
function labelOf(element: LandscapeElement): string {
  switch (element.type) {
    case 'process':
      return element.label ?? element.processId;
    case 'note':
      return element.text.split('\n')[0] ?? '';
    default:
      return element.label;
  }
}

/** What identifies the element besides its name: the process id of a process, the file of a link. */
function referenceOf(element: LandscapeElement): string {
  if (element.type === 'process') {
    return element.processId;
  }
  return element.type === 'mapLink' ? element.mapPath : '';
}

/**
 * Indexes the elements of a landscape map for the global search. Maps hold tens of elements, so the text is parsed on
 * the renderer thread instead of in a worker.
 */
export class LandscapeSearchIndexerClient implements ISearchIndexerClient {
  async index(uri: string, documentType: string, currentData: string): Promise<SearchIndexerResult> {
    const parseResult = await parseLandscapeMap(currentData);
    if (!parseResult.ok) {
      return { success: false, error: parseResult.errors.join(' ') };
    }
    const result = parseResult.map.elements.map((element): SearchResult => ({
      uri,
      documentType,
      label: labelOf(element),
      type: element.type,
      icon: `bpmn-landscape/search-result/types/${element.type}`,
      prio1: labelOf(element),
      prio2: element.id,
      prio3: referenceOf(element),
      rest: '',
      metadata: { elementId: element.id },
    }));
    return { success: true, result };
  }
}
