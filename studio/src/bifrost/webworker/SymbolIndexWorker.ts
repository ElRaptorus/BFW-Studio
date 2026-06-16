import type { SymbolQuery, SymbolResult } from './../contracts/SymbolTypes';

self.onmessage = (event: any) => {
  const message = event.data.__message;
  const messageId = event.data.__messageId;

  switch (message.methodName) {
    case 'clear':
      return clear.apply(self, message.methodArgs);
    case 'clearByUri':
      return clearByUri.apply(self, message.methodArgs);
    case 'clearBySolutionUri':
      return clearBySolutionUri.apply(self, message.methodArgs);
    case 'put':
      return put.apply(self, message.methodArgs);
    case 'getAll': {
      const args = [messageId, ...message.methodArgs] as any;
      return getAll.apply(self, args);
    }
    default:
      throw new Error(`Could not find method '${message.methodName}' on 'Symbol Indexer Worker'`);
  }
};

type SymbolIndexMap = { [uri: string]: any[] };

let symbolIndex: SymbolIndexMap = {};

function clear(): void {
  symbolIndex = {};
}

function clearByUri(uri: string): void {
  delete symbolIndex[uri];
}

function clearBySolutionUri(solutionUri: string): void {
  Object.keys(symbolIndex).forEach((key) => {
    const isInSolution = key.includes(solutionUri);
    if (isInSolution) {
      delete symbolIndex[key];
    }
  });
}

function put(uri: string, documentType: string, indexerResult: any[]): void {
  const results = indexerResult.map((result: any) => {
    return { ...result, uri, documentType };
  });

  symbolIndex[uri] = results;
}

function filterSymbols(
  symbols: SymbolResult[],
  query: any,
  getFilterablePartBySymbol: (symbol: SymbolResult) => any,
): SymbolResult[] {
  const filteringKeys = Object.keys(query);
  const filteringValues = {};
  filteringKeys.map((key) => (filteringValues[key] = Array.isArray(query[key]) ? query[key] : [query[key] ?? null]));

  return symbols.filter((symbolResult) => {
    const symbol = getFilterablePartBySymbol(symbolResult);
    return filteringKeys.every((filterKey) => {
      if (!(filterKey in symbol)) {
        return filteringValues[filterKey].includes(null);
      }
      return filteringValues[filterKey].includes(symbol[filterKey]);
    });
  });
}

function getAll(messageId: string, symbolQuery: SymbolQuery): void {
  let symbols = symbolQuery.uris == null ? getAllSymbols() : getAllSymbolsForUris(symbolQuery.uris);
  delete symbolQuery.uris;

  const metadata = symbolQuery.metadata;
  delete symbolQuery.metadata;

  symbols = filterSymbols(symbols, symbolQuery, (symbol) => symbol);
  if (metadata) {
    symbols = filterSymbols(symbols, metadata, (symbol) => symbol.metadata);
  }

  self.postMessage({ __message: symbols, __messageId: messageId });
}

function getAllSymbols(): SymbolResult[] {
  return Object.values(symbolIndex).flat();
}

function getAllSymbolsForUris(uris: string[]): SymbolResult[] {
  let results: SymbolResult[] = [];

  for (const uri of uris) {
    const symbolResults = symbolIndex[uri];

    if (!symbolResults) {
      continue;
    }

    results = results.concat(symbolResults);
  }

  return results;
}
