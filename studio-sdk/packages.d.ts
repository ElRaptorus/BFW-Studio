declare module '@bpmn-io/feel-editor' {
  import type { Extension } from '@codemirror/state';
  import type { EditorView } from '@codemirror/view';

  export interface FeelEditorVariable {
    name: string;
    detail?: string;
    info?: string | (() => HTMLElement);
    isList?: boolean | 'optional';
    entries?: FeelEditorVariable[];
    type?: 'function' | 'variable';
    params?: Array<{ name: string; type?: string }>;
  }

  export type FeelDialect = 'expression' | 'unaryTests';

  export interface FeelEditorConfig {
    container: HTMLElement;
    extensions?: Extension[];
    dialect?: FeelDialect;
    onChange?: (value: string) => void;
    onKeyDown?: (event: KeyboardEvent, view: EditorView) => boolean | void;
    onLint?: (diagnostics: unknown[]) => void;
    readOnly?: boolean;
    value?: string;
    variables?: FeelEditorVariable[];
    contentAttributes?: Record<string, string>;
    placeholder?: string;
    tooltipContainer?: HTMLElement | string;
  }

  export default class FeelEditor {
    constructor(config: FeelEditorConfig);
    setValue(value: string): void;
    setVariables(variables: FeelEditorVariable[]): void;
    setPlaceholder(placeholder: string): void;
    focus(position?: number): void;
    getSelection(): unknown;
    on(event: string, callback: (event: unknown) => void): void;
    off(event: string, callback?: (event: unknown) => void): void;
    _cmEditor: EditorView;
  }
}
