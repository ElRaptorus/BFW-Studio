import MonacoEditor, { type OnMount } from '@monaco-editor/react';
import type * as monaco from 'monaco-editor';

import React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { Studio } from '../../index';
import { assertNotNull } from '../../index';
import { EVENT_THEME_CHANGED } from '../contracts/internal/ThemeEvents';
import { relaxJavaScriptDiagnostics } from './internal/monacoJavaScriptDiagnostics';

type OneLineCodeEditorProps = {
  studio: Studio;
  initialValue: string;
  language: string;
  onChange?: (value: string) => void;
  onKeyDown?: (e: monaco.IKeyboardEvent) => void;
  onKeyUp?: (e: monaco.IKeyboardEvent) => void;
  autoFocus?: boolean;
  className?: string;
  fontSize?: number;
  htmlAttributes?: any;
  htmlId?: string;
  placeholder?: string;
  readOnly?: boolean;
  treatInterpolationExpression?: boolean;
};

type OneLineCodeEditorInnerProps = OneLineCodeEditorProps & {
  onEditorReady: (editor: monaco.editor.IStandaloneCodeEditor) => void;
};

const DEFAULT_FONT_SIZE = 12.25;

const DEFAULT_BASE_EDITOR_OPTIONS: monaco.editor.IStandaloneEditorConstructionOptions = {
  contextmenu: false,
  cursorStyle: 'line-thin',
  find: { addExtraSpaceOnTop: false, autoFindInSelection: 'never', seedSearchStringFromSelection: 'never' },
  fixedOverflowWidgets: true,
  folding: false,
  fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  hideCursorInOverviewRuler: true,
  lineDecorationsWidth: 5,
  lineNumbers: 'off',
  lineNumbersMinChars: 0,
  links: false,
  minimap: { enabled: false },
  occurrencesHighlight: 'off',
  overviewRulerBorder: false,
  overviewRulerLanes: 0,
  renderLineHighlight: 'none',
  revealHorizontalRightPadding: 5,
  roundedSelection: false,
  scrollbar: { horizontal: 'hidden', vertical: 'hidden', alwaysConsumeMouseWheel: false },
  wordWrap: 'off',
  automaticLayout: true,
};

export class OneLineCodeEditor extends React.Component<OneLineCodeEditorProps> {
  private editorInstance: monaco.editor.IStandaloneCodeEditor | null = null;

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
      <OneLineCodeEditorInner
        {...this.props}
        onEditorReady={(editor) => {
          this.editorInstance = editor;
        }}
      />
    );
  }
}

function OneLineCodeEditorInner(props: OneLineCodeEditorInnerProps): React.JSX.Element {
  const studio = props.studio;
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [monacoTheme, setMonacoTheme] = useState(() => getMonacoTheme(studio));
  const [showPlaceholder, setShowPlaceholder] = useState(!props.initialValue);
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

    if (latestPropsRef.current.treatInterpolationExpression === true) {
      disableAutocompletion(editor);
      setupInterpolationExpressionHandling(editor);
    }

    editor.onDidBlurEditorText(() => {
      const value = currentValueRef.current;
      if (value === latestPropsRef.current.initialValue) {
        return;
      }
      latestPropsRef.current.onChange?.(value);
    });

    editor.onDidPaste((pasteEvent) => {
      if (pasteEvent.range.endLineNumber <= 1) {
        return;
      }

      let newContent = '';
      assertNotNull(editor, 'editor');
      const textModel = editor.getModel();
      assertNotNull(textModel, 'textModel');

      const lineCount = textModel.getLineCount();
      for (let i = 0; i < lineCount; i += 1) {
        newContent += textModel.getLineContent(i + 1);
      }

      textModel.setValue(newContent);
      editor.setPosition({ column: newContent.length + 1, lineNumber: 1 });
    });

    editor.createContextKey('isOneLineCodeEditor', true);
    editor.createContextKey('editorTabMovesFocus', true);

    const ctx = 'isOneLineCodeEditor';

    editor.addCommand(monacoObj.KeyMod.CtrlCmd | monacoObj.KeyCode.KeyF, () => null, ctx);
    editor.addCommand(monacoObj.KeyCode.F1, () => null, ctx);
    editor.addCommand(monacoObj.KeyMod.Shift | monacoObj.KeyCode.Enter, () => null, ctx);

    const pasteFromClipBoard = async () => {
      const text = (await navigator.clipboard.readText()) ?? '';
      editor.executeEdits(null, [
        {
          range: editor.getSelection() as monaco.IRange,
          text: text.trim().replace(/\r?\n|\r/g, ' '),
          forceMoveMarkers: true,
        },
      ]);
    };

    editor.addCommand(monacoObj.KeyMod.CtrlCmd | monacoObj.KeyCode.KeyV, pasteFromClipBoard, ctx);
    editor.addCommand(monacoObj.KeyMod.Shift | monacoObj.KeyCode.Insert, pasteFromClipBoard, ctx);

    editor.addCommand(monacoObj.KeyMod.CtrlCmd | monacoObj.KeyMod.Shift | monacoObj.KeyCode.KeyZ, () => null, ctx);

    editor.addCommand(
      monacoObj.KeyMod.CtrlCmd | monacoObj.KeyCode.KeyY,
      () => editor.trigger('OneLineCodeEditor', 'redo', null),
      ctx,
    );

    editor.addCommand(
      monacoObj.KeyCode.Enter,
      () => {
        const domNode = editor.getDomNode();
        const contentWidgetVisible = domNode?.querySelector('[monaco-visible-content-widget="true"]') ?? false;
        if (contentWidgetVisible) {
          editor.trigger('OneLineCodeEditor', 'acceptSelectedSuggestion', null);
        } else {
          (document.activeElement as HTMLElement).blur();
        }
      },
      ctx,
    );

    if (latestPropsRef.current.onKeyDown) {
      editor.onKeyDown(latestPropsRef.current.onKeyDown);
    }
    if (latestPropsRef.current.onKeyUp) {
      editor.onKeyUp(latestPropsRef.current.onKeyUp);
    }
  }, []);

  const handleEditorChange = useCallback(
    (value: string | undefined): void => {
      const editorValue = value ?? '';
      if (showPlaceholder !== (editorValue.length === 0)) {
        setShowPlaceholder(editorValue.length === 0);
      }
    },
    [showPlaceholder],
  );

  return (
    <div
      className={`one-line-monaco-editor ${props.className ?? ''}`}
      style={{ position: 'relative' }}
      id={props.htmlId}
      onFocus={() => editorRef.current?.focus()}
      {...props.htmlAttributes}
    >
      {showPlaceholder && (
        <input type="text" readOnly className="one-line-monaco-editor__placeholder" placeholder={props.placeholder} />
      )}
      <div style={{ position: 'absolute', inset: 0 }}>
        <MonacoEditor
          value={props.initialValue ?? ''}
          language={props.language}
          theme={monacoTheme}
          options={{
            ...DEFAULT_BASE_EDITOR_OPTIONS,
            fontSize: props.fontSize ?? DEFAULT_FONT_SIZE,
            readOnly: props.readOnly,
          }}
          onMount={handleMount}
          onChange={handleEditorChange}
        />
      </div>
    </div>
  );
}

function getMonacoTheme(studio: Studio): string {
  return studio.theme.isCurrentThemeDark() ? 'vs-dark' : 'vs-light';
}

function enableAutocompletion(editor: monaco.editor.IStandaloneCodeEditor): void {
  editor.updateOptions({
    quickSuggestions: true,
    parameterHints: { enabled: true },
    suggestOnTriggerCharacters: true,
    acceptSuggestionOnEnter: 'on',
    tabCompletion: 'on',
    wordBasedSuggestions: 'currentDocument',
    hover: { enabled: 'on' },
  });
}

function disableAutocompletion(editor: monaco.editor.IStandaloneCodeEditor): void {
  editor.updateOptions({
    quickSuggestions: { other: false, comments: false, strings: false },
    parameterHints: { enabled: false },
    suggestOnTriggerCharacters: false,
    acceptSuggestionOnEnter: 'off',
    tabCompletion: 'off',
    wordBasedSuggestions: 'off',
    hover: { enabled: 'off' },
  });
}

function setupInterpolationExpressionHandling(editor: monaco.editor.IStandaloneCodeEditor): monaco.IDisposable {
  return editor.onDidChangeCursorPosition((cursorChangedEvent) => {
    const value = editor.getValue();

    if (value != null && value.trim() !== '') {
      const cursorPosition = cursorChangedEvent.position.column;
      let cursorIsNotInExpression = true;
      const leftValuePart = value.substr(0, cursorPosition - 1);
      const startExpressionSplittet = leftValuePart.split('${');
      const endExpressionSplittet = leftValuePart.split('}');

      if (startExpressionSplittet.length === endExpressionSplittet.length) {
        cursorIsNotInExpression = true;
      } else if (startExpressionSplittet.length > endExpressionSplittet.length) {
        const rightValuePart = value.substr(cursorPosition - 1);
        const secondStartExpressionSplittet = rightValuePart.split('${');
        const secondEndExpressionSplittet = rightValuePart.split('}');

        if (
          secondEndExpressionSplittet.length + endExpressionSplittet.length ===
          secondStartExpressionSplittet.length + startExpressionSplittet.length
        ) {
          cursorIsNotInExpression = false;
        }
      }

      const suggestionsEnabled = editor.getRawOptions().suggestOnTriggerCharacters === true;

      if (cursorIsNotInExpression) {
        if (suggestionsEnabled) {
          disableAutocompletion(editor);
        }
      } else {
        if (!suggestionsEnabled) {
          enableAutocompletion(editor);
        }
      }
    }
  });
}
