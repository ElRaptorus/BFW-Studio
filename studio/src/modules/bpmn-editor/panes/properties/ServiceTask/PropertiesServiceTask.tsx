import React from 'react';

import type { EditorDocument, PaneComponentProps, PaneProvider, SelectOption } from '@evil/bifrost_fw_sdk';
import {
  BpmnElementType,
  Pane,
  PaneBody,
  PaneHeader,
  PaneHeaderHelpIcon,
  PaneProperty,
  assertNotNull,
} from '@evil/bifrost_fw_sdk';
import type { CustomServiceTaskType } from '@evil/bifrost_fw_sdk/types/bpmn/BpmnElementTypes';
import { BpmnServiceTaskImplementation } from '@evil/bifrost_fw_sdk/types/bpmn/BpmnElementTypes';

import type BpmnDocumentModel from '../../../BpmnDocumentModel';
import { assertBpmnElementIsServiceTask } from '../../BpmnElementTypeAssertionFunctions';
import {
  getBpmnSelectionForPropertiesPane,
  getKeyForPropertiesPane,
  shouldBeDisplayedForBpmnElementOfType,
} from '../../PropertiesPaneFunctions';

const selectOptions: SelectOption[] = [
  {
    label: 'HTTP Service Task',
    dataTestOptionValue: BpmnServiceTaskImplementation.Http,
    value: {
      implementation: BpmnServiceTaskImplementation.Http,
    },
  },
  {
    label: 'None',
    dataTestOptionValue: '',
    value: {
      implementation: '',
    },
  },
];

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Service Task';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/service_task" />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  return (
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.ServiceTask) ||
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.HttpServiceTask)
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const selection = getBpmnSelectionForPropertiesPane(props);
  if (selection == null) {
    return null;
  }
  return <PropertiesServiceTask key={getKeyForPropertiesPane(selection)} {...props} />;
}

function PropertiesServiceTask(props: PaneComponentProps): React.JSX.Element {
  const bpmnDocumentModel: BpmnDocumentModel | null = props.editorDocumentModel;
  assertNotNull(bpmnDocumentModel, 'bpmnDocumentModel');

  const element = bpmnDocumentModel.selection.getOnlyElementOrNull();
  assertBpmnElementIsServiceTask(element);

  const updateServiceTaskImplementation = (newImplementation: string): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'serviceTaskImplementation', {
      newImplementation,
    });
  };

  const customTaskTypes = props.studio.commands
    .executeCommand<CustomServiceTaskType[]>('bpmn.serviceTasks.getCustomTypes')
    .map<SelectOption>((customTaskType) => {
      return {
        label: customTaskType.label,
        dataTestOptionValue: customTaskType.implementation,
        value: {
          implementation: customTaskType.implementation,
        },
      };
    });

  const allOptions = [...selectOptions, ...customTaskTypes];

  const currentImplementation = element.implementation ?? '';
  const isHttp = currentImplementation === BpmnServiceTaskImplementation.Http;

  const initialValue = allOptions.find((opt) => opt.value.implementation === currentImplementation);
  const noneOption = allOptions.find((opt) => opt.value.implementation === '');

  return (
    <PaneBody>
      <PaneProperty
        key={`element_service_task_impl_${currentImplementation}`}
        htmlId="service-task-type"
        label="Type"
        type="select"
        options={allOptions}
        value={initialValue ?? noneOption}
        onChange={(newValue: any) => updateServiceTaskImplementation(newValue.value.implementation)}
      />
      {!isHttp && (
        <PaneProperty
          key={`element_service_task_custom_impl_${currentImplementation}`}
          htmlId="service-task-custom-implementation"
          label="Implementation Type"
          type="text"
          value={currentImplementation}
          onCommit={(value: string) => updateServiceTaskImplementation(value)}
          htmlAttributes={{ 'data-test--service-task-custom-implementation-input': true }}
        />
      )}
    </PaneBody>
  );
}
