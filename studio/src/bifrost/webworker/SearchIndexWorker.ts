import Fuse from 'fuse.js';
import { Minimatch } from 'minimatch';

import type { SearchQuery, SearchResult } from '../../../../studio-sdk/src/contracts/internal/SearchTypes';

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
    case 'search': {
      const args = [messageId, ...message.methodArgs] as any;
      return search.apply(self, args);
    }
    default:
      throw new Error(`Could not find method '${message.methodName}' on 'Search Indexer Worker'`);
  }
};

type SearchIndexMap = { [uri: string]: SearchResult[] };

const FUSE_OPTIONS = {
  findAllMatches: true,
  ignoreFieldNorm: true,
  ignoreLocation: true,
  includeScore: true,
  isCaseSensitive: false,
  matchAllTokens: true,
  maxPatternLength: 32,
  minMatchCharLength: 2,
  shouldSort: true,
  threshold: 0.1,
  tokenize: true,
  keys: [
    {
      name: 'prio1',
      weight: 0.4,
    },
    {
      name: 'prio2',
      weight: 0.3,
    },
    {
      name: 'prio3',
      weight: 0.2,
    },
    {
      name: 'rest',
      weight: 0.1,
    },
  ],
};

let searchIndex: SearchIndexMap = {};

function clear(): void {
  searchIndex = {};
}

function clearByUri(uri: string): void {
  delete searchIndex[uri];
}

function clearBySolutionUri(solutionUri: string): void {
  Object.keys(searchIndex).forEach((key) => {
    const isInSolution = key.includes(solutionUri);
    if (isInSolution) {
      delete searchIndex[key];
    }
  });
}

function put(uri: string, documentType: string, searchResultFromIndexer: SearchResult[]): void {
  const results: SearchResult[] = searchResultFromIndexer.map((result) => {
    return { ...result, uri, documentType };
  });

  searchIndex[uri] = results;
}

function search(messageId: string, query: SearchQuery): void {
  let uris: string[];

  const hasIncludedUris = query.includedUris != null && query.includedUris.length > 0;
  if (hasIncludedUris) {
    uris = query.includedUris.filter((uri) => searchIndex[uri] != null);
  } else {
    uris = Object.keys(searchIndex);
  }

  const hasIncludeGlobs = query.includeGlobs != null && query.includeGlobs.length > 0;
  const hasExcludeGlobs = query.excludeGlobs != null && query.excludeGlobs.length > 0;

  if (hasIncludeGlobs) {
    const matchers = normalizeGlobs(query.includeGlobs).map((globPattern) => new Minimatch(globPattern));
    uris = uris.filter((uri) => {
      const relativePath = extractPathFromUri(uri);
      return matchers.some((matcher) => matcher.match(relativePath));
    });
  }

  if (hasExcludeGlobs) {
    const matchers = normalizeGlobs(query.excludeGlobs).map((globPattern) => new Minimatch(globPattern));
    uris = uris.filter((uri) => {
      const relativePath = extractPathFromUri(uri);
      return !matchers.some((matcher) => matcher.match(relativePath));
    });
  }

  const values = uris.map((uri) => searchIndex[uri]);
  const fullIndex = ([] as any[]).concat(...values);

  const options = { ...FUSE_OPTIONS, isCaseSensitive: query.isCaseSensitive };
  const fuse = new Fuse(fullIndex, options);

  let results: SearchResult[] = fuse.search(query.phrase).map((result) => {
    return { ...result.item, score: result.score };
  });

  if (query.isWholeWordOnly) {
    results = filterByWholeWord(results, query.phrase);
  }

  self.postMessage({ __message: results, __messageId: messageId });
}

function filterByWholeWord(searchResults: SearchResult[], phrase: string): SearchResult[] {
  const escapedPhrase = escapeRegExp(phrase);
  const regex = new RegExp(`\\b${escapedPhrase}\\b`, 'gi');

  return searchResults.filter((searchResult: SearchResult) => {
    const fields = [searchResult.prio1, searchResult.prio2, searchResult.prio3, searchResult.rest];
    const fieldsAsStrings = fields.map((stringOrArray: string | string[]) => {
      return Array.isArray(stringOrArray) ? stringOrArray.join('\n') : stringOrArray;
    });

    return fieldsAsStrings.some((candidate) => regex.test(candidate));
  });
}

function escapeRegExp(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

function extractPathFromUri(uri: string): string {
  const schemeEnd = uri.indexOf('://');
  return schemeEnd >= 0 ? uri.substring(schemeEnd + 3) : uri;
}

const LOOKS_LIKE_BARE_DIR = /^[^.*?{[]+$/;

function normalizeGlobs(globs: string[]): string[] {
  return globs.map((globPattern) => {
    if (globPattern.startsWith('**/') || globPattern.startsWith('/')) {
      return globPattern;
    }

    const prefixed = `**/${globPattern}`;

    if (LOOKS_LIKE_BARE_DIR.test(globPattern) && !globPattern.endsWith('/**')) {
      return `${prefixed}/**`;
    }

    return prefixed;
  });
}
