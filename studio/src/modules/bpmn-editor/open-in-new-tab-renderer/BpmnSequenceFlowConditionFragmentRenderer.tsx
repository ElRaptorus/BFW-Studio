import React, { useRef } from 'react';

import type { EditorDocumentRendererProps } from '@evil/bifrost_fw_sdk';

import type BpmnDocumentModel from '../BpmnDocumentModel';
import { BpmnFragmentRendererView } from './BpmnFragmentRendererView';
import type { BpmnFragmentRendererConfig, FragmentEditorRef } from './useBpmnFragmentRenderer';
import { useBpmnFragmentRenderer } from './useBpmnFragmentRenderer';

const CONFIG: BpmnFragmentRendererConfig = {
  label: 'Condition',
  language: 'feel',
  editorHtmlId: 'bpmn-sequence-flow-condition-fragment-editor',
  linkProps: { id: 'bpmn-sequence-flow-condition-fragment-link-to-editor-document' },
};

function getFragmentValue(model: BpmnDocumentModel, fragmentId: string): string {
  return model.elements.getElementPropertyValue(fragmentId, 'condition');
}

function setFragmentValue(model: BpmnDocumentModel, fragmentId: string, value: string): void {
  model.elements.setElementProperty(fragmentId, 'condition', value);
}

/**
 * Used to render the condition property of a BPMN Sequence Flow element in a separate editor.
 */
export default function BpmnSequenceFlowConditionFragmentRenderer(
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
