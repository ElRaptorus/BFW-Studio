import React, { useEffect, useState } from 'react';

import type { EditorDocument, FeelEditorVariable, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import {
  FeelExpressionHint,
  Icon,
  OneLineFeelEditor,
  Pane,
  PaneBody,
  PaneHeader,
  PaneHeaderHelpIcon,
  PaneProperty,
  assertNotNull,
} from '@evil/bifrost_fw_sdk';

import type BpmnDocumentModel from '../../../BpmnDocumentModel';
import {
  getBpmnSelectionForPropertiesPane,
  getKeyForPropertiesPane,
  shouldBeDisplayedForInputMappingElement,
} from '../../PropertiesPaneFunctions';

type DataPipelineMapping = {
  source: string;
  target: string;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Input Mappings';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/input_mappings" />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  return shouldBeDisplayedForInputMappingElement(editorDocument, editorDocumentModel);
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const selection = getBpmnSelectionForPropertiesPane(props);
  if (selection == null) {
    return null;
  }
  return (
    <PaneBody>
      <InputMappingsContent key={getKeyForPropertiesPane(selection)} {...props} />
    </PaneBody>
  );
}

function InputMappingsContent(props: PaneComponentProps): React.JSX.Element {
  const bpmnDocumentModel: BpmnDocumentModel | null = props.editorDocumentModel;
  assertNotNull(bpmnDocumentModel, 'bpmnDocumentModel');

  const element = bpmnDocumentModel.selection.getOnlyElementOrNull();
  assertNotNull(element, 'element');

  const [feelVariables, setFeelVariables] = useState<FeelEditorVariable[]>([]);
  const { editorDocument } = props;
  const { commands } = props.studio;

  useEffect(() => {
    commands
      .executeCommand<Promise<FeelEditorVariable[]>>('bpmn.feel.getExpressionContext', [editorDocument])
      .then(setFeelVariables);
  }, [editorDocument, commands]);

  const dataPipeline = bpmnDocumentModel.elements.getElementPropertyValue(element.id, 'dataPipeline') as any;
  const mappings: DataPipelineMapping[] = dataPipeline?.inputMappings ?? [];

  const addMapping = (): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'dataPipeline', {
      command: 'addMapping',
      mappingType: 'input',
      source: '',
      target: '',
    });
  };

  const updateSource = (index: number, source: string): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'dataPipeline', {
      command: 'updateMapping',
      mappingType: 'input',
      index,
      source,
    });
  };

  const updateTarget = (index: number, target: string): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'dataPipeline', {
      command: 'updateMapping',
      mappingType: 'input',
      index,
      target,
    });
  };

  const deleteMapping = (index: number): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'dataPipeline', {
      command: 'deleteMapping',
      mappingType: 'input',
      index,
    });
  };

  const handleAddClick = (event: React.MouseEvent): void => {
    event.preventDefault();
    addMapping();
  };

  return (
    <div className="form-group">
      <label className="d-block" style={{ width: '100%' }}>
        <span className="float-right">
          <FeelExpressionHint studio={props.studio} />
          <a
            href="#"
            className="pane-header__icon"
            onClick={handleAddClick}
            title="Add Input Mapping"
            data-test--data-pipeline-add-mapping="input"
          >
            <Icon id="ph ph-plus" />
          </a>
        </span>
      </label>
      {mappings.map((mapping, index) => (
        <div
          key={`input-mapping-${index}`}
          className="form-group"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          data-test--data-pipeline-mapping-row="input"
          data-test--data-pipeline-mapping-index={index}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <OneLineFeelEditor
              studio={props.studio}
              initialValue={mapping.source}
              onChange={(source: string) => updateSource(index, source)}
              variables={feelVariables}
              htmlId={`data-pipeline-input-source-${index}`}
              htmlAttributes={{ 'data-test--data-pipeline-mapping-source': index }}
            />
          </div>
          <span aria-hidden="true">&rarr;</span>
          <div style={{ width: '30%', minWidth: 0 }}>
            <PaneProperty
              type="text"
              value={mapping.target}
              onCommit={(target: string) => updateTarget(index, target)}
              htmlId={`data-pipeline-input-target-${index}`}
              htmlAttributes={{ 'data-test--data-pipeline-mapping-target': index }}
            />
          </div>
          <a
            href="#"
            className="user-task-form-field__icon-button"
            onClick={(event) => {
              event.preventDefault();
              deleteMapping(index);
            }}
            title="Remove mapping"
            data-test--data-pipeline-remove-mapping={index}
          >
            <Icon id="ph-duotone ph-trash" />
          </a>
        </div>
      ))}
    </div>
  );
}
