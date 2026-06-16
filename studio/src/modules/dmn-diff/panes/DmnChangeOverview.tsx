import React from 'react';

import type { EditorDocument, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { Icon, Pane, PaneBody, PaneHeader } from '@evil/bifrost_fw_sdk';

import { dmnChangeSummaryHasAnyChange } from '../../dmn-core/diff';
import type { DmnChangeSummary, DmnChangeSummaryEntry, DmnModifiedEntry } from '../../dmn-core/diff';

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  return (
    editorDocument != null &&
    editorDocumentModel != null &&
    (editorDocument.modelKey === 'DmnDiffDocumentModel' || editorDocument.modelKey === 'DmnHistoryPreviewDocumentModel')
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

function getPaneTitle(): string {
  return 'Change Overview';
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  if (props.editorDocumentModel == null) {
    return null;
  }

  const summary: DmnChangeSummary | null = props.editorDocumentModel.getChangeSummary?.();
  if (summary == null) {
    return <PaneBody>Loading...</PaneBody>;
  }

  if (!dmnChangeSummaryHasAnyChange(summary)) {
    return <PaneBody>No changes detected.</PaneBody>;
  }

  const handleClick = (elementId: string): void => {
    props.editorDocumentModel?.selectElements?.([elementId]);
  };

  return (
    <PaneBody>
      <div className="change-overview">
        {summary.added.length > 0 && (
          <ChangeSection
            title={`Added (${summary.added.length})`}
            icon="dmn-diff/element/added"
            legendClass="bpmn-diff-legend--added"
            entries={summary.added}
            onClick={handleClick}
          />
        )}
        {summary.removed.length > 0 && (
          <ChangeSection
            title={`Removed (${summary.removed.length})`}
            icon="dmn-diff/element/deleted"
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
            icon="dmn-diff/element/moved"
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
  entries: DmnChangeSummaryEntry[];
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
          </li>
        ))}
      </ul>
    </div>
  );
}

type ModifiedSectionProps = {
  title: string;
  entries: DmnModifiedEntry[];
  onClick: (elementId: string) => void;
};

function ModifiedSection(props: ModifiedSectionProps): React.JSX.Element {
  return (
    <div className="change-overview__section">
      <h4 className="change-overview__section-title">
        <span className="bpmn-diff-legend bpmn-diff-legend--updated">
          <Icon id="dmn-diff/element/updated" />
        </span>{' '}
        {props.title}
      </h4>
      <ul className="change-overview__list">
        {props.entries.map((entry) => (
          <li key={entry.id} className="change-overview__entry" onClick={() => props.onClick(entry.id)}>
            <span className="change-overview__entry-name">{entry.displayName}</span>
            {entry.attributeChanges.length > 0 && (
              <ul className="change-overview__attrs">
                {entry.attributeChanges.map((attributeChange) => (
                  <li key={attributeChange.attribute} className="change-overview__attr">
                    {attributeChange.attribute}: {formatValue(attributeChange.oldValue)} →{' '}
                    {formatValue(attributeChange.newValue)}
                  </li>
                ))}
              </ul>
            )}
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
