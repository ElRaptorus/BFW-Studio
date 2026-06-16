import { EditorView } from '@codemirror/view';

/**
 * CodeMirror 6 theme extension that references the Studio's CSS custom
 * properties (`--theme-feel-*`). Theme switching happens at the CSS level
 * via the `.bifrost-theme--light` / `--dark` class swap — no JS
 * reconfiguration is needed.
 *
 * `EditorView.theme()` takes precedence over the feel-editor's built-in
 * `EditorView.baseTheme()`, so our overrides win naturally.
 */
export const studioFeelTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--theme-feel-bg)',
    color: 'var(--theme-feel-fg)',
  },
  // CM6's baseTheme sets `caretColor: "black"` on `&light .cm-content`,
  // overriding any caret-color on the parent `.cm-editor`. We must target
  // `.cm-content` directly — theme() beats baseTheme() at the same selector.
  '.cm-content': {
    caretColor: 'var(--theme-feel-cursor)',
  },
  '.cm-cursor': {
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
    borderRight: '1px solid var(--theme-feel-border)',
  },
  '& .variableName': { color: 'var(--theme-feel-variable)' },
  '& .number': { color: 'var(--theme-feel-number)' },
  '& .string': { color: 'var(--theme-feel-string)' },
  '& .bool': { color: 'var(--theme-feel-bool)' },
  '& .function': { color: 'var(--theme-feel-function)' },
  '& .control': { color: 'var(--theme-feel-keyword)' },
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
