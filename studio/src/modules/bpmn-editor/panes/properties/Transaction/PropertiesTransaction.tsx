import React from 'react';

import type { EditorDocument, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { BpmnElementType, Pane, PaneBody, PaneHeader, PaneHeaderHelpIcon, PaneProperty } from '@evil/bifrost_fw_sdk';

import type BpmnDocumentModel from '../../../BpmnDocumentModel';
import {
  getBpmnSelectionForPropertiesPane,
  getKeyForPropertiesPane,
  shouldBeDisplayedForBpmnElementOfType,
} from '../../PropertiesPaneFunctions';

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Transaction';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/transaction" />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  return shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.Transaction);
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const selection = getBpmnSelectionForPropertiesPane(props);

  if (selection == null) {
    return null;
  } else {
    return <PropertiesTransaction key={getKeyForPropertiesPane(selection)} {...props} />;
  }
}

function PropertiesTransaction(props: PaneComponentProps): React.JSX.Element {
  const model = props.editorDocumentModel as BpmnDocumentModel | null;
  const element = model?.selection?.getOnlyElementOrNull();

  const transactionMethod = (element as any)?.method ?? null;

  return (
    <PaneBody>
      <PaneProperty
        type="text"
        label="Method"
        htmlId="transaction-method-property"
        disabled={true}
        value={transactionMethod ?? '(default)'}
      />
      <p className="text-muted small mt-2">
        The <code>method</code> attribute specifies the transaction protocol (e.g. <code>##WSAtomicTransaction</code>).
        The Engine uses saga-pattern compensation and does not execute wire-level transaction protocols.
      </p>
    </PaneBody>
  );
}
