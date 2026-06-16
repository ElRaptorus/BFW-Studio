import type { SearchResult } from '../../../../../studio-sdk/src/contracts/internal/SearchTypes';
import type { IndexedDmnElement } from './DmnElementConverter';
import { getElementsFromXml } from './DmnElementConverter';

self.onmessage = (event: any) => {
  const message = event.data.__message;
  const messageId = event.data.__messageId;

  switch (message.methodName) {
    case 'index': {
      const args = [messageId, ...message.methodArgs] as any;
      return index.apply(self, args);
    }
    default:
      throw new Error(`Could not find method '${message.methodName}' on 'Dmn Search Indexer Worker'`);
  }
};

async function index(messageId: string, uri: string, documentType: string, data: string): Promise<void> {
  try {
    const elements = await getElementsFromXml(data);
    const result = elements.map((element: IndexedDmnElement) =>
      mapElementToSearchIndexerResult(uri, documentType, element),
    );

    self.postMessage({ __message: { success: true, result }, __messageId: messageId });
  } catch (error) {
    self.postMessage({
      __message: { success: false, error: error && (error as Error).message },
      __messageId: messageId,
    });
  }
}

function mapElementToSearchIndexerResult(uri: string, documentType: string, element: IndexedDmnElement): SearchResult {
  const type = element.type.replace('dmn:', '');

  const elementDeepCopy = JSON.parse(JSON.stringify(element));
  delete elementDeepCopy.metadata;
  const rest = elementDeepCopy;

  return {
    uri,
    documentType,
    label: element.name || element.id,
    type: element.type,
    icon: `dmn/search-result/types/${type}`,
    prio1: element.name,
    prio2: element.id,
    prio3: element.description,
    rest: JSON.stringify(rest),
    metadata: {
      elementId: element.id,
      ...element.metadata,
    },
  };
}
