import { Icon } from '#components/Icon';
import { EvaluationResultView } from '#modules/dmn-core';

import React from 'react';

import type { EvaluationResult } from '@elraptorus/bfw_engine_sdk';

import './EvaluationPanel.scss';

interface EvaluationPanelProps {
  open: boolean;
  inputJson: string;
  loading: boolean;
  error: string | null;
  result: EvaluationResult | null;
  onInputChange: (value: string) => void;
  onEvaluate: () => void;
  onClose: () => void;
  onOpenImportedModel?: (modelId: string) => void;
}

export function EvaluationPanel(props: EvaluationPanelProps): React.JSX.Element | null {
  if (!props.open) {
    return null;
  }

  return (
    <div className="engine-evaluation-panel">
      <div className="engine-evaluation-panel__header">
        <span className="engine-evaluation-panel__title">Test Decision</span>
        <button className="engine-evaluation-panel__close" onClick={props.onClose} title="Close">
          <Icon id="ph ph-x" />
        </button>
      </div>

      <div className="engine-evaluation-panel__body">
        <label className="engine-evaluation-panel__label" htmlFor="evaluation-input">
          Input JSON
        </label>
        <textarea
          id="evaluation-input"
          className="engine-evaluation-panel__textarea"
          value={props.inputJson}
          onChange={(event) => props.onInputChange(event.target.value)}
          rows={6}
          spellCheck={false}
        />

        <button
          className={`engine-evaluation-panel__evaluate${props.loading ? ' engine-evaluation-panel__evaluate--loading' : ''}`}
          onClick={props.onEvaluate}
          disabled={props.loading}
        >
          <Icon id="ph ph-play" /> {props.loading ? 'Evaluating...' : 'Evaluate'}
        </button>

        {props.error && <div className="engine-evaluation-panel__error">{props.error}</div>}

        {props.result && <EvaluationResultView result={props.result} onOpenImportedModel={props.onOpenImportedModel} />}
      </div>
    </div>
  );
}
