import type { EditorDocumentRendererProps } from '#bifrost/contracts/EditorTypes';
import type { MultiLineCodeEditor } from '#components/MultiLineCodeEditor';

import React, { useRef } from 'react';

import type BpmnDocumentModel from '../BpmnDocumentModel';
import { BpmnFragmentRendererView } from './BpmnFragmentRendererView';
import type { BpmnFragmentRendererConfig } from './useBpmnFragmentRenderer';
import { useBpmnFragmentRenderer } from './useBpmnFragmentRenderer';

const CONFIG: BpmnFragmentRendererConfig = {
  label: 'Text',
  language: '',
  editorHtmlId: 'bpmn-text-fragment-editor',
  linkProps: { id: 'bpmn-text-fragment-link-to-editor-document' },
};

function getFragmentValue(model: BpmnDocumentModel, fragmentId: string): string {
  return model.elements.getElementPropertyValue(fragmentId, 'textAnnotation');
}

function setFragmentValue(model: BpmnDocumentModel, fragmentId: string, value: string): void {
  model.elements.setElementProperty(fragmentId, 'textAnnotation', value);
}

/**
 * Used to render the text property of a BPMN element in a separate editor.
 */
export default function BpmnTextFragmentRenderer(props: EditorDocumentRendererProps): React.JSX.Element | null {
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
