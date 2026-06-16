import type { SymbolResult } from '#bifrost/contracts/SymbolTypes';

import type { IndexedBpmnElement } from './BpmnElementConverter';

const { getElementsFromXml } = require('./BpmnElementConverter');

self.onmessage = (event: any) => {
  const message = event.data.__message;
  const messageId = event.data.__messageId;

  switch (message.methodName) {
    case 'index': {
      const args = [messageId, ...message.methodArgs] as any;
      return index.apply(self, args);
    }
    default:
      throw new Error(`Could not find method '${message.methodName}' on 'Bpmn Symbol Indexer Worker'`);
  }
};

async function index(messageId: string, uri: string, documentType: string, data: string): Promise<void> {
  try {
    const elements = await getElementsFromXml(data);
    const result: SymbolResult[] = [];

    for (const element of elements) {
      const symbolResult = mapElementToSymbolIndexerResult(uri, documentType, element);
      if (symbolResult != null) {
        result.push(symbolResult);
      }
    }

    self.postMessage({ __message: { success: true, result }, __messageId: messageId });
  } catch (error) {
    self.postMessage({ __message: { success: false, error: error && error.message }, __messageId: messageId });
  }
}

function mapElementToSymbolIndexerResult(
  uri: string,
  documentType: string,
  element: IndexedBpmnElement,
): SymbolResult | null {
  const type = element.type.replace('bpmn:', '');

  return {
    uri,
    documentType,
    label: element.name || element.id,
    type: element.type,
    icon: `bpmn/search-result/types/${type}`,
    metadata: { ...element.metadata },
    id: element.id,
    name: element.name,
    processId: element.metadata.processId,
    definitionId: element.metadata.definitionId,
    extensions: element.extensions,
  };
}
