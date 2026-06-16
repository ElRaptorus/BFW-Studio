import type { SymbolResult } from '#bifrost/contracts/SymbolTypes';

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
      throw new Error(`Could not find method '${message.methodName}' on 'Dmn Symbol Indexer Worker'`);
  }
};

async function index(messageId: string, uri: string, documentType: string, data: string): Promise<void> {
  try {
    const elements = await getElementsFromXml(data);
    const result: SymbolResult[] = [];

    for (const element of elements) {
      const symbolResult = mapElementToSymbolResult(uri, documentType, element);
      if (symbolResult != null) {
        result.push(symbolResult);
      }
    }

    self.postMessage({ __message: { success: true, result }, __messageId: messageId });
  } catch (error) {
    self.postMessage({
      __message: { success: false, error: error && (error as Error).message },
      __messageId: messageId,
    });
  }
}

function mapElementToSymbolResult(uri: string, documentType: string, element: IndexedDmnElement): SymbolResult | null {
  const type = element.type.replace('dmn:', '');

  return {
    uri,
    documentType,
    label: element.name || element.id,
    type: element.type,
    icon: `dmn/search-result/types/${type}`,
    metadata: { ...element.metadata },
    id: element.id,
    name: element.name,
    definitionId: element.metadata?.definitionId ?? '',
    extensions: {},
  };
}
