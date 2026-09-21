import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import { MultiLineCodeEditor } from '#components/MultiLineCodeEditor';
import { Editor } from '#components/editor/Editor';
import { EditorContent } from '#components/editor/EditorContent';
import { EditorToolbar } from '#components/editor/EditorToolbar';
import { EditorToolbarLeft } from '#components/editor/EditorToolbarLeft';
import { EditorToolbarText } from '#components/editor/EditorToolbarText';

import React, { useCallback, useRef } from 'react';

import type { FeelEditorVariable } from '@elraptorus/bfw_studio_sdk';

import { FeelSimulatorEditor } from '../../../components/feel-simulator';
import type { FeelSimulatorEditorRef } from '../../../components/feel-simulator';
import type { BpmnFragmentRendererConfig, FragmentEditorRef } from './useBpmnFragmentRenderer';

type BpmnFragmentRendererViewProps = {
  bifrost: Bifrost;
  config: BpmnFragmentRendererConfig;
  fragmentId: string;
  fragmentName: string | null;
  fragmentValue: string | null;
  feelVariables: FeelEditorVariable[] | null;
  parentEditorDocument: EditorDocument;
  onValueChange: (value: string) => void;
  ref?: React.Ref<FragmentEditorRef | null>;
};

export function BpmnFragmentRendererView({
  ref: forwardedRef,
  bifrost,
  config,
  fragmentId,
  fragmentName,
  fragmentValue,
  feelVariables,
  parentEditorDocument,
  onValueChange,
}: BpmnFragmentRendererViewProps): React.JSX.Element {
  const editorRef = useRef<FragmentEditorRef | null>(null);
  const { label, language, editorHtmlId, editorHtmlAttributes, linkProps } = config;
  const isFeelEditor = language === 'feel';

  const setEditorRef = useCallback(
    (instance: FragmentEditorRef | null) => {
      editorRef.current = instance;
      if (typeof forwardedRef === 'function') {
        forwardedRef(instance);
      } else if (forwardedRef != null) {
        (forwardedRef as React.MutableRefObject<FragmentEditorRef | null>).current = instance;
      }
    },
    [forwardedRef],
  );

  const setSimulatorRef = useCallback(
    (instance: FeelSimulatorEditorRef | null) => {
      editorRef.current = instance;
      if (typeof forwardedRef === 'function') {
        forwardedRef(instance);
      } else if (forwardedRef != null) {
        (forwardedRef as React.MutableRefObject<FragmentEditorRef | null>).current = instance;
      }
    },
    [forwardedRef],
  );

  function flushAndNavigate(): void {
    const editor = editorRef.current;
    if (editor != null) {
      const currentValue = editor.getCurrentValue();
      if (currentValue != null) {
        onValueChange(currentValue);
      }
    }
    bifrost.editors.focusOrOpenEditorDocument(parentEditorDocument);
  }

  return (
    <Editor>
      <EditorToolbar>
        <EditorToolbarLeft>
          {parentEditorDocument && (
            <EditorToolbarText studio={bifrost}>
              {label} for &quot;
              <a href="#" onClick={flushAndNavigate}>
                {fragmentName}
              </a>
              &quot; ({fragmentId}) in{' '}
              <a href="#" onClick={flushAndNavigate} {...linkProps}>
                {parentEditorDocument.label}
              </a>
            </EditorToolbarText>
          )}
        </EditorToolbarLeft>
      </EditorToolbar>
      <EditorContent>
        {isFeelEditor ? (
          <FeelSimulatorEditor
            ref={setSimulatorRef}
            htmlId={editorHtmlId}
            studio={bifrost}
            initialExpression={fragmentValue ?? ''}
            onChange={onValueChange}
            variables={feelVariables ?? null}
            layout="MultiLine"
            autoFocus={true}
            htmlAttributes={editorHtmlAttributes as Record<string, unknown>}
          />
        ) : (
          <MultiLineCodeEditor
            htmlId={editorHtmlId}
            ref={setEditorRef as React.RefCallback<MultiLineCodeEditor>}
            studio={bifrost}
            initialValue={fragmentValue ?? ''}
            lineNumbers={true}
            language={language}
            onChange={onValueChange}
            autoFocus={true}
            htmlAttributes={editorHtmlAttributes as Record<string, unknown>}
            minimap={true}
          />
        )}
      </EditorContent>
    </Editor>
  );
}
