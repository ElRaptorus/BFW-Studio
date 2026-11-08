import type { Bifrost } from '#bifrost/Bifrost';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Icon } from '#components/Icon';
import { Tree } from '#components/Tree/Tree';
import { Pane } from '#components/panes/Pane';
import { PaneHeader } from '#components/panes/PaneHeader';

import React, { useCallback, useEffect, useRef, useState } from 'react';

import InteractionsDocumentModel from '../InteractionsDocumentModel';
import {
  buildInteractionsProcessTree,
  collectFilteredProcessReferences,
  listedProcessesCheckboxState,
} from '../interactionsProcessTree';

export const paneProvider: PaneProvider = {
  getPaneTitle: () => 'Processes',
  Pane: PaneFull,
  PaneContent: PaneContent,
  classNames: 'app-layout__solution-pane',
  shouldBeDisplayed: (editorDocument) => editorDocument?.documentType === 'bpmn-interactions-map',
};

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane classNames="app-layout__full-height-pane">
      <PaneHeader studio={props.studio} title="Processes" paneId={props.paneId} collapsed={props.collapsed} />
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function ProcessesMasterCheckbox(props: {
  checkboxState: 'checked' | 'unchecked' | 'mixed';
  disabled: boolean;
  onToggle: () => void;
}): React.JSX.Element {
  const checkboxReference = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const checkbox = checkboxReference.current;
    if (checkbox != null) {
      checkbox.indeterminate = props.checkboxState === 'mixed';
    }
  }, [props.checkboxState]);
  return (
    <input
      ref={checkboxReference}
      type="checkbox"
      title="Select or clear every process in the filtered list"
      aria-label="Select or clear every process in the filtered list"
      checked={props.checkboxState === 'checked'}
      disabled={props.disabled}
      data-test--interactions-select-all-processes
      onChange={() => {
        props.onToggle();
      }}
    />
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element {
  const bifrost: Bifrost = props.studio;
  const model = props.editorDocumentModel instanceof InteractionsDocumentModel ? props.editorDocumentModel : null;
  const [filterText, setFilterText] = useState('');
  const catalog = model?.getCatalog() ?? [];
  const listedReferences = model == null ? [] : collectFilteredProcessReferences(catalog, filterText);

  const treeEntries =
    model == null
      ? []
      : buildInteractionsProcessTree(catalog, filterText, (reference) => model.isProcessSelected(reference));

  const masterState =
    model == null
      ? ('unchecked' as const)
      : listedProcessesCheckboxState(listedReferences, (reference) => model.isProcessSelected(reference));

  const onMasterCheckboxToggle = useCallback(() => {
    if (model == null) {
      return;
    }
    const references = collectFilteredProcessReferences(model.getCatalog(), filterText);
    if (references.length === 0) {
      return;
    }
    const allListedSelected = references.every((reference) => model.isProcessSelected(reference));
    model.setProcessesSelected(references, !allListedSelected);
  }, [filterText, model]);

  const onActionIconClick = useCallback(
    (data: {
      actionId?: string;
      metadata?: { reference?: { uri: string; processId: string }; fileUri?: string; invalid?: boolean };
    }) => {
      if (model == null || data.actionId !== 'checkbox') {
        return;
      }
      const reference = data.metadata?.reference;
      if (reference != null) {
        model.setProcessSelected(reference, !model.isProcessSelected(reference));
        return;
      }
      const fileUri = data.metadata?.fileUri;
      if (fileUri == null || data.metadata?.invalid === true) {
        return;
      }
      const fileReferences = collectFilteredProcessReferences(model.getCatalog(), filterText).filter(
        (item) => item.uri === fileUri,
      );
      const allListedSelected = fileReferences.every((item) => model.isProcessSelected(item));
      model.setProcessesSelected(fileReferences, !allListedSelected);
    },
    [filterText, model],
  );

  const onDoubleClick = useCallback(
    (metadata: { reference?: { uri: string; processId: string } }) => {
      const reference = metadata.reference;
      if (reference == null) {
        return;
      }
      void bifrost.commands.executeCommand('std.editor.gotoSymbolInDocument', [reference.uri, reference.processId]);
    },
    [bifrost],
  );

  const onClick = useCallback((): void => undefined, []);

  return (
    <>
      <div className="pane-tab-input__outer interactions-processes-filter" style={{ flex: 'none' }}>
        <ProcessesMasterCheckbox
          checkboxState={masterState}
          disabled={listedReferences.length === 0}
          onToggle={onMasterCheckboxToggle}
        />
        <input
          type="text"
          className="pane-tab-input"
          placeholder="Filter processes..."
          value={filterText}
          onChange={(event) => setFilterText(event.target.value)}
          data-test--interactions-process-filter
        />
      </div>
      <div className="pane__content pane__content--treeview pane__content--scroll-vertically">
        <Tree
          studio={bifrost}
          viewMediatorId="bpmn-interactions/processes"
          className="kbm-interactions-processes"
          entries={treeEntries}
          iconComponent={Icon}
          onClick={onClick}
          onDoubleClick={onDoubleClick}
          onActionIconClick={onActionIconClick}
        />
      </div>
    </>
  );
}
