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
  id: string;
  flowNodeId?: string;
  flowNodeName?: string;
  propertyName: string;
  value: string;
  scriptLanguage?: 'json' | 'javascript';
};

/**
 * Used to render a json or javascript snippet in a separate editor.
 */
export default function FlowNodeInstanceJsonPropertyFragmentRenderer(
  props: EditorDocumentRendererProps,
): React.JSX.Element | null {
  const multiLineCodeEditorRef = useRef<MultiLineCodeEditor | null>(null);

  const { bifrost, parentEditorDocument, flowNodeInstanceData } = useMemo(() => {
    const bifrostInstance = props.studio;
    const parsedFragmentUri = parseOpenInNewTabUrl(props.editorDocument.uri);
    const parentUri = parsedFragmentUri.parentUri;
    const flowNodeInstanceDataFromUri = parsedFragmentUri.data as JsonPayloadFragmentRendererData;
    const parentEditorDocumentFromUri = bifrostInstance.editors.getEditorDocumentByUri(parentUri) as EditorDocument;

    return {
      bifrost: bifrostInstance,
      parentEditorDocument: parentEditorDocumentFromUri,
      flowNodeInstanceData: flowNodeInstanceDataFromUri,
    };
  }, [props.editorDocument.uri, props.studio]);

  useEffect(() => {
    multiLineCodeEditorRef.current?.focus();
  }, []);

  const flowNodeInstanceLabel = flowNodeInstanceData.id ? `(${flowNodeInstanceData.id})` : '';

  return (
    <Editor>
      <EditorToolbar>
        <EditorToolbarLeft>
          {parentEditorDocument && (
            <EditorToolbarText studio={props.studio}>
              {flowNodeInstanceData.propertyName} for &quot;
              <a href="#" onClick={() => bifrost.editors.focusOrOpenEditorDocument(parentEditorDocument)}>
                {flowNodeInstanceData.flowNodeId ?? flowNodeInstanceData.flowNodeName}
              </a>
              &quot; {flowNodeInstanceLabel} in{' '}
              <a
                href="#"
                id="debugger-flow-node-instance-json-data-fragment-link-to-editor-document"
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
          htmlId="debugger-flow-node-instance-json-data-fragment-editor"
          ref={multiLineCodeEditorRef}
          studio={bifrost}
          initialValue={flowNodeInstanceData.value}
          lineNumbers={true}
          language={flowNodeInstanceData.scriptLanguage || 'json'}
          autoFocus={true}
          readOnly={true}
          minimap={true}
        />
      </EditorContent>
    </Editor>
  );
}
