import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Icon } from '#components/Icon';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';

import React from 'react';

import { CustomPropertyChangeOverviewGroup, changeSummaryHasAnySemanticChange } from '../../bpmn-core/diff';
import type {
  ChangeSummary,
  ChangeSummaryEntry,
  DefinitionsMetadataChange,
  LinterScoreChange,
  ModifiedEntry,
} from '../../bpmn-core/diff';

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  return (
    editorDocument != null &&
    (editorDocument.modelKey === 'BpmnDiffDocumentModel' ||
      editorDocument.modelKey === 'BpmnHistoryPreviewDocumentModel') &&
    editorDocumentModel != null
  );
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed} />
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

export function getPaneTitle(): string {
  return 'Change Overview';
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  if (props.editorDocumentModel == null) {
    return null;
  }

  const summary: ChangeSummary | null = props.editorDocumentModel.getChangeSummary?.();
  if (summary == null) {
    return <PaneBody>Loading...</PaneBody>;
  }

  if (!changeSummaryHasAnySemanticChange(summary)) {
    return <PaneBody>No changes detected.</PaneBody>;
  }

  const handleClick = (elementId: string): void => {
    props.editorDocumentModel?.selectElements?.([elementId]);
  };

  return (
    <PaneBody>
      <div className="change-overview">
        {summary.definitionsMetadata.length > 0 && <DefinitionsMetadataSection rows={summary.definitionsMetadata} />}
        {summary.linterScoreChanges.length > 0 && <LinterScoreSection changes={summary.linterScoreChanges} />}
        {summary.added.length > 0 && (
          <ChangeSection
            title={`Added (${summary.added.length})`}
            icon="bpmn-diff/element/added"
            legendClass="bpmn-diff-legend--added"
            entries={summary.added}
            onClick={handleClick}
          />
        )}
        {summary.removed.length > 0 && (
          <ChangeSection
            title={`Removed (${summary.removed.length})`}
            icon="bpmn-diff/element/deleted"
            legendClass="bpmn-diff-legend--deleted"
            entries={summary.removed}
            onClick={handleClick}
          />
        )}
        {summary.modified.length > 0 && (
          <ModifiedSection
            title={`Modified (${summary.modified.length})`}
            entries={summary.modified}
            onClick={handleClick}
          />
        )}
        {summary.layoutChanged.length > 0 && (
          <ChangeSection
            title={`Layout Changed (${summary.layoutChanged.length})`}
            icon="bpmn-diff/element/moved"
            legendClass="bpmn-diff-legend--moved"
            entries={summary.layoutChanged}
            onClick={handleClick}
          />
        )}
      </div>
    </PaneBody>
  );
}

type ChangeSectionProps = {
  title: string;
  icon: string;
  legendClass: string;
  entries: ChangeSummaryEntry[];
  onClick: (elementId: string) => void;
};

function ChangeSection(props: ChangeSectionProps): React.JSX.Element {
  return (
    <div className="change-overview__section">
      <h4 className="change-overview__section-title">
        <span className={`bpmn-diff-legend ${props.legendClass}`}>
          <Icon id={props.icon} />
        </span>{' '}
        {props.title}
      </h4>
      <ul className="change-overview__list">
        {props.entries.map((entry) => (
          <li key={entry.id} className="change-overview__entry" onClick={() => props.onClick(entry.id)}>
            <span className="change-overview__entry-name">{entry.displayName}</span>
            <CustomPropertyChangeOverviewGroup changes={entry.customPropertyChanges} variant="change-overview" />
          </li>
        ))}
      </ul>
    </div>
  );
}

type ModifiedSectionProps = {
  title: string;
  entries: ModifiedEntry[];
  onClick: (elementId: string) => void;
};

function ModifiedSection(props: ModifiedSectionProps): React.JSX.Element {
  return (
    <div className="change-overview__section">
      <h4 className="change-overview__section-title">
        <span className="bpmn-diff-legend bpmn-diff-legend--updated">
          <Icon id="bpmn-diff/element/updated" />
        </span>{' '}
        {props.title}
      </h4>
      <ul className="change-overview__list">
        {props.entries.map((entry) => (
          <li key={entry.id} className="change-overview__entry" onClick={() => props.onClick(entry.id)}>
            <span className="change-overview__entry-name">{entry.displayName}</span>
            {entry.attributeChanges.length > 0 && (
              <ul className="change-overview__attrs">
                {entry.attributeChanges.map((attr) => (
                  <li key={attr.attribute} className="change-overview__attr">
                    {attr.attribute}: {formatValue(attr.oldValue)} → {formatValue(attr.newValue)}
                  </li>
                ))}
              </ul>
            )}
            <CustomPropertyChangeOverviewGroup changes={entry.customPropertyChanges} variant="change-overview" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatValue(value: string | undefined): string {
  if (value == null) {
    return '(none)';
  }
  if (value.includes('\n')) {
    return '(complex value)';
  }
  return `'${value}'`;
}

function DefinitionsMetadataSection(props: { rows: DefinitionsMetadataChange[] }): React.JSX.Element {
  return (
    <div className="change-overview__section">
      <h4 className="change-overview__section-title">
        <span className="bpmn-diff-legend bpmn-diff-legend--updated">
          <Icon id="ph ph-file-dashed" />
        </span>{' '}
        Definitions / file metadata ({props.rows.length})
      </h4>
      <ul className="change-overview__list">
        {props.rows.map((row) => (
          <li key={row.attribute} className="change-overview__entry change-overview__entry--non-nav">
            <span className="change-overview__entry-name">{row.label}</span>
            <ul className="change-overview__attrs">
              <li className="change-overview__attr">
                {formatValue(row.oldValue)} → {formatValue(row.newValue)}
              </li>
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LinterScoreSection(props: { changes: LinterScoreChange[] }): React.JSX.Element {
  return (
    <div className="change-overview__section">
      <h4 className="change-overview__section-title">
        <span className="bpmn-diff-legend bpmn-diff-legend--updated">
          <Icon id="ph ph-seal-check" />
        </span>{' '}
        Linter Scores ({props.changes.length})
      </h4>
      <ul className="change-overview__list">
        {props.changes.map((change) => (
          <li key={change.rulesetId} className="change-overview__entry change-overview__entry--non-nav">
            <span className="change-overview__entry-name">
              {change.rulesetId}
              {change.kind !== 'changed' && (
                <span className={`bpmn-diff-linter-kind bpmn-diff-linter-kind--${change.kind}`}>
                  {change.kind === 'added' ? ' (added)' : ' (removed)'}
                </span>
              )}
            </span>
            <ul className="change-overview__attrs">
              {change.propertyChanges.map((prop) => (
                <li key={prop.property} className="change-overview__attr">
                  {prop.label}: {formatValue(prop.oldValue)} → {formatValue(prop.newValue)}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
