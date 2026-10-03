import type { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneHeader } from '#components/panes/PaneHeader';
import { formatRulesetFailure } from '#modules/engine-core';

import React from 'react';

import { PaneProperty } from '@elraptorus/bfw_studio_sdk';

import type DeployPlanDocumentModel from '../models/DeployPlanDocumentModel';
import { DEPLOY_PLAN_URI } from '../models/DeployPlanDocumentModel';

export const paneProvider: PaneProvider = {
  getPaneTitle: () => 'Deploy Item',
  shouldBeDisplayed: (
    editorDocument: EditorDocument | null | undefined,
    model: EditorDocumentModel | null | undefined,
  ) => editorDocument?.uri === DEPLOY_PLAN_URI && (model as DeployPlanDocumentModel | null)?.getSelectedItem() != null,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title="Deploy Item" paneId={props.paneId} collapsed={props.collapsed} />
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const model = props.editorDocumentModel as DeployPlanDocumentModel | null;
  const item = model?.getSelectedItem() ?? null;
  if (model == null || item == null) {
    return null;
  }

  const bifrost = props.studio;
  const dependencies = model.getDependenciesOf(item.uri);
  const result = model.getResult(item.uri);

  return (
    <div className="deploy-item-details" data-test--deploy-item-details={item.uri}>
      <PaneProperty type="text" label="File" value={item.uri.replace(/^file:\/\//, '')} disabled />
      <PaneProperty type="text" label="Status" value={item.status} disabled />
      {item.processes.map((process) => (
        <PaneProperty
          key={process.processId}
          type="text"
          label={process.processId}
          value={`${process.version ?? 'no version'} · ${process.status}`}
          disabled
        />
      ))}
      {item.linterInfo != null && <p className="deploy-item-details__info">{item.linterInfo}</p>}
      {item.storedLinterScores.map((score) => (
        <PaneProperty
          key={score.rulesetId}
          type="text"
          label={`Linter: ${score.rulesetId}`}
          value={`${score.scorePercent}% · ${score.complianceStatus}`}
          disabled
        />
      ))}
      {item.blockers.map((blocker) => (
        <p key={blocker} className="deploy-item-details__blocker">
          {blocker}
        </p>
      ))}
      {dependencies.length > 0 && <h6 className="deploy-item-details__heading">Dependencies</h6>}
      {dependencies.map((dependency) => (
        <div
          key={`${dependency.kind}:${dependency.id}:${dependency.version ?? ''}`}
          className="deploy-item-details__dependency"
          data-test--deploy-dependency={dependency.id}
          data-test--deploy-dependency-state={dependency.state}
        >
          <span>
            {dependency.id}
            {dependency.version != null ? ` @ ${dependency.version}` : ''} · {dependency.state}
          </span>
          {dependency.state === 'localNotInPlan' && dependency.fileUri != null && (
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => void bifrost.commands.executeCommand('engine.deploy.addToPlan', [[dependency.fileUri]])}
            >
              Add
            </button>
          )}
        </div>
      ))}
      {result != null && (
        <>
          <h6 className="deploy-item-details__heading">Last result</h6>
          <PaneProperty type="text" label="Result" value={result.status} disabled />
          {result.message != null && <p className="deploy-item-details__blocker">{result.message}</p>}
          {result.rulesetFailures.map((failure) => (
            <p key={formatRulesetFailure(failure)} className="deploy-item-details__blocker">
              {formatRulesetFailure(failure)}
            </p>
          ))}
        </>
      )}
    </div>
  );
}
