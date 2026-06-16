import type { EditorDocument, Studio } from '../../../index';
import { assertNotNull, waitForAcceptance } from '../../../index';
import { AbstractEmitter } from '../../common/AbstractEmitter';
import { EditorInlineSearchView } from '../../common/internal/EditorInlineSearchView';
import { EVENT_INLINE_SEARCH_UPDATED } from '../../contracts/internal/SearchEvents';
import type { InlineSearchViewData, SearchQuery } from '../../contracts/internal/SearchTypes';

export class EditorInlineSearchViewMediator extends AbstractEmitter {
  public readonly domClassName: string;
  public readonly domSelector: string;

  private editorInlineSearchView: EditorInlineSearchView;

  constructor(studio: Studio, editorDocument: EditorDocument, domClassName: string | null = null) {
    super();
    this.domClassName = domClassName || studio.getGuid(`${this.constructor.name}-`);
    this.domSelector = `.${this.domClassName}`;

    const openCallbackFn = (searchResult): void => studio.searchView.open(searchResult);

    this.editorInlineSearchView = new EditorInlineSearchView(
      studio.searchIndex,
      editorDocument.uri,
      editorDocument.metadata.searchQuery,
      openCallbackFn,
    );
    this.editorInlineSearchView.on(EVENT_INLINE_SEARCH_UPDATED, (visible: boolean, searchQuery: SearchQuery) => {
      studio.editors.updateEditorInlineSearch(editorDocument, visible, searchQuery);
      this.emit(EVENT_INLINE_SEARCH_UPDATED);
    });
  }

  async gotoNextSearchResult(): Promise<void> {
    return this.editorInlineSearchView.gotoNextSearchResult();
  }

  async gotoPreviousSearchResult(): Promise<void> {
    return this.editorInlineSearchView.gotoPreviousSearchResult();
  }

  async search(phrase: string): Promise<void> {
    return this.editorInlineSearchView.search(phrase);
  }

  async setCaseSensitivity(isCaseSensitive: boolean): Promise<void> {
    return this.editorInlineSearchView.setCaseSensitivity(isCaseSensitive);
  }

  async setWholeWordOnly(isWholeWordOnly: boolean): Promise<void> {
    return this.editorInlineSearchView.setWholeWordOnly(isWholeWordOnly);
  }

  showAndFocus(): void {
    this.editorInlineSearchView.show();
    this.waitForAndFocusInputElement();
  }

  hide(): void {
    this.editorInlineSearchView.hide();
  }

  getViewData(): InlineSearchViewData {
    return this.editorInlineSearchView.getViewData();
  }

  private async waitForAndFocusInputElement(): Promise<void> {
    await waitForAcceptance(
      () => {
        const viewElement = document.getElementsByClassName(this.domClassName)[0];
        return viewElement != null;
      },
      'SearchInput did not appear',
      500,
    );

    const viewElement = document.getElementsByClassName(this.domClassName)[0];

    assertNotNull(viewElement, 'viewElement');

    const inputElement: HTMLInputElement | null = viewElement.querySelector('input[type=text]');
    assertNotNull(inputElement, 'inputElement');

    inputElement.focus();
    inputElement.setSelectionRange(0, inputElement.value.length);
  }
}
