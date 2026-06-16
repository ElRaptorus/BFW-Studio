import type { Bifrost } from '#bifrost/Bifrost';
import { SplitterLayout } from '#components/splitter/SplitterLayout';

import React, { useState } from 'react';

import type { DocumentInspectorProps, EditorDocument, Studio } from '@evil/bifrost_fw_sdk';
import { DocumentContentInspector, DocumentTypeDefinitionInspector, Icon, Tree } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../EngineBpmnDebuggerEditorDocumentModel';
import './DebuggerInspector.scss';
import { RuntimeExpressionRunner } from './panes/ExpressionRunner';
import { ProcessInstanceInspector } from './panes/ProcessInstanceInspector';
import { DebuggerSelectionInspector } from './panes/SelectionInspector';
import { XmlInspector } from './panes/XmlInspector';

export function EngineBpmnDebuggerDocumentInspector(props: DocumentInspectorProps): React.JSX.Element | null {
  const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;

  const viewMediatorId = 'debuggerInspector';

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
    <div className="pane__content pane__content--no-padding pane__content--flex debugger-inspector-splitter--container">
      <SplitterLayout
        secondaryMinSize={40}
        secondaryInitialSize={200}
        primaryMinSize={185}
        primaryIndex={1}
        customClassName="debugger-inspector-splitter"
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
              label: `Selection (${model.selectedElements.length})`,
              labelIcon: 'ph-light ph-selection',
              pathId: `inspector/debugger/selection`,
              metadata: {
                action: 'show-selection',
              },
            },
            {
              type: 'file',
              label: 'Expression Runner',
              labelIcon: 'ph-light ph-test-tube',
              pathId: `inspector/debugger/expression-runner`,
              metadata: {
                action: 'show-expression-runner',
              },
            },
            {
              type: 'file',
              label: 'Process Instance',
              labelIcon: 'ph-light ph-gear',
              pathId: `inspector/debugger/process-instance`,
              metadata: {
                action: 'show-process-instance-data',
              },
            },
            {
              type: 'file',
              label: 'XML',
              labelIcon: 'ph-light ph-code',
              pathId: `inspector/debugger/xml`,
              metadata: {
                action: 'show-xml-data',
              },
            },
            {
              type: 'file',
              label: 'Editor Document Data',
              labelIcon: 'ph-light ph-file-magnifying-glass',
              pathId: `inspectordebugger/document-data`,
              metadata: {
                action: 'show-document-data',
              },
            },
            {
              type: 'file',
              label: 'Editor Document Type',
              labelIcon: 'ph-light ph-file-code',
              pathId: `inspectordebugger/document-type-definition`,
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
  model: EngineBpmnDebuggerEditorDocumentModel;
  selectedView: string;
  studio: Studio;
};

function resolveViewFromAction(action: string | undefined): string | null {
  switch (action) {
    case 'show-selection':
      return 'selection';
    case 'show-expression-runner':
      return 'expressionRunner';
    case 'show-process-instance-data':
      return 'processInstance';
    case 'show-xml-data':
      return 'xml';
    case 'show-document-data':
      return 'document-data';
    case 'show-document-type-definition':
      return 'document-type-definition';
    default:
      return null;
  }
}

function InspectorShowroom(props: InspectorShowroomProps): React.JSX.Element {
  switch (props.selectedView) {
    case 'expressionRunner':
      return (
        <RuntimeExpressionRunner editorDocument={props.editorDocument} model={props.model} studio={props.studio} />
      );

    case 'xml':
      return <XmlInspector editorDocument={props.editorDocument} model={props.model} studio={props.studio} />;
    case 'processInstance':
      return (
        <ProcessInstanceInspector editorDocument={props.editorDocument} model={props.model} studio={props.studio} />
      );
    case 'document-data':
      return <DocumentContentInspector editorDocument={props.editorDocument} studio={props.studio} />;
    case 'document-type-definition':
      return <DocumentTypeDefinitionInspector editorDocument={props.editorDocument} studio={props.studio} />;
    case 'selection':
    default:
      return (
        <DebuggerSelectionInspector editorDocument={props.editorDocument} model={props.model} studio={props.studio} />
      );
  }
}
