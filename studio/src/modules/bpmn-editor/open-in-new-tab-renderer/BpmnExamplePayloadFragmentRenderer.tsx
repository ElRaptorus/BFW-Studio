import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import type { EditorDocumentRendererProps } from '#bifrost/contracts/EditorTypes';
import type { MultiLineCodeEditor } from '#components/MultiLineCodeEditor';

import React, { useRef } from 'react';

import type BpmnDocumentModel from '../BpmnDocumentModel';
import { BpmnFragmentRendererView } from './BpmnFragmentRendererView';
import type { BpmnFragmentRendererConfig } from './useBpmnFragmentRenderer';
import { useBpmnFragmentRenderer } from './useBpmnFragmentRenderer';

const CONFIG: BpmnFragmentRendererConfig = {
  label: 'Example Payload',
  language: 'json',
  editorHtmlId: 'bpmn-example-payload-fragment-editor',
  linkProps: { id: 'bpmn-example-payload-fragment-link-to-editor-document' },
};

function getFragmentValue(model: BpmnDocumentModel, fragmentId: string): string {
  const element = model.elements.getById(fragmentId);
  assertNotNull(element, 'element');

  const examplePayloadProperty = element.customProperties?.find(
    (property) => property.name === 'studio.examplePayload',
  );

  return examplePayloadProperty?.value ?? '';
}

function setFragmentValue(model: BpmnDocumentModel, fragmentId: string, value: string): void {
  model.elements.setCustomProperty(fragmentId, 'studio.examplePayload', value);
}

/**
 * Used to render the Example Payload of a triggerable Flow Node (like Message and Signal Events) in a separate editor.
 */
export default function BpmnExamplePayloadFragmentRenderer(
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
