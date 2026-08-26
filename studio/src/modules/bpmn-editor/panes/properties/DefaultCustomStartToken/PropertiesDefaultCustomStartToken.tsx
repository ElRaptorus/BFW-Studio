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
  'Default Configured Start Payload',
  DefaultCustomStartTokenPane,
  (props: PaneComponentProps) => {
    const editorDocument = props.editorDocument;
    const bpmnDocumentModel: BpmnDocumentModel = props.editorDocumentModel;

    const selectedElement = bpmnDocumentModel.selection.getOnlyElementOrNull();
    assertNotNull(selectedElement, 'selectedElement');

    return (
      <>
        <OpenInNewTabButton
          studio={props.studio}
          type="bpmn.start-event.default-custom-start-token"
          parentUri={editorDocument.uri}
          fragmentId={selectedElement.id}
          dataTest="open-default-custom-start-token-in-new-tab"
        />
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/default_custom_start_token" />
      </>
    );
  },
);

function DefaultCustomStartTokenPane(props: PaneComponentProps): React.JSX.Element {
  const bpmnDocumentModel: BpmnDocumentModel = props.editorDocumentModel;
  const element = bpmnDocumentModel.selection.getOnlyElementOrNull();
  assertNotNull(element, 'element');

  const defaultCustomStartTokenProperty = element.customProperties?.find(
    (property) => property.name === 'studio.defaultCustomStartToken',
  );

  const changeDefaultCustomStartToken = (value: string): void => {
    bpmnDocumentModel.elements.setCustomProperty(element.id, 'studio.defaultCustomStartToken', value);
  };

  return (
    <PaneBody>
      <KeyValueJsonEditor
        studio={props.studio}
        initialValue={defaultCustomStartTokenProperty?.value ?? ''}
        onChange={changeDefaultCustomStartToken}
        keyPlaceholder="Key"
        valuePlaceholder="Value"
        emptyMessage="No default payload configured"
        htmlId="default-custom-start-token-editor"
        htmlAttributes={{ 'data-test--default-custom-start-token-input': true }}
      />
    </PaneBody>
  );
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  return (
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.StartEvent) ||
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.TimerStartEvent) ||
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.SignalStartEvent) ||
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.MessageStartEvent) ||
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.ConditionalStartEvent)
  );
}
