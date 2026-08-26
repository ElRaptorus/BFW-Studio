import type { Bifrost } from '#bifrost/Bifrost';
import { parseOpenInNewTabUrl } from '#bifrost/common/OpenInNewTabUrl';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import { MultiLineCodeEditor } from '#components/MultiLineCodeEditor';
import { Editor } from '#components/editor/Editor';
import { EditorContent } from '#components/editor/EditorContent';
import { EditorToolbar } from '#components/editor/EditorToolbar';
import { EditorToolbarLeft } from '#components/editor/EditorToolbarLeft';
import { EditorToolbarText } from '#components/editor/EditorToolbarText';

import React, { useEffect, useMemo, useRef } from 'react';

type DefaultDocumentInspectorFragmentRendererProps = {
  editorDocument: EditorDocument;
  propertyName: string;
  studio: Bifrost;
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
