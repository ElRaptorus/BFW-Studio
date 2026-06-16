import React, { useEffect, useState } from 'react';

import type { EditorDocumentRendererProps } from '@evil/bifrost_fw_sdk';
import { Editor, EditorContent, MarkdownEditor, assertNotNull } from '@evil/bifrost_fw_sdk';

import type { EditorDocumentMarkdownEditorModel } from './EditorDocumentMarkdownEditorModel';

export function EditorDocumentMarkdownEditorRenderer(props: EditorDocumentRendererProps): React.JSX.Element | null {
  const [model, setModel] = useState<EditorDocumentMarkdownEditorModel | null>(null);

  useEffect(() => {
    let mounted = true;
    props.studio.editors
      .getEditorDocumentModel<EditorDocumentMarkdownEditorModel>(props.editorDocument)
      .then((loadedModel) => {
        if (mounted) {
          setModel(loadedModel);
        }
      });
    return () => {
      mounted = false;
    };
  }, [props.studio, props.editorDocument]);

  const onDataChanged = (value: string): void => {
    assertNotNull(model, 'model');
    model.setValue(value);
  };

  if (model == null) {
    return null;
  }

  return (
    <Editor>
      <EditorContent>
        <MarkdownEditor
          htmlAttributes={{ 'data-test--mdx-document-editor-visible': true }}
          studio={props.studio}
          data={model.getValue()}
          onDataChanged={(value) => onDataChanged(value)}
        />
      </EditorContent>
    </Editor>
  );
}
