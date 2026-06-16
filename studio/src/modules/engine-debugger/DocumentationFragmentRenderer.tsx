import React, { useEffect, useState } from 'react';

import type { EditorDocumentRendererProps } from '@evil/bifrost_fw_sdk';
import {
  Editor,
  EditorContent,
  EditorToolbar,
  EditorToolbarLeft,
  EditorToolbarText,
  MarkdownEditor,
  assertNotNull,
  parseOpenInNewTabUrl,
} from '@evil/bifrost_fw_sdk';
import { EVENT_DATA_UPDATED } from '@evil/bifrost_fw_sdk/src/contracts/internal/EditorEvents';

import type EngineBpmnDebuggerEditorDocumentModel from './EngineBpmnDebuggerEditorDocumentModel';

function getElement(
  model: EngineBpmnDebuggerEditorDocumentModel,
  elementId: string,
): { name: string | null; documentation: string } {
  const shape = model.bpmnViewerComponentAdapter?.getElementRegistry().get(elementId);
  if (!shape) {
    return { name: null, documentation: '' };
  }

  const businessObject = (shape as any).businessObject;
  const docs: { text: string }[] | undefined = businessObject?.documentation;

  return {
    name: businessObject?.name ?? null,
    documentation: docs?.map((entry) => entry.text).join('\n') ?? '',
  };
}

export default function DebuggerDocumentationFragmentRenderer(
  props: EditorDocumentRendererProps,
): React.JSX.Element | null {
  const bifrost = props.studio;

  const parsedFragmentUri = parseOpenInNewTabUrl(props.editorDocument.uri);
  const parentUri = parsedFragmentUri.parentUri;
  const fragmentId = parsedFragmentUri.fragmentId;

  const parentEditorDocument = bifrost.editors.getEditorDocumentByUri(parentUri);
  assertNotNull(parentEditorDocument, 'parentEditorDocument');

  const [loading, setLoading] = useState(true);
  const [fragmentName, setFragmentName] = useState<string | null>(null);
  const [documentation, setDocumentation] = useState<string>('');

  useEffect(() => {
    let mounted = true;

    bifrost.editors
      .getEditorDocumentModel<EngineBpmnDebuggerEditorDocumentModel>(parentEditorDocument)
      .then((model: EngineBpmnDebuggerEditorDocumentModel) => {
        if (!mounted) {
          return;
        }

        function refresh(): void {
          if (!mounted) {
            return;
          }
          const element = getElement(model, fragmentId);
          setFragmentName(element.name);
          setDocumentation(element.documentation);
          setLoading(false);
        }

        model.onceInteractive(() => refresh());
        refresh();

        model.on(EVENT_DATA_UPDATED, () => refresh());
      });

    return () => {
      mounted = false;
    };
  }, [bifrost.editors, fragmentId, parentEditorDocument]);

  if (loading) {
    return null;
  }

  return (
    <Editor>
      <EditorToolbar>
        <EditorToolbarLeft>
          {parentEditorDocument && (
            <EditorToolbarText studio={bifrost}>
              Documentation for &quot;
              <a href="#" onClick={() => bifrost.editors.focusOrOpenEditorDocument(parentEditorDocument)}>
                {fragmentName ?? fragmentId}
              </a>
              &quot; ({fragmentId}) in{' '}
              <a href="#" onClick={() => bifrost.editors.focusOrOpenEditorDocument(parentEditorDocument)}>
                {parentEditorDocument.label}
              </a>
            </EditorToolbarText>
          )}
        </EditorToolbarLeft>
      </EditorToolbar>
      <EditorContent>
        <MarkdownEditor
          studio={bifrost}
          data={documentation}
          readonly={true}
          htmlAttributes={{ style: { height: '100%' } }}
        />
      </EditorContent>
    </Editor>
  );
}
