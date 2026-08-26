import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { DocumentInspectorProps } from '#bifrost/contracts/PaneTypes';
import { Icon } from '#components/Icon';
import { Tree } from '#components/Tree/Tree';
import { DocumentContentInspector } from '#components/panes/inspectors/DocumentContentInspector';
import { DocumentTypeDefinitionInspector } from '#components/panes/inspectors/DocumentTypeDefinitionInspector';
import { SplitterLayout } from '#components/splitter/SplitterLayout';

import React, { useState } from 'react';

import type BpmnDocumentModel from '../../BpmnDocumentModel';
import './EditorInspector.scss';
import { SanitizerInspector } from './panes/SanitizerInspector';
import { EditorSelectionInspector } from './panes/SelectionInspector';
import { XmlInspector } from './panes/XmlInspector';

export function BpmnEditorDocumentInspector(props: DocumentInspectorProps): React.JSX.Element | null {
  const model = props.editorDocumentModel as BpmnDocumentModel;

  const viewMediatorId = 'editorInspector';

  const [selectedView, setSelectedView] = useState(() => {
    if (!model) {
      return 'selection';
    }
    if (!props.studio.views.isRegistered(viewMediatorId)) {
      return 'selection';
    }
    const metadata = props.studio.views.getById(viewMediatorId).getSelectedMetadata()[0];
    return resolveViewFromAction(metadata?.action) ?? 'selection';
  });

  function onTreeClick(metadata: any): void {
    const view = resolveViewFromAction(metadata?.action);
    if (view != null) {
      setSelectedView(view);
    }
  }

  if (!model) {
    return null;
  }

  return (
    <div className="pane__content pane__content--no-padding pane__content--flex editor-inspector-splitter--container">
      <SplitterLayout
        secondaryMinSize={40}
        secondaryInitialSize={200}
        primaryMinSize={185}
        primaryIndex={1}
        customClassName="editor-inspector-splitter"
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
              label: `Selection (${model.selection.getElements().length})`,
              labelIcon: 'ph-light ph-selection',
              pathId: `inspector/editor/selection`,
              metadata: {
                action: 'show-selection',
              },
            },
            {
              type: 'file',
              label: 'Sanitizer',
              labelIcon: 'ph ph-spray-bottle',
              pathId: `inspector/editor/sanitizer`,
              metadata: {
                action: 'show-sanitizer',
              },
            },
            {
              type: 'file',
              label: 'XML',
              labelIcon: 'ph-light ph-code',
              pathId: `inspector/editor/xml`,
              metadata: {
                action: 'show-xml-data',
              },
            },
            {
              type: 'file',
              label: 'Editor Document Data',
              labelIcon: 'ph-light ph-file-magnifying-glass',
              pathId: `inspector/editor/document-data`,
              metadata: {
                action: 'show-document-data',
              },
            },
            {
              type: 'file',
              label: 'Editor Document Type',
              labelIcon: 'ph-light ph-file-code',
              pathId: `inspector/editor/document-type-definition`,
              metadata: {
                action: 'show-document-type-definition',
              },
            },
          ]}
        />
        <InspectorShowroom
          editorDocument={props.editorDocument}
          model={model}
          selectedView={selectedView}
          studio={props.studio}
        />
      </SplitterLayout>
    </div>
  );
}

type InspectorShowroomProps = {
  editorDocument: EditorDocument;
  model: BpmnDocumentModel;
  selectedView: string;
  studio: Bifrost;
};

function resolveViewFromAction(action: string | undefined): string | null {
  switch (action) {
    case 'show-selection':
      return 'selection';
    case 'show-xml-data':
      return 'xml';
    case 'show-document-data':
      return 'document-data';
    case 'show-document-type-definition':
      return 'document-type-definition';
    case 'show-sanitizer':
      return 'sanitizer';
    default:
      return null;
  }
}

function InspectorShowroom(props: InspectorShowroomProps): React.JSX.Element {
  switch (props.selectedView) {
    case 'xml':
      return <XmlInspector editorDocument={props.editorDocument} model={props.model} studio={props.studio} />;
    case 'document-data':
      return <DocumentContentInspector editorDocument={props.editorDocument} studio={props.studio} />;
    case 'document-type-definition':
      return <DocumentTypeDefinitionInspector editorDocument={props.editorDocument} studio={props.studio} />;
    case 'sanitizer':
      return <SanitizerInspector editorDocument={props.editorDocument} model={props.model} studio={props.studio} />;
    case 'selection':
    default:
      return (
        <EditorSelectionInspector editorDocument={props.editorDocument} model={props.model} studio={props.studio} />
      );
  }
}
