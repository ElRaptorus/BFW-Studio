import React, { useCallback, useRef } from 'react';

import type { EditorDocument, FeelEditorVariable, Studio } from '@evil/bifrost_fw_sdk';
import {
  Editor,
  EditorContent,
  EditorToolbar,
  EditorToolbarLeft,
  EditorToolbarText,
  MultiLineCodeEditor,
} from '@evil/bifrost_fw_sdk';

import { FeelSimulatorEditor } from '../../../components/feel-simulator';
import type { FeelSimulatorEditorRef } from '../../../components/feel-simulator';
import type { BpmnFragmentRendererConfig, FragmentEditorRef } from './useBpmnFragmentRenderer';

type BpmnFragmentRendererViewProps = {
  bifrost: Studio;
  config: BpmnFragmentRendererConfig;
  fragmentId: string;
  fragmentName: string | null;
  fragmentValue: string | null;
  feelVariables: FeelEditorVariable[] | null;
  parentEditorDocument: EditorDocument;
  onValueChange: (value: string) => void;
};

export const BpmnFragmentRendererView = React.forwardRef<FragmentEditorRef | null, BpmnFragmentRendererViewProps>(
  function BpmnFragmentRendererView(props, forwardedRef): React.JSX.Element {
    const editorRef = useRef<FragmentEditorRef | null>(null);
    const { label, language, editorHtmlId, editorHtmlAttributes, linkProps } = props.config;
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
          props.onValueChange(currentValue);
        }
      }
      props.bifrost.editors.focusOrOpenEditorDocument(props.parentEditorDocument);
    }

    return (
      <Editor>
        <EditorToolbar>
          <EditorToolbarLeft>
            {props.parentEditorDocument && (
              <EditorToolbarText studio={props.bifrost}>
                {label} for &quot;
                <a href="#" onClick={flushAndNavigate}>
                  {props.fragmentName}
                </a>
                &quot; ({props.fragmentId}) in{' '}
                <a href="#" onClick={flushAndNavigate} {...linkProps}>
                  {props.parentEditorDocument.label}
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
              studio={props.bifrost}
              initialExpression={props.fragmentValue ?? ''}
              onChange={props.onValueChange}
              variables={props.feelVariables ?? null}
              layout="MultiLine"
              autoFocus={true}
              htmlAttributes={editorHtmlAttributes as Record<string, unknown>}
            />
          ) : (
            <MultiLineCodeEditor
              htmlId={editorHtmlId}
              ref={setEditorRef as React.RefCallback<MultiLineCodeEditor>}
              studio={props.bifrost}
              initialValue={props.fragmentValue ?? ''}
              lineNumbers={true}
              language={language}
              onChange={props.onValueChange}
              autoFocus={true}
              htmlAttributes={editorHtmlAttributes as Record<string, unknown>}
              minimap={true}
            />
          )}
        </EditorContent>
      </Editor>
    );
  },
);
