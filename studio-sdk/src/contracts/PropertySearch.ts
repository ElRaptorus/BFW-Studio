/**
 * Slim search-query shape used by Keep property panes to highlight matching values.
 * Not the full host `SearchQuery` (URI globs, indexers, …).
 */
export type PropertySearchQuery = {
  phrase: string;
  isCaseSensitive: boolean;
  isWholeWordOnly: boolean;
};

/**
 * Returns true when `value` contains `searchQuery.phrase`.
 * Empty/whitespace phrases never match. `isWholeWordOnly` is reserved for the host search index.
 */
export function valueMatchesSearchQuery(value: string, searchQuery: PropertySearchQuery): boolean {
  if (searchQuery.phrase == null || searchQuery.phrase.trim() === '') {
    return false;
  }

  const pattern = escapeRegExp(searchQuery.phrase);
  const regexModifiers = searchQuery.isCaseSensitive ? 'g' : 'gi';
  const regex = new RegExp(pattern, regexModifiers);

  return regex.test(value);
}

function escapeRegExp(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}
