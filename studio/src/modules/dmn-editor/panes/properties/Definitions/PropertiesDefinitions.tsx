import type { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';

import React from 'react';

import { PaneProperty } from '@evil/bifrost_fw_sdk';

import type DmnDocumentModel from '../../../DmnDocumentModel';
import { getDmnModel, shouldBeDisplayedForDmnDrdNoSelection } from '../../PropertiesPaneFunctions';

export const paneProvider: PaneProvider = {
  getPaneTitle,
  shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent,
};

function getPaneTitle(): string {
  return 'DMN Definitions';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel): boolean {
  return shouldBeDisplayedForDmnDrdNoSelection(editorDocument, editorDocumentModel);
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="dmn/drd" />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const model = getDmnModel(props.editorDocumentModel);
  if (!model || !model.isReadyForInteraction()) {
    return null;
  }

  return <DefinitionsProperties key="definitions" {...props} />;
}

function DefinitionsProperties(props: PaneComponentProps): React.JSX.Element | null {
  const model = props.editorDocumentModel as DmnDocumentModel;
  const definitions = model.elements.getDefinitions();
  if (!definitions) {
    return null;
  }

  const changeDefinitionsProperty = (propertyName: string, value: any): void => {
    model.elements.setDefinitionsProperty(propertyName, value);
  };

  return (
    <PaneBody>
      <PaneProperty
        label="Name"
        type="text"
        value={definitions.name ?? ''}
        onCommit={(value: any) => changeDefinitionsProperty('name', value)}
        htmlAttributes={{ 'data-test--dmn-definitions-name': true }}
      />
      <PaneProperty
        label="ID"
        type="text"
        value={definitions.id ?? ''}
        onCommit={(value: any) => changeDefinitionsProperty('id', value)}
        htmlAttributes={{ 'data-test--dmn-definitions-id': true }}
      />
      <PaneProperty
        label="Namespace"
        type="text"
        value={definitions.namespace ?? ''}
        onCommit={(value: any) => changeDefinitionsProperty('namespace', value)}
        htmlAttributes={{ 'data-test--dmn-definitions-namespace': true }}
      />
      <PaneProperty
        label="Exported by"
        type="text"
        value={definitions.exporter ?? ''}
        disabled={true}
        htmlAttributes={{ 'data-test--dmn-definitions-exporter': true }}
      />
      <PaneProperty
        label="Exporter Version"
        type="text"
        value={definitions.exporterVersion ?? ''}
        disabled={true}
        htmlAttributes={{ 'data-test--dmn-definitions-exporter-version': true }}
      />
    </PaneBody>
  );
}
