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

type EditorInspectorItemFragmentRendererProps = {
  editorDocument: EditorDocument;
  processId: string;
  propertyName: string;
  language?: string;
  studio: Bifrost;
  value: string;
};

/**
 * Used to render inspector data in a separate editor.
 */
export default function EditorInspectorItemFragmentRenderer(
  props: EditorInspectorItemFragmentRendererProps,
): React.JSX.Element | null {
  const multiLineCodeEditorRef = useRef<MultiLineCodeEditor | null>(null);

  const { bifrost, parentEditorDocument, inspectorData } = useMemo(() => {
    const bifrostInstance = props.studio;
    const parsedFragmentUri = parseOpenInNewTabUrl(props.editorDocument.uri);
    const parentUri = parsedFragmentUri.parentUri;
    const inspectorDataFromUri = parsedFragmentUri.data as EditorInspectorItemFragmentRendererProps;
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

  return (
    <Editor>
      <EditorToolbar>
        <EditorToolbarLeft>
          {parentEditorDocument && (
            <EditorToolbarText studio={props.studio}>
              {inspectorData.propertyName} of BPMN &quot;
              <a href="#" onClick={() => bifrost.editors.focusOrOpenEditorDocument(parentEditorDocument)}>
                {inspectorData.processId}
              </a>
              &quot;
            </EditorToolbarText>
          )}
        </EditorToolbarLeft>
      </EditorToolbar>
      <EditorContent>
        <MultiLineCodeEditor
          htmlId="editor-bpmn-json-data-fragment-editor"
          ref={multiLineCodeEditorRef}
          studio={bifrost}
          initialValue={inspectorData.value}
          language={inspectorData.language ?? 'json'}
          autoFocus={true}
          readOnly={true}
          minimap={true}
        />
      </EditorContent>
    </Editor>
  );
}
