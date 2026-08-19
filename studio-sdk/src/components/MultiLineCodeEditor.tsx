import MonacoEditor, { type OnMount } from '@monaco-editor/react';
import type * as monaco from 'monaco-editor';

import React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { Studio } from '../../index';
import { EVENT_THEME_CHANGED } from '../contracts/internal/ThemeEvents';
import { relaxJavaScriptDiagnostics } from './internal/monacoJavaScriptDiagnostics';

type MultiLineCodeEditorProps = {
  name?: string;
  studio: Studio;
  size?: 'small' | 'medium' | 'tall';
  className?: string;
  initialValue: string;
  language: string;
  lineNumbers?: boolean;
  fontSize?: number;
  onChange?: (value: string) => void;
  onKeyDown?: (e: monaco.IKeyboardEvent) => void;
  onKeyUp?: (e: monaco.IKeyboardEvent) => void;
  autoFocus?: boolean;
  htmlId?: string;
  htmlAttributes?: any;
  readOnly?: boolean;
  minimap?: boolean;
  /**
   * Optional model path for the Monaco editor. When set, the editor model is identified
   * by this path, which can be used for language-specific configuration (e.g., JSON schema matching).
   */
  modelPath?: string;
};

type MultiLineCodeEditorInnerProps = MultiLineCodeEditorProps & {
  onEditorReady: (editor: monaco.editor.IStandaloneCodeEditor) => void;
};

const DEFAULT_FONT_SIZE = 14;

export class MultiLineCodeEditor extends React.Component<MultiLineCodeEditorProps> {
  public readonly name?: string;
  private editorInstance: monaco.editor.IStandaloneCodeEditor | null = null;

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
    return this.editorInstance?.getValue();
  }

  resetValue(): void {
    this.editorInstance?.setValue('');
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
  const studio = props.studio;
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [monacoTheme, setMonacoTheme] = useState(() => getMonacoTheme(studio));
  const latestPropsRef = useRef(props);
  const currentValueRef = useRef(props.initialValue ?? '');

  useEffect(() => {
    latestPropsRef.current = props;
  });

  useEffect(() => {
    const sub = studio.theme.on(EVENT_THEME_CHANGED, () => {
      setMonacoTheme(getMonacoTheme(studio));
    });
    return () => sub.dispose();
  }, [studio]);

  useEffect(() => {
    return () => {
      const value = currentValueRef.current;
      if (value != null && value !== latestPropsRef.current.initialValue) {
        latestPropsRef.current.onChange?.(value);
      }
    };
  }, []);

  const handleMount: OnMount = useCallback((editor, monacoObj) => {
    editorRef.current = editor;
    latestPropsRef.current.onEditorReady(editor);

    relaxJavaScriptDiagnostics(monacoObj);

    editor.onDidChangeModelContent(() => {
      currentValueRef.current = editor.getValue();
    });

    if (latestPropsRef.current.autoFocus === true) {
      editor.focus();
    }

    editor.onDidBlurEditorText(() => {
      const value = currentValueRef.current;
      const current = latestPropsRef.current;
      const valueIsAlreadySet = value === current.initialValue;
      const valueIsStillEmpty = value === '' && current.initialValue === undefined;
      if (valueIsAlreadySet || valueIsStillEmpty) {
        return;
      }
      current.onChange?.(value);
    });

    editor.createContextKey('isMultiLineCodeEditor', true);

    editor.addCommand(monacoObj.KeyMod.CtrlCmd | monacoObj.KeyMod.Shift | monacoObj.KeyCode.KeyZ, () => null);

    editor.addCommand(
      monacoObj.KeyMod.Shift | monacoObj.KeyCode.Enter,
      () => {
        (document.activeElement as HTMLElement).blur();
      },
      'isMultiLineCodeEditor',
    );

    const pasteFromClipBoard = async () =>
      editor.executeEdits(null, [
        {
          range: editor.getSelection() as monaco.IRange,
          text: await navigator.clipboard.readText(),
          forceMoveMarkers: true,
        },
      ]);

    editor.addCommand(monacoObj.KeyMod.CtrlCmd | monacoObj.KeyCode.KeyV, pasteFromClipBoard);
    editor.addCommand(monacoObj.KeyMod.Shift | monacoObj.KeyCode.Insert, pasteFromClipBoard);

    editor.addCommand(monacoObj.KeyMod.CtrlCmd | monacoObj.KeyCode.KeyY, () =>
      editor.trigger('MultiLineCodeEditor', 'redo', null),
    );

    if (latestPropsRef.current.onKeyDown) {
      editor.onKeyDown(latestPropsRef.current.onKeyDown);
    }
    if (latestPropsRef.current.onKeyUp) {
      editor.onKeyUp(latestPropsRef.current.onKeyUp);
    }
  }, []);

  const sizeClass = props.size ? `pane__textarea--${props.size}` : '';
  return (
    <div
      className={`pane__textarea ${sizeClass} ${props.className ?? ''}`}
      style={{ position: 'relative' }}
      id={props.htmlId}
      {...props.htmlAttributes}
    >
      <div style={{ position: 'absolute', inset: 0 }}>
        <MonacoEditor
          value={props.initialValue ?? ''}
          language={props.language}
          path={props.modelPath}
          theme={monacoTheme}
          options={{
            fontFamily: 'SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace',
            fontSize: props.fontSize ?? DEFAULT_FONT_SIZE,
            lineNumbers: props.lineNumbers === true ? 'on' : 'off',
            minimap: { enabled: props.minimap === true },
            wordWrap: 'on',
            readOnly: props.readOnly,
            fixedOverflowWidgets: true,
            automaticLayout: true,
          }}
          onMount={handleMount}
        />
      </div>
    </div>
  );
}

function getMonacoTheme(studio: Studio): string {
  return studio.theme.isCurrentThemeDark() ? 'vs-dark' : 'vs-light';
}
