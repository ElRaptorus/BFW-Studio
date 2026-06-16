import React, { useRef } from 'react';

import type { EditorDocumentRendererProps } from '@evil/bifrost_fw_sdk';

import type BpmnDocumentModel from '../BpmnDocumentModel';
import { BpmnFragmentRendererView } from './BpmnFragmentRendererView';
import type { BpmnFragmentRendererConfig, FragmentEditorRef } from './useBpmnFragmentRenderer';
import { useBpmnFragmentRenderer } from './useBpmnFragmentRenderer';

const CONFIG: BpmnFragmentRendererConfig = {
  label: 'Payload',
  language: 'feel',
  editorHtmlAttributes: { 'data-test--bpmn-message-and-signal-event-payload-fragment-editor': true },
  linkProps: { 'data-test--bpmn-message-and-signal-event-payload-fragment-link-to-editor-document': true },
};

function getFragmentValue(model: BpmnDocumentModel, fragmentId: string): string {
  const customProperties = model.elements.getCustomProperties(fragmentId) ?? [];
  const payloadProperty = customProperties.find((property) => property.name === 'payload');
  return payloadProperty?.value ?? '';
}

function setFragmentValue(model: BpmnDocumentModel, fragmentId: string, value: string): void {
  model.elements.setCustomProperty(fragmentId, 'payload', value);
}

/**
 * Used to render the message- or signal-event payload property of a BPMN element in a separate editor.
 */
export default function BpmnMessageAndSignalEventPayloadFragmentRenderer(
  props: EditorDocumentRendererProps,
): React.JSX.Element | null {
  const editorRef = useRef<FragmentEditorRef | null>(null);
  const state = useBpmnFragmentRenderer(props, CONFIG, getFragmentValue, setFragmentValue);

  if (state.loading) {
    return null;
  }

  return (
    <BpmnFragmentRendererView
      bifrost={state.bifrost}
      config={CONFIG}
      fragmentId={state.fragmentId}
      fragmentName={state.fragmentName}
      fragmentValue={state.fragmentValue}
      feelVariables={state.feelVariables}
      parentEditorDocument={state.parentEditorDocument}
      ref={editorRef}
      onValueChange={state.handleChange}
    />
  );
}
