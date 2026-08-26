import { parseOpenInNewTabUrl } from '#bifrost/common/OpenInNewTabUrl';
import type { EditorDocument, EditorDocumentRendererProps } from '#bifrost/contracts/EditorTypes';
import { MultiLineCodeEditor } from '#components/MultiLineCodeEditor';
import { Editor } from '#components/editor/Editor';
import { EditorContent } from '#components/editor/EditorContent';
import { EditorToolbar } from '#components/editor/EditorToolbar';
import { EditorToolbarLeft } from '#components/editor/EditorToolbarLeft';
import { EditorToolbarText } from '#components/editor/EditorToolbarText';

import React, { useEffect, useMemo, useRef } from 'react';

type JsonPayloadFragmentRendererData = {
  processInstanceId: string;
  processModelId: string;
  processModelName?: string;
  propertyName: string;
  value: string;
};

/**
 * Used to render a json or javascript snippet in a separate editor.
 */
export default function ProcessInstanceJsonPropertyFragmentRenderer(
  props: EditorDocumentRendererProps,
): React.JSX.Element | null {
  const multiLineCodeEditorRef = useRef<MultiLineCodeEditor | null>(null);

  const { bifrost, parentEditorDocument, processInstanceData } = useMemo(() => {
    const bifrostInstance = props.studio;
    const parsedFragmentUri = parseOpenInNewTabUrl(props.editorDocument.uri);
    const parentUri = parsedFragmentUri.parentUri;
    const processInstanceDataFromUri = parsedFragmentUri.data as JsonPayloadFragmentRendererData;
    const parentEditorDocumentFromUri = bifrostInstance.editors.getEditorDocumentByUri(parentUri) as EditorDocument;

    return {
      bifrost: bifrostInstance,
      parentEditorDocument: parentEditorDocumentFromUri,
      processInstanceData: processInstanceDataFromUri,
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
              {processInstanceData.propertyName} for Process Instance &quot;
              <a href="#" onClick={() => bifrost.editors.focusOrOpenEditorDocument(parentEditorDocument)}>
                {processInstanceData.processInstanceId}
              </a>
              &quot; ({processInstanceData.processModelId || processInstanceData.processModelId}) in{' '}
              <a
                href="#"
                id="debugger-process-instance-json-data-fragment-link-to-editor-document"
                onClick={() => bifrost.editors.focusOrOpenEditorDocument(parentEditorDocument)}
              >
                {parentEditorDocument.label}
              </a>
            </EditorToolbarText>
          )}
        </EditorToolbarLeft>
      </EditorToolbar>
      <EditorContent>
        <MultiLineCodeEditor
          htmlId="debugger-process-instance-json-data-fragment-editor"
          ref={multiLineCodeEditorRef}
          studio={bifrost}
          initialValue={processInstanceData.value}
          language={'json'}
          autoFocus={true}
          readOnly={true}
          minimap={true}
        />
      </EditorContent>
    </Editor>
  );
}
