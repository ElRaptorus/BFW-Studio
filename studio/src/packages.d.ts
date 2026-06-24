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
    params?: { name: string; type?: string }[];
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

declare module 'bpmn-moddle';

declare module 'bpmnlint-utils' {
  export function is(node: unknown, type: string): boolean;
  export function isAny(node: unknown, types: readonly string[]): boolean;
}

declare module 'bpmnlint/lib/linter' {
  export default class Linter {
    constructor(options: {
      config: { rules: Record<string, string | number> };
      resolver: {
        resolveRule(pkg: string, ruleName: string): (() => unknown) | null;
        resolveConfig(pkg: string, configName: string): unknown;
      };
    });
    lint(definitions: unknown): Promise<Record<string, { id: string; message: string }[]>>;
  }
}

declare module 'bpmnlint/rules/*' {
  type CheckFn = (
    node: { $type: string; [key: string]: unknown },
    reporter: { report(id: string, message: string): void },
  ) => void;
  function factory(): { check: CheckFn | Record<string, CheckFn> };
  export default factory;
}

declare module 'clear-cut';

declare module '*.bpmn' {
  const content: any;
  export default content;
}

declare module '*.scss';
declare module '*.css';

declare module '*.svg' {
  const src: string;
  export default src;
}

declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.jpg' {
  const src: string;
  export default src;
}

declare module '*.gif' {
  const src: string;
  export default src;
}

declare module '*.md' {
  const content: string;
  export default content;
}

declare module '*.markdown' {
  const content: string;
  export default content;
}

declare module '*.txt' {
  const content: string;
  export default content;
}

declare module 'monaco-editor/esm/vs/language/json/monaco.contribution';

declare const __non_webpack_require__: NodeRequire;
