import type { RelativePerformanceEntry } from '#bifrost/common/Performance';

import React, { useMemo } from 'react';

import type {
  EditorDocument,
  EditorDocumentModel,
  PaneComponentProps,
  PaneProvider,
  Studio,
  TableColumnDef,
} from '@evil/bifrost_fw_sdk';
import { Pane, PaneHeader, Table } from '@evil/bifrost_fw_sdk';

export const paneProvider: PaneProvider = {
  shouldBeDisplayed: shouldBeDisplayed,
  getPaneTitle: getPaneTitle,
  Pane: PaneFull,
  PaneTabOptions: PaneTabOptions,
  PaneContent: PaneContent,
};

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel, studio: Studio) {
  return true;
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} menuId="mock/pane-heading-options" paneId={props.paneId}>
        <PaneTabOptions {...props} />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function getPaneTitle(): string {
  return 'Performance Inspector';
}

function PaneContent(props: PaneComponentProps): React.JSX.Element {
  const bifrost = props.studio;
  const filterText = props.dataFromPaneTabOptions && props.dataFromPaneTabOptions.filterText;
  const lowercaseFilterText = (filterText || '').toLowerCase();
  const performanceEntries = [...bifrost.performance.getRelativeEntries()].filter((entry: RelativePerformanceEntry) => {
    return entry.label.toString().toLowerCase().indexOf(lowercaseFilterText) !== -1;
  });

  return <PerformanceInspector performanceEntries={performanceEntries} />;
}

function PaneTabOptions(props: any): React.JSX.Element {
  const onChange = (event: any): void => {
    props.onChangeDataFromPaneTabOptions({ filterText: event.target.value });
  };

  return (
    <div className="pane-tab-input__outer">
      <input
        type="text"
        className="pane-tab-input"
        placeholder="Filter, e.g. by name, type, ..."
        style={{ width: 160 }}
        onChange={onChange}
      />
    </div>
  );
}

const performanceColumns: TableColumnDef<RelativePerformanceEntry>[] = [
  {
    id: 'label',
    accessorKey: 'label',
    header: 'Type',
    enableSorting: false,
    enableResizing: false,
  },
  {
    id: 'duration',
    accessorKey: 'duration',
    header: 'Duration (ms)',
    enableSorting: false,
    enableResizing: false,
    cell: ({ getValue }) => {
      const value = getValue() as number | null | undefined;
      return value != null ? `${value}` : '';
    },
  },
  {
    id: 'time',
    accessorKey: 'time',
    header: 'Time',
    enableSorting: false,
    enableResizing: false,
    cell: ({ getValue }) => `${getValue() as number}`,
  },
];

function PerformanceInspector(props: { performanceEntries: RelativePerformanceEntry[] }): React.JSX.Element {
  const data = useMemo(() => props.performanceEntries, [props.performanceEntries]);

  return (
    <div className="pane__content pane__content--table" style={{ minHeight: '60px' }}>
      <Table<RelativePerformanceEntry>
        data={data}
        columns={performanceColumns}
        getRowId={(_row, index) => String(index)}
      />
    </div>
  );
}
