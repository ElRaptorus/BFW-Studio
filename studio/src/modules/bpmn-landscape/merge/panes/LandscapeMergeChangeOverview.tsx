import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import {
  EVENT_MERGE_FILE_CHANGED,
  EVENT_RESOLUTION_CHANGED,
  type ElementResolutionStatus,
  type MergeResolutionProgress,
  type MergeResolverHost,
} from '#bifrost/contracts/MergeTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Icon } from '#components/Icon';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';

import React, { useEffect, useState } from 'react';

import type { LandscapeClassifiedItem } from '../LandscapeMergeResolver';

export const paneProvider: PaneProvider = {
  getPaneTitle: () => 'Merge Changes',
  shouldBeDisplayed: (document: EditorDocument, model: MergeResolverHost) =>
    document?.modelKey === 'MergeDocumentModel' && model?.currentFileType === 'landscape',
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
  const model = props.editorDocumentModel as MergeResolverHost | null;
  const resolverApi = model?.resolverRef?.current;

  const [elements, setElements] = useState<LandscapeClassifiedItem[]>(
    () => resolverApi?.getClassifiedElements?.() ?? [],
  );
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
    const fileChanged = model.on(EVENT_MERGE_FILE_CHANGED, () => {
      setElements(model.resolverRef?.current?.getClassifiedElements?.() ?? []);
      setResolutionProgress(model.getResolutionProgress());
    });
    // Invariant conflicts can appear after a resolution, so the list is read again as well.
    const resolutionChanged = model.on(EVENT_RESOLUTION_CHANGED, () => {
      setElements(model.resolverRef?.current?.getClassifiedElements?.() ?? []);
      setResolutionProgress(model.getResolutionProgress());
      setRenderTick((prev) => prev + 1);
    });
    return () => {
      fileChanged.dispose();
      resolutionChanged.dispose();
    };
  }, [model]);

  const allResolutions = resolverApi?.getAllResolutions?.() ?? [];
  const idsWithStatus = (...statuses: ElementResolutionStatus[]) =>
    new Set(
      allResolutions
        .filter((resolution) => statuses.includes(resolution.status))
        .map((resolution) => resolution.elementId),
    );
  const autoAppliedIds = idsWithStatus('auto-applied');
  const revertedIds = idsWithStatus('reverted');
  const conflictIds = idsWithStatus('pending', 'accepted-ours', 'accepted-theirs');

  const conflicts = elements.filter((element) => conflictIds.has(element.elementId));
  const autoApplied = elements.filter((element) => autoAppliedIds.has(element.elementId));
  const reverted = elements.filter((element) => revertedIds.has(element.elementId));
  const sideOnly = (classification: LandscapeClassifiedItem['classification']) =>
    elements.filter(
      (element) =>
        element.classification === classification &&
        !autoAppliedIds.has(element.elementId) &&
        !revertedIds.has(element.elementId),
    );

  const select = (elementId: string) => resolverApi?.selectElements?.([elementId]);

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
        <SectionHeader badgeClass="merge-status-badge--conflict" count={conflicts.length} title="Conflicts">
          {conflicts.map((element) => {
            const status: ElementResolutionStatus | null =
              resolverApi?.getResolutionStatus?.(element.elementId) ?? null;
            return (
              <Entry
                key={element.elementId}
                element={element}
                onClick={select}
                dataTest={{ 'data-test--landscape-merge-conflict': element.elementId }}
              >
                {status != null && (
                  <div className="merge-overview__entry-status-row">
                    <ResolutionBadge status={status} />
                  </div>
                )}
                <ConflictActions
                  status={status}
                  onAcceptOurs={() => resolverApi?.acceptOursForKey?.(element.elementId)}
                  onAcceptTheirs={() => resolverApi?.acceptTheirsForKey?.(element.elementId)}
                  onUndo={() => resolverApi?.undoConflictResolution?.(element.elementId)}
                />
              </Entry>
            );
          })}
        </SectionHeader>
      )}
      {(autoApplied.length > 0 || reverted.length > 0) && (
        <SectionHeader
          badgeClass="merge-status-badge--auto"
          count={autoApplied.length + reverted.length}
          title="Auto-applied"
        >
          {autoApplied.map((element) => {
            const source = element.classification === 'ours-only' ? 'Ours' : 'Theirs';
            const restoreSide = source === 'Ours' ? 'theirs' : 'ours';
            return (
              <Entry
                key={element.elementId}
                element={element}
                onClick={select}
                badge={
                  <span className="merge-overview__resolution-badge merge-overview__resolution-badge--auto">
                    {source}
                  </span>
                }
                dataTest={{ 'data-test--landscape-merge-auto-applied': element.elementId }}
              >
                <EntryButton
                  modifier="revert"
                  icon="ph ph-arrow-counter-clockwise"
                  label={`Restore ${restoreSide}`}
                  onClick={() => resolverApi?.revertAutoApplied?.(element.elementId)}
                />
              </Entry>
            );
          })}
          {reverted.map((element) => {
            const source = element.classification === 'ours-only' ? 'ours' : 'theirs';
            const currentSide = source === 'ours' ? 'Theirs' : 'Ours';
            return (
              <Entry
                key={element.elementId}
                element={element}
                onClick={select}
                reverted={true}
                badge={
                  <span className="merge-overview__resolution-badge merge-overview__resolution-badge--reverted">
                    {currentSide}
                  </span>
                }
              >
                <EntryButton
                  modifier="reapply"
                  icon="ph ph-arrow-clockwise"
                  label={`Reapply ${source}`}
                  onClick={() => resolverApi?.reapplyAutoApplied?.(element.elementId)}
                />
              </Entry>
            );
          })}
        </SectionHeader>
      )}
      {(['ours-only', 'theirs-only'] as const).map((classification) => {
        const items = sideOnly(classification);
        const isOurs = classification === 'ours-only';
        return (
          items.length > 0 && (
            <SectionHeader
              key={classification}
              badgeClass={isOurs ? 'merge-status-badge--ours' : 'merge-status-badge--theirs'}
              count={items.length}
              title={isOurs ? 'Ours only' : 'Theirs only'}
            >
              {items.map((element) => (
                <Entry key={element.elementId} element={element} onClick={select} />
              ))}
            </SectionHeader>
          )
        );
      })}
      {elements.length === 0 && <div className="merge-overview__empty">No changes detected.</div>}
    </div>
  );
}

function SectionHeader(props: {
  badgeClass: string;
  count: number;
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="merge-overview__section">
      <div className="merge-overview__section-header">
        <span className={`merge-overview__badge ${props.badgeClass}`}>{props.count}</span>
        <span>{props.title}</span>
      </div>
      <ul className="merge-overview__list">{props.children}</ul>
    </div>
  );
}

function Entry(props: {
  element: LandscapeClassifiedItem;
  onClick: (elementId: string) => void;
  badge?: React.ReactNode;
  reverted?: boolean;
  dataTest?: Record<string, string>;
  children?: React.ReactNode;
}): React.JSX.Element {
  const { element } = props;
  return (
    <li
      className={`merge-overview__entry${props.reverted === true ? ' merge-overview__entry--reverted' : ''}`}
      onClick={() => props.onClick(element.elementId)}
      {...props.dataTest}
    >
      <div className="merge-overview__entry-header">
        <span className="merge-overview__entry-type">{element.type}</span>
        <span className="merge-overview__entry-name">{element.displayName}</span>
        {props.badge}
      </div>
      {props.children}
      <ActionDetails element={element} />
    </li>
  );
}

function EntryButton(props: {
  modifier: string;
  icon: string;
  label: string;
  dataTest?: Record<string, string>;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      className={`merge-overview__action-button merge-overview__action-button--${props.modifier}`}
      title={props.label}
      onClick={(event) => {
        event.stopPropagation();
        props.onClick();
      }}
      {...props.dataTest}
    >
      <Icon id={props.icon} /> {props.label}
    </button>
  );
}

function ConflictActions(props: {
  status: ElementResolutionStatus | null;
  onAcceptOurs: () => void;
  onAcceptTheirs: () => void;
  onUndo: () => void;
}): React.JSX.Element | null {
  if (props.status === 'pending') {
    return (
      <div className="merge-overview__entry-actions">
        <EntryButton
          modifier="ours"
          icon="ph ph-check"
          label="Ours"
          onClick={props.onAcceptOurs}
          dataTest={{ 'data-test--landscape-merge-accept-ours': '' }}
        />
        <EntryButton
          modifier="theirs"
          icon="ph ph-check"
          label="Theirs"
          onClick={props.onAcceptTheirs}
          dataTest={{ 'data-test--landscape-merge-accept-theirs': '' }}
        />
      </div>
    );
  }
  if (props.status === 'accepted-ours' || props.status === 'accepted-theirs') {
    return (
      <div className="merge-overview__entry-actions">
        <EntryButton
          modifier="undo"
          icon="ph ph-arrow-counter-clockwise"
          label="Undo"
          onClick={props.onUndo}
          dataTest={{ 'data-test--landscape-merge-undo': '' }}
        />
      </div>
    );
  }
  return null;
}

function ResolutionBadge(props: { status: ElementResolutionStatus }): React.JSX.Element {
  const badges: Partial<Record<ElementResolutionStatus, [label: string, modifier: string]>> = {
    'auto-applied': ['Auto', 'auto'],
    'accepted-ours': ['Ours', 'resolved-ours'],
    'accepted-theirs': ['Theirs', 'resolved-theirs'],
    reverted: ['Reverted', 'reverted'],
  };
  const [label, modifier] = badges[props.status] ?? ['Pending', 'pending'];
  return (
    <span className={`merge-overview__resolution-badge merge-overview__resolution-badge--${modifier}`}>{label}</span>
  );
}

function ActionDetails(props: { element: LandscapeClassifiedItem }): React.JSX.Element | null {
  const { oursActions, theirsActions } = props.element;
  const sides = [
    ['ours', 'Ours:', oursActions],
    ['theirs', 'Theirs:', theirsActions],
  ] as const;
  const shown = sides.filter(([, , actions]) => actions.length > 0);
  if (shown.length === 0) {
    return null;
  }
  return (
    <div className="merge-overview__details">
      {shown.map(([side, label, actions]) => (
        <div key={side} className={`merge-overview__side-detail merge-overview__side-detail--${side}`}>
          <div className="merge-overview__action-line">
            {shown.length > 1 && <span className="merge-overview__side-label">{label}</span>}
            <span>{actions.map(formatAction).join(', ')}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function formatAction(action: string): string {
  const labels: Record<string, string> = {
    added: 'Added',
    removed: 'Removed',
    updated: 'Modified',
    layoutChanged: 'Layout changed',
  };
  return labels[action] ?? action;
}
