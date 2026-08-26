import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { ConflictKey, ElementResolutionStatus, MergeResolutionProgress } from '#bifrost/contracts/MergeTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Icon } from '#components/Icon';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { EVENT_MERGE_FILE_CHANGED, EVENT_RESOLUTION_CHANGED } from '#modules/git-cruiser/GitTypes';
import type MergeDocumentModel from '#modules/git-cruiser/merge/MergeDocumentModel';

import React, { useEffect, useState } from 'react';

import type { DmnClassifiedElement } from '../DmnMergeResultModeler';

export const paneProvider: PaneProvider = {
  getPaneTitle: () => 'Merge Changes',
  shouldBeDisplayed: (document: EditorDocument, model: MergeDocumentModel) =>
    document?.modelKey === 'MergeDocumentModel' && model?.currentFileType === 'dmn',
  Pane: PaneFull,
  PaneContent: PaneContentWrapper,
};

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title="Merge Changes" paneId={props.paneId} collapsed={props.collapsed} />
      {props.collapsed !== true && <PaneContentWrapper {...props} />}
    </Pane>
  );
}

function PaneContentWrapper(props: PaneComponentProps): React.JSX.Element {
  return (
    <PaneBody>
      <PaneContent {...props} />
    </PaneBody>
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element {
  const model = props.editorDocumentModel as MergeDocumentModel | null;
  const resolverApi = model?.resolverRef?.current;

  const [elements, setElements] = useState<DmnClassifiedElement[]>(() => resolverApi?.getClassifiedElements?.() ?? []);
  const [resolutionProgress, setResolutionProgress] = useState<MergeResolutionProgress | null>(
    () => model?.getResolutionProgress() ?? null,
  );
  const [renderTick, setRenderTick] = useState(0);
  const [prevModel, setPrevModel] = useState(model);

  if (model !== prevModel) {
    setPrevModel(model);
    setElements(resolverApi?.getClassifiedElements?.() ?? []);
    setResolutionProgress(model?.getResolutionProgress() ?? null);
  }

  useEffect(() => {
    if (model == null) {
      return;
    }

    const sub1 = model.on(EVENT_MERGE_FILE_CHANGED, () => {
      const api = model.resolverRef?.current;
      setElements(api?.getClassifiedElements?.() ?? []);
      setResolutionProgress(model.getResolutionProgress());
    });
    const sub2 = model.on(EVENT_RESOLUTION_CHANGED, () => {
      setResolutionProgress(model.getResolutionProgress());
      setRenderTick((prev) => prev + 1);
    });
    return () => {
      sub1.dispose();
      sub2.dispose();
    };
  }, [model]);

  const allResolutions = resolverApi?.getAllResolutions?.() ?? [];
  const autoAppliedIds = new Set(
    allResolutions
      .filter((resolution) => resolution.status === 'auto-applied')
      .map((resolution) => resolution.elementId),
  );
  const revertedIds = new Set(
    allResolutions.filter((resolution) => resolution.status === 'reverted').map((resolution) => resolution.elementId),
  );
  const autoAppliedElements = elements.filter((element) => autoAppliedIds.has(element.elementId));
  const revertedElements = elements.filter((element) => revertedIds.has(element.elementId));

  const oursOnly = elements.filter(
    (element) => element.classification === 'ours-only' && !autoAppliedIds.has(element.elementId),
  );
  const theirsOnly = elements.filter(
    (element) => element.classification === 'theirs-only' && !autoAppliedIds.has(element.elementId),
  );
  const conflicts = elements.filter((element) => element.classification === 'both');

  const getResolutionStatus = (key: ConflictKey): ElementResolutionStatus | null =>
    resolverApi?.getResolutionStatus?.(key) ?? null;

  const handleClick = (elementId: string) => {
    resolverApi?.selectElements?.([elementId]);
  };

  const handleAcceptOursForKey = (key: ConflictKey) => {
    resolverApi?.acceptOursForKey?.(key);
  };

  const handleAcceptTheirsForKey = (key: ConflictKey) => {
    resolverApi?.acceptTheirsForKey?.(key);
  };

  const handleRevertAutoApplied = (elementId: string) => {
    resolverApi?.revertAutoApplied?.(elementId);
  };

  const handleReapplyAutoApplied = (elementId: string) => {
    resolverApi?.reapplyAutoApplied?.(elementId);
  };

  const handleUndoConflictResolution = (key: ConflictKey) => {
    resolverApi?.undoConflictResolution?.(key);
  };

  const hasPerElementResolution = resolverApi?.getResolutionStatus != null;

  return (
    <div className="merge-overview" key={renderTick}>
      {resolutionProgress != null && resolutionProgress.totalConflicts > 0 && (
        <div className="merge-overview__progress">
          <div className="merge-overview__progress-text">
            Conflicts: {resolutionProgress.resolvedConflicts} of {resolutionProgress.totalConflicts} resolved
          </div>
          <div className="merge-overview__progress-bar">
            <div
              className="merge-overview__progress-bar-fill"
              style={{
                width: `${(resolutionProgress.resolvedConflicts / resolutionProgress.totalConflicts) * 100}%`,
              }}
            />
          </div>
        </div>
      )}
      {conflicts.length > 0 && (
        <ConflictSection
          elements={conflicts}
          onClick={handleClick}
          onAcceptOursForKey={hasPerElementResolution ? handleAcceptOursForKey : undefined}
          onAcceptTheirsForKey={hasPerElementResolution ? handleAcceptTheirsForKey : undefined}
          onUndoResolution={hasPerElementResolution ? handleUndoConflictResolution : undefined}
          getResolutionStatus={hasPerElementResolution ? getResolutionStatus : undefined}
        />
      )}
      {(autoAppliedElements.length > 0 || revertedElements.length > 0) && (
        <AutoAppliedSection
          elements={autoAppliedElements}
          revertedElements={revertedElements}
          onClick={handleClick}
          onRevert={hasPerElementResolution ? handleRevertAutoApplied : undefined}
          onReapply={hasPerElementResolution ? handleReapplyAutoApplied : undefined}
        />
      )}
      {oursOnly.length > 0 && (
        <Section
          title="Ours only"
          badgeClass="merge-status-badge--ours"
          count={oursOnly.length}
          elements={oursOnly}
          onClick={handleClick}
        />
      )}
      {theirsOnly.length > 0 && (
        <Section
          title="Theirs only"
          badgeClass="merge-status-badge--theirs"
          count={theirsOnly.length}
          elements={theirsOnly}
          onClick={handleClick}
        />
      )}
      {elements.length === 0 && <div className="merge-overview__empty">No changes detected.</div>}
    </div>
  );
}

function ResolutionBadge(props: { status: ElementResolutionStatus }): React.JSX.Element {
  let label: string;
  let cssClass: string;

  switch (props.status) {
    case 'auto-applied':
      label = 'Auto';
      cssClass = 'merge-overview__resolution-badge--auto';
      break;
    case 'accepted-ours':
      label = 'Ours';
      cssClass = 'merge-overview__resolution-badge--resolved-ours';
      break;
    case 'accepted-theirs':
      label = 'Theirs';
      cssClass = 'merge-overview__resolution-badge--resolved-theirs';
      break;
    case 'custom':
      label = 'Mixed';
      cssClass = 'merge-overview__resolution-badge--resolved-mixed';
      break;
    case 'reverted':
      label = 'Reverted';
      cssClass = 'merge-overview__resolution-badge--reverted';
      break;
    case 'pending':
    default:
      label = 'Pending';
      cssClass = 'merge-overview__resolution-badge--pending';
      break;
  }

  return <span className={`merge-overview__resolution-badge ${cssClass}`}>{label}</span>;
}

function ConflictSection(props: {
  elements: DmnClassifiedElement[];
  onClick: (elementId: string) => void;
  onAcceptOursForKey?: (key: ConflictKey) => void;
  onAcceptTheirsForKey?: (key: ConflictKey) => void;
  onUndoResolution?: (key: ConflictKey) => void;
  getResolutionStatus?: (key: ConflictKey) => ElementResolutionStatus | null;
}): React.JSX.Element {
  return (
    <div className="merge-overview__section">
      <div className="merge-overview__section-header">
        <span className="merge-overview__badge merge-status-badge--conflict">{props.elements.length}</span>
        <span>Conflicts</span>
      </div>
      <ul className="merge-overview__list">
        {props.elements.map((element) => {
          const conflictKey = element.elementId;
          const status = props.getResolutionStatus?.(conflictKey) ?? null;

          return (
            <li
              key={element.elementId}
              className="merge-overview__entry"
              onClick={() => props.onClick(element.elementId)}
            >
              <div className="merge-overview__entry-header">
                <span className="merge-overview__entry-type">{element.type}</span>
                <span className="merge-overview__entry-name">{element.displayName}</span>
              </div>
              {status != null && (
                <div className="merge-overview__entry-status-row">
                  <ResolutionBadge status={status} />
                </div>
              )}
              <ConflictKeyActions
                conflictKey={conflictKey}
                status={status}
                onAcceptOursForKey={props.onAcceptOursForKey}
                onAcceptTheirsForKey={props.onAcceptTheirsForKey}
                onUndoResolution={props.onUndoResolution}
              />
              <ActionDetails oursActions={element.oursActions} theirsActions={element.theirsActions} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ConflictKeyActions(props: {
  conflictKey: ConflictKey;
  status: ElementResolutionStatus | null;
  onAcceptOursForKey?: (key: ConflictKey) => void;
  onAcceptTheirsForKey?: (key: ConflictKey) => void;
  onUndoResolution?: (key: ConflictKey) => void;
}): React.JSX.Element | null {
  const isPending = props.status === 'pending';
  const isResolved =
    props.status === 'accepted-ours' || props.status === 'accepted-theirs' || props.status === 'custom';

  if (isPending && props.onAcceptOursForKey != null && props.onAcceptTheirsForKey != null) {
    return (
      <div className="merge-overview__entry-actions">
        <button
          className="merge-overview__action-button merge-overview__action-button--ours"
          title="Accept ours"
          onClick={(event) => {
            event.stopPropagation();
            props.onAcceptOursForKey!(props.conflictKey);
          }}
        >
          <Icon id="ph ph-check" /> Ours
        </button>
        <button
          className="merge-overview__action-button merge-overview__action-button--theirs"
          title="Accept theirs"
          onClick={(event) => {
            event.stopPropagation();
            props.onAcceptTheirsForKey!(props.conflictKey);
          }}
        >
          <Icon id="ph ph-check" /> Theirs
        </button>
      </div>
    );
  }

  if (isResolved && props.onUndoResolution != null) {
    return (
      <div className="merge-overview__entry-actions">
        <button
          className="merge-overview__action-button merge-overview__action-button--undo"
          title="Undo resolution"
          onClick={(event) => {
            event.stopPropagation();
            props.onUndoResolution!(props.conflictKey);
          }}
        >
          <Icon id="ph ph-arrow-counter-clockwise" /> Undo
        </button>
      </div>
    );
  }

  return null;
}

function Section(props: {
  title: string;
  badgeClass: string;
  count: number;
  elements: DmnClassifiedElement[];
  onClick: (elementId: string) => void;
}): React.JSX.Element {
  return (
    <div className="merge-overview__section">
      <div className="merge-overview__section-header">
        <span className={`merge-overview__badge ${props.badgeClass}`}>{props.count}</span>
        <span>{props.title}</span>
      </div>
      <ul className="merge-overview__list">
        {props.elements.map((element) => (
          <li
            key={element.elementId}
            className="merge-overview__entry"
            onClick={() => props.onClick(element.elementId)}
          >
            <div className="merge-overview__entry-header">
              <span className="merge-overview__entry-type">{element.type}</span>
              <span className="merge-overview__entry-name">{element.displayName}</span>
            </div>
            <ActionDetails
              oursActions={element.oursActions}
              theirsActions={element.theirsActions}
              classification={element.classification}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function AutoAppliedSection(props: {
  elements: DmnClassifiedElement[];
  revertedElements: DmnClassifiedElement[];
  onClick: (elementId: string) => void;
  onRevert?: (elementId: string) => void;
  onReapply?: (elementId: string) => void;
}): React.JSX.Element {
  const totalCount = props.elements.length + props.revertedElements.length;

  return (
    <div className="merge-overview__section">
      <div className="merge-overview__section-header">
        <span className="merge-overview__badge merge-status-badge--auto">{totalCount}</span>
        <span>Auto-applied</span>
      </div>
      <ul className="merge-overview__list">
        {props.elements.map((element) => {
          const source = element.classification === 'ours-only' ? 'Ours' : 'Theirs';
          const restoreSide = source === 'Ours' ? 'Theirs' : 'Ours';
          return (
            <li
              key={element.elementId}
              className="merge-overview__entry"
              onClick={() => props.onClick(element.elementId)}
            >
              <div className="merge-overview__entry-header">
                <span className="merge-overview__entry-type">{element.type}</span>
                <span className="merge-overview__entry-name">{element.displayName}</span>
                <span className="merge-overview__resolution-badge merge-overview__resolution-badge--auto">
                  {source}
                </span>
              </div>
              {props.onRevert && (
                <div className="merge-overview__entry-actions">
                  <button
                    className="merge-overview__action-button merge-overview__action-button--revert"
                    title={`Restore ${restoreSide.toLowerCase()} version`}
                    onClick={(event) => {
                      event.stopPropagation();
                      props.onRevert!(element.elementId);
                    }}
                  >
                    <Icon id="ph ph-arrow-counter-clockwise" /> Restore {restoreSide.toLowerCase()}
                  </button>
                </div>
              )}
              <ActionDetails
                oursActions={element.oursActions}
                theirsActions={element.theirsActions}
                classification={element.classification}
              />
            </li>
          );
        })}
        {props.revertedElements.map((element) => {
          const source = element.classification === 'ours-only' ? 'Ours' : 'Theirs';
          const currentSide = source === 'Ours' ? 'Theirs' : 'Ours';
          return (
            <li
              key={element.elementId}
              className="merge-overview__entry merge-overview__entry--reverted"
              onClick={() => props.onClick(element.elementId)}
            >
              <div className="merge-overview__entry-header">
                <span className="merge-overview__entry-type">{element.type}</span>
                <span className="merge-overview__entry-name">{element.displayName}</span>
                <span className="merge-overview__resolution-badge merge-overview__resolution-badge--reverted">
                  {currentSide}
                </span>
              </div>
              {props.onReapply && (
                <div className="merge-overview__entry-actions">
                  <button
                    className="merge-overview__action-button merge-overview__action-button--reapply"
                    title={`Reapply ${source.toLowerCase()} version`}
                    onClick={(event) => {
                      event.stopPropagation();
                      props.onReapply!(element.elementId);
                    }}
                  >
                    <Icon id="ph ph-arrow-clockwise" /> Reapply {source.toLowerCase()}
                  </button>
                </div>
              )}
              <ActionDetails
                oursActions={element.oursActions}
                theirsActions={element.theirsActions}
                classification={element.classification}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ActionDetails(props: {
  oursActions: string[];
  theirsActions: string[];
  classification?: DmnClassifiedElement['classification'];
}): React.JSX.Element | null {
  const oursLabel = props.oursActions.map(formatAction).join(', ');
  const theirsLabel = props.theirsActions.map(formatAction).join(', ');
  const oursHasActions = props.oursActions.length > 0;
  const theirsHasActions = props.theirsActions.length > 0;

  if (!oursHasActions && !theirsHasActions) {
    return null;
  }

  if (props.classification === 'both' || (oursHasActions && theirsHasActions)) {
    return (
      <div className="merge-overview__details">
        {oursHasActions && (
          <div className="merge-overview__side-detail merge-overview__side-detail--ours">
            <div className="merge-overview__action-line">
              <span className="merge-overview__side-label">Ours:</span>
              <span>{oursLabel}</span>
            </div>
          </div>
        )}
        {theirsHasActions && (
          <div className="merge-overview__side-detail merge-overview__side-detail--theirs">
            <div className="merge-overview__action-line">
              <span className="merge-overview__side-label">Theirs:</span>
              <span>{theirsLabel}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  const actions = oursHasActions ? props.oursActions : props.theirsActions;
  const side = oursHasActions ? 'ours' : 'theirs';

  return (
    <div className="merge-overview__details">
      <div className={`merge-overview__side-detail merge-overview__side-detail--${side}`}>
        <div className="merge-overview__action-line">
          <span>{actions.map(formatAction).join(', ')}</span>
        </div>
      </div>
    </div>
  );
}

function formatAction(action: string): string {
  switch (action) {
    case 'added':
      return 'Added';
    case 'removed':
      return 'Removed';
    case 'updated':
      return 'Modified';
    case 'layoutChanged':
      return 'Layout changed';
    default:
      return action;
  }
}
