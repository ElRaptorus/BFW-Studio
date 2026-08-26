import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { FeelExpressionHint } from '#components/FeelExpressionHint';
import { Icon } from '#components/Icon';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';

import React, { useEffect, useState } from 'react';

import { type FeelEditorVariable, OneLineFeelEditor, PaneProperty } from '@evil/bifrost_fw_sdk';

import type BpmnDocumentModel from '../../../BpmnDocumentModel';
import {
  getBpmnSelectionForPropertiesPane,
  getKeyForPropertiesPane,
  shouldBeDisplayedForOutboundPipelineElement,
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
  return 'Output Mappings';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  const bpmnDocumentModel = props.editorDocumentModel as BpmnDocumentModel | null;
  const element = bpmnDocumentModel?.selection.getOnlyElementOrNull() ?? null;

  const handleAddClick = (event: React.MouseEvent): void => {
    event.preventDefault();
    if (bpmnDocumentModel != null && element != null) {
      bpmnDocumentModel.elements.setElementProperty(element.id, 'dataPipeline', {
        command: 'addMapping',
        mappingType: 'output',
        source: '',
        target: '',
      });
    }
  };

  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        {props.collapsed !== true && (
          <>
            <FeelExpressionHint studio={props.studio} />
            <a
              href="#"
              className="pane-header__icon"
              onClick={handleAddClick}
              title="Add Output Mapping"
              data-test--data-pipeline-add-mapping="output"
            >
              <Icon id="ph ph-plus" />
            </a>
          </>
        )}
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/output_mappings" />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  return shouldBeDisplayedForOutboundPipelineElement(editorDocument, editorDocumentModel);
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const selection = getBpmnSelectionForPropertiesPane(props);
  if (selection == null) {
    return null;
  }
  return (
    <PaneBody>
      <OutputMappingsContent key={getKeyForPropertiesPane(selection)} {...props} />
    </PaneBody>
  );
}

function OutputMappingsContent(props: PaneComponentProps): React.JSX.Element {
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
  const mappings: DataPipelineMapping[] = dataPipeline?.outputMappings ?? [];

  const updateSource = (index: number, source: string): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'dataPipeline', {
      command: 'updateMapping',
      mappingType: 'output',
      index,
      source,
    });
  };

  const updateTarget = (index: number, target: string): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'dataPipeline', {
      command: 'updateMapping',
      mappingType: 'output',
      index,
      target,
    });
  };

  const deleteMapping = (index: number): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'dataPipeline', {
      command: 'deleteMapping',
      mappingType: 'output',
      index,
    });
  };

  return (
    <div className="form-group">
      {mappings.map((mapping, index) => (
        <div
          key={`${mapping.source}->${mapping.target}`}
          className="form-group"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          data-test--data-pipeline-mapping-row="output"
          data-test--data-pipeline-mapping-index={index}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <OneLineFeelEditor
              initialValue={mapping.source}
              onChange={(source: string) => updateSource(index, source)}
              variables={feelVariables}
              htmlId={`data-pipeline-output-source-${index}`}
              htmlAttributes={{ 'data-test--data-pipeline-mapping-source': index }}
            />
          </div>
          <span aria-hidden="true">&rarr;</span>
          <div style={{ width: '30%', minWidth: 0 }}>
            <PaneProperty
              type="text"
              value={mapping.target}
              onCommit={(target: string) => updateTarget(index, target)}
              htmlId={`data-pipeline-output-target-${index}`}
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
