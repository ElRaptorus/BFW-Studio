import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Icon } from '#components/Icon';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';
import type BpmnDocumentModel from '#modules/bpmn-editor/BpmnDocumentModel';

import React, { useEffect, useState } from 'react';

import type { BpmnDiagramOrigin, LintBridgeApi, LintScoreSnapshot } from '../types';

export const paneProvider: PaneProvider = {
  getPaneTitle,
  shouldBeDisplayed,
  Pane: LinterScorePaneFull,
  PaneContent: LinterScorePaneContent,
};

function getPaneTitle(): string {
  return 'Linter Score';
}

function shouldBeDisplayed(editorDocument: EditorDocument, _editorDocumentModel: unknown, studio: Bifrost): boolean {
  if (!editorDocument || editorDocument.documentType !== 'bpmn') {
    return false;
  }
  if (!studio) {
    return false;
  }
  return studio.settings.get('bpmnLinter.enabled') === true;
}

function LinterScorePaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn-linter/linter-score" tooltip="Linter score help" />
      </PaneHeader>
      {props.collapsed !== true && <LinterScorePaneContent {...props} />}
    </Pane>
  );
}

const REASON_LABELS: Record<string, string> = {
  instant_fail_any_error: 'This ruleset requires zero errors (instant fail).',
  instant_risk_any_warning: 'This ruleset requires zero warnings (instant risk).',
  below_risky_threshold: 'The score is below the ruleset’s risky threshold.',
  below_valid_threshold: 'The score is below the ruleset’s valid threshold.',
};

function LinterScorePaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const [snapshot, setSnapshot] = useState<LintScoreSnapshot | null>(null);
  const [activeProfile, setActiveProfile] = useState<string>('');
  const [diagramOrigin, setDiagramOrigin] = useState<BpmnDiagramOrigin | null>(null);
  const [foreignBlocked, setForeignBlocked] = useState(false);

  const model = props.editorDocumentModel as BpmnDocumentModel | null;

  useEffect(() => {
    if (!model?.modelerAdapter) {
      return;
    }

    const bridge = model.modelerAdapter.getModelerComponentByName<LintBridgeApi>('lintBridge');
    if (!bridge) {
      return;
    }

    const tick = () => {
      setSnapshot(bridge.getLintScoreSnapshot?.() ?? null);
      setActiveProfile(bridge.getActiveProfile?.() ?? '');
      setDiagramOrigin(bridge.getDiagramOrigin?.() ?? null);
      setForeignBlocked(bridge.isForeignDiagramLintingBlocked?.() ?? false);
    };

    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [model]);

  if (foreignBlocked) {
    return (
      <PaneBody>
        <div className="lint-foreign-diagram-info">
          <Icon id="bpmn-linter/badge/info" />
          <p>
            Linting is disabled for this diagram. It appears to originate from{' '}
            <strong>{diagramOrigin?.provider ?? 'an unknown platform'}</strong>, which uses different conventions.
          </p>
          <button
            type="button"
            className="lint-foreign-diagram-info__button"
            onClick={() => props.studio.commands.executeCommand('bpmn.linter.runLintOnForeignDiagram')}
          >
            Run Linter Anyway
          </button>
        </div>
      </PaneBody>
    );
  }

  if (snapshot == null) {
    return (
      <PaneBody>
        <div className="lint-score-empty">
          <Icon id="bpmn-linter/badge/info" />
          <span>Run the linter to compute a score.</span>
        </div>
      </PaneBody>
    );
  }

  const policyUsed = snapshot.scorePolicyUsed;
  const isForeignButAllowed = diagramOrigin != null && diagramOrigin.origin !== 'daemon-engine' && !foreignBlocked;

  return (
    <PaneBody>
      <div className="lint-score-pane">
        {isForeignButAllowed && (
          <div className="lint-foreign-diagram-note">
            <Icon id="bpmn-linter/badge/info" />
            <span>This diagram originates from {diagramOrigin.provider}.</span>
          </div>
        )}
        <div className={`lint-score-pane__hero lint-score-pane__hero--${snapshot.complianceStatus}`}>
          <div className="lint-score-pane__percent">{snapshot.scorePercentDisplay}</div>
          <div className="lint-score-pane__label">Overall score ({activeProfile})</div>
        </div>

        <dl className="lint-score-pane__stats">
          <div>
            <dt>Max score points</dt>
            <dd>{snapshot.maxPoints}</dd>
          </div>
          {snapshot.errorElementCount > 0 && (
            <div className="lint-score-pane__stat--error">
              <dt>Error penalty points / penalty %</dt>
              <dd>
                {snapshot.errorPenaltyPoints} / {snapshot.errorPenaltyPercentOfTotal.toFixed(1)}% (
                {snapshot.errorElementCount} Elements)
              </dd>
            </div>
          )}
          {snapshot.warningOnlyElementCount > 0 && (
            <div className="lint-score-pane__stat--warning">
              <dt>Warning penalty points / penalty %</dt>
              <dd>
                {snapshot.warningPenaltyPoints} / {snapshot.warningPenaltyPercentOfTotal.toFixed(1)}% (
                {snapshot.warningOnlyElementCount} Elements)
              </dd>
            </div>
          )}
          {snapshot.penaltyPoints > 0 && (
            <>
              <div>
                <dt>Penalty points total:</dt>
                <dd>{snapshot.penaltyPoints}</dd>
              </div>
              <div>
                <dt>Remaining points:</dt>
                <dd>{snapshot.remainingPoints}</dd>
              </div>
            </>
          )}
          <div>
            <dt>Raw finding counts (errors / warnings)</dt>
            <dd>
              {snapshot.rawFindingErrors} / {snapshot.rawFindingWarnings}
            </dd>
          </div>
        </dl>

        <section className="lint-score-pane__thresholds">
          <h3 className="lint-score-pane__subhead">{`Requirements for "${activeProfile}":`}</h3>
          <ul>
            <li>
              <span className="lint-score-pane__threshold-label lint-score-pane__threshold-label--valid">Valid</span>:
              at least <b>{policyUsed.validMinPercent}%</b>
            </li>
            <li>
              <span className="lint-score-pane__threshold-label lint-score-pane__threshold-label--risky">Risky</span>:
              between <b>{policyUsed.riskyMinPercent}%</b> and <b>{policyUsed.validMinPercent}%</b>
            </li>
            <li>
              <span className="lint-score-pane__threshold-label lint-score-pane__threshold-label--failed">Failed</span>:
              below <b>{policyUsed.riskyMinPercent}%</b>
            </li>
            <li>Instant fail on any error: {policyUsed.instantFailOnAnyError ? 'yes' : 'no'}</li>
            <li>Instant risk on any warning: {policyUsed.instantRiskOnAnyWarning ? 'yes' : 'no'}</li>
          </ul>
        </section>

        {snapshot.complianceStatus !== 'valid' && snapshot.reasonCodes.length > 0 && (
          <section className="lint-score-pane__reasons">
            <h3 className="lint-score-pane__subhead">Why this rating</h3>
            <ul>
              {snapshot.reasonCodes.map((code) => (
                <li key={code}>{REASON_LABELS[code] ?? code}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </PaneBody>
  );
}
