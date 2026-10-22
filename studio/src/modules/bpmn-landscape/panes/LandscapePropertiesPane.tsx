import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import type { BpmnElementColor } from '#modules/bpmn-core/BpmnElementCoreTypes';
import { BpmnElementColorPicker, generateRandomColor } from '#modules/bpmn-core/components/BpmnElementColorPicker';

import React from 'react';

import { PaneProperty, type SelectOption } from '@elraptorus/bfw_studio_sdk';

import type { ProcessRelationEntry } from '../LandscapeMapDocumentModel';
import LandscapeMapDocumentModel from '../LandscapeMapDocumentModel';
import type { LandscapeElement, LandscapeShape } from '../LandscapeMapFile';
import type { ProcessRelationKind } from '../buildProcessRelations';
import type { RelationLine } from '../buildRelationLines';

const KIND_LABELS: Record<ProcessRelationKind, string> = {
  callActivity: 'Call activities',
  message: 'Messages',
  signal: 'Signals',
};
const KINDS: ProcessRelationKind[] = ['callActivity', 'message', 'signal'];
const ELEMENT_TITLES: Record<string, string> = {
  process: 'Process',
  placeholder: 'Placeholder',
  group: 'Group',
  band: 'Band',
  mapLink: 'Map Link',
  note: 'Note',
  connector: 'Connector',
  relation: 'Relation',
};
const SHAPE_OPTIONS: SelectOption[] = [
  { label: 'Box', value: 'box', dataTestOptionValue: 'box' },
  { label: 'Chevron', value: 'chevron', dataTestOptionValue: 'chevron' },
];

function getPaneTitle(_editorDocument: EditorDocument, model: EditorDocumentModel): string {
  const selected = model instanceof LandscapeMapDocumentModel ? model.getSelectedElements() : [];
  if (selected.length === 0) {
    return 'Landscape Map';
  }
  return selected.length === 1 ? (ELEMENT_TITLES[selected[0].type] ?? 'Element') : 'Selection';
}

export const paneProvider: PaneProvider = {
  getPaneTitle,
  shouldBeDisplayed: (editorDocument, model) =>
    editorDocument?.documentType === 'bpmn-landscape-map' &&
    model instanceof LandscapeMapDocumentModel &&
    model.getMapProperties() != null,
  Pane: PaneFull,
  PaneContent,
};

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader
        studio={props.studio}
        title={getPaneTitle(props.editorDocument, props.editorDocumentModel)}
        paneId={props.paneId}
        collapsed={props.collapsed}
      />
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function Switch(props: { id: string; label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className="form-check form-switch landscape-properties__switch">
      <input
        id={props.id}
        className="form-check-input"
        type="checkbox"
        role="switch"
        checked={props.checked}
        onChange={(event) => props.onChange(event.target.checked)}
        data-test--landscape-switch={props.id}
      />
      <label htmlFor={props.id}>{props.label}</label>
    </div>
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const model: LandscapeMapDocumentModel = props.editorDocumentModel;
  const mapProperties = model.getMapProperties();
  if (mapProperties == null) {
    return null;
  }
  const revision = props.editorDocument.metadata?.selectionRevision ?? 0;
  const selected = model.getSelectedElements();
  if (selected.length === 0) {
    return <MapProperties key={`map-${revision}`} model={model} />;
  }
  if (selected.length > 1) {
    return (
      <PaneBody>
        <p className="landscape-properties__info">{selected.length} elements selected</p>
      </PaneBody>
    );
  }
  const element = selected[0];
  const key = `${element.id}-${revision}`;
  if (element.type === 'relation') {
    return <RelationLineProperties key={key} model={model} element={element} />;
  }
  if (element.type === 'connector') {
    return (
      <PaneBody key={key}>
        <PaneProperty
          type="text"
          label="Label"
          value={element.businessObject.label}
          onCommit={(value: string) => model.updateSelectedElement({ label: value })}
          htmlAttributes={{ 'data-test--landscape-property': 'label' }}
        />
      </PaneBody>
    );
  }
  return <ShapeProperties key={key} studio={props.studio} model={model} element={element.businessObject} />;
}

function MapProperties(props: { model: LandscapeMapDocumentModel }): React.JSX.Element | null {
  const { model } = props;
  const mapProperties = model.getMapProperties();
  if (mapProperties == null) {
    return null;
  }
  const hiddenCount = model.getHiddenRelationCount();
  return (
    <PaneBody>
      <PaneProperty
        type="text"
        label="Name"
        value={mapProperties.name}
        onCommit={(value: string) => model.updateMap({ name: value })}
        htmlAttributes={{ 'data-test--landscape-property': 'name' }}
      />
      <h6 className="landscape-properties__heading">Relations</h6>
      {KINDS.map((kind) => (
        <Switch
          key={kind}
          id={`landscape-layer-${kind}`}
          label={KIND_LABELS[kind]}
          checked={mapProperties.relationLayers[kind]}
          onChange={(checked) => model.setRelationLayer(kind, checked)}
        />
      ))}
      <button
        type="button"
        className="btn btn-sm btn-secondary landscape-properties__button"
        disabled={hiddenCount === 0}
        onClick={() => model.showAllRelations()}
        data-test--landscape-show-hidden-relations
      >
        {hiddenCount === 1 ? 'Show 1 hidden relation' : `Show ${hiddenCount} hidden relations`}
      </button>
    </PaneBody>
  );
}

function colorOf(element: LandscapeElement): BpmnElementColor | null {
  return element.style == null
    ? null
    : { backgroundColor: element.style.fill ?? '', borderColor: element.style.stroke ?? '' };
}

function ShapeProperties(props: {
  studio: Bifrost;
  model: LandscapeMapDocumentModel;
  element: LandscapeElement;
}): React.JSX.Element {
  const { studio, model, element } = props;
  const style = element.style ?? { fill: null, stroke: null };

  const onElementColorChange = (option: SelectOption): void => {
    if (option.value === 'no_color') {
      model.updateSelectedElement({ style: null });
    } else if (option.value === 'custom') {
      model.updateSelectedElement({ style: { fill: generateRandomColor(), stroke: generateRandomColor() } });
    } else {
      model.updateSelectedElement({
        style: { fill: option.value.backgroundColor ?? null, stroke: option.value.borderColor ?? null },
      });
    }
  };

  return (
    <PaneBody>
      <LabelProperty model={model} element={element} />
      {(element.type === 'process' || element.type === 'placeholder') && (
        <PaneProperty
          type="select"
          label="Shape"
          options={SHAPE_OPTIONS}
          value={SHAPE_OPTIONS.find((option) => option.value === element.shape)}
          onChange={(option: SelectOption) => model.updateSelectedElement({ shape: option.value as LandscapeShape })}
          htmlId="landscape-shape-property"
        />
      )}
      <div data-test--landscape-color>
        <BpmnElementColorPicker
          studio={studio}
          customColors={studio.settings.get('bpmn.editor.customColors') as BpmnElementColor[] | undefined}
          initialColor={colorOf(element)}
          onElementColorChange={onElementColorChange}
          setBackgroundColor={(fill) => model.updateSelectedElement({ style: { ...style, fill } })}
          setBorderColor={(stroke) => model.updateSelectedElement({ style: { ...style, stroke } })}
        />
      </div>
      {element.type === 'process' && <ProcessDetailsView studio={studio} model={model} element={element} />}
    </PaneBody>
  );
}

function LabelProperty(props: { model: LandscapeMapDocumentModel; element: LandscapeElement }): React.JSX.Element {
  const { model, element } = props;
  const htmlAttributes = { 'data-test--landscape-property': 'label' };
  switch (element.type) {
    case 'note':
      return (
        <PaneProperty
          type="textarea"
          label="Text"
          value={element.text}
          onCommit={(value: string) => model.updateSelectedElement({ text: value })}
          htmlAttributes={htmlAttributes}
        />
      );
    case 'process':
      return (
        <PaneProperty
          type="text"
          label="Label"
          value={element.label ?? ''}
          placeholder={model.getProcessLabel({ ...element, label: null })}
          onCommit={(value: string) => model.updateSelectedElement({ label: value.trim() === '' ? null : value })}
          htmlAttributes={htmlAttributes}
        />
      );
    default:
      return (
        <PaneProperty
          type="text"
          label="Label"
          value={element.label}
          onCommit={(value: string) => model.updateSelectedElement({ label: value })}
          htmlAttributes={htmlAttributes}
        />
      );
  }
}

function ProcessDetailsView(props: {
  studio: Bifrost;
  model: LandscapeMapDocumentModel;
  element: Extract<LandscapeElement, { type: 'process' }>;
}): React.JSX.Element {
  const { studio, model, element } = props;
  const details = model.getProcessDetails(element);
  if (details == null) {
    return <p className="landscape-properties__info">Not found in the solution.</p>;
  }
  const { process } = details;
  return (
    <>
      <PaneProperty type="text" label="File" value={details.relativePath} disabled />
      <PaneProperty type="text" label="Process ID" value={process.id} disabled />
      <PaneProperty type="text" label="Version" value={process.version ?? '—'} disabled />
      <PaneProperty type="text" label="Executable" value={process.isExecutable ? 'Yes' : 'No'} disabled />
      <h6 className="landscape-properties__heading">Relations</h6>
      {details.relations.length === 0 && <p className="landscape-properties__info">No relations.</p>}
      {KINDS.map((kind) => {
        const entries = details.relations.filter((entry) => entry.relation.kind === kind);
        return entries.length === 0 ? null : (
          <div key={kind} className="landscape-properties__group">
            <div className="landscape-properties__group-title">{KIND_LABELS[kind]}</div>
            {entries.map((entry) => (
              <RelationEntry key={`${entry.relation.key}-${entry.direction}`} model={model} entry={entry} />
            ))}
          </div>
        );
      })}
      <h6 className="landscape-properties__heading">Decisions</h6>
      {process.decisionRefs.length === 0 && <p className="landscape-properties__info">No decisions.</p>}
      {process.decisionRefs.map((decisionRef) => (
        <div key={decisionRef} className="landscape-properties__row" data-test--landscape-decision={decisionRef}>
          <span className="landscape-properties__row-label">{decisionRef}</span>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() =>
              void studio.commands.executeCommand('bpmn.businessRuleTask.openTargetDecision', [decisionRef])
            }
          >
            Open
          </button>
        </div>
      ))}
    </>
  );
}

function RelationEntry(props: { model: LandscapeMapDocumentModel; entry: ProcessRelationEntry }): React.JSX.Element {
  const { model, entry } = props;
  const arrow = entry.direction === 'outgoing' ? '→' : '←';
  const name = entry.relation.name == null ? '' : ` · ${entry.relation.name}`;
  const label = `${arrow} ${entry.otherProcessLabel}${name}`;
  if (!entry.otherOnMap) {
    return (
      <div
        className="landscape-properties__row landscape-properties__row--muted"
        title="The other process is not on this map"
      >
        <span className="landscape-properties__row-label">{label}</span>
      </div>
    );
  }
  return (
    <Switch
      id={`landscape-relation-${entry.relation.key}`}
      label={label}
      checked={!entry.hidden}
      onChange={(checked) => model.setRelationsHidden([entry.relation.key], !checked)}
    />
  );
}

function RelationLineProperties(props: { model: LandscapeMapDocumentModel; element: any }): React.JSX.Element {
  const { model, element } = props;
  const line: RelationLine = element.businessObject;
  const hidden = new Set(line.hiddenKeys);
  const visibleKeys = line.relations.map((relation) => relation.key).filter((key) => !hidden.has(key));
  return (
    <PaneBody>
      <PaneProperty type="text" label="Kind" value={KIND_LABELS[line.kind]} disabled />
      <PaneProperty type="text" label="From" value={model.getProcessLabel(element.source.businessObject)} disabled />
      <PaneProperty type="text" label="To" value={model.getProcessLabel(element.target.businessObject)} disabled />
      {line.relations.map((relation) => (
        <Switch
          key={relation.key}
          id={`landscape-relation-${relation.key}`}
          label={relation.name ?? relation.sourceFlowNodeIds.join(', ')}
          checked={!hidden.has(relation.key)}
          onChange={(checked) => model.setRelationsHidden([relation.key], !checked)}
        />
      ))}
      <button
        type="button"
        className="btn btn-sm btn-secondary landscape-properties__button"
        onClick={() => model.setRelationsHidden(visibleKeys, true)}
        data-test--landscape-hide-relation-line
      >
        Hide
      </button>
    </PaneBody>
  );
}
