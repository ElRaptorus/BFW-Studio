import React, { useRef } from 'react';

import type { EditorDocumentRendererProps, MultiLineCodeEditor } from '@evil/bifrost_fw_sdk';

import type BpmnDocumentModel from '../BpmnDocumentModel';
import { BpmnFragmentRendererView } from './BpmnFragmentRendererView';
import type { BpmnFragmentRendererConfig } from './useBpmnFragmentRenderer';
import { useBpmnFragmentRenderer } from './useBpmnFragmentRenderer';

const CONFIG: BpmnFragmentRendererConfig = {
  label: 'Default Configured Start Payload',
  language: 'json',
  editorHtmlAttributes: { 'data-test--bpmn-default-custom-start-token-fragment-editor': true },
  linkProps: { 'data-test--bpmn-default-custom-start-token-fragment-link-to-editor-document': true },
};

function getFragmentValue(model: BpmnDocumentModel, fragmentId: string): string {
  const customProperties = model.elements.getCustomProperties(fragmentId) ?? [];
  const defaultCustomStartTokenProperty = customProperties.find(
    (property) => property.name === 'studio.defaultCustomStartToken',
  );
  return defaultCustomStartTokenProperty?.value ?? '';
}

function setFragmentValue(model: BpmnDocumentModel, fragmentId: string, value: string): void {
  model.elements.setCustomProperty(fragmentId, 'studio.defaultCustomStartToken', value);
}

/**
 * Used to render the default custom start token property of a BPMN element in a separate editor.
 */
export default function BpmnDefaultCustomStartTokenFragmentRenderer(
  props: EditorDocumentRendererProps,
): React.JSX.Element | null {
  const multiLineCodeEditorRef = useRef<MultiLineCodeEditor | null>(null);
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
      ref={multiLineCodeEditorRef}
      onValueChange={state.handleChange}
    />
  );
}
