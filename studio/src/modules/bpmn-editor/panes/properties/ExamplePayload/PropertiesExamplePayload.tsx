import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps } from '#bifrost/contracts/PaneTypes';
import { OpenInNewTabButton } from '#components/OpenInNewTabButton';
import { PaneBody } from '#components/panes/PaneBody';
import { buildSimplePropertyPaneProvider } from '#components/panes/PaneFunctions';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';
import { BpmnElementType } from '#modules/bpmn-editor/BpmnElementTypes';

import React from 'react';

import { KeyValueJsonEditor } from '../../../../../components/key-value-builder';
import type BpmnDocumentModel from '../../../BpmnDocumentModel';
import { shouldBeDisplayedForBpmnElementOfType } from '../../PropertiesPaneFunctions';

export const paneProvider = buildSimplePropertyPaneProvider(
  shouldBeDisplayed,
  'Example Payload',
  ExamplePayloadPane,
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
          type="bpmn.general.example-payload"
          parentUri={editorDocument.uri}
          fragmentId={selectedElement.id}
          dataTest="open-example-payload-in-new-tab"
        />
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/example_payload" />
      </>
    );
  },
);

function ExamplePayloadPane(props: PaneComponentProps): React.JSX.Element {
  const bpmnDocumentModel: BpmnDocumentModel = props.editorDocumentModel;
  const element = bpmnDocumentModel.selection.getOnlyElementOrNull();
  assertNotNull(element, 'element');

  const examplePayloadProperty = element.customProperties?.find(
    (property) => property.name === 'studio.examplePayload',
  );

  const changeExamplePayload = (value: string): void => {
    bpmnDocumentModel.elements.setCustomProperty(element.id, 'studio.examplePayload', value);
  };

  return (
    <PaneBody>
      <KeyValueJsonEditor
        studio={props.studio}
        initialValue={examplePayloadProperty?.value ?? ''}
        onChange={changeExamplePayload}
        keyPlaceholder="Key"
        valuePlaceholder="Value"
        emptyMessage="No example payload configured"
        htmlId="example-payload-editor"
        htmlAttributes={{ 'data-test--example-payload-input': true }}
      />
    </PaneBody>
  );
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  return (
    shouldBeDisplayedForBpmnElementOfType(
      editorDocument,
      editorDocumentModel,
      BpmnElementType.MessageIntermediateCatchEvent,
    ) ||
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.MessageBoundaryEvent) ||
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.ReceiveTask) ||
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.SendTask) ||
    shouldBeDisplayedForBpmnElementOfType(
      editorDocument,
      editorDocumentModel,
      BpmnElementType.MessageIntermediateThrowEvent,
    ) ||
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.MessageEndEvent)
  );
}
