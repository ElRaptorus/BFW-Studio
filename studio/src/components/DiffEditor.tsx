import type { Bifrost } from '#bifrost/Bifrost';
import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import { createDefaultEditorExtensions } from '#components/code-editor/defaultExtensions';
import { jsonParseLinterExtension } from '#components/code-editor/jsonParseLinter';
import { getLanguageSupport } from '#components/code-editor/languageSupport';
import { MergeView } from '@codemirror/merge';
import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

import React, { useEffect, useRef } from 'react';

type DiffEditorProps = {
  name?: string;
  studio: Bifrost;
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
  onEditorReady: (mergeView: MergeView) => void;
};

function sideExtensions(props: DiffEditorProps, side: 'a' | 'b'): Extension[] {
  const readOnly = side === 'a' || props.readOnly === true;
  const useStrictJsonLint = props.language === 'json';

  return [
    ...createDefaultEditorExtensions({
      readOnly,
      lineNumbers: props.lineNumbers,
      fontSize: props.fontSize,
      lintGutter: useStrictJsonLint,
    }),
    getLanguageSupport(props.language),
    ...(useStrictJsonLint ? [jsonParseLinterExtension()] : []),
  ];
}

export class DiffEditor extends React.Component<DiffEditorProps> {
  public readonly name?: string;
  private mergeView: MergeView | null = null;

  constructor(props: DiffEditorProps) {
    super(props);
    this.name = props.name;
  }

  componentWillUnmount(): void {
    this.mergeView?.destroy();
    this.mergeView = null;
  }

  layout(): void {
    // CodeMirror 6 MergeView sizes from CSS; no Monaco layout() equivalent.
  }

  focus(): void {
    assertNotNull(this.mergeView, 'this.mergeView');
    this.mergeView.b.focus();
  }

  getCurrentValue(): string | undefined {
    return this.mergeView?.b.state.doc.toString();
  }

  resetValue(): void {
    const view = this.mergeView?.b;
    if (view == null) {
      return;
    }
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: '' },
    });
  }

  render(): React.JSX.Element {
    return (
      <DiffEditorInner
        {...this.props}
        onEditorReady={(mergeView) => {
          this.mergeView = mergeView;
        }}
      />
    );
  }
}

function DiffEditorInner(props: DiffEditorInnerProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const mergeViewRef = useRef<MergeView | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (container == null) {
      return;
    }

    const mergeView = new MergeView({
      parent: container,
      // MergeView's public option keys are `a` (ours) and `b` (theirs).
      // eslint-disable-next-line id-length -- MergeView API
      a: {
        doc: props.beforeValue,
        extensions: sideExtensions(props, 'a'),
      },
      // eslint-disable-next-line id-length -- MergeView API
      b: {
        doc: props.afterValue,
        extensions: [
          ...sideExtensions(props, 'b'),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              props.onContentChanged?.();
            }
          }),
        ],
      },
      highlightChanges: true,
      gutter: true,
    });

    mergeViewRef.current = mergeView;
    props.onEditorReady(mergeView);

    if (props.autoFocus === true) {
      mergeView.b.focus();
    }

    return () => {
      mergeView.destroy();
      mergeViewRef.current = null;
    };
    // Mount once; merge contents are the initial before/after values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sizeClass = props.size ? `pane__textarea--${props.size}` : '';
  return (
    <div
      className={`pane__textarea ${sizeClass} ${props.className ?? ''}`}
      style={{ position: 'relative' }}
      id={props.htmlId}
      data-code-editor="diff"
      {...props.htmlAttributes}
    >
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
    </div>
  );
}
