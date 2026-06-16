import React, { useRef } from 'react';

import type { EditorDocumentRendererProps } from '@evil/bifrost_fw_sdk';

import type BpmnDocumentModel from '../BpmnDocumentModel';
import { BpmnFragmentRendererView } from './BpmnFragmentRendererView';
import type { BpmnFragmentRendererConfig, FragmentEditorRef } from './useBpmnFragmentRenderer';
import { useBpmnFragmentRenderer } from './useBpmnFragmentRenderer';

const CONFIG: BpmnFragmentRendererConfig = {
  label: 'Loop Break Condition',
  language: 'feel',
  editorHtmlAttributes: { 'data-test--bpmn-loop-break-condition-fragment-editor': true },
  linkProps: { 'data-test--bpmn-loop-break-condition-fragment-link-to-editor-document': true },
};

function getFragmentValue(model: BpmnDocumentModel, fragmentId: string): string {
  const element = model.elements.getById(fragmentId);
  const loopConfig = (element as any)?.loopConfig;
  return loopConfig?.loopBreakCondition ?? '';
}

function setFragmentValue(model: BpmnDocumentModel, fragmentId: string, value: string): void {
  model.elements.setElementProperty(fragmentId, 'loopConfig', {
    command: 'updateMultiInstance',
    loopBreakCondition: value,
  });
}

/**
 * Used to render the Break Condition property of a BPMN element in a separate editor.
 */
export default function BpmnLoopBreakConditionFragmentRenderer(
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
