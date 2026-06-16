import type FeelEditorLib from '@bpmn-io/feel-editor';
import type { FeelEditorVariable } from '@bpmn-io/feel-editor';
import { EditorView, keymap } from '@codemirror/view';

import React, { useCallback, useEffect, useRef, useState } from 'react';

import type { Studio } from '../../index';
import { studioFeelTheme } from './FeelEditorTheme';

type FeelEditorInstance = InstanceType<typeof FeelEditorLib>;

export type OneLineFeelEditorProps = {
  studio: Studio;
  initialValue: string;
  dialect?: 'expression' | 'unaryTests';
  variables?: FeelEditorVariable[];
  onChange?: (value: string) => void;
  onKeyDown?: (event: KeyboardEvent) => boolean | void;
  autoFocus?: boolean;
  className?: string;
  fontSize?: number;
  htmlId?: string;
  htmlAttributes?: Record<string, unknown>;
  readOnly?: boolean;
  placeholder?: string;
};

type OneLineFeelEditorInnerProps = OneLineFeelEditorProps & {
  onEditorReady: (editorInstance: FeelEditorInstance) => void;
};

const singleLineKeymap = keymap.of([
  {
    key: 'Enter',
    run: () => {
      (document.activeElement as HTMLElement)?.blur();
      return true;
    },
  },
]);

const pasteHandler = EditorView.domEventHandlers({
  paste(event, view) {
    const text = event.clipboardData?.getData('text/plain');
    if (text && text.includes('\n')) {
      event.preventDefault();
      const cleaned = text.replace(/\r?\n|\r/g, ' ').trim();
      view.dispatch(view.state.replaceSelection(cleaned));
      return true;
    }
    return false;
  },
});

const singleLineTheme = EditorView.theme({
  '&': { maxHeight: '2rem' },
  '.cm-scroller': { overflow: 'hidden' },
  '.cm-content': { whiteSpace: 'nowrap' },
});

export class OneLineFeelEditor extends React.Component<OneLineFeelEditorProps> {
  private editorInstance: FeelEditorInstance | null = null;

  componentWillUnmount(): void {
    this.editorInstance = null;
  }

  focus(): void {
    this.editorInstance?.focus();
  }

  getCurrentValue(): string | undefined {
    return this.editorInstance?._cmEditor.state.doc.toString();
  }

  resetValue(): void {
    this.editorInstance?.setValue('');
  }

  render(): React.JSX.Element {
    return (
      <OneLineFeelEditorInner
        {...this.props}
        onEditorReady={(instance) => {
          this.editorInstance = instance;
        }}
      />
    );
  }
}

function OneLineFeelEditorInner(props: OneLineFeelEditorInnerProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<FeelEditorInstance | null>(null);
  const latestPropsRef = useRef(props);
  const currentValueRef = useRef(props.initialValue ?? '');
  const [showPlaceholder, setShowPlaceholder] = useState(!props.initialValue);

  useEffect(() => {
    latestPropsRef.current = props;
  });

  const handleBlur = useCallback(() => {
    const value = currentValueRef.current;
    if (value === latestPropsRef.current.initialValue) {
      return;
    }
    latestPropsRef.current.onChange?.(value);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const FeelEditorImport = require('@bpmn-io/feel-editor').default;

    const instance = new FeelEditorImport({
      container,
      extensions: [studioFeelTheme, singleLineKeymap, pasteHandler, singleLineTheme],
      dialect: props.dialect ?? 'expression',
      value: props.initialValue ?? '',
      variables: props.variables,
      readOnly: props.readOnly,
      onChange: (value: string) => {
        currentValueRef.current = value;
        setShowPlaceholder(value.length === 0);
      },
      onKeyDown: props.onKeyDown ? (event: KeyboardEvent) => latestPropsRef.current.onKeyDown?.(event) : undefined,
    });

    editorRef.current = instance;
    latestPropsRef.current.onEditorReady(instance);

    const cmDom = instance._cmEditor.dom;
    cmDom.addEventListener('focusout', handleBlur);

    if (latestPropsRef.current.autoFocus === true) {
      instance.focus();
    }

    return () => {
      cmDom.removeEventListener('focusout', handleBlur);

      const value = currentValueRef.current;
      if (value != null && value !== latestPropsRef.current.initialValue) {
        latestPropsRef.current.onChange?.(value);
      }

      instance._cmEditor.destroy();
      editorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (editorRef.current && props.variables) {
      editorRef.current.setVariables(props.variables);
    }
  }, [props.variables]);

  return (
    <div
      className={`one-line-feel-editor ${props.className ?? ''}`}
      style={{ position: 'relative', fontSize: props.fontSize }}
      id={props.htmlId}
      onFocus={() => editorRef.current?.focus()}
      {...(props.htmlAttributes as React.HTMLAttributes<HTMLDivElement>)}
    >
      {showPlaceholder && props.placeholder && (
        <input type="text" readOnly className="one-line-feel-editor__placeholder" placeholder={props.placeholder} />
      )}
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
    </div>
  );
}
