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

type DebuggerInspectorItemFragmentRendererProps = {
  editorDocument: EditorDocument;
  processInstanceId: string;
  propertyName: string;
  language?: string;
  studio: Studio;
  value: string;
};

/**
 * Used to render inspector data in a separate editor.
 */
export default function DebuggerInspectorItemFragmentRenderer(
  props: DebuggerInspectorItemFragmentRendererProps,
): React.JSX.Element | null {
  const multiLineCodeEditorRef = useRef<MultiLineCodeEditor | null>(null);

  const { bifrost, parentEditorDocument, processInstanceData } = useMemo(() => {
    const bifrostInstance = props.studio;
    const parsedFragmentUri = parseOpenInNewTabUrl(props.editorDocument.uri);
    const parentUri = parsedFragmentUri.parentUri;
    const processInstanceDataFromUri = parsedFragmentUri.data as DebuggerInspectorItemFragmentRendererProps;
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

  const getTitle = (): React.JSX.Element | string => {
    if (processInstanceData.propertyName === 'Process Instance') {
      return `Debugged Process Instance `;
    }

    return (
      <>
        <a href="#" onClick={() => bifrost.editors.focusOrOpenEditorDocument(parentEditorDocument)}>
          {processInstanceData.propertyName}
        </a>{' '}
        of debugged Process Instance
      </>
    );
  };

  return (
    <Editor>
      <EditorToolbar>
        <EditorToolbarLeft>
          {parentEditorDocument && (
            <EditorToolbarText studio={props.studio}>
              {getTitle()}&quot;
              <a href="#" onClick={() => bifrost.editors.focusOrOpenEditorDocument(parentEditorDocument)}>
                {processInstanceData.processInstanceId}
              </a>
              &quot;
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
          language={processInstanceData.language ?? 'json'}
          autoFocus={true}
          readOnly={true}
          minimap={true}
        />
      </EditorContent>
    </Editor>
  );
}
