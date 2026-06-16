import { type DiffOnMount, DiffEditor as MonacoDiffEditor } from '@monaco-editor/react';
import type * as monaco from 'monaco-editor';

import React from 'react';
import { useEffect, useRef, useState } from 'react';

import type { Studio } from '../../index';
import { assertNotNull } from '../../index';
import { EVENT_THEME_CHANGED } from '../contracts/internal/ThemeEvents';

type DiffEditorProps = {
  name?: string;
  studio: Studio;
  size?: 'small' | 'medium' | 'tall';
  className?: string;
  beforeValue: string;
  afterValue: string;
  language: string;
  lineNumbers?: boolean;
  fontSize?: number;
  autoFocus?: boolean;
  htmlId?: string;
  htmlAttributes?: any;
  readOnly?: boolean;
  onContentChanged?: () => void;
};

type DiffEditorInnerProps = DiffEditorProps & {
  onEditorReady: (editor: monaco.editor.IStandaloneDiffEditor) => void;
};

const DEFAULT_FONT_SIZE = 14;

function getMonacoTheme(studio: Studio): string {
  return studio.theme.isCurrentThemeDark() ? 'vs-dark' : 'vs-light';
}

export class DiffEditor extends React.Component<DiffEditorProps> {
  public readonly name?: string;
  private editorInstance: monaco.editor.IStandaloneDiffEditor | null = null;

  constructor(props: DiffEditorProps) {
    super(props);
    this.name = props.name;
  }

  componentWillUnmount(): void {
    if (this.editorInstance) {
      try {
        this.editorInstance.setModel(null);
        this.editorInstance.dispose();
      } catch {
        // Already disposed — safe to ignore.
      }
    }
    this.editorInstance = null;
  }

  layout(): void {
    this.editorInstance?.getOriginalEditor()?.layout();
    this.editorInstance?.getModifiedEditor()?.layout();
  }

  focus(): void {
    assertNotNull(this.editorInstance, 'this.editorInstance');
    this.editorInstance.getModifiedEditor().focus();
  }

  getCurrentValue(): string | undefined {
    return this.editorInstance?.getModel()?.modified?.getValue();
  }

  resetValue(): void {
    this.editorInstance?.getModel()?.modified?.setValue('');
  }

  render(): React.JSX.Element {
    return (
      <DiffEditorInner
        {...this.props}
        onEditorReady={(editor) => {
          this.editorInstance = editor;
        }}
      />
    );
  }
}

function DiffEditorInner(props: DiffEditorInnerProps): React.JSX.Element {
  const studio = props.studio;
  const editorRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(null);
  const [monacoTheme, setMonacoTheme] = useState(() => getMonacoTheme(studio));

  useEffect(() => {
    const sub = studio.theme.on(EVENT_THEME_CHANGED, () => {
      setMonacoTheme(getMonacoTheme(studio));
    });
    return () => sub.dispose();
  }, [studio]);

  const handleMount: DiffOnMount = (editor, monacoObj) => {
    editorRef.current = editor;
    props.onEditorReady(editor);

    editor.getOriginalEditor()?.layout();
    editor.getModifiedEditor()?.layout();

    if (props.autoFocus === true) {
      editor.getModifiedEditor().focus();
    }

    editor.addCommand(monacoObj.KeyMod.CtrlCmd | monacoObj.KeyMod.Shift | monacoObj.KeyCode.KeyZ, () => null);

    editor.addCommand(monacoObj.KeyMod.CtrlCmd | monacoObj.KeyCode.KeyY, () =>
      editor.trigger('DiffEditor', 'redo', null),
    );

    if (props.onContentChanged) {
      editor.getModifiedEditor().onDidChangeModelContent(() => {
        props.onContentChanged?.();
      });
    }
  };

  const sizeClass = props.size ? `pane__textarea--${props.size}` : '';
  return (
    <div
      className={`pane__textarea ${sizeClass} ${props.className ?? ''}`}
      style={{ position: 'relative' }}
      id={props.htmlId}
      {...props.htmlAttributes}
    >
      <div style={{ position: 'absolute', inset: 0 }}>
        <MonacoDiffEditor
          original={props.beforeValue}
          modified={props.afterValue}
          language={props.language}
          theme={monacoTheme}
          options={{
            fontFamily: 'SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace',
            fontSize: props.fontSize ?? DEFAULT_FONT_SIZE,
            lineNumbers: props.lineNumbers === true ? 'on' : 'off',
            readOnly: props.readOnly,
            enableSplitViewResizing: false,
            renderSideBySide: true,
            renderOverviewRuler: false,
            automaticLayout: true,
          }}
          onMount={handleMount}
        />
      </div>
    </div>
  );
}
