import type { Bifrost } from '#bifrost/Bifrost';
import { useDrop } from 'react-dnd';

import React, { useCallback, useEffect } from 'react';

import type { EditorAreaLayout_Column, EditorAreaLayout_Editor, EditorAreaLayout_Row } from '@evil/bifrost_fw_sdk';
import { NATIVE_FILE_TYPE, isUrlForOpenInNewTab, parseOpenInNewTabUrl } from '@evil/bifrost_fw_sdk';

import { useBifrost } from '../../bifrostContext';
import { ErrorBoundaryWithMessage } from '../ErrorBoundaryWithMessage';
import { SplitterLayout } from '../splitter/SplitterLayout';
import { EditorAreaEmptyState } from './EditorAreaEmptyState';
import EditorWrapper from './EditorWrapper';

const GET_PATHS_COMMAND = 'std.internal.getPathsFromFiles';

type EditorAreaRequiredProps = {
  focusedEditorId: string | null;
  focusedEditorDocumentUri: string | null;
  editorTabsVisible: boolean;
  layout: any;
};
type EditorAreaDocumentUriAnnotation = {
  focusedEditorDocumentParentUri: string | null;
};
type EditorAreaProps = EditorAreaRequiredProps & EditorAreaDocumentUriAnnotation;

export default function EditorArea(props: EditorAreaRequiredProps): React.JSX.Element {
  const bifrost = useBifrost();
  const onEditorSizeChanged = useCallback(() => bifrost.editors.onEditorSizeChanged(), [bifrost.editors]);
  const { parentUri: focusedEditorDocumentParentUri, parseError } = getParentUriIfFragmentUri(
    props.focusedEditorDocumentUri,
  );
  useEffect(() => {
    if (parseError) {
      bifrost.notifications.open({
        type: 'error',
        content: `A fragment document has a malformed URI. This is a bug in the module that created it.\n\n${parseError}`,
        source: 'EditorArea.getParentUriIfFragmentUri',
      });
    }
  }, [parseError, bifrost.notifications]);
  const editorAreaProps: EditorAreaProps = { ...props, focusedEditorDocumentParentUri };
  const editorArea = render(editorAreaProps.layout, editorAreaProps, bifrost, onEditorSizeChanged) || (
    <EditorAreaEmptyState />
  );

  const [, editorAreaDrop] = useDrop(
    () => ({
      accept: NATIVE_FILE_TYPE,
      drop: (item: any) => {
        if (!bifrost.commands.isRegistered(GET_PATHS_COMMAND)) {
          return;
        }
        (async () => {
          const paths: string[] = bifrost.commands.executeCommand(GET_PATHS_COMMAND, [Array.from(item.files)]);
          for (const filePath of paths) {
            if (!filePath.endsWith('.bpmn')) {
              continue;
            }
            const uri = bifrost.files.getUriForFilename(filePath);
            bifrost.commands.executeCommand('std.editor.focusOrOpenDocument', [uri]);
          }
        })().catch((error) => console.warn('External editor area drop failed:', error));
      },
    }),
    [bifrost],
  );

  return (
    <div ref={editorAreaDrop as any} className="editor-area" data-editor-area>
      {editorArea}
    </div>
  );
}

function getParentUriIfFragmentUri(uri: string | null): { parentUri: string | null; parseError: string | null } {
  if (uri == null || !isUrlForOpenInNewTab(uri)) {
    return { parentUri: null, parseError: null };
  }

  try {
    return { parentUri: parseOpenInNewTabUrl(uri).parentUri, parseError: null };
  } catch (error) {
    return { parentUri: null, parseError: error instanceof Error ? error.message : String(error) };
  }
}

function renderEditor(
  editorProps: EditorAreaLayout_Editor,
  editorAreaProps: EditorAreaProps,
): React.JSX.Element | null {
  if (editorProps == null) {
    return null;
  }
  const isFocusedEditor = editorAreaProps.focusedEditorId === editorProps.editorId;

  return (
    <ErrorBoundaryWithMessage message="This editor has crashed. Please restart the program.">
      <EditorWrapper
        isFocusedEditor={isFocusedEditor}
        focusedEditorDocumentUri={editorAreaProps.focusedEditorDocumentUri!}
        focusedEditorDocumentParentUri={editorAreaProps.focusedEditorDocumentParentUri!}
        editorTabsVisible={editorAreaProps.editorTabsVisible}
        {...editorProps}
      />
    </ErrorBoundaryWithMessage>
  );
}

function renderSplit(
  arrayOrThing: any,
  editor: any,
  vertical: boolean,
  editorAreaProps: EditorAreaProps,
  bifrost?: Bifrost,
  onEditorSizeChanged?: () => void,
): React.JSX.Element {
  let primarySplit;
  if (Array.isArray(arrayOrThing)) {
    primarySplit = renderSplit(
      arrayOrThing[0],
      arrayOrThing[1],
      vertical,
      editorAreaProps,
      bifrost,
      onEditorSizeChanged,
    );
  } else {
    primarySplit = render(arrayOrThing, editorAreaProps);
  }
  const secondarySplit = render(editor, editorAreaProps);

  const splitterProps: any = {
    percentage: true,
    secondaryInitialSize: 50,
    secondaryDefaultSize: 50,
    primaryMinSize: 10,
    secondaryMinSize: 10,
    onSecondaryPaneSizeChange: onEditorSizeChanged,
  };
  if (vertical) {
    splitterProps.vertical = true;
  }

  return (
    <SplitterLayout {...splitterProps}>
      {primarySplit}
      {secondarySplit}
    </SplitterLayout>
  );
}

function renderEditorAreaColumn(
  column: EditorAreaLayout_Column,
  editorAreaProps: EditorAreaProps,
  bifrost?: Bifrost,
  onEditorSizeChanged?: () => void,
): React.JSX.Element | null {
  if (column.rows.length === 0) {
    return null;
  }
  if (column.rows.length === 1) {
    return renderSplit(column.rows[0], null, true, editorAreaProps, bifrost, onEditorSizeChanged);
  }

  const splitted = column.rows.reduce<any>((prev, curr, _idx, _all) => [prev, curr], null);

  return renderSplit(splitted[0], splitted[1], true, editorAreaProps, bifrost, onEditorSizeChanged);
}

function renderEditorAreaRow(
  row: EditorAreaLayout_Row,
  editorAreaProps: EditorAreaProps,
  bifrost?: Bifrost,
  onEditorSizeChanged?: () => void,
): React.JSX.Element | null {
  if (row.columns.length === 0) {
    return null;
  }
  if (row.columns.length === 1) {
    return renderSplit(row.columns[0], null, false, editorAreaProps, bifrost, onEditorSizeChanged);
  }

  const splitted = row.columns.reduce<any>((prev, curr, _idx, _all) => [prev, curr], null);

  return renderSplit(splitted[0], splitted[1], false, editorAreaProps, bifrost, onEditorSizeChanged);
}

function render(
  thing: EditorAreaLayout_Column | EditorAreaLayout_Row | EditorAreaLayout_Editor | null,
  editorAreaProps: EditorAreaProps,
  bifrost?: Bifrost,
  onEditorSizeChanged?: () => void,
): React.JSX.Element | null {
  switch (thing?.type) {
    case 'column':
      return renderEditorAreaColumn(thing as EditorAreaLayout_Column, editorAreaProps, bifrost, onEditorSizeChanged);
    case 'row':
      return renderEditorAreaRow(thing as EditorAreaLayout_Row, editorAreaProps, bifrost, onEditorSizeChanged);
    case 'editor':
      return renderEditor(thing as EditorAreaLayout_Editor, editorAreaProps);
    default:
      return null;
  }
}
