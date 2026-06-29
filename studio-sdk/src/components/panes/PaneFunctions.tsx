import React from 'react';

import type { EditorDocument, EditorDocumentModel, PaneComponentProps, PaneProvider, Studio } from '../../../index';
import { Pane, PaneHeader } from '../../../index';
import type { SearchQuery } from '../../contracts/internal/SearchTypes';

/**
 * Returns a simple `PaneProvider` to export in a Pane file.
 *
 *      // MyPane.tsx
 *
 *      export const paneProvider = buildSimplePropertyPaneProvider(
 *        'bpmn', // documentType
 *        'MyPane Example', // label
 *        MyPane // React Component for Pane Content
 *      );
 *
 *      function MyPane(props: PaneComponentProps): React.JSX.Element {
 *        return (
 *          <PaneBody>
 *            This is great!
 *          </PaneBody>
 *        );
 *      }
 *
 */
export function buildSimplePropertyPaneProvider(
  documentTypeOrPredicateFn:
    string | ((editorDocument: EditorDocument, editorDocumentModel: any, studio: Studio) => boolean),
  titleOrTitleFn:
    string | ((editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel, studio: Studio) => string),
  PaneContentComponent: any,
  PaneTabOptionsComponent?: any,
): PaneProvider {
  const getPaneTitle = typeof titleOrTitleFn === 'function' ? titleOrTitleFn : () => titleOrTitleFn;
  const PaneComponent = (props: PaneComponentProps) => (
    <Pane>
      <PaneHeader
        studio={props.studio}
        title={getPaneTitle(props.editorDocument, props.editorDocumentModel, props.studio)}
        paneId={props.paneId}
        collapsed={props.collapsed}
      >
        {PaneTabOptionsComponent ? <PaneTabOptionsComponent {...props} /> : null}
      </PaneHeader>
      {props.collapsed !== true && <PaneContentComponent {...props} />}
    </Pane>
  );
  const shouldBeDisplayed =
    typeof documentTypeOrPredicateFn === 'function'
      ? documentTypeOrPredicateFn
      : (editorDocument: EditorDocument): boolean => {
          return editorDocument?.documentType === documentTypeOrPredicateFn;
        };

  return {
    getPaneTitle: getPaneTitle,
    Pane: PaneComponent,
    PaneContent: PaneContentComponent,
    shouldBeDisplayed: shouldBeDisplayed,
  };
}

/**
 * Returns `true` if the given `value` matches the given `searchQuery`.
 */
export function valueMatchesSearchQuery(value: string, searchQuery: SearchQuery): boolean {
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
