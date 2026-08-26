import type { Bifrost } from '#bifrost/Bifrost';
import type { DocumentInspectorProps } from '#bifrost/contracts/PaneTypes';
import { Tree } from '#components/Tree/Tree';
import { DocumentContentInspector } from '#components/panes/inspectors/DocumentContentInspector';
import { DocumentTypeDefinitionInspector } from '#components/panes/inspectors/DocumentTypeDefinitionInspector';
import { SplitterLayout } from '#components/splitter/SplitterLayout';

import React, { useState } from 'react';

import { Icon } from '../../../Icon';

export function DefaultDocumentInspector(props: DocumentInspectorProps): React.JSX.Element {
  const viewMediatorId = 'default-document-inspector';

  const [selectedView, setSelectedView] = useState(() => {
    if (!props.studio.views.isRegistered(viewMediatorId)) {
      return 'document-data';
    }
    const metadata = props.studio.views.getById(viewMediatorId).getSelectedMetadata()[0];
    return resolveViewFromAction(metadata?.action) ?? 'document-data';
  });

  function onTreeClick(metadata: any): void {
    const view = resolveViewFromAction(metadata?.action);
    if (view != null) {
      setSelectedView(view);
    }
  }

  return (
    <div className="pane__content pane__content--no-padding pane__content--flex default_document_inspector-splitter--container">
      <SplitterLayout
        secondaryMinSize={40}
        secondaryInitialSize={200}
        primaryMinSize={185}
        primaryIndex={1}
        customClassName="default_document_inspector-splitter"
        onSecondaryPaneSizeChange={() => (props.studio as Bifrost).panes.emitPaneSizeChanged()}
      >
        <Tree
          studio={props.studio}
          iconComponent={Icon}
          viewMediatorId={viewMediatorId}
          onClick={(metadata) => onTreeClick(metadata)}
          entries={[
            {
              type: 'file',
              label: 'Editor Document Data',
              labelIcon: 'ph ph-file-magnifying-glass',
              pathId: `inspector/default/document-data`,
              metadata: {
                action: 'show-document-data',
              },
            },
            {
              type: 'file',
              label: 'Editor Document Type',
              labelIcon: 'ph ph-file-code',
              pathId: `inspector/default/document-type-definition`,
              metadata: {
                action: 'show-document-type-definition',
              },
            },
          ]}
        />
        {selectedView === 'document-type-definition' ? (
          <DocumentTypeDefinitionInspector {...props} />
        ) : (
          <DocumentContentInspector {...props} />
        )}
      </SplitterLayout>
    </div>
  );
}

function resolveViewFromAction(action: string | undefined): string | null {
  switch (action) {
    case 'show-document-data':
      return 'document-data';
    case 'show-document-type-definition':
      return 'document-type-definition';
    default:
      return null;
  }
}
