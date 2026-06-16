import React, { useRef } from 'react';

import type { EditorDocumentRendererProps, MultiLineCodeEditor } from '@evil/bifrost_fw_sdk';
import { assertNotNull } from '@evil/bifrost_fw_sdk';

import type BpmnDocumentModel from '../BpmnDocumentModel';
import { BpmnFragmentRendererView } from './BpmnFragmentRendererView';
import type { BpmnFragmentRendererConfig } from './useBpmnFragmentRenderer';
import { useBpmnFragmentRenderer } from './useBpmnFragmentRenderer';

const CONFIG: BpmnFragmentRendererConfig = {
  label: 'Example Result',
  language: 'json',
  editorHtmlId: 'bpmn-example-result-fragment-editor',
  linkProps: { id: 'bpmn-example-result-fragment-link-to-editor-document' },
};

function getFragmentValue(model: BpmnDocumentModel, fragmentId: string): string {
  const element = model.elements.getById(fragmentId);
  assertNotNull(element, 'element');

  const exampleResultProperty = element.customProperties?.find((property) => property.name === 'studio.exampleResult');

  return exampleResultProperty?.value ?? '';
}

function setFragmentValue(model: BpmnDocumentModel, fragmentId: string, value: string): void {
  model.elements.setCustomProperty(fragmentId, 'studio.exampleResult', value);
}

/**
 * Used to render the Example Result of a Business Rule Task in a separate editor.
 */
export default function BpmnExampleResultFragmentRenderer(
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
