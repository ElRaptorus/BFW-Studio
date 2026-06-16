import React from 'react';

import type { EditorDocument, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { BpmnElementType, Pane, PaneBody, PaneHeader, PaneHeaderHelpIcon, PaneProperty } from '@evil/bifrost_fw_sdk';

import type BpmnDocumentModel from '../../../BpmnDocumentModel';
import { assertBpmnElementIsGroup } from '../../BpmnElementTypeAssertionFunctions';
import { shouldBeDisplayedForBpmnElementOfType } from '../../PropertiesPaneFunctions';

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Group';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/group" />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  return shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.Group);
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const bpmnDocumentModel: BpmnDocumentModel | null = props.editorDocumentModel;
  const element = bpmnDocumentModel?.selection.getOnlyElementOrNull();

  if (bpmnDocumentModel == null || element == null) {
    return null;
  }

  assertBpmnElementIsGroup(element);

  const changeCategoryValue = (value: string): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'categoryValue', value);
  };

  return (
    <PaneBody key={element.id}>
      <PaneProperty
        htmlId="group-category-value-property"
        type="text"
        key={`element_category_value_${element.categoryValue}`}
        value={element.categoryValue}
        label="Category Value"
        onCommit={(value: string) => changeCategoryValue(value)}
      />
    </PaneBody>
  );
}
