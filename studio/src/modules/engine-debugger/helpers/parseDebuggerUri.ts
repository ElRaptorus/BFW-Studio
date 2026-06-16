export interface ParsedDebuggerUri {
  engineId: string;
  processInstanceId: string;
}

export function parseDebuggerUri(uri: string): ParsedDebuggerUri {
  const match = uri.match(/^engine-debug:\/\/([^/]+)\/([^/?]+)/);
  return {
    engineId: match?.[1] ?? '',
    processInstanceId: match?.[2] ?? '',
  };
}
