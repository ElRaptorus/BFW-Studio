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

import LandscapeMapDocumentModel from '../LandscapeMapDocumentModel';
import type { LandscapeElement, LandscapeShape } from '../LandscapeMapFile';
import type { ProcessCandidate } from '../resolveProcessReference';

const ELEMENT_TITLES: Record<string, string> = {
  process: 'Process',
  placeholder: 'Placeholder',
  group: 'Group',
  band: 'Band',
  mapLink: 'Map Link',
  note: 'Note',
  connector: 'Connector',
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
  return (
    <ShapeProperties key={key} studio={props.studio} model={model} shape={element} element={element.businessObject} />
  );
}

function MapProperties(props: { model: LandscapeMapDocumentModel }): React.JSX.Element | null {
  const { model } = props;
  const mapProperties = model.getMapProperties();
  if (mapProperties == null) {
    return null;
  }
  return (
    <PaneBody>
      <PaneProperty
        type="text"
        label="Name"
        value={mapProperties.name}
        onCommit={(value: string) => model.updateMap({ name: value })}
        htmlAttributes={{ 'data-test--landscape-property': 'name' }}
      />
      <h6 className="landscape-properties__heading">Levels</h6>
      {mapProperties.levels.map((level, index) => (
        <div key={level.id} className="landscape-properties__level">
          <PaneProperty
            type="text"
            label={`Depth ${index + 1}`}
            value={level.name}
            onCommit={(value: string) => model.renameLevel(level.id, value)}
            htmlAttributes={{ 'data-test--landscape-level': index }}
          />
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            title="Remove this level"
            onClick={() => model.removeLevel(level.id)}
            data-test--landscape-level-remove={index}
          >
            <i className="ph ph-trash" />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-sm btn-secondary landscape-properties__button"
        onClick={() => model.addLevel()}
        data-test--landscape-level-add
      >
        Add level
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
  shape: unknown;
  element: LandscapeElement;
}): React.JSX.Element {
  const { studio, model, shape, element } = props;
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
      {element.type === 'group' && (
        <PaneProperty
          type="text"
          label="Level"
          value={model.getGroupLevelName(shape) ?? ''}
          placeholder="No name for this depth"
          disabled
          htmlAttributes={{ 'data-test--landscape-property': 'level' }}
        />
      )}
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
      {element.type === 'mapLink' && <MapLinkDetails model={model} element={element} />}
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
    return <BrokenProcessDetails model={model} element={element} />;
  }
  const { process } = details;
  return (
    <>
      <PaneProperty type="text" label="File" value={details.relativePath} disabled />
      <PaneProperty type="text" label="Process ID" value={process.id} disabled />
      <PaneProperty type="text" label="Version" value={process.version ?? '—'} disabled />
      <PaneProperty type="text" label="Executable" value={process.isExecutable ? 'Yes' : 'No'} disabled />
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

function candidateOption(model: LandscapeMapDocumentModel, candidate: ProcessCandidate): SelectOption {
  const file = model.getRelativePath(candidate.uri);
  const value = `${candidate.uri}#${candidate.process.id}`;
  return {
    label: candidate.process.name ? `${candidate.process.name} (${file})` : `${candidate.process.id} (${file})`,
    value: candidate,
    dataTestOptionValue: value,
  };
}

/** A process shape whose reference does not resolve: say why, and offer the three ways out. */
function BrokenProcessDetails(props: {
  model: LandscapeMapDocumentModel;
  element: Extract<LandscapeElement, { type: 'process' }>;
}): React.JSX.Element {
  const { model, element } = props;
  const options = model.getReplacementOptions(element);
  if (options == null) {
    return <p className="landscape-properties__info">Looking for this process in the solution ...</p>;
  }
  const isAmbiguous = options.status === 'ambiguous';
  return (
    <div data-test--landscape-broken-process={options.status}>
      <p className="landscape-properties__info">
        {isAmbiguous
          ? `The process "${element.processId}" is defined in several files. Choose the file this shape stands for.`
          : `The process "${element.processId}" is not found in the solution.`}
      </p>
      {options.candidates.length === 0 ? (
        <PaneProperty
          type="text"
          label="Replace with"
          value="Every process of the solution is already on this map"
          disabled
        />
      ) : (
        <PaneProperty
          type="select"
          label={isAmbiguous ? 'File' : 'Replace with'}
          placeholder={isAmbiguous ? 'Choose a file ...' : 'Choose a process ...'}
          options={options.candidates.map((candidate) => candidateOption(model, candidate))}
          onChange={(option: SelectOption) => model.replaceSelectedProcess(option.value)}
          htmlId="landscape-replace-process"
        />
      )}
      <button
        type="button"
        className="btn btn-sm btn-secondary landscape-properties__button"
        onClick={() => model.dropSelectedProcessReference()}
        data-test--landscape-drop-reference
      >
        Drop reference
      </button>
      <button
        type="button"
        className="btn btn-sm btn-secondary landscape-properties__button"
        disabled={options.isKept}
        onClick={() => model.keepSelectedReference()}
        data-test--landscape-keep-reference
      >
        {options.isKept ? 'Kept until the map is closed' : 'Keep'}
      </button>
    </div>
  );
}

function MapLinkDetails(props: {
  model: LandscapeMapDocumentModel;
  element: Extract<LandscapeElement, { type: 'mapLink' }>;
}): React.JSX.Element {
  const { model, element } = props;
  const status = model.getMapLinkStatus(element);
  const targets = model.getOtherMaps();
  const options: SelectOption[] = targets.map((entry) => ({
    label: entry.name,
    value: entry.uri,
    dataTestOptionValue: model.getRelativePath(entry.uri),
  }));
  return (
    <>
      <PaneProperty type="text" label="Target" value={element.mapPath} disabled />
      {status === 'missing' && (
        <p className="landscape-properties__info" data-test--landscape-broken-map-link>
          The map "{element.mapPath}" is not found in the landscape folder.
        </p>
      )}
      <PaneProperty
        // The select only reads its value on mount; undo and redo change `mapPath` underneath it.
        key={element.mapPath}
        type="select"
        label="Target map"
        placeholder="Choose a map ..."
        options={options}
        value={options.find((option) => model.getRelativePath(option.value) === element.mapPath)}
        onChange={(option: SelectOption) => model.retargetSelectedMapLink(option.value)}
        htmlId="landscape-map-link-target"
      />
    </>
  );
}
