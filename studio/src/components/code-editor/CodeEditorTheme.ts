import { syntaxHighlighting } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { classHighlighter } from '@lezer/highlight';

/**
 * CodeMirror 6 theme for host code editors. Chrome and syntax colors
 * reference `--theme-feel-*` CSS custom properties — the same tokens
 * every theme file already defines for `FeelEditor`. Theme switching is
 * a CSS class swap; the editor is not reconfigured in JavaScript.
 *
 * Do not use `--theme-cm-*` here. Those aliases used to live only under
 * `.bifrost-theme--light` / `--dark`, so named themes (vscode-dark, …)
 * left `color: var(--theme-cm-string)` invalid and every token inherited
 * the same foreground. Rainbow-bracket aliases stay in SCSS.
 *
 * `classHighlighter` stamps stable `tok-*` classes. `EditorView.theme()`
 * scoped selectors paint them; `[data-code-editor] .tok-*` in
 * `component.code-editor.scss` is the stylesheet backup.
 */
export const studioCodeMirrorTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--theme-feel-bg)',
    color: 'var(--theme-feel-fg)',
    height: '100%',
    fontFamily: 'SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace',
  },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: 'inherit',
  },
  '.cm-content': {
    caretColor: 'var(--theme-feel-cursor)',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--theme-feel-cursor)',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'var(--theme-feel-selection-bg)',
  },
  '.cm-activeLine': {
    backgroundColor: 'var(--theme-feel-active-line-bg)',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--theme-feel-gutter-bg)',
    color: 'var(--theme-feel-fg)',
    borderRight: '1px solid var(--theme-feel-border)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--theme-feel-active-line-bg)',
  },
  '.cm-matchingBracket': {
    backgroundColor: 'color-mix(in srgb, var(--theme-feel-selection-bg) 70%, transparent)',
    outline: '1px solid var(--theme-feel-border)',
  },
  '& .tok-keyword': { color: 'var(--theme-feel-keyword)' },
  '& .tok-bool': { color: 'var(--theme-feel-bool)' },
  '& .tok-null': { color: 'var(--theme-feel-keyword)' },
  '& .tok-atom': { color: 'var(--theme-feel-bool)' },
  '& .tok-literal': { color: 'var(--theme-feel-number)' },
  '& .tok-propertyName': { color: 'var(--theme-feel-variable)' },
  '& .tok-definition': { color: 'var(--theme-feel-variable)' },
  '& .tok-variableName': { color: 'var(--theme-feel-variable)' },
  '& .tok-string': { color: 'var(--theme-feel-string)' },
  '& .tok-string2': { color: 'var(--theme-feel-string)' },
  '& .tok-number': { color: 'var(--theme-feel-number)' },
  '& .tok-comment': { color: 'var(--theme-feel-comment)' },
  '& .tok-operator': { color: 'var(--theme-feel-fg)' },
  '& .tok-punctuation': { color: 'var(--theme-feel-fg)' },
  '& .tok-typeName': { color: 'var(--theme-feel-function)' },
  '& .tok-className': { color: 'var(--theme-feel-function)' },
  '& .tok-name': { color: 'var(--theme-feel-function)' },
  '& .tok-meta': { color: 'var(--theme-feel-comment)' },
  '& .tok-invalid': { color: '#f44747' },
  '& .tok-link': { color: 'var(--theme-feel-keyword)' },
  '& .tok-heading': { color: 'var(--theme-feel-keyword)' },
  '& .tok-tagName': { color: 'var(--theme-feel-keyword)' },
  '& .tok-attributeName': { color: 'var(--theme-feel-variable)' },
  '& .tok-attributeValue': { color: 'var(--theme-feel-string)' },
  '.cm-tooltip': {
    backgroundColor: 'var(--theme-feel-tooltip-bg)',
    color: 'var(--theme-feel-tooltip-fg)',
    border: '1px solid var(--theme-feel-tooltip-border)',
  },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    backgroundColor: 'var(--theme-feel-tooltip-selected-bg)',
    color: 'var(--theme-feel-tooltip-selected-fg)',
  },
});

export const studioCodeMirrorHighlighting = syntaxHighlighting(classHighlighter);
