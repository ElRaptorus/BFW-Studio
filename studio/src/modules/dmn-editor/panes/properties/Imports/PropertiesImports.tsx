import React, { useCallback, useState } from 'react';

import type { EditorDocument, EditorDocumentModel, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { Pane, PaneBody, PaneHeader, PaneHeaderHelpIcon, PaneProperty } from '@evil/bifrost_fw_sdk';

import type DmnDocumentModel from '../../../DmnDocumentModel';
import { getDmnModel, shouldBeDisplayedForDmnDrdNoSelection } from '../../PropertiesPaneFunctions';

const DMN_IMPORT_TYPE_URI = 'https://www.omg.org/spec/DMN/20191111/MODEL/';

export const paneProvider: PaneProvider = {
  getPaneTitle,
  shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent,
};

function getPaneTitle(): string {
  return 'Imports';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel): boolean {
  if (!shouldBeDisplayedForDmnDrdNoSelection(editorDocument, editorDocumentModel)) {
    return false;
  }
  const model = getDmnModel(editorDocumentModel);
  if (!model) {
    return false;
  }
  const imports = model.elements.getImports();
  return imports.length > 0;
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="dmn/editor" />
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

  return <ImportsContent {...props} />;
}

function ImportsContent(props: PaneComponentProps): React.JSX.Element | null {
  const model = props.editorDocumentModel as DmnDocumentModel;
  const [refreshKey, setRefreshKey] = useState(0);
  const imports: any[] = model.elements.getImports();

  const refresh = useCallback(() => setRefreshKey((previous) => previous + 1), []);

  const addImport = useCallback(() => {
    model.elements.addImport({
      namespace: 'https://example.com/dmn/',
      locationURI: '',
      importType: DMN_IMPORT_TYPE_URI,
    });
    refresh();
  }, [model, refresh]);

  const removeImport = useCallback(
    (importElement: any) => {
      model.elements.removeImport(importElement);
      refresh();
    },
    [model, refresh],
  );

  const updateImport = useCallback(
    (importElement: any, propertyName: string, value: any) => {
      model.elements.updateImport(importElement, propertyName, value);
      refresh();
    },
    [model, refresh],
  );

  return (
    <PaneBody key={refreshKey}>
      {imports.length === 0 && (
        <div className="dmn-imports__empty" data-test--dmn-imports-empty={true}>
          No imports defined.
        </div>
      )}

      {imports.map((importElement: any) => (
        <ImportEntry
          key={importElement.id}
          importElement={importElement}
          onUpdate={updateImport}
          onRemove={removeImport}
        />
      ))}

      <div className="dmn-imports__actions" data-test--dmn-imports-actions={true}>
        <button type="button" className="dmn-imports__add-button" onClick={addImport} data-test--dmn-imports-add={true}>
          + Add Import
        </button>
      </div>
    </PaneBody>
  );
}

type ImportEntryProps = {
  importElement: any;
  onUpdate: (importElement: any, propertyName: string, value: any) => void;
  onRemove: (importElement: any) => void;
};

function ImportEntry(props: ImportEntryProps): React.JSX.Element {
  const { importElement, onUpdate, onRemove } = props;

  return (
    <div className="dmn-imports__entry" data-test--dmn-import-entry={importElement.namespace ?? importElement.id}>
      <PaneProperty
        label="Namespace"
        type="text"
        value={importElement.namespace ?? ''}
        onCommit={(value: any) => onUpdate(importElement, 'namespace', value)}
        htmlAttributes={{ 'data-test--dmn-import-namespace': true }}
      />
      <PaneProperty
        label="Location URI"
        type="text"
        value={importElement.locationURI ?? ''}
        onCommit={(value: any) => onUpdate(importElement, 'locationURI', value)}
        htmlAttributes={{ 'data-test--dmn-import-location': true }}
      />
      <PaneProperty
        label="Import Type"
        type="text"
        value={importElement.importType ?? ''}
        disabled={true}
        htmlAttributes={{ 'data-test--dmn-import-type': true }}
      />

      <div className="dmn-imports__entry-actions">
        <button
          type="button"
          className="dmn-imports__remove-button"
          onClick={() => onRemove(importElement)}
          data-test--dmn-import-remove={true}
        >
          Remove
        </button>
      </div>
    </div>
  );
}
