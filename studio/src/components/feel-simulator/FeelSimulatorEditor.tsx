import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

import type { FeelEditorVariable } from '@evil/bifrost_fw_sdk';
import { FeelEditor, MultiLineCodeEditor, OneLineFeelEditor } from '@evil/bifrost_fw_sdk';

import { ExecuteButton } from './ExecuteButton';
import { FeelEvaluator } from './FeelEvaluator';
import { ResultRenderer } from './ResultRenderer';
import './component.feel-simulator.scss';
import type { EvalResult, FeelSimulatorEditorRef, FeelSimulatorProps } from './types';

const DEFAULT_CONTEXT: Record<string, unknown> = {
  token: {
    amount: 1500,
    currency: 'EUR',
    customer: {
      id: 'C-123',
      name: 'Acme Corp',
      tier: 'gold',
    },
  },
  this: {
    id: 'Activity_1a2b3c',
    name: 'Review Invoice',
    type: 'UserTask',
  },
  context: {
    region: 'EU',
    priority: 3,
  },
  process: {
    id: 'Process_InvoiceReview',
    name: 'Invoice Review',
    version: '1.0',
  },
  processInstance: {
    id: 'pi-001-abc',
    businessKey: 'INV-2026-0042',
    startedAt: '2026-05-18T09:00:00Z',
    startedBy: 'user-42',
    parentId: null,
  },
  identity: {
    id: 'user-42',
    roles: ['manager', 'approver'],
    groups: ['finance'],
    claims: {
      department: 'accounting',
      level: 3,
    },
  },
  loop: {
    index: 0,
    total: 3,
    completed: 0,
    results: [],
  },
  dataObjects: {
    OrderData: { orderId: 'ORD-789', status: 'pending' },
    CustomerProfile: { customerId: 'C-123', creditLimit: 50000 },
  },
};

export const FeelSimulatorEditor = React.forwardRef<FeelSimulatorEditorRef | null, FeelSimulatorProps>(
  function FeelSimulatorEditor(props, forwardedRef): React.JSX.Element {
    const { studio, initialExpression, variables, onChange, layout, initialContext } = props;

    const multiLineRef = useRef<FeelEditor>(null);
    const singleLineRef = useRef<OneLineFeelEditor>(null);

    const effectiveInitialContext = initialContext ?? DEFAULT_CONTEXT;
    const [valuesJson, setValuesJson] = useState<string>(() => JSON.stringify(effectiveInitialContext, null, 2));
    const [evalContext, setEvalContext] = useState<Record<string, unknown>>(effectiveInitialContext);
    const [valuesParseError, setValuesParseError] = useState<string | null>(null);

    const [result, setResult] = useState<EvalResult | null>(null);
    const [resultSource, setResultSource] = useState<'multi' | 'single' | null>(null);
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [showLoading, setShowLoading] = useState(false);
    const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const evaluatorRef = useRef<FeelEvaluator | null>(null);

    useEffect(() => {
      evaluatorRef.current = new FeelEvaluator();
      return () => {
        evaluatorRef.current?.dispose();
        evaluatorRef.current = null;
      };
    }, []);

    useEffect(() => {
      if (!isEvaluating) {
        if (loadingTimerRef.current != null) {
          clearTimeout(loadingTimerRef.current);
        }
        loadingTimerRef.current = null;
        const resetTimer = setTimeout(() => setShowLoading(false), 0);
        return () => clearTimeout(resetTimer);
      }

      loadingTimerRef.current = setTimeout(() => setShowLoading(true), 300);
      return () => {
        if (loadingTimerRef.current != null) {
          clearTimeout(loadingTimerRef.current);
        }
      };
    }, [isEvaluating]);

    useImperativeHandle(
      forwardedRef,
      () => ({
        getCurrentValue(): string | undefined {
          if (layout === 'SingleLine') {
            return singleLineRef.current?.getCurrentValue();
          }
          return multiLineRef.current?.getCurrentValue();
        },
      }),
      [layout],
    );

    const handleValuesChange = useCallback((value: string) => {
      setValuesJson(value);
      try {
        const parsed = JSON.parse(value);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          setEvalContext(parsed);
          setValuesParseError(null);
        } else {
          setValuesParseError('Must be a JSON object (not array or primitive)');
        }
      } catch (error: unknown) {
        setValuesParseError(error instanceof Error ? error.message : String(error));
      }
    }, []);

    const handleExecute = useCallback(
      async (source: 'multi' | 'single') => {
        const ref = source === 'multi' ? multiLineRef : singleLineRef;
        const expression = ref.current?.getCurrentValue() ?? '';

        if (expression.trim() === '') {
          setResult({ status: 'error', error: 'Expression is empty', elapsed: 0 });
          setResultSource(source);
          return;
        }

        if (valuesParseError) {
          setResult({
            status: 'error',
            error: `Variable values JSON is invalid: ${valuesParseError}`,
            elapsed: 0,
          });
          setResultSource(source);
          return;
        }

        setIsEvaluating(true);
        setResultSource(source);

        const evalResult = await evaluatorRef.current!.evaluate(expression, evalContext);

        setIsEvaluating(false);
        setResult(evalResult);
      },
      [evalContext, valuesParseError],
    );

    const handleMultiLineKeyDown = useCallback(
      (event: KeyboardEvent) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
          handleExecute('multi');
          return true;
        }
      },
      [handleExecute],
    );

    const handleSingleLineKeyDown = useCallback(
      (event: KeyboardEvent) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
          handleExecute('single');
          return true;
        }
      },
      [handleExecute],
    );

    const variablesOrUndefined: FeelEditorVariable[] | undefined = variables ?? undefined;

    return (
      <div className={`feel-simulator ${props.className ?? ''}`}>
        <div className="feel-simulator__expression-area">
          {(layout === 'MultiLine' || layout === 'Both') && (
            <div className="feel-simulator__editor-row">
              <div className="feel-simulator__editor-row-header">
                {layout === 'Both' && <span className="feel-simulator__editor-label">Multi-line</span>}
                <ExecuteButton onClick={() => handleExecute('multi')} disabled={isEvaluating} testId="multi" />
              </div>
              <div className="feel-simulator__editor-wrapper">
                <FeelEditor
                  ref={multiLineRef}
                  htmlId={layout !== 'Both' ? props.htmlId : undefined}
                  studio={studio}
                  className="feel-simulator__feel-editor"
                  initialValue={initialExpression}
                  variables={variablesOrUndefined}
                  onChange={onChange}
                  onKeyDown={props.onKeyDown ?? handleMultiLineKeyDown}
                  autoFocus={props.autoFocus}
                  dialect={props.dialect}
                  htmlAttributes={layout !== 'Both' ? (props.htmlAttributes as Record<string, unknown>) : undefined}
                />
              </div>
            </div>
          )}

          {(layout === 'SingleLine' || layout === 'Both') && (
            <div className="feel-simulator__editor-row feel-simulator__editor-row--single">
              <div className="feel-simulator__editor-row-header">
                {layout === 'Both' && <span className="feel-simulator__editor-label">Single-line</span>}
                <ExecuteButton onClick={() => handleExecute('single')} disabled={isEvaluating} testId="single" />
              </div>
              <OneLineFeelEditor
                ref={singleLineRef}
                htmlId={layout === 'SingleLine' ? props.htmlId : undefined}
                studio={studio}
                initialValue={layout === 'SingleLine' ? initialExpression : 'token.amount > 100'}
                variables={variablesOrUndefined}
                onChange={layout === 'SingleLine' ? onChange : undefined}
                onKeyDown={props.onKeyDown ?? handleSingleLineKeyDown}
                autoFocus={props.autoFocus && layout === 'SingleLine'}
                placeholder="Enter a FEEL expression..."
                htmlAttributes={layout === 'SingleLine' ? (props.htmlAttributes as Record<string, unknown>) : undefined}
              />
            </div>
          )}
        </div>

        <div className="feel-simulator__bottom-area">
          <div className="feel-simulator__values-editor">
            <div className="feel-simulator__section-header">
              <span className="feel-simulator__section-title">Variable Values</span>
              {valuesParseError && <span className="feel-simulator__values-error">{valuesParseError}</span>}
            </div>
            <div className="feel-simulator__values-editor-wrapper">
              <MultiLineCodeEditor
                studio={studio}
                className="feel-simulator__json-editor"
                initialValue={valuesJson}
                language="json"
                onChange={handleValuesChange}
              />
            </div>
          </div>

          <div className="feel-simulator__result">
            <div className="feel-simulator__section-header">
              <span className="feel-simulator__section-title">Result</span>
            </div>
            <ResultRenderer result={result} source={layout === 'Both' ? resultSource : null} isLoading={showLoading} />
          </div>
        </div>
      </div>
    );
  },
);
