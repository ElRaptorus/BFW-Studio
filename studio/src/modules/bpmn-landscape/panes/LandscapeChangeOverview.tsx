import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Icon } from '#components/Icon';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { formatSummaryValueForDisplay } from '#modules/bpmn-core/diff/changeSummaryBuilder';

import React from 'react';

import type LandscapeDiffDocumentModel from '../diff/LandscapeDiffDocumentModel';
import type { LandscapeItemChange, LandscapePropertyChange } from '../diff/landscapeMapDiff';

export const paneProvider: PaneProvider = {
  getPaneTitle,
  shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent,
};

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  return (
    editorDocument != null &&
    editorDocumentModel != null &&
    (editorDocument.modelKey === 'LandscapeDiffDocumentModel' ||
      editorDocument.modelKey === 'LandscapeHistoryPreviewDocumentModel')
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

function PaneContent(props: PaneComponentProps): React.JSX.Element {
  const model = props.editorDocumentModel as LandscapeDiffDocumentModel;
  const diff = model.getDiff();
  if (diff == null) {
    return <PaneBody>Loading...</PaneBody>;
  }

  const { mapProperties, added, removed, modified, layoutChanged } = diff;
  if ([mapProperties, added, removed, modified, layoutChanged].every((changes) => changes.length === 0)) {
    return <PaneBody>No changes detected.</PaneBody>;
  }

  const handleClick = (item: LandscapeItemChange): void => {
    model.setViewMode('visual');
    model.selectElements([item.id]);
  };

  return (
    <PaneBody>
      <div className="change-overview">
        {mapProperties.length > 0 && (
          <div className="change-overview__section">
            <h4 className="change-overview__section-title">
              <span className="bpmn-diff-legend bpmn-diff-legend--updated">
                <Icon id="ph ph-map-trifold" />
              </span>{' '}
              Map properties ({mapProperties.length})
            </h4>
            <PropertyRows changes={mapProperties} />
          </div>
        )}
        <ChangeSection title="Added" modifier="added" items={added} onClick={handleClick} />
        <ChangeSection title="Removed" modifier="deleted" items={removed} onClick={handleClick} />
        <ChangeSection title="Modified" modifier="updated" items={modified} onClick={handleClick} />
        <ChangeSection title="Layout changed" modifier="moved" items={layoutChanged} onClick={handleClick} />
      </div>
    </PaneBody>
  );
}

type ChangeSectionProps = {
  title: string;
  modifier: 'added' | 'deleted' | 'updated' | 'moved';
  items: LandscapeItemChange[];
  onClick: (item: LandscapeItemChange) => void;
};

function ChangeSection(props: ChangeSectionProps): React.JSX.Element | null {
  if (props.items.length === 0) {
    return null;
  }
  return (
    <div className="change-overview__section" data-test--landscape-change-section={props.modifier}>
      <h4 className="change-overview__section-title">
        <span className={`bpmn-diff-legend bpmn-diff-legend--${props.modifier}`}>
          <Icon id={`bpmn-landscape/diff/element/${props.modifier}`} />
        </span>{' '}
        {props.title} ({props.items.length})
      </h4>
      <ul className="change-overview__list">
        {props.items.map((item) => (
          <li
            key={`${item.itemType}:${item.id}`}
            // Levels have no shape on the canvas.
            className={`change-overview__entry${item.itemType === 'level' ? ' change-overview__entry--non-nav' : ''}`}
            onClick={item.itemType === 'level' ? undefined : () => props.onClick(item)}
            data-test--landscape-change-entry={item.id}
          >
            <span className="change-overview__entry-name">{item.displayName}</span>
            {item.propertyChanges.length > 0 && <PropertyRows changes={item.propertyChanges} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PropertyRows(props: { changes: LandscapePropertyChange[] }): React.JSX.Element {
  return (
    <ul className="change-overview__attrs">
      {props.changes.map((change) => (
        <li key={`${change.property}:${change.before}:${change.after}`} className="change-overview__attr">
          {change.label}: {formatSummaryValueForDisplay(change.before ?? undefined)} →{' '}
          {formatSummaryValueForDisplay(change.after ?? undefined)}
        </li>
      ))}
    </ul>
  );
}
