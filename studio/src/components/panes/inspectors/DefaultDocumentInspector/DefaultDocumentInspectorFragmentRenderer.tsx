import React, { useEffect, useMemo, useRef } from 'react';

import type { EditorDocument, Studio } from '@evil/bifrost_fw_sdk';
import {
  Editor,
  EditorContent,
  EditorToolbar,
  EditorToolbarLeft,
  EditorToolbarText,
  MultiLineCodeEditor,
  parseOpenInNewTabUrl,
} from '@evil/bifrost_fw_sdk';

type DefaultDocumentInspectorFragmentRendererProps = {
  editorDocument: EditorDocument;
  propertyName: string;
  studio: Studio;
  value: string;
};

/**
 * Used to render inspector data in a separate editor.
 */
export default function DefaultDocumentInspectorFragmentRenderer(
  props: DefaultDocumentInspectorFragmentRendererProps,
): React.JSX.Element | null {
  const multiLineCodeEditorRef = useRef<MultiLineCodeEditor | null>(null);

  const { bifrost, parentEditorDocument, inspectorData } = useMemo(() => {
    const bifrostInstance = props.studio;
    const parsedFragmentUri = parseOpenInNewTabUrl(props.editorDocument.uri);
    const parentUri = parsedFragmentUri.parentUri;
    const inspectorDataFromUri = parsedFragmentUri.data as DefaultDocumentInspectorFragmentRendererProps;
    const parentEditorDocumentFromUri = bifrostInstance.editors.getEditorDocumentByUri(parentUri) as EditorDocument;

    return {
      bifrost: bifrostInstance,
      parentEditorDocument: parentEditorDocumentFromUri,
      inspectorData: inspectorDataFromUri,
    };
  }, [props.editorDocument.uri, props.studio]);

  useEffect(() => {
    multiLineCodeEditorRef.current?.focus();
  }, []);

  const getTitle = (): React.JSX.Element | string => {
    return (
      <>
        {inspectorData.propertyName} of Editor Document &quot;
        <a href="#" onClick={() => bifrost.editors.focusOrOpenEditorDocument(parentEditorDocument)}>
          {parentEditorDocument.label}
        </a>
        &quot;
      </>
    );
  };

  return (
    <Editor>
      <EditorToolbar>
        <EditorToolbarLeft>
          {parentEditorDocument && <EditorToolbarText studio={props.studio}>{getTitle()}</EditorToolbarText>}
        </EditorToolbarLeft>
      </EditorToolbar>
      <EditorContent>
        <MultiLineCodeEditor
          htmlId="default-document-inspector-json-data-fragment-renderer"
          ref={multiLineCodeEditorRef}
          studio={bifrost}
          initialValue={inspectorData.value}
          language="json"
          autoFocus={true}
          readOnly={true}
        />
      </EditorContent>
    </Editor>
  );
}
