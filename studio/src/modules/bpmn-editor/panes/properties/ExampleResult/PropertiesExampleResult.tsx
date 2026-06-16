import React from 'react';

import type { EditorDocument, PaneComponentProps } from '@evil/bifrost_fw_sdk';
import {
  BpmnElementType,
  OpenInNewTabButton,
  PaneBody,
  PaneHeaderHelpIcon,
  assertNotNull,
  buildSimplePropertyPaneProvider,
} from '@evil/bifrost_fw_sdk';

import { KeyValueJsonEditor } from '../../../../../components/key-value-builder';
import type BpmnDocumentModel from '../../../BpmnDocumentModel';
import { shouldBeDisplayedForBpmnElementOfType } from '../../PropertiesPaneFunctions';

export const paneProvider = buildSimplePropertyPaneProvider(
  shouldBeDisplayed,
  'Example Result',
  ExampleResultPane,
  (props: PaneComponentProps) => {
    const editorDocument = props.editorDocument;
    const bpmnDocumentModel: BpmnDocumentModel = props.editorDocumentModel;

    const selectedElement = bpmnDocumentModel.selection.getOnlyElementOrNull();
    assertNotNull(selectedElement, 'selectedElement');

    return (
      <>
        <span className="pane-header__divider"></span>
        <OpenInNewTabButton
          studio={props.studio}
          type="bpmn.general.example-result"
          parentUri={editorDocument.uri}
          fragmentId={selectedElement.id}
          dataTest="open-example-result-in-new-tab"
        />
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/example_result" />
      </>
    );
  },
);

function ExampleResultPane(props: PaneComponentProps): React.JSX.Element {
  const bpmnDocumentModel: BpmnDocumentModel = props.editorDocumentModel;
  const element = bpmnDocumentModel.selection.getOnlyElementOrNull();
  assertNotNull(element, 'element');

  const exampleResultProperty = element.customProperties?.find((property) => property.name === 'studio.exampleResult');

  const changeExampleResult = (value: string): void => {
    bpmnDocumentModel.elements.setCustomProperty(element.id, 'studio.exampleResult', value);
  };

  return (
    <PaneBody>
      <KeyValueJsonEditor
        studio={props.studio}
        initialValue={exampleResultProperty?.value ?? ''}
        onChange={changeExampleResult}
        keyPlaceholder="Key"
        valuePlaceholder="Value"
        emptyMessage="No example result configured"
        htmlId="example-result-editor"
        htmlAttributes={{ 'data-test--example-result-input': true }}
      />
    </PaneBody>
  );
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  return (
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.BusinessRuleTask) ||
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.CallActivity) ||
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.ServiceTask) ||
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.HttpServiceTask)
  );
}
