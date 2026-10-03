import type { EditorDocumentRendererProps } from '#bifrost/contracts/EditorTypes';
import { Icon } from '#components/Icon';
import { Editor } from '#components/editor/Editor';
import { EditorContent } from '#components/editor/EditorContent';
import { EditorToolbar } from '#components/editor/EditorToolbar';
import { EditorToolbarLeft } from '#components/editor/EditorToolbarLeft';
import { EditorToolbarRight } from '#components/editor/EditorToolbarRight';
import { EditorToolbarText } from '#components/editor/EditorToolbarText';
import { formatRulesetFailure } from '#modules/engine-core';
import { useEditorModel } from '#modules/engine-workspace/hooks/useEditorModel';

import React from 'react';

import { describeDeployItemLocation } from '../analysis/describeDeployItemLocation';
import type { DeployItemAnalysis } from '../analysis/types';
import '../engine-deploy.scss';
import type DeployPlanDocumentModel from '../models/DeployPlanDocumentModel';

const STATUS_LABELS: Record<DeployItemAnalysis['status'], string> = {
  new: 'New',
  newVersion: 'New version',
  unchanged: 'Unchanged',
  changedWithoutVersionBump: 'Changed without version bump',
  versionMissing: 'Version missing',
  skipped: 'Skipped (not executable)',
  unknown: 'Unknown (Engine offline)',
  invalid: 'Unreadable',
};

const KIND_LABELS: Record<DeployItemAnalysis['kind'], string> = { bpmn: 'BPMN', dmn: 'DMN', invalid: 'Invalid' };
const KIND_ICONS: Record<DeployItemAnalysis['kind'], string> = {
  bpmn: 'bpmn/editor-tab/bpmn',
  dmn: 'dmn/editor-tab/dmn',
  invalid: 'ph ph-warning',
};

function formatLinterSummary(item: DeployItemAnalysis): string {
  return item.storedLinterScores.map((score) => `${score.rulesetId} ${score.scorePercent}%`).join(', ') || '–';
}

export default function DeployPlanRenderer(props: EditorDocumentRendererProps): React.JSX.Element {
  const { studio, editorDocument } = props;
  const model = useEditorModel<DeployPlanDocumentModel>(studio, editorDocument);

  const analysis = model?.getAnalysis();
  const items = analysis?.items ?? [];
  const blockedReason = model?.getDeployBlockedReason() ?? null;
  const projectRoots = model?.getProjectRoots() ?? [];
  const missingDependencyCount = model?.getMissingLocalDependencyUris().length ?? 0;
  const selectedUri = model?.getSelectedUri() ?? null;

  return (
    <Editor>
      <EditorToolbar>
        <EditorToolbarLeft>
          <EditorToolbarText studio={studio}>Deploy to: {model?.getActiveEngineLabel() ?? '…'}</EditorToolbarText>
        </EditorToolbarLeft>
        <EditorToolbarRight>
          {missingDependencyCount > 0 && (
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              data-test--deploy-add-missing-dependencies
              onClick={() => void model?.addMissingDependencies()}
            >
              Add all missing dependencies ({missingDependencyCount})
            </button>
          )}
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => void model?.refresh()}
            title="Ask the Engine again"
          >
            <Icon id="ph ph-arrows-clockwise" /> Refresh
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            data-test--deploy-button
            disabled={blockedReason != null}
            title={blockedReason ?? 'Deploy the selected files'}
            onClick={() => {
              if (studio.commands.isCommandEnabled('engine.deploy.deployPlan')) {
                void studio.commands.executeCommand('engine.deploy.deployPlan', []);
              }
            }}
          >
            <Icon id="ph ph-paper-plane-tilt" /> Deploy
          </button>
        </EditorToolbarRight>
      </EditorToolbar>
      <EditorContent>
        <div className="deploy-plan__content" data-test--deploy-plan>
          {items.length === 0 ? (
            <p className="deploy-plan__empty">
              The plan is empty. Choose BPMN and DMN files in the Deploy Explorer and add them with Enter or a double
              click.
            </p>
          ) : (
            <>
              {blockedReason != null && (
                <div className="deploy-plan__notice deploy-plan__notice--blocked" data-test--deploy-blocked-reason>
                  {blockedReason}
                </div>
              )}
              <table className="deploy-plan__table">
                <thead>
                  <tr>
                    <th>Deploy</th>
                    <th />
                    <th>File</th>
                    <th>Kind</th>
                    <th>Status</th>
                    <th>Versions</th>
                    <th>Dependencies</th>
                    <th>Linter</th>
                    <th>Result</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const result = model?.getResult(item.uri) ?? null;
                    const dependencies = model?.getDependenciesOf(item.uri) ?? [];
                    const unresolvedCount = dependencies.filter((dependency) =>
                      ['localNotInPlan', 'missing'].includes(dependency.state),
                    ).length;
                    const location = describeDeployItemLocation(item.uri, projectRoots);
                    return (
                      <tr
                        key={item.uri}
                        className={`deploy-plan__row${item.uri === selectedUri ? ' deploy-plan__row--selected' : ''}`}
                        data-test--deploy-item={item.uri}
                        data-test--deploy-item-status={item.status}
                        onClick={() => model?.selectItem(item.uri)}
                      >
                        <td>
                          <input
                            type="checkbox"
                            checked={model?.isIncluded(item.uri) ?? false}
                            disabled={item.kind === 'invalid' && !(model?.isIncluded(item.uri) ?? false)}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) => model?.setIncluded(item.uri, event.target.checked)}
                          />
                        </td>
                        <td>
                          <Icon id={KIND_ICONS[item.kind]} />
                        </td>
                        <td>
                          <div>{location.fileName}</div>
                          {location.folder !== '' && <div className="deploy-plan__folder">{location.folder}</div>}
                        </td>
                        <td>{KIND_LABELS[item.kind]}</td>
                        <td>{STATUS_LABELS[item.status]}</td>
                        <td>{item.processes.map((process) => process.version ?? '–').join(', ') || '–'}</td>
                        <td>{unresolvedCount > 0 ? `${unresolvedCount} unresolved` : dependencies.length}</td>
                        <td>{formatLinterSummary(item)}</td>
                        <td className={result == null ? '' : `deploy-plan__result--${result.status}`}>
                          {result == null ? '' : (result.message ?? result.status)}
                          {result?.rulesetFailures.map((failure) => (
                            <div key={formatRulesetFailure(failure)}>{formatRulesetFailure(failure)}</div>
                          ))}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            title="Remove from plan"
                            onClick={(event) => {
                              event.stopPropagation();
                              void model?.removeItem(item.uri);
                            }}
                          >
                            <Icon id="ph ph-x" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
        </div>
      </EditorContent>
    </Editor>
  );
}
