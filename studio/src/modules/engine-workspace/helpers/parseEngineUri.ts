export interface ParsedEngineUri {
  engineId: string;
  query: URLSearchParams;
}

export function parseEngineUri(uri: string, pathPattern: RegExp): ParsedEngineUri {
  const [pathPart, queryPart] = uri.split('?');
  const match = pathPart.match(pathPattern);
  const engineId = match?.[1] ?? '';
  const query = new URLSearchParams(queryPart ?? '');
  return { engineId, query };
}
