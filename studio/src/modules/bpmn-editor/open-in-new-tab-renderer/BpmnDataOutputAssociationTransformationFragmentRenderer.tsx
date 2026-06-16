import React, { useRef } from 'react';

import type { EditorDocumentRendererProps } from '@evil/bifrost_fw_sdk';

import type BpmnDocumentModel from '../BpmnDocumentModel';
import { BpmnFragmentRendererView } from './BpmnFragmentRendererView';
import type { BpmnFragmentRendererConfig, FragmentEditorRef } from './useBpmnFragmentRenderer';
import { useBpmnFragmentRenderer } from './useBpmnFragmentRenderer';

const CONFIG: BpmnFragmentRendererConfig = {
  label: 'Transformation',
  language: 'feel',
  editorHtmlId: 'bpmn-data-output-association-transformation-fragment-editor',
  linkProps: { id: 'bpmn-data-output-association-transformation-fragment-link-to-editor-document' },
};

function getFragmentValue(model: BpmnDocumentModel, fragmentId: string): string {
  return (model.elements.getById(fragmentId) as any)?.transformation ?? '';
}

function setFragmentValue(model: BpmnDocumentModel, fragmentId: string, value: string): void {
  model.elements.setElementProperty(fragmentId, 'transformation', value);
}

export default function BpmnDataOutputAssociationTransformationFragmentRenderer(
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
