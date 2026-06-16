import React, { useCallback, useEffect, useState } from 'react';

import type { EditorDocument, Studio } from '../../../index';
import { EditorInlineSearchViewMediator } from '../../browser/internal/EditorInlineSearchViewMediator';
import { EVENT_INLINE_SEARCH_UPDATED } from '../../contracts/internal/SearchEvents';
import { FormInput } from '../FormInput';
import { Icon } from '../internal/Icon';

type EditorDocumentInlineSearchProps = {
  studio: Studio;
  editorDocument: EditorDocument;
  viewMediatorId?: string;
};

type InlineSearchProps = InlineSearchProps_HasResults | InlineSearchProps_HasNoResults;

type InlineSearchProps_HasResults = {
  studio: Studio;
  value: string;
  isCaseSensitive: boolean;
  isWholeWordOnly: boolean;

  hasResults: true;
  currentResultIndex: number;
  maxResultIndex: number;

  close: () => void;
  gotoNextSearchResult: () => Promise<void>;
  gotoPreviousSearchResult: () => Promise<void>;
  search: (value: string) => Promise<void>;
  setCaseSensitivity: (value: boolean) => void;
  setWholeWordOnly: (value: boolean) => void;
};

type InlineSearchProps_HasNoResults = {
  studio: Studio;
  value: string;
  isCaseSensitive: boolean;
  isWholeWordOnly: boolean;

  hasResults: false;

  close: () => void;
  gotoNextSearchResult: () => Promise<void>;
  gotoPreviousSearchResult: () => Promise<void>;
  search: (value: string) => Promise<void>;
  setCaseSensitivity: (value: boolean) => void;
  setWholeWordOnly: (value: boolean) => void;
};

export function EditorInlineSearch(props: EditorDocumentInlineSearchProps): React.JSX.Element {
  const viewMediatorId = props.viewMediatorId ?? `std/inline-search:${props.editorDocument.uri}`;

  const editorInlineSearchView = props.studio.views.getOrRegisterById<EditorInlineSearchViewMediator>(
    viewMediatorId,
    () => new EditorInlineSearchViewMediator(props.studio, props.editorDocument),
  );

  const [inlineSearchState, setInlineSearchState] = useState<Record<string, any>>(
    editorInlineSearchView.getViewData() ?? {},
  );

  useEffect(() => {
    const subscription = editorInlineSearchView.on(EVENT_INLINE_SEARCH_UPDATED, () =>
      setInlineSearchState(editorInlineSearchView.getViewData()),
    );
    return () => subscription.dispose();
  }, [editorInlineSearchView]);

  const close = useCallback(() => editorInlineSearchView.hide(), [editorInlineSearchView]);
  const gotoNextSearchResult = useCallback(
    () => editorInlineSearchView.gotoNextSearchResult(),
    [editorInlineSearchView],
  );
  const gotoPreviousSearchResult = useCallback(
    () => editorInlineSearchView.gotoPreviousSearchResult(),
    [editorInlineSearchView],
  );
  const search = useCallback((value: string) => editorInlineSearchView.search(value), [editorInlineSearchView]);
  const setCaseSensitivity = useCallback(
    (value: boolean) => editorInlineSearchView.setCaseSensitivity(value),
    [editorInlineSearchView],
  );
  const setWholeWordOnly = useCallback(
    (value: boolean) => editorInlineSearchView.setWholeWordOnly(value),
    [editorInlineSearchView],
  );

  return (
    inlineSearchState.visible && (
      <div className={`editor-inline-search__outer ${editorInlineSearchView.domClassName}`}>
        <InlineSearch
          studio={props.studio}
          hasResults={inlineSearchState.hasResults}
          currentResultIndex={inlineSearchState.currentResultIndex}
          maxResultIndex={inlineSearchState.maxResultIndex}
          value={props.editorDocument.metadata.searchQuery?.phrase}
          isCaseSensitive={props.editorDocument.metadata.searchQuery?.isCaseSensitive}
          isWholeWordOnly={props.editorDocument.metadata.searchQuery?.isWholeWordOnly}
          close={close}
          gotoNextSearchResult={gotoNextSearchResult}
          gotoPreviousSearchResult={gotoPreviousSearchResult}
          search={search}
          setCaseSensitivity={setCaseSensitivity}
          setWholeWordOnly={setWholeWordOnly}
        />
      </div>
    )
  );
}

function InlineSearch(props: InlineSearchProps): React.JSX.Element {
  const {
    hasResults,
    value,
    isCaseSensitive,
    isWholeWordOnly,
    close,
    gotoNextSearchResult,
    gotoPreviousSearchResult,
    search,
    setCaseSensitivity,
    setWholeWordOnly,
  } = props;

  const resultsText = hasResults
    ? `${(props as InlineSearchProps_HasResults).currentResultIndex + 1} of ${(props as InlineSearchProps_HasResults).maxResultIndex + 1}`
    : 'No results.';
  const isNavigationActive = hasResults && (props as InlineSearchProps_HasResults).maxResultIndex > 0;
  let navigationClassName = 'editor-inline-search__button';
  if (isNavigationActive === false) {
    navigationClassName += ' editor-inline-search__button--disabled';
  }

  const onSubmit = useCallback((val: string) => search(val), [search]);
  const onCaseSensitivityChange = useCallback(
    (event: any) => setCaseSensitivity(event.target.checked),
    [setCaseSensitivity],
  );
  const onWholeWordChange = useCallback((event: any) => setWholeWordOnly(event.target.checked), [setWholeWordOnly]);
  const onPrevious = useCallback(() => gotoPreviousSearchResult(), [gotoPreviousSearchResult]);
  const onNext = useCallback(() => gotoNextSearchResult(), [gotoNextSearchResult]);
  const onClose = useCallback(() => close(), [close]);

  return (
    <div className="editor-inline-search kbm-editor-inline-search">
      <div className="search-input search-input--inline-search">
        <FormInput
          type="text"
          className="form-control form-control-sm editor-inline-search__input"
          value={value}
          autoselect
          onSubmit={onSubmit}
          onChange={onSubmit}
        />

        <div className="search-input__options">
          <label className="form-check-label" data-bs-toggle="tooltip" title="Match Case">
            <input
              type="checkbox"
              className="form-check-input"
              checked={isCaseSensitive}
              onChange={onCaseSensitivityChange}
            />
            <Icon id="ph ph-text-aa" />
          </label>

          <label className="form-check-label" data-bs-toggle="tooltip" title="Match Whole Word">
            <input
              type="checkbox"
              className="form-check-input"
              checked={isWholeWordOnly}
              onChange={onWholeWordChange}
            />
            <Icon id="ph ph-text-t" />
          </label>
        </div>
      </div>

      <span className="editor-inline-search__results">{resultsText}</span>

      <button className={navigationClassName} onClick={isNavigationActive ? onPrevious : undefined}>
        <Icon id="ph-light ph-caret-up" />
      </button>
      <button className={navigationClassName} onClick={isNavigationActive ? onNext : undefined}>
        <Icon id="ph-light ph-caret-down" />
      </button>
      <button className="editor-inline-search__button" onClick={onClose}>
        <Icon id="ph ph-x" />
      </button>
    </div>
  );
}
