import type { EditorDocumentRendererProps } from '#bifrost/contracts/EditorTypes';

import React, { useRef } from 'react';

import type BpmnDocumentModel from '../BpmnDocumentModel';
import { BpmnFragmentRendererView } from './BpmnFragmentRendererView';
import type { BpmnFragmentRendererConfig, FragmentEditorRef } from './useBpmnFragmentRenderer';
import { useBpmnFragmentRenderer } from './useBpmnFragmentRenderer';

const CONFIG: BpmnFragmentRendererConfig = {
  label: 'Assignees for User Task',
  language: 'feel',
  editorHtmlAttributes: { 'data-test--bpmn-user-task-assignees-fragment-editor': true },
  linkProps: { 'data-test--bpmn-user-task-assignees-fragment-link-to-editor-document': true },
};

function getFragmentValue(model: BpmnDocumentModel, fragmentId: string): string {
  const element = model.elements.getById(fragmentId);
  return (element as any)?.assignees ?? '';
}

function setFragmentValue(model: BpmnDocumentModel, fragmentId: string, value: string): void {
  model.elements.setElementProperty(fragmentId, 'userTaskExtensions', { assignees: value });
}

/**
 * Used to render the User Task Assignees property of a User Task in a separate editor.
 */
export default function BpmnUserTaskAssigneesFragmentRenderer(
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
