import type FeelEditorLib from '@bpmn-io/feel-editor';
import type { FeelEditorVariable } from '@bpmn-io/feel-editor';

import React, { useCallback, useEffect, useRef } from 'react';

import type { Studio } from '../../index';
import { studioFeelHighlighting, studioFeelTheme } from './FeelEditorTheme';

export type { FeelEditorVariable } from '@bpmn-io/feel-editor';

type FeelEditorInstance = InstanceType<typeof FeelEditorLib>;

export type FeelEditorProps = {
  studio: Studio;
  initialValue: string;
  dialect?: 'expression' | 'unaryTests';
  variables?: FeelEditorVariable[];
  onChange?: (value: string) => void;
  onKeyDown?: (event: KeyboardEvent) => boolean | void;
  onLint?: (diagnostics: unknown[]) => void;
  autoFocus?: boolean;
  className?: string;
  size?: 'small' | 'medium' | 'tall';
  fontSize?: number;
  htmlId?: string;
  htmlAttributes?: Record<string, unknown>;
  readOnly?: boolean;
  placeholder?: string;
};

type FeelEditorInnerProps = FeelEditorProps & {
  onEditorReady: (editorInstance: FeelEditorInstance) => void;
};

export class FeelEditor extends React.Component<FeelEditorProps> {
  private editorInstance: FeelEditorInstance | null = null;

  componentWillUnmount(): void {
    this.editorInstance = null;
  }

  focus(): void {
    this.editorInstance?.focus();
  }

  getCurrentValue(): string | undefined {
    return this.editorInstance?._cmEditor.state.doc.toString();
  }

  resetValue(): void {
    this.editorInstance?.setValue('');
  }

  render(): React.JSX.Element {
    return (
      <FeelEditorInner
        {...this.props}
        onEditorReady={(instance) => {
          this.editorInstance = instance;
        }}
      />
    );
  }
}

function FeelEditorInner(props: FeelEditorInnerProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<FeelEditorInstance | null>(null);
  const latestPropsRef = useRef(props);
  const currentValueRef = useRef(props.initialValue ?? '');

  useEffect(() => {
    latestPropsRef.current = props;
  });

  const handleBlur = useCallback(() => {
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
    if (!container) {
      return;
    }

    const FeelEditorImport = require('@bpmn-io/feel-editor').default;

    const instance = new FeelEditorImport({
      container,
      extensions: [studioFeelTheme, studioFeelHighlighting],
      dialect: props.dialect ?? 'expression',
      value: props.initialValue ?? '',
      variables: props.variables,
      readOnly: props.readOnly,
      placeholder: props.placeholder,
      onChange: (value: string) => {
        currentValueRef.current = value;
      },
      onKeyDown: props.onKeyDown ? (event: KeyboardEvent) => latestPropsRef.current.onKeyDown?.(event) : undefined,
      onLint: props.onLint ? (diagnostics: unknown[]) => latestPropsRef.current.onLint?.(diagnostics) : undefined,
    });

    editorRef.current = instance;
    latestPropsRef.current.onEditorReady(instance);

    const cmDom = instance._cmEditor.dom;
    cmDom.addEventListener('focusout', handleBlur);

    if (latestPropsRef.current.autoFocus === true) {
      instance.focus();
    }

    return () => {
      cmDom.removeEventListener('focusout', handleBlur);

      const value = currentValueRef.current;
      if (value != null && value !== latestPropsRef.current.initialValue) {
        latestPropsRef.current.onChange?.(value);
      }

      instance._cmEditor.destroy();
      editorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (editorRef.current && props.variables) {
      editorRef.current.setVariables(props.variables);
    }
  }, [props.variables]);

  useEffect(() => {
    if (editorRef.current && props.placeholder != null) {
      editorRef.current.setPlaceholder(props.placeholder);
    }
  }, [props.placeholder]);

  const sizeClass = props.size ? `feel-editor--${props.size}` : '';
  return (
    <div
      className={`feel-editor ${sizeClass} ${props.className ?? ''}`}
      style={{ position: 'relative', fontSize: props.fontSize }}
      id={props.htmlId}
      {...(props.htmlAttributes as React.HTMLAttributes<HTMLDivElement>)}
    >
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
    </div>
  );
}
