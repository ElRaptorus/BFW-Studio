import type { Bifrost } from '#bifrost/Bifrost';
import { createDefaultEditorExtensions } from '#components/code-editor/defaultExtensions';
import {
  type JsonAssistBackend,
  createJsonAssistExtensions,
  updateJsonAssist,
} from '#components/code-editor/jsonAssist';
import { jsonParseLinterExtension } from '#components/code-editor/jsonParseLinter';
import { getLanguageSupport } from '#components/code-editor/languageSupport';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';

import React, { useCallback, useEffect, useRef } from 'react';

type MultiLineCodeEditorProps = {
  name?: string;
  studio: Bifrost;
  size?: 'small' | 'medium' | 'tall';
  className?: string;
  initialValue: string;
  language: string;
  lineNumbers?: boolean;
  fontSize?: number;
  onChange?: (value: string) => void;
  onKeyDown?: (event: KeyboardEvent) => void;
  onKeyUp?: (event: KeyboardEvent) => void;
  autoFocus?: boolean;
  htmlId?: string;
  htmlAttributes?: any;
  readOnly?: boolean;
  /**
   * Kept so existing callsites compile. CodeMirror 6 has no minimap;
   * this prop is a no-op.
   */
  minimap?: boolean;
  /**
   * When set, lint, completion and hover come from this backend (`language` `jsonc` or `json`).
   * Used by Settings JSON. A new backend is swapped in without a remount.
   */
  jsonAssist?: JsonAssistBackend;
};

type MultiLineCodeEditorInnerProps = MultiLineCodeEditorProps & {
  onEditorReady: (editor: EditorView) => void;
};

const shiftEnterBlurKeymap = keymap.of([
  {
    key: 'Shift-Enter',
    run: (view) => {
      view.contentDOM.blur();
      return true;
    },
  },
]);

function buildExtensions(props: MultiLineCodeEditorProps): Extension[] {
  const useAssist = props.jsonAssist != null;
  const useStrictJsonLint = props.language === 'json' && !useAssist;

  return [
    ...createDefaultEditorExtensions({
      readOnly: props.readOnly,
      lineNumbers: props.lineNumbers,
      fontSize: props.fontSize,
      lintGutter: useStrictJsonLint || useAssist,
    }),
    shiftEnterBlurKeymap,
    props.jsonAssist != null
      ? createJsonAssistExtensions(props.language === 'jsonc' ? 'jsonc' : 'json', props.jsonAssist)
      : getLanguageSupport(props.language),
    ...(useStrictJsonLint ? [jsonParseLinterExtension()] : []),
  ];
}

export class MultiLineCodeEditor extends React.Component<MultiLineCodeEditorProps> {
  public readonly name?: string;
  private editorInstance: EditorView | null = null;

  constructor(props: MultiLineCodeEditorProps) {
    super(props);
    this.name = props.name;
  }

  componentWillUnmount(): void {
    this.editorInstance = null;
  }

  focus(): void {
    this.editorInstance?.focus();
  }

  getCurrentValue(): string | undefined {
    return this.editorInstance?.state.doc.toString();
  }

  resetValue(): void {
    this.setValue('');
  }

  setValue(value: string): void {
    const view = this.editorInstance;
    if (view == null) {
      return;
    }
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
    });
  }

  render(): React.JSX.Element {
    return (
      <MultiLineCodeEditorInner
        {...this.props}
        onEditorReady={(editor) => {
          this.editorInstance = editor;
        }}
      />
    );
  }
}

function MultiLineCodeEditorInner(props: MultiLineCodeEditorInnerProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorView | null>(null);
  const latestPropsRef = useRef(props);
  const currentValueRef = useRef(props.initialValue ?? '');

  useEffect(() => {
    latestPropsRef.current = props;
  });

  useEffect(() => {
    return () => {
      const value = currentValueRef.current;
      if (value != null && value !== latestPropsRef.current.initialValue) {
        latestPropsRef.current.onChange?.(value);
      }
    };
  }, []);

  const handleBlur = useCallback(() => {
    const value = currentValueRef.current;
    const current = latestPropsRef.current;
    const valueIsAlreadySet = value === current.initialValue;
    const valueIsStillEmpty = value === '' && current.initialValue === undefined;
    if (valueIsAlreadySet || valueIsStillEmpty) {
      return;
    }
    current.onChange?.(value);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (container == null) {
      return;
    }

    const view = new EditorView({
      parent: container,
      state: EditorState.create({
        doc: props.initialValue ?? '',
        extensions: [
          ...buildExtensions(props),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) {
              return;
            }
            const value = update.state.doc.toString();
            if (value === currentValueRef.current) {
              return;
            }
            currentValueRef.current = value;
          }),
          EditorView.domEventHandlers({
            keydown: (event) => {
              latestPropsRef.current.onKeyDown?.(event);
              return false;
            },
            keyup: (event) => {
              latestPropsRef.current.onKeyUp?.(event);
              return false;
            },
          }),
        ],
      }),
    });

    editorRef.current = view;
    latestPropsRef.current.onEditorReady(view);
    view.contentDOM.addEventListener('focusout', handleBlur);

    if (latestPropsRef.current.autoFocus === true) {
      view.focus();
    }

    return () => {
      view.contentDOM.removeEventListener('focusout', handleBlur);
      view.destroy();
      editorRef.current = null;
    };
    // Mount once; language / JSON assist / readOnly are applied at construction.
    // A changed `jsonAssist` prop is swapped in by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = editorRef.current;
    const value = props.initialValue ?? '';
    if (view == null || view.state.doc.toString() === value) {
      return;
    }
    currentValueRef.current = value;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
  }, [props.initialValue]);

  useEffect(() => {
    if (editorRef.current != null && props.jsonAssist != null) {
      updateJsonAssist(editorRef.current, props.jsonAssist);
    }
  }, [props.jsonAssist]);

  const sizeClass = props.size ? `pane__textarea--${props.size}` : '';
  return (
    <div
      className={`pane__textarea ${sizeClass} ${props.className ?? ''}`}
      style={{ position: 'relative' }}
      id={props.htmlId}
      data-code-editor="multiline"
      {...props.htmlAttributes}
    >
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
    </div>
  );
}
