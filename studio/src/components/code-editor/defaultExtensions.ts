import { autocompletion, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, redo } from '@codemirror/commands';
import { bracketMatching, indentOnInput } from '@codemirror/language';
import { lintGutter } from '@codemirror/lint';
import { searchKeymap } from '@codemirror/search';
import { EditorState, type Extension } from '@codemirror/state';
import {
  EditorView,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
} from '@codemirror/view';

import { studioCodeMirrorHighlighting, studioCodeMirrorTheme } from './CodeEditorTheme';
import { rainbowBrackets } from './rainbowBrackets';

export type DefaultEditorExtensionOptions = {
  readOnly?: boolean;
  lineNumbers?: boolean;
  fontSize?: number;
  lintGutter?: boolean;
};

const DEFAULT_FONT_SIZE = 14;

const EDITOR_KEYMAP = keymap.of([
  ...closeBracketsKeymap,
  ...defaultKeymap,
  ...historyKeymap,
  ...searchKeymap,
  { key: 'Mod-y', run: redo },
]);

export function createDefaultEditorExtensions(options: DefaultEditorExtensionOptions = {}): Extension[] {
  const fontSize = options.fontSize ?? DEFAULT_FONT_SIZE;
  const readOnly = options.readOnly === true;

  return [
    studioCodeMirrorTheme,
    studioCodeMirrorHighlighting,
    history(),
    drawSelection(),
    dropCursor(),
    highlightSpecialChars(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    indentOnInput(),
    EDITOR_KEYMAP,
    EditorView.lineWrapping,
    bracketMatching(),
    closeBrackets(),
    autocompletion(),
    rainbowBrackets(),
    options.lineNumbers === true ? lineNumbers() : [],
    options.lintGutter === true ? lintGutter() : [],
    EditorState.readOnly.of(readOnly),
    EditorView.editable.of(!readOnly),
    EditorView.theme({
      '&': { fontSize: `${fontSize}px` },
    }),
  ];
}
