import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneHeader } from '#components/panes/PaneHeader';

import React from 'react';

import { valueMatchesSearchQuery } from '@evil/bifrost_fw_sdk';

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
    string | ((editorDocument: EditorDocument, editorDocumentModel: any, studio: Bifrost) => boolean),
  titleOrTitleFn:
    string | ((editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel, studio: Bifrost) => string),
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

export { valueMatchesSearchQuery };
