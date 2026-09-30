import type { Bifrost } from '#bifrost/Bifrost';
import { parseOpenInNewTabUrl } from '#bifrost/common/OpenInNewTabUrl';
import type { EditorDocumentRendererProps } from '#bifrost/contracts/EditorTypes';

import React from 'react';

import type { FlowNodeInstance } from '@elraptorus/bfw_engine_sdk';

import { DynamicUiComponentAdapter } from './DynamicUiComponentAdapter';

function parseJsonOrNull(text: string | undefined): unknown {
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export default function TaskViewRenderer(props: EditorDocumentRendererProps): React.JSX.Element {
  const { studio, editorDocument } = props;

  const parsedFragmentUri = parseOpenInNewTabUrl(editorDocument.uri);

  const userTaskInstance = JSON.parse(parsedFragmentUri.data.userTaskInstance) as FlowNodeInstance;
  if (!userTaskInstance) {
    return <></>;
  }

  const readOnly = parsedFragmentUri.data.readOnly === 'true';

  const definitionFormFields = parseJsonOrNull(parsedFragmentUri.data.definitionFormFields);
  const definitionFormActions = parseJsonOrNull(parsedFragmentUri.data.definitionFormActions);

  return (
    <DynamicUiComponentAdapter
      engineId={parsedFragmentUri.data.engineId ?? parsedFragmentUri.data.engineUrl}
      studio={studio as Bifrost}
      userTaskInstance={userTaskInstance}
      readOnly={readOnly}
      definitionFormFields={definitionFormFields}
      definitionFormActions={definitionFormActions}
      onClose={() => studio.editors.closeEditorDocument(editorDocument)}
    />
  );
}
