import type { Bifrost } from '#bifrost/Bifrost';

import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';

import type { EditorDocument, EditorDocumentRendererProps } from '@evil/bifrost_fw_sdk';
import { DecorationContext, EditorLoadingError, Icon } from '@evil/bifrost_fw_sdk';

import { EVENT_EDITOR_AREA_LAYOUT_UPDATED } from '../../../../studio-sdk/src/contracts/internal/EditorEvents';
import {
  EVENT_PANE_LAYOUT_UPDATED,
  EVENT_PANE_SIZE_UPDATED,
} from '../../../../studio-sdk/src/contracts/internal/PaneEvents';
import { useBifrost } from '../../bifrostContext';
import { ErrorBoundaryWithMessage } from '../ErrorBoundaryWithMessage';
import EditorTabList from './EditorTabList';

const MIN_WIDTH_BREAKPOINTS = { sm: 576, md: 768, lg: 992, xl: 1200, xxl: 1400 };

type EditorProps = {
  editorId: string;
  editorDocuments: EditorDocument[];
  activeEditorDocumentIndex: number;

  isFocusedEditor: boolean;
  focusedEditorDocumentUri: string;
  focusedEditorDocumentParentUri: string;

  editorTabsVisible: boolean;
};

type EditorTabsAndOptionsProps = {
  activeEditorDocumentIndex: number;
  editorDocuments: EditorDocument[];
  editorId: string;
  focusedEditorDocumentParentUri: string;
  focusedEditorDocumentUri: string;
  isFocusedEditor: boolean;
};

export default function EditorWrapper(props: EditorProps): React.JSX.Element {
  const bifrost = useBifrost();
  const htmlRef = useRef<HTMLDivElement>(null);
  const [editorSizeClassNames, setEditorSizeClassNames] = useState<string[]>([]);
  const activeEditorDocument = props.editorDocuments[props.activeEditorDocumentIndex];

  const handleResize = useCallback(() => {
    const width = htmlRef.current?.offsetWidth || 0;
    const breakpoints = Object.keys(MIN_WIDTH_BREAKPOINTS)
      .map((key) => (width >= MIN_WIDTH_BREAKPOINTS[key] ? key : null))
      .filter((key) => key != null);

    const classNames = breakpoints.map((key) => `editor--${key}`);

    setEditorSizeClassNames((prev) => (prev.join(' ') === classNames.join(' ') ? prev : classNames));
  }, []);

  useLayoutEffect(() => {
    handleResize();

    const subscriptions = [
      bifrost.panes.on(EVENT_PANE_LAYOUT_UPDATED, handleResize),
      bifrost.panes.on(EVENT_PANE_SIZE_UPDATED, handleResize),
      bifrost.editors.on(EVENT_EDITOR_AREA_LAYOUT_UPDATED, handleResize),
    ];

    return () => subscriptions.forEach((subscription) => subscription.dispose());
  }, [bifrost.panes, bifrost.editors, handleResize]);

  const classNamesString = useMemo(
    () =>
      [
        'editor',
        'kbm-editor',
        props.isFocusedEditor ? 'editor--focused' : '',
        'editor--xs',
        ...editorSizeClassNames,
      ].join(' '),
    [props.isFocusedEditor, editorSizeClassNames],
  );

  const divProps: any = {
    'data-editor-id': props.editorId,
    'data-editor-document-type': activeEditorDocument?.documentType,
  };

  if (props.isFocusedEditor) {
    divProps['data-focused-editor'] = true;
    divProps['data-test--editors--focused-uri'] = activeEditorDocument?.uri;
    divProps['data-test--editors--focused-document-type'] = activeEditorDocument?.documentType;
  }

  const onClick = useCallback(() => {
    if (!props.isFocusedEditor) {
      bifrost.editors.focusOrOpenEditorDocument(activeEditorDocument);
    }
  }, [bifrost.editors, props.isFocusedEditor, activeEditorDocument]);

  return (
    <div ref={htmlRef} className={classNamesString} tabIndex="-1" onClick={onClick} {...divProps}>
      {props.editorTabsVisible && <EditorTabsAndOptions {...props} />}

      <ErrorBoundaryWithMessage
        message="There has been an error in this document."
        key={`${props.editorId}__${activeEditorDocument?.uri || 'empty_editor'}`}
      >
        <div className="editor__canvas">
          <RenderDocument editorDocument={activeEditorDocument} />
        </div>
      </ErrorBoundaryWithMessage>
    </div>
  );
}

function getRenderer(bifrost: Bifrost, key: string | null): any {
  if (key == null) {
    throw new Error('No renderer key provided');
  }

  try {
    return bifrost.editors.getEditorDocumentRenderer(key);
  } catch (error) {
    function RendererErrorFallback() {
      return <EditorLoadingError errorMessage={error} />;
    }
    return RendererErrorFallback;
  }
}

function RenderDocument({ editorDocument }: { editorDocument?: EditorDocument }): React.JSX.Element | null {
  const studio = useBifrost();
  const EditorDocumentRenderer = useMemo(
    () => getRenderer(studio, editorDocument ? editorDocument.rendererKey : null),
    [studio, editorDocument],
  );

  if (!editorDocument) {
    return null;
  }

  const { uri } = editorDocument;
  const key = `text-${uri || 'empty'}`;
  const editorDocumentRendererProps: EditorDocumentRendererProps = {
    uri,
    editorDocument,
    studio,
  };

  // eslint-disable-next-line react-hooks/static-components -- dynamic renderer lookup; stable per rendererKey via useMemo
  return <EditorDocumentRenderer {...editorDocumentRendererProps} key={key} />;
}

function EditorTabsAndOptions(props: EditorTabsAndOptionsProps): React.JSX.Element {
  const bifrost = useBifrost();

  const editorDocuments = props.editorDocuments;
  const activeEditorDocument = editorDocuments[props.activeEditorDocumentIndex];

  const focusEditorDocument = useCallback(
    (editorDocument: EditorDocument): void => {
      bifrost.editors.focusOrOpenEditorDocument(editorDocument);
    },
    [bifrost.editors],
  );

  const moveEditorDocument = useCallback(
    (origEditorId: string, origIndex: number, destEditorId: string, destIndex: number): void => {
      bifrost.editors.moveAndActivateEditorDocumentByEditorIdAndIndex(origEditorId, origIndex, destEditorId, destIndex);
    },
    [bifrost.editors],
  );

  const closeEditorDocument = useCallback(
    (editorDocument: EditorDocument): void => {
      bifrost.commands.executeCommand('std.editor.closeEditorDocument', [editorDocument]);
    },
    [bifrost.commands],
  );

  const persistEditorDocument = useCallback(
    (editorDocument: EditorDocument): void => {
      bifrost.editors.persistEditorDocument(editorDocument);
    },
    [bifrost.editors],
  );

  const decorationSource = bifrost.fileExplorerView.getDecorationSource();

  return (
    <div className="editor__tabs clearfix">
      <DecorationContext.Provider value={decorationSource}>
        <EditorTabList
          editorDocuments={editorDocuments}
          activeEditorDocument={activeEditorDocument}
          isFocusedEditor={props.isFocusedEditor}
          focusedEditorDocumentUri={props.focusedEditorDocumentUri}
          focusedEditorDocumentParentUri={props.focusedEditorDocumentParentUri}
          editorId={props.editorId}
          focusEditorDocument={focusEditorDocument}
          moveEditorDocument={moveEditorDocument}
          closeEditorDocument={closeEditorDocument}
          persistEditorDocument={persistEditorDocument}
          iconComponent={Icon}
        />
      </DecorationContext.Provider>
    </div>
  );
}
