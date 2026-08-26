import type { Bifrost } from '#bifrost/Bifrost';
import { createDefaultEditorExtensions } from '#components/code-editor/defaultExtensions';
import { createJson5SchemaExtensions } from '#components/code-editor/json5SchemaExtensions';
import { jsonParseLinterExtension } from '#components/code-editor/jsonParseLinter';
import { getLanguageSupport } from '#components/code-editor/languageSupport';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { updateSchema } from 'codemirror-json-schema';
import type { JSONSchema7 } from 'json-schema';

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
   * When set, the editor uses JSON5 + `codemirror-json-schema` instead of
   * strict JSON parse lint. Used by Settings JSON (JSONC comments).
   */
  jsonSchema?: object;
  /**
   * When true, `onChange` fires on every document change instead of on blur.
   * Used by Machine Sanctum live playgrounds.
   */
  liveUpdate?: boolean;
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
  const useSchema = props.jsonSchema != null;
  const useStrictJsonLint = props.language === 'json' && !useSchema;

  return [
    ...createDefaultEditorExtensions({
      readOnly: props.readOnly,
      lineNumbers: props.lineNumbers,
      fontSize: props.fontSize,
      lintGutter: useStrictJsonLint || useSchema,
    }),
    shiftEnterBlurKeymap,
    useSchema ? createJson5SchemaExtensions(props.jsonSchema as JSONSchema7) : getLanguageSupport(props.language),
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

  updateJsonSchema(schema: object): void {
    if (this.editorInstance == null) {
      return;
    }
    updateSchema(this.editorInstance, schema as JSONSchema7);
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
    if (latestPropsRef.current.liveUpdate === true) {
      return;
    }
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
            currentValueRef.current = update.state.doc.toString();
            if (latestPropsRef.current.liveUpdate === true) {
              latestPropsRef.current.onChange?.(currentValueRef.current);
            }
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
    // Mount once; language / schema / readOnly are applied at construction.
    // Schema updates go through `updateJsonSchema`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (editorRef.current != null && props.jsonSchema != null) {
      updateSchema(editorRef.current, props.jsonSchema as JSONSchema7);
    }
  }, [props.jsonSchema]);

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
