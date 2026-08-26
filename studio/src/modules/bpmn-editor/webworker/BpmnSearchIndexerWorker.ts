import type { SearchResult } from '#bifrost/contracts/internal/SearchTypes';

import type { IndexedBpmnElement } from './BpmnElementConverter';
import { getElementsFromXml } from './BpmnElementConverter';

self.onmessage = (event: any) => {
  const message = event.data.__message;
  const messageId = event.data.__messageId;

  switch (message.methodName) {
    case 'index': {
      const args = [messageId, ...message.methodArgs] as any;
      return index.apply(self, args);
    }
    default:
      throw new Error(`Could not find method '${message.methodName}' on 'Bpmn Search Indexer Worker'`);
  }
};

async function index(messageId: string, uri: string, documentType: string, data: string): Promise<void> {
  try {
    const elements = await getElementsFromXml(data);
    const result = elements.map((element: any) => mapElementToSearchIndexerResult(uri, documentType, element));

    self.postMessage({ __message: { success: true, result }, __messageId: messageId });
  } catch (error) {
    self.postMessage({ __message: { success: false, error: error && error.message }, __messageId: messageId });
  }
}

function mapElementToSearchIndexerResult(uri: string, documentType: string, element: IndexedBpmnElement): SearchResult {
  const type = element.type.replace('bpmn:', '');
  const nameOrText = element.name || element.text;

  const elementDeepCopy = JSON.parse(JSON.stringify(element));
  delete elementDeepCopy.metadata;
  const rest = elementDeepCopy;

  return {
    uri,
    documentType,
    label: nameOrText || element.id,
    type: element.type,
    icon: `bpmn/search-result/types/${type}`,
    prio1: nameOrText,
    prio2: element.id,
    prio3: element.documentation,
    rest: JSON.stringify(rest),
    metadata: {
      elementId: element.id,
      ...element.metadata,
    },
  };
}
