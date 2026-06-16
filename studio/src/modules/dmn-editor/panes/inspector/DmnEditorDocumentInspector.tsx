import type { Bifrost } from '#bifrost/Bifrost';
import { SplitterLayout } from '#components/splitter/SplitterLayout';

import React, { useState } from 'react';

import type { DocumentInspectorProps, EditorDocument, Studio } from '@evil/bifrost_fw_sdk';
import {
  DocumentContentInspector,
  DocumentTypeDefinitionInspector,
  Icon,
  MultiLineCodeEditor,
  Tree,
} from '@evil/bifrost_fw_sdk';

import type DmnDocumentModel from '../../DmnDocumentModel';
import './DmnEditorInspector.scss';
import { DmnSanitizerInspector } from './panes/DmnSanitizerInspector';

export function DmnEditorDocumentInspector(props: DocumentInspectorProps): React.JSX.Element | null {
  const model = props.editorDocumentModel as DmnDocumentModel;

  const viewMediatorId = 'dmnEditorInspector';
  const selectionCount = model?.selection?.getElements()?.length ?? 0;

  const [selectedView, setSelectedView] = useState(() => {
    if (!model) {
      return 'xml';
    }
    if (!props.studio.views.isRegistered(viewMediatorId)) {
      return 'xml';
    }
    const metadata = props.studio.views.getById(viewMediatorId).getSelectedMetadata()[0];
    return resolveViewFromAction(metadata?.action) ?? 'xml';
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
              label: `Selection (${selectionCount})`,
              labelIcon: 'ph-light ph-cursor-click',
              pathId: 'inspector/dmn-editor/selection',
              metadata: {
                action: 'show-selection',
              },
            },
            {
              type: 'file',
              label: 'XML',
              labelIcon: 'ph-light ph-code',
              pathId: 'inspector/dmn-editor/xml',
              metadata: {
                action: 'show-xml-data',
              },
            },
            {
              type: 'file',
              label: 'Editor Document Data',
              labelIcon: 'ph-light ph-file-magnifying-glass',
              pathId: 'inspector/dmn-editor/document-data',
              metadata: {
                action: 'show-document-data',
              },
            },
            {
              type: 'file',
              label: 'Sanitizer',
              labelIcon: 'ph-light ph-spray-bottle',
              pathId: 'inspector/dmn-editor/sanitizer',
              metadata: {
                action: 'show-sanitizer',
              },
            },
            {
              type: 'file',
              label: 'Editor Document Type',
              labelIcon: 'ph-light ph-file-code',
              pathId: 'inspector/dmn-editor/document-type-definition',
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
  model: DmnDocumentModel;
  selectedView: string;
  studio: Studio;
};

function resolveViewFromAction(action: string | undefined): string | null {
  switch (action) {
    case 'show-selection':
      return 'selection';
    case 'show-xml-data':
      return 'xml';
    case 'show-sanitizer':
      return 'sanitizer';
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
    case 'selection':
      return <DmnSelectionInspector model={props.model} studio={props.studio} />;
    case 'xml':
      return <DmnXmlInspector model={props.model} studio={props.studio} />;
    case 'sanitizer':
      return <DmnSanitizerInspector editorDocument={props.editorDocument} model={props.model} studio={props.studio} />;
    case 'document-data':
      return <DocumentContentInspector editorDocument={props.editorDocument} studio={props.studio} />;
    case 'document-type-definition':
      return <DocumentTypeDefinitionInspector editorDocument={props.editorDocument} studio={props.studio} />;
    default:
      return <DmnXmlInspector model={props.model} studio={props.studio} />;
  }
}

type DmnXmlInspectorProps = {
  model: DmnDocumentModel;
  studio: Studio;
};

function DmnXmlInspector(props: DmnXmlInspectorProps): React.JSX.Element {
  return (
    <div className="pane__content editor-inspector-pane__content--flow-node-props">
      <div className="flow-node-props__information-header">
        <span className="flow-node-props__information-header--text">XML</span>
      </div>
      <MultiLineCodeEditor
        studio={props.studio}
        htmlId="dmn-editor-inspector-xml"
        fontSize={12}
        initialValue={props.model.currentXml ?? ''}
        readOnly={true}
        language="html"
      />
    </div>
  );
}

type DmnSelectionInspectorProps = {
  model: DmnDocumentModel;
  studio: Studio;
};

function DmnSelectionInspector(props: DmnSelectionInspectorProps): React.JSX.Element {
  const selectedElements = props.model.selection.getElements();

  const serialized = selectedElements.map((element) => {
    const businessObject = element.businessObject;

    const safeSerialize = (object: any, depth: number = 0): any => {
      if (depth > 3 || object == null) {
        return object;
      }

      if (typeof object !== 'object') {
        return object;
      }

      if (Array.isArray(object)) {
        return object.map((item) => safeSerialize(item, depth + 1));
      }

      const result: Record<string, any> = {};
      for (const key of Object.keys(object)) {
        if (key.startsWith('$') && key !== '$type') {
          continue;
        }
        if (key === 'di' || key === 'bpmndi' || key === 'dmndi') {
          continue;
        }
        result[key] = safeSerialize(object[key], depth + 1);
      }
      return result;
    };

    return {
      id: element.id,
      name: element.name,
      type: element.type,
      businessObject: safeSerialize(businessObject),
    };
  });

  const jsonString = JSON.stringify(serialized, null, 2);

  return (
    <div className="pane__content editor-inspector-pane__content--flow-node-props">
      <div className="flow-node-props__information-header">
        <span className="flow-node-props__information-header--text">Selection ({selectedElements.length})</span>
      </div>
      <MultiLineCodeEditor
        studio={props.studio}
        htmlId="dmn-editor-inspector-selection"
        fontSize={12}
        initialValue={jsonString}
        readOnly={true}
        language="json"
      />
    </div>
  );
}
