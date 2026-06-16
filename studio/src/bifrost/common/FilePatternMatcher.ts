import { Minimatch } from 'minimatch';

/**
 * Pre-compiles include/exclude glob patterns for efficient repeated matching.
 */
export class FilePatternMatcher {
  private includeMatchers: Minimatch[];
  private excludeMatchers: Minimatch[];
  private allFilesIncluded: boolean;
  private noFilesExcluded: boolean;
  private rawExcludePatterns: string[];

  constructor(included: string[], excluded: string[]) {
    this.allFilesIncluded = included.length === 0;
    this.noFilesExcluded = excluded.length === 0;
    this.includeMatchers = included.map((pattern) => new Minimatch(pattern));
    this.excludeMatchers = excluded.map((pattern) => new Minimatch(pattern));
    this.rawExcludePatterns = excluded;
  }

  isIncluded(relativePath: string): boolean {
    return this.allFilesIncluded || this.includeMatchers.some((matcher) => matcher.match(relativePath));
  }

  isExcluded(relativePath: string): boolean {
    return !this.noFilesExcluded && this.excludeMatchers.some((matcher) => matcher.match(relativePath));
  }

  /**
   * Returns `true` if the entry should be visible in a filtered view.
   * Directories are always visible unless explicitly excluded.
   * Files must be included AND not excluded.
   */
  isVisible(relativePath: string, type: 'file' | 'directory'): boolean {
    if (this.isExcluded(relativePath)) {
      return false;
    }

    return type === 'directory' || this.isIncluded(relativePath);
  }

  getExcludePatterns(): string[] {
    return this.rawExcludePatterns;
  }
}

/**
 * Computes the relative path of `uri` within `baseUri`.
 *
 * Both values are expected to be `file://` URIs with the same prefix structure.
 */
export function computeRelativeUri(uri: string, baseUri: string): string {
  const normalizedBase = baseUri.endsWith('/') ? baseUri : baseUri + '/';

  if (uri.startsWith(normalizedBase)) {
    return uri.slice(normalizedBase.length);
  }

  return uri.replace(baseUri + '/', '');
}
