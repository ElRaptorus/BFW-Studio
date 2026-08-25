import { EVENT_MERGE_FILE_CHANGED, EVENT_RESOLUTION_CHANGED } from '#modules/git-cruiser/GitTypes';
import type BpmnMergeResultModeler from '#modules/git-cruiser/merge/MergeDocumentModel';

import React, { useEffect, useState } from 'react';

import type {
  ConflictKey,
  EditorDocument,
  ElementResolutionStatus,
  MergeResolutionProgress,
  PaneComponentProps,
  PaneProvider,
} from '@evil/bifrost_fw_sdk';
import { Icon, Pane, PaneBody, PaneHeader } from '@evil/bifrost_fw_sdk';

import {
  CustomPropertyChangeOverviewGroup,
  type DefinitionsMetadataChange,
  type LinterScoreChange,
} from '../../../bpmn-core/diff';
import type { ClassifiedElement, MergeSideDetail } from '../BpmnMergeResolver';
import { makeBaseKey, parseConflictKey } from '../BpmnMergeResultModeler';

export const paneProvider: PaneProvider = {
  getPaneTitle: () => 'Merge Changes',
  shouldBeDisplayed: (document: EditorDocument, model: BpmnMergeResultModeler) =>
    document?.modelKey === 'MergeDocumentModel' && model?.currentFileType === 'bpmn',
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
  const model = props.editorDocumentModel as BpmnMergeResultModeler | null;
  const resolverApi = model?.resolverRef?.current;

  const [elements, setElements] = useState<ClassifiedElement[]>(() => resolverApi?.getClassifiedElements() ?? []);
  const [resolutionProgress, setResolutionProgress] = useState<MergeResolutionProgress | null>(
    () => model?.getResolutionProgress() ?? null,
  );
  const [renderTick, setRenderTick] = useState(0);
  const [prevModel, setPrevModel] = useState(model);

  if (model !== prevModel) {
    setPrevModel(model);
    setElements(resolverApi?.getClassifiedElements() ?? []);
    setResolutionProgress(model?.getResolutionProgress() ?? null);
  }

  useEffect(() => {
    if (model == null) {
      return;
    }

    const sub1 = model.on(EVENT_MERGE_FILE_CHANGED, () => {
      const api = model.resolverRef?.current;
      setElements(api?.getClassifiedElements() ?? []);
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
    allResolutions.filter((res) => res.status === 'auto-applied').map((res) => res.elementId),
  );
  const revertedIds = new Set(allResolutions.filter((res) => res.status === 'reverted').map((res) => res.elementId));
  const autoAppliedElements = elements.filter((el) => autoAppliedIds.has(el.elementId));
  const revertedElements = elements.filter((el) => revertedIds.has(el.elementId));

  const oursOnly = elements.filter((el) => el.classification === 'ours-only' && !autoAppliedIds.has(el.elementId));
  const theirsOnly = elements.filter((el) => el.classification === 'theirs-only' && !autoAppliedIds.has(el.elementId));
  const conflicts = elements.filter((el) => el.classification === 'both');

  const getResolutionStatus = (key: ConflictKey): ElementResolutionStatus | null =>
    resolverApi?.getResolutionStatus?.(key) ?? null;

  const getConflictKeysForElement = (elementId: string): ConflictKey[] =>
    resolverApi?.getConflictKeysForElement?.(elementId) ?? [];

  const handleClick = (elementId: string) => {
    resolverApi?.selectElements([elementId]);
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

  const defsOurs: DefinitionsMetadataChange[] = resolverApi?.getDefinitionsMetadataOurs() ?? [];
  const defsTheirs: DefinitionsMetadataChange[] = resolverApi?.getDefinitionsMetadataTheirs() ?? [];
  const linterScoresOurs: LinterScoreChange[] = resolverApi?.getLinterScoreChangesOurs?.() ?? [];
  const linterScoresTheirs: LinterScoreChange[] = resolverApi?.getLinterScoreChangesTheirs?.() ?? [];
  const hasPerElementResolution = resolverApi?.getResolutionStatus != null;

  const oursDefsCount = defsOurs.length + linterScoresOurs.length;
  const theirsDefsCount = defsTheirs.length + linterScoresTheirs.length;

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
          getConflictKeysForElement={hasPerElementResolution ? getConflictKeysForElement : undefined}
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
      {(oursOnly.length > 0 || oursDefsCount > 0) && (
        <Section
          title="Ours only"
          badgeClass="merge-status-badge--ours"
          count={oursOnly.length + oursDefsCount}
          elements={oursOnly}
          onClick={handleClick}
          definitionsMetadata={defsOurs}
          linterScoreChanges={linterScoresOurs}
        />
      )}
      {(theirsOnly.length > 0 || theirsDefsCount > 0) && (
        <Section
          title="Theirs only"
          badgeClass="merge-status-badge--theirs"
          count={theirsOnly.length + theirsDefsCount}
          elements={theirsOnly}
          onClick={handleClick}
          definitionsMetadata={defsTheirs}
          linterScoreChanges={linterScoresTheirs}
        />
      )}
      {elements.length === 0 && oursDefsCount === 0 && theirsDefsCount === 0 && (
        <div className="merge-overview__empty">No changes detected.</div>
      )}
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

// --- Conflict section: per-attribute sub-entries ---

function ConflictSection(props: {
  elements: ClassifiedElement[];
  onClick: (elementId: string) => void;
  onAcceptOursForKey?: (key: ConflictKey) => void;
  onAcceptTheirsForKey?: (key: ConflictKey) => void;
  onUndoResolution?: (key: ConflictKey) => void;
  getResolutionStatus?: (key: ConflictKey) => ElementResolutionStatus | null;
  getConflictKeysForElement?: (elementId: string) => ConflictKey[];
}): React.JSX.Element {
  const totalKeys = props.elements.reduce((sum, el) => {
    const keys = props.getConflictKeysForElement?.(el.elementId) ?? [makeBaseKey(el.elementId)];
    return sum + keys.length;
  }, 0);

  return (
    <div className="merge-overview__section">
      <div className="merge-overview__section-header">
        <span className="merge-overview__badge merge-status-badge--conflict">{totalKeys}</span>
        <span>Conflicts</span>
      </div>
      <ul className="merge-overview__list">
        {props.elements.map((element) => (
          <ConflictElement
            key={element.elementId}
            element={element}
            onClick={props.onClick}
            onAcceptOursForKey={props.onAcceptOursForKey}
            onAcceptTheirsForKey={props.onAcceptTheirsForKey}
            onUndoResolution={props.onUndoResolution}
            getResolutionStatus={props.getResolutionStatus}
            conflictKeys={props.getConflictKeysForElement?.(element.elementId) ?? [makeBaseKey(element.elementId)]}
          />
        ))}
      </ul>
    </div>
  );
}

function ConflictElement(props: {
  element: ClassifiedElement;
  onClick: (elementId: string) => void;
  onAcceptOursForKey?: (key: ConflictKey) => void;
  onAcceptTheirsForKey?: (key: ConflictKey) => void;
  onUndoResolution?: (key: ConflictKey) => void;
  getResolutionStatus?: (key: ConflictKey) => ElementResolutionStatus | null;
  conflictKeys: ConflictKey[];
}): React.JSX.Element {
  const { element, conflictKeys, getResolutionStatus } = props;

  const baseKey = conflictKeys.find((key) => parseConflictKey(key).propertyName == null);
  const cpKeys = conflictKeys.filter((key) => parseConflictKey(key).propertyName != null);
  const hasSingleKey = conflictKeys.length === 1;

  return (
    <li className="merge-overview__entry" onClick={() => props.onClick(element.elementId)}>
      <div className="merge-overview__entry-header">
        <span className="merge-overview__entry-type">{element.type}</span>
        <span className="merge-overview__entry-name">{element.displayName}</span>
      </div>

      {hasSingleKey ? (
        <SingleConflictKey
          conflictKey={conflictKeys[0]}
          element={element}
          getResolutionStatus={getResolutionStatus}
          onAcceptOursForKey={props.onAcceptOursForKey}
          onAcceptTheirsForKey={props.onAcceptTheirsForKey}
          onUndoResolution={props.onUndoResolution}
        />
      ) : (
        <>
          {baseKey != null && (
            <ConflictSubEntry
              label="Base properties"
              conflictKey={baseKey}
              getResolutionStatus={getResolutionStatus}
              onAcceptOursForKey={props.onAcceptOursForKey}
              onAcceptTheirsForKey={props.onAcceptTheirsForKey}
              onUndoResolution={props.onUndoResolution}
            >
              <BasePropertyDetails element={element} />
            </ConflictSubEntry>
          )}
          {cpKeys.map((cpKey) => {
            const { propertyName } = parseConflictKey(cpKey);
            return (
              <ConflictSubEntry
                key={cpKey}
                label={`Custom property: ${propertyName}`}
                conflictKey={cpKey}
                getResolutionStatus={getResolutionStatus}
                onAcceptOursForKey={props.onAcceptOursForKey}
                onAcceptTheirsForKey={props.onAcceptTheirsForKey}
                onUndoResolution={props.onUndoResolution}
              >
                <CustomPropertyConflictDetails element={element} propertyName={propertyName!} />
              </ConflictSubEntry>
            );
          })}
        </>
      )}
    </li>
  );
}

function SingleConflictKey(props: {
  conflictKey: ConflictKey;
  element: ClassifiedElement;
  getResolutionStatus?: (key: ConflictKey) => ElementResolutionStatus | null;
  onAcceptOursForKey?: (key: ConflictKey) => void;
  onAcceptTheirsForKey?: (key: ConflictKey) => void;
  onUndoResolution?: (key: ConflictKey) => void;
}): React.JSX.Element {
  const status = props.getResolutionStatus?.(props.conflictKey) ?? null;
  return (
    <>
      {status != null && (
        <div className="merge-overview__entry-status-row">
          <ResolutionBadge status={status} />
        </div>
      )}
      <ConflictKeyActions
        conflictKey={props.conflictKey}
        status={status}
        onAcceptOursForKey={props.onAcceptOursForKey}
        onAcceptTheirsForKey={props.onAcceptTheirsForKey}
        onUndoResolution={props.onUndoResolution}
      />
      <ElementDetails element={props.element} />
    </>
  );
}

function ConflictSubEntry(props: {
  label: string;
  conflictKey: ConflictKey;
  getResolutionStatus?: (key: ConflictKey) => ElementResolutionStatus | null;
  onAcceptOursForKey?: (key: ConflictKey) => void;
  onAcceptTheirsForKey?: (key: ConflictKey) => void;
  onUndoResolution?: (key: ConflictKey) => void;
  children?: React.ReactNode;
}): React.JSX.Element {
  const status = props.getResolutionStatus?.(props.conflictKey) ?? null;

  return (
    <div className="merge-overview__sub-entry">
      <div className="merge-overview__sub-entry-header">
        <span className="merge-overview__sub-entry-label">{props.label}</span>
        {status != null && <ResolutionBadge status={status} />}
      </div>
      <ConflictKeyActions
        conflictKey={props.conflictKey}
        status={status}
        onAcceptOursForKey={props.onAcceptOursForKey}
        onAcceptTheirsForKey={props.onAcceptTheirsForKey}
        onUndoResolution={props.onUndoResolution}
      />
      {props.children}
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
          onClick={(ev) => {
            ev.stopPropagation();
            props.onAcceptOursForKey!(props.conflictKey);
          }}
        >
          <Icon id="ph ph-check" /> Ours
        </button>
        <button
          className="merge-overview__action-button merge-overview__action-button--theirs"
          title="Accept theirs"
          onClick={(ev) => {
            ev.stopPropagation();
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
          onClick={(ev) => {
            ev.stopPropagation();
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

function BasePropertyDetails(props: { element: ClassifiedElement }): React.JSX.Element | null {
  const { ours, theirs } = props.element;
  const oursHasBase = ours != null && (ours.actions.length > 0 || ours.attributeChanges.length > 0);
  const theirsHasBase = theirs != null && (theirs.actions.length > 0 || theirs.attributeChanges.length > 0);

  if (!oursHasBase && !theirsHasBase) {
    return null;
  }

  return (
    <div className="merge-overview__details">
      {oursHasBase && ours != null && <SideDetail label="Ours" side="ours" detail={ours} showCp={false} />}
      {theirsHasBase && theirs != null && <SideDetail label="Theirs" side="theirs" detail={theirs} showCp={false} />}
    </div>
  );
}

function CustomPropertyConflictDetails(props: {
  element: ClassifiedElement;
  propertyName: string;
}): React.JSX.Element | null {
  const { ours, theirs } = props.element;
  const oursCp = ours?.customPropertyChanges.find((cp) => cp.propertyName === props.propertyName);
  const theirsCp = theirs?.customPropertyChanges.find((cp) => cp.propertyName === props.propertyName);

  if (oursCp == null && theirsCp == null) {
    return null;
  }

  return (
    <div className="merge-overview__details">
      {oursCp != null && (
        <div className="merge-overview__side-detail merge-overview__side-detail--ours">
          <span className="merge-overview__side-label">Ours:</span> <span>{formatCpChange(oursCp)}</span>
        </div>
      )}
      {theirsCp != null && (
        <div className="merge-overview__side-detail merge-overview__side-detail--theirs">
          <span className="merge-overview__side-label">Theirs:</span> <span>{formatCpChange(theirsCp)}</span>
        </div>
      )}
    </div>
  );
}

function formatCpChange(cp: { kind: string; oldValue?: string; newValue?: string }): string {
  switch (cp.kind) {
    case 'added':
      return `Added: ${formatValue(cp.newValue)}`;
    case 'removed':
      return `Removed`;
    case 'changed':
      return `${formatValue(cp.oldValue)} → ${formatValue(cp.newValue)}`;
    default:
      return cp.kind;
  }
}

// --- Non-conflict sections ---

function Section(props: {
  title: string;
  badgeClass: string;
  count: number;
  elements: ClassifiedElement[];
  onClick: (elementId: string) => void;
  definitionsMetadata?: DefinitionsMetadataChange[];
  linterScoreChanges?: LinterScoreChange[];
}): React.JSX.Element {
  return (
    <div className="merge-overview__section">
      <div className="merge-overview__section-header">
        <span className={`merge-overview__badge ${props.badgeClass}`}>{props.count}</span>
        <span>{props.title}</span>
      </div>
      <ul className="merge-overview__list">
        {props.definitionsMetadata != null &&
          props.definitionsMetadata.map((row) => (
            <li key={`def-${row.attribute}`} className="merge-overview__entry merge-overview__entry--non-nav">
              <div className="merge-overview__entry-header">
                <span className="merge-overview__entry-type">Definitions</span>
                <span className="merge-overview__entry-name">{row.label}</span>
              </div>
              <ul className="merge-overview__attrs">
                <li className="merge-overview__attr">
                  {formatValue(row.oldValue)} → {formatValue(row.newValue)}
                </li>
              </ul>
            </li>
          ))}
        {props.linterScoreChanges != null &&
          props.linterScoreChanges.map((change) => (
            <li key={`lint-${change.rulesetId}`} className="merge-overview__entry merge-overview__entry--non-nav">
              <div className="merge-overview__entry-header">
                <span className="merge-overview__entry-type">Linter Score</span>
                <span className="merge-overview__entry-name">{change.rulesetId}</span>
              </div>
              <ul className="merge-overview__attrs">
                {change.propertyChanges.map((prop) => (
                  <li key={prop.property} className="merge-overview__attr">
                    {prop.label}: {formatValue(prop.oldValue)} → {formatValue(prop.newValue)}
                  </li>
                ))}
              </ul>
            </li>
          ))}
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
            <ElementDetails element={element} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function AutoAppliedSection(props: {
  elements: ClassifiedElement[];
  revertedElements: ClassifiedElement[];
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
                    onClick={(ev) => {
                      ev.stopPropagation();
                      props.onRevert!(element.elementId);
                    }}
                  >
                    <Icon id="ph ph-arrow-counter-clockwise" /> Restore {restoreSide.toLowerCase()}
                  </button>
                </div>
              )}
              <ElementDetails element={element} />
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
                    onClick={(ev) => {
                      ev.stopPropagation();
                      props.onReapply!(element.elementId);
                    }}
                  >
                    <Icon id="ph ph-arrow-clockwise" /> Reapply {source.toLowerCase()}
                  </button>
                </div>
              )}
              <ElementDetails element={element} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// --- Shared detail renderers ---

function ElementDetails(props: { element: ClassifiedElement }): React.JSX.Element | null {
  const { ours, theirs, classification } = props.element;

  if (classification === 'both') {
    return (
      <div className="merge-overview__details">
        {ours && <SideDetail label="Ours" side="ours" detail={ours} />}
        {theirs && <SideDetail label="Theirs" side="theirs" detail={theirs} />}
      </div>
    );
  }

  const detail = ours ?? theirs;
  if (
    detail == null ||
    (detail.actions.length === 0 && detail.attributeChanges.length === 0 && detail.customPropertyChanges.length === 0)
  ) {
    return null;
  }

  return (
    <div className="merge-overview__details">
      <SideDetail detail={detail} />
    </div>
  );
}

function SideDetail(props: {
  label?: string;
  side?: string;
  detail: MergeSideDetail;
  showCp?: boolean;
}): React.JSX.Element {
  const { label, side, detail, showCp = true } = props;
  const actionLabel = detail.actions.map(formatAction).join(', ');

  return (
    <div className={`merge-overview__side-detail ${side ? `merge-overview__side-detail--${side}` : ''}`}>
      <div className="merge-overview__action-line">
        {label && <span className="merge-overview__side-label">{label}:</span>}
        <span>{actionLabel}</span>
      </div>
      {detail.attributeChanges.length > 0 && (
        <ul className="merge-overview__attrs">
          {detail.attributeChanges.map((attr) => (
            <li key={attr.attribute} className="merge-overview__attr">
              <span className="merge-overview__attr-name">{attr.attribute}:</span> {formatValue(attr.oldValue)} →{' '}
              {formatValue(attr.newValue)}
            </li>
          ))}
        </ul>
      )}
      {showCp && <CustomPropertyChangeOverviewGroup changes={detail.customPropertyChanges} variant="bpmn-merge" />}
    </div>
  );
}

function formatAction(action: string): string {
  switch (action) {
    case 'added':
      return 'Added';
    case 'deleted':
      return 'Removed';
    case 'updated':
      return 'Modified';
    case 'moved':
      return 'Layout changed';
    default:
      return action;
  }
}

function formatValue(value: string | undefined): string {
  if (value == null) {
    return '(none)';
  }
  if (value.includes('\n')) {
    return '(complex value)';
  }
  if (value.length > 40) {
    return `'${value.substring(0, 37)}...'`;
  }
  return `'${value}'`;
}
