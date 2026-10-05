import type { Bifrost } from '#bifrost/Bifrost';
import { Icon } from '#components/Icon';
import { EvaluationResultView } from '#modules/dmn-core';

import React, { useState, useSyncExternalStore } from 'react';

import type { DmnSimulatorSession } from '../DmnSimulatorSession';
import type { SimulationOutcome, SimulationStep } from '../core/types';
import { DmnSimulatorInput } from './DmnSimulatorInput';
import { summarizeOutcome, toEvaluationResult } from './outcomeSummary';

export type DmnSimulatorPanelProps = {
  session: DmnSimulatorSession;
  bifrost: Bifrost;
  /** The display name of a local element of the diagram. */
  describeElement: (elementId: string) => string;
  onClose: () => void;
  onReplay: (index: number | null) => void;
  onRunAgain: () => void;
  onReset: () => void;
  onEditInput: (name: string) => void;
};

function describeStep(step: SimulationStep): string {
  const value = step.error == null ? JSON.stringify(step.value) : step.error.message;
  const origin = step.namespace == null ? '' : ` (${step.namespace})`;
  return `${step.elementName ?? step.elementId}${origin} = ${value ?? 'null'}`;
}

const STEP_ICONS: Record<SimulationStep['type'], string> = {
  inputData: 'ph ph-download-simple',
  decision: 'ph ph-diamond',
  businessKnowledgeModel: 'ph ph-books',
  decisionService: 'ph ph-stack',
};

function PadButton(props: {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  pressed?: boolean;
  children?: React.ReactNode;
}): React.ReactElement {
  return (
    <button
      className={`dmn-sim-panel__button${props.active === true ? ' dmn-sim-panel__button--active' : ''}`}
      onClick={props.onClick}
      disabled={props.disabled}
      title={props.label}
      aria-label={props.label}
      aria-pressed={props.pressed}
    >
      <Icon id={props.icon} />
      {props.children}
    </button>
  );
}

function StepList(props: {
  steps: SimulationStep[];
  current: number;
  replayIndex: number | null;
  importedModelUris: Record<string, string>;
  bifrost: Bifrost;
  onReplay: (index: number | null) => void;
}) {
  return (
    <div className="dmn-sim-panel__section">
      <div className="dmn-sim-panel__section-title">Steps</div>
      <ol className="dmn-sim-panel__steps">
        {props.steps.map((step, index) => (
          <li
            // eslint-disable-next-line @eslint-react/no-array-index-key -- the step list is append-only; its position is its identity
            key={`${step.namespace ?? ''}|${step.elementId}|${index}`}
            className={[
              'dmn-sim-panel__step',
              index === props.current ? 'dmn-sim-panel__step--current' : '',
              step.error == null ? '' : 'dmn-sim-panel__step--error',
              props.replayIndex != null && index > props.replayIndex ? 'dmn-sim-panel__step--pending' : '',
            ].join(' ')}
          >
            <button onClick={() => props.onReplay(index)} title={describeStep(step)}>
              <Icon id={STEP_ICONS[step.type]} /> <span>{describeStep(step)}</span>
            </button>
            {step.namespace != null && props.importedModelUris[step.namespace] != null && (
              <a
                href="#"
                className="dmn-sim-panel__open"
                title="Open the imported model"
                onClick={(event) => {
                  event.preventDefault();
                  void props.bifrost.commands.executeCommand('std.editor.gotoSymbolInDocument', [
                    props.importedModelUris[step.namespace ?? ''],
                    step.elementId,
                  ]);
                }}
              >
                Open
              </a>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function OutcomeView(props: { outcome: SimulationOutcome }): React.ReactElement {
  const { outcome } = props;
  if (!outcome.ok) {
    return (
      <div className="dmn-sim-panel__error-detail">
        <strong>{outcome.error.code}</strong>
        <div>{outcome.error.message}</div>
      </div>
    );
  }
  return <EvaluationResultView result={toEvaluationResult(outcome)} />;
}

export function DmnSimulatorPanel(props: DmnSimulatorPanelProps): React.ReactElement {
  useSyncExternalStore(props.session.subscribe, props.session.getRevision);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const snapshot = props.session.getSnapshot();
  const steps = snapshot.outcome?.steps ?? [];
  const lastIndex = steps.length - 1;
  const current = snapshot.replayIndex ?? lastIndex;
  const summary = summarizeOutcome(snapshot, props.describeElement);
  const hasWarnings = snapshot.unresolvedImports.length > 0 || snapshot.ambiguousImports.length > 0;
  const needsAttention = hasWarnings || snapshot.importedInputs.length > 0;
  const hasDetails = needsAttention || snapshot.outcome != null;
  const canRun = snapshot.target != null && snapshot.status !== 'running';
  const showDrawer = detailsOpen && hasDetails;

  return (
    <div className="dmn-sim-panel" onMouseDown={(event) => event.stopPropagation()}>
      <div className="dmn-sim-panel__actions">
        <PadButton
          icon="ph ph-play"
          label="Run"
          onClick={props.onRunAgain}
          disabled={!canRun}
          active={snapshot.outcome != null}
        />
        <PadButton icon="ph ph-arrow-clockwise" label="Run again" onClick={props.onRunAgain} disabled={!canRun} />
        <PadButton icon="ph ph-eraser" label="Reset" onClick={props.onReset} disabled={snapshot.outcome == null} />
        <span className="dmn-sim-panel__separator" />
        <PadButton
          icon="ph ph-skip-back"
          label="First step"
          onClick={() => props.onReplay(0)}
          disabled={current <= 0}
        />
        <PadButton
          icon="ph ph-caret-left"
          label="Previous step"
          onClick={() => props.onReplay(current - 1)}
          disabled={current <= 0}
        />
        <PadButton
          icon="ph ph-caret-right"
          label="Next step"
          onClick={() => props.onReplay(current + 1)}
          disabled={current >= lastIndex}
        />
        <PadButton
          icon="ph ph-skip-forward"
          label="Show the final state"
          onClick={() => props.onReplay(null)}
          disabled={snapshot.replayIndex == null}
        />
        <span className="dmn-sim-panel__counter">{steps.length > 0 ? `${current + 1}/${steps.length}` : '–'}</span>
        <span className="dmn-sim-panel__separator" />
        <PadButton
          icon="ph ph-list-bullets"
          label={showDrawer ? 'Hide details' : 'Show details'}
          onClick={() => setDetailsOpen(!detailsOpen)}
          disabled={!hasDetails}
          active={showDrawer}
          pressed={showDrawer}
        >
          {needsAttention && !showDrawer && <span className="dmn-sim-panel__attention" />}
        </PadButton>
        <PadButton
          icon="ph ph-question"
          label="Help"
          onClick={() => void props.bifrost.commands.executeCommand('std.help.openToTheSide', ['dmn/simulator'])}
        />
        <span className="dmn-sim-panel__separator" />
        <PadButton icon="ph ph-x" label="Close simulator" onClick={props.onClose} />
      </div>

      <div className={`dmn-sim-panel__strip dmn-sim-panel__strip--${summary.tone}`} role="status" title={summary.text}>
        <span className="dmn-sim-panel__strip-text">{summary.text}</span>
        {summary.tag != null && <span className="dmn-sim-panel__tag">{summary.tag}</span>}
        {summary.duration != null && <span className="dmn-sim-panel__duration">{summary.duration}</span>}
      </div>

      {showDrawer && (
        <div className="dmn-sim-panel__drawer">
          {snapshot.unresolvedImports.map((unresolved) => (
            <div key={unresolved.namespace} className="dmn-sim-panel__warning">
              Import <code>{unresolved.namespace}</code>: {unresolved.reason}
            </div>
          ))}
          {snapshot.ambiguousImports.map((ambiguous) => (
            <div key={ambiguous.namespace} className="dmn-sim-panel__warning">
              Namespace <code>{ambiguous.namespace}</code> is provided by several files; using{' '}
              <code>{ambiguous.chosenUri}</code>, ignoring {ambiguous.ignoredUris.length}.
            </div>
          ))}

          {snapshot.importedInputs.length > 0 && (
            <div className="dmn-sim-panel__section">
              <div className="dmn-sim-panel__section-title">Inputs from imported models</div>
              {snapshot.importedInputs.map((importedInput) => (
                <div key={importedInput.name} className="dmn-sim-panel__field" title={importedInput.namespace}>
                  <span>{importedInput.name}</span>
                  <DmnSimulatorInput session={props.session} name={importedInput.name} onEdit={props.onEditInput} />
                </div>
              ))}
            </div>
          )}

          {snapshot.outcome != null && <OutcomeView outcome={snapshot.outcome} />}
          {steps.length > 0 && (
            <StepList
              steps={steps}
              current={current}
              replayIndex={snapshot.replayIndex}
              importedModelUris={snapshot.importedModelUris}
              bifrost={props.bifrost}
              onReplay={props.onReplay}
            />
          )}
        </div>
      )}
    </div>
  );
}
