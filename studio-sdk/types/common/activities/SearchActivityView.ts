import type { SearchResult } from '../../contracts/SearchTypes';

export declare class SearchActivityView {
  open(searchResult: SearchResult): void;
  onOpenSearchResult(documentType: string, openCallbackFn: (...args: any[]) => void): void;
}
