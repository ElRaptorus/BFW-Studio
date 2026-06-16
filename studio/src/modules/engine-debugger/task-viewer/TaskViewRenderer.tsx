import type { Bifrost } from '#bifrost/Bifrost';
import type { FlowNodeInstance } from '@elraptorus/daemonengine_sdk';

import React from 'react';

import type { EditorDocumentRendererProps } from '@evil/bifrost_fw_sdk';
import { parseOpenInNewTabUrl } from '@evil/bifrost_fw_sdk';

import { DynamicUiComponentAdapter } from './DynamicUiComponentAdapter';

export default function TaskViewRenderer(props: EditorDocumentRendererProps): React.JSX.Element {
  const { studio, editorDocument } = props;

  const parsedFragmentUri = parseOpenInNewTabUrl(editorDocument.uri);

  const userTaskInstance = JSON.parse(parsedFragmentUri.data.userTaskInstance) as FlowNodeInstance;
  if (!userTaskInstance) {
    return <></>;
  }

  const readOnly = parsedFragmentUri.data.readOnly === 'true';

  let definitionFormSchema: unknown = null;
  if (parsedFragmentUri.data.definitionFormSchema) {
    try {
      definitionFormSchema = JSON.parse(parsedFragmentUri.data.definitionFormSchema);
    } catch {
      definitionFormSchema = null;
    }
  }

  return (
    <DynamicUiComponentAdapter
      engineId={parsedFragmentUri.data.engineId ?? parsedFragmentUri.data.engineUrl}
      studio={studio as Bifrost}
      userTaskInstance={userTaskInstance}
      readOnly={readOnly}
      definitionFormSchema={definitionFormSchema}
      onTaskCompleted={() => studio.editors.closeEditorDocument(editorDocument)}
    />
  );
}
