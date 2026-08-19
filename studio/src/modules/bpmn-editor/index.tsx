import type { Bifrost } from '#bifrost/Bifrost';
import { DataObjectDetailLevel } from '#modules/bpmn-core/DataObjectDetailsSettings';
import '@mdxeditor/editor/style.css';

import React from 'react';

import type { SearchResult } from '../../../../studio-sdk/src/contracts/internal/SearchTypes';
import BpmnDocumentModel from './BpmnDocumentModel';
import BpmnDocumentRenderer from './BpmnDocumentRenderer';
import { BpmnSearchIndexerWorkerClient } from './browser/BpmnSearchIndexerWorkerClient';
import { BpmnSymbolIndexerWorkerClient } from './browser/BpmnSymbolIndexerWorkerClient';
import FormBuilderRenderer from './form-builder/FormBuilderRenderer';
import { initializeBpmnCommands } from './initializers/initializeBpmnCommands';
import { initializeBpmnHelpTexts } from './initializers/initializeBpmnHelpTexts';
import { initializeBpmnMenus } from './initializers/initializeBpmnMenus';
import { initializeBpmnPanes } from './initializers/initializeBpmnPanes';
import { initializeFeelContextCommands } from './initializers/initializeFeelContextCommands';
import { initializeSanitizerCommands } from './initializers/initializeSanitizerCommands';
import BpmnMergeResolver from './merge/BpmnMergeResolver';
import BpmnConditionalEventFragmentRenderer from './open-in-new-tab-renderer/BpmnConditionalEventFragmentRenderer';
import BpmnDataOutputAssociationTransformationFragmentRenderer from './open-in-new-tab-renderer/BpmnDataOutputAssociationTransformationFragmentRenderer';
import BpmnDefaultCustomStartTokenFragmentRenderer from './open-in-new-tab-renderer/BpmnDefaultCustomStartTokenFragmentRenderer';
import BpmnDocumentationFragmentRenderer from './open-in-new-tab-renderer/BpmnDocumentationFragmentRenderer';
import BpmnExamplePayloadFragmentRenderer from './open-in-new-tab-renderer/BpmnExamplePayloadFragmentRenderer';
import BpmnExampleResultFragmentRenderer from './open-in-new-tab-renderer/BpmnExampleResultFragmentRenderer';
import BpmnHttpServiceTaskBodyFragmentRenderer from './open-in-new-tab-renderer/BpmnHttpServiceTaskBodyFragmentRenderer';
import BpmnLoopBreakConditionFragmentRenderer from './open-in-new-tab-renderer/BpmnLoopBreakConditionFragmentRenderer';
import BpmnMessageAndSignalEventPayloadFragmentRenderer from './open-in-new-tab-renderer/BpmnMessageAndSignalEventPayloadFragmentRenderer';
import BpmnScriptFragmentRenderer from './open-in-new-tab-renderer/BpmnScriptFragmentRenderer';
import BpmnSequenceFlowConditionFragmentRenderer from './open-in-new-tab-renderer/BpmnSequenceFlowConditionFragmentRenderer';
import BpmnTextFragmentRenderer from './open-in-new-tab-renderer/BpmnTextFragmentRenderer';
import BpmnUserTaskAssigneesFragmentRenderer from './open-in-new-tab-renderer/BpmnUserTaskAssigneesFragmentRenderer';
import EditorInspectorItemFragmentRenderer from './panes/inspector/EditorInspectorItemFragmentRenderer';
import { BpmnEditorDocumentInspector } from './panes/inspector/EditorInspectorPane';

export const BPMN_DOCUMENT_TYPE = 'bpmn';

export function onLoad(bifrost: Bifrost): void {
  bifrost.editors.registerDocumentType(BPMN_DOCUMENT_TYPE, {
    uriMatch: /\.bpmn$/,
    modelKey: 'BpmnDocumentModel',
    modelConstructor: BpmnDocumentModel,
    rendererKey: 'BpmnRenderer',
    rendererConstructor: BpmnDocumentRenderer,
    inspectorKey: 'BpmnEditorDocumentInspector',
    inspectorConstructor: BpmnEditorDocumentInspector,
    mergeResolverKey: 'BpmnMergeResolver',
    mergeResolverConstructor: BpmnMergeResolver,
    icon: 'bpmn/editor-tab/bpmn',
  });
  bifrost.editors.registerDocumentType('bpmn.script', {
    uriMatch: /^fragment\+bpmn\.script:/,
    modelKey: null,
    rendererKey: 'BpmnScriptRenderer',
    rendererConstructor: BpmnScriptFragmentRenderer,
    icon: 'bpmn/editor-tab/docs',
  });
  bifrost.editors.registerDocumentType('bpmn.text', {
    uriMatch: /^fragment\+bpmn\.text:/,
    modelKey: null,
    rendererKey: 'BpmnTextRenderer',
    rendererConstructor: BpmnTextFragmentRenderer,
    icon: 'bpmn/editor-tab/docs',
  });
  bifrost.editors.registerDocumentType('bpmn.docs', {
    uriMatch: /^fragment\+bpmn\.docs:/,
    modelKey: null,
    rendererKey: 'BpmnDocumentationRenderer',
    rendererConstructor: BpmnDocumentationFragmentRenderer,
    icon: 'bpmn/editor-tab/docs',
  });
  bifrost.editors.registerDocumentType('bpmn.data-output-association.transformation', {
    uriMatch: /^fragment\+bpmn\.data-output-association\.transformation:/,
    modelKey: null,
    rendererKey: 'BpmnDataOutputAssociationTransformationRenderer',
    rendererConstructor: BpmnDataOutputAssociationTransformationFragmentRenderer,
    icon: 'bpmn/editor-tab/docs',
  });
  bifrost.editors.registerDocumentType('bpmn.http-service-task.body', {
    uriMatch: /^fragment\+bpmn\.http-service-task\.body:/,
    modelKey: null,
    rendererKey: 'BpmnHttpServiceTaskBodyRenderer',
    rendererConstructor: BpmnHttpServiceTaskBodyFragmentRenderer,
    icon: 'bpmn/editor-tab/docs',
  });
  bifrost.editors.registerDocumentType('bpmn.general.example-payload', {
    uriMatch: /^fragment\+bpmn\.general\.example-payload:/,
    modelKey: null,
    rendererKey: 'BpmnExamplePayloadFragmentRenderer',
    rendererConstructor: BpmnExamplePayloadFragmentRenderer,
    icon: 'bpmn/editor-tab/docs',
  });
  bifrost.editors.registerDocumentType('bpmn.general.example-result', {
    uriMatch: /^fragment\+bpmn\.general\.example-result:/,
    modelKey: null,
    rendererKey: 'BpmnExampleResultFragmentRenderer',
    rendererConstructor: BpmnExampleResultFragmentRenderer,
    icon: 'bpmn/editor-tab/docs',
  });
  bifrost.editors.registerDocumentType('bpmn.sequence-flow.condition', {
    uriMatch: /^fragment\+bpmn\.sequence-flow\.condition:/,
    modelKey: null,
    rendererKey: 'BpmnSequenceFlowConditionRenderer',
    rendererConstructor: BpmnSequenceFlowConditionFragmentRenderer,
    icon: 'bpmn/editor-tab/docs',
  });
  bifrost.editors.registerDocumentType('bpmn.conditional-event', {
    uriMatch: /^fragment\+bpmn\.conditional-event:/,
    modelKey: null,
    rendererKey: 'BpmnConditionalEventRenderer',
    rendererConstructor: BpmnConditionalEventFragmentRenderer,
    icon: 'bpmn/editor-tab/docs',
  });
  bifrost.editors.registerDocumentType('bpmn.message-event.payload', {
    uriMatch: /^fragment\+bpmn\.message-event\.payload:/,
    modelKey: null,
    rendererKey: 'BpmnMessageEventPayloadRenderer',
    rendererConstructor: BpmnMessageAndSignalEventPayloadFragmentRenderer,
    icon: 'bpmn/editor-tab/docs',
  });
  bifrost.editors.registerDocumentType('bpmn.loop-break-condition.payload', {
    uriMatch: /^fragment\+bpmn\.loop-break-condition:/,
    modelKey: null,
    rendererKey: 'BpmnLoopBreakConditionFragmentRenderer',
    rendererConstructor: BpmnLoopBreakConditionFragmentRenderer,
    icon: 'bpmn/editor-tab/docs',
  });
  bifrost.editors.registerDocumentType('bpmn.user-task-assignees', {
    uriMatch: /^fragment\+bpmn\.user-task-assignees:/,
    modelKey: null,
    rendererKey: 'BpmnUserTaskAssigneesRenderer',
    rendererConstructor: BpmnUserTaskAssigneesFragmentRenderer,
    icon: 'bpmn/editor-tab/docs',
  });
  bifrost.editors.registerDocumentType('bpmn.start-event.default-custom-start-token', {
    uriMatch: /^fragment\+bpmn\.start-event\.default-custom-start-token:/,
    modelKey: null,
    rendererKey: 'BpmnDefaultCustomStartTokenRenderer',
    rendererConstructor: BpmnDefaultCustomStartTokenFragmentRenderer,
    icon: 'bpmn/editor-tab/docs',
  });
  bifrost.editors.registerDocumentType('bpmn.form-builder', {
    uriMatch: /^fragment\+bpmn\.form-builder:/,
    modelKey: null,
    rendererKey: 'FormBuilderRenderer',
    rendererConstructor: FormBuilderRenderer,
    icon: 'bpmn/editor-tab/docs',
  });
  bifrost.editors.registerDocumentType('bpmn.inspector.item', {
    uriMatch: /^fragment\+bpmn\.inspector\.item:/i,
    modelKey: null,
    rendererKey: 'EditorInspectorItemFragmentRenderer',
    rendererConstructor: EditorInspectorItemFragmentRenderer,
    icon: 'bpmn/editor-tab/docs',
  });

  bifrost.settings.register({
    'bpmn.editor.showGrid': {
      category: 'BPMN Editor',
      type: 'boolean',
      label: 'Show Grid',
      description: 'Display a grid overlay on the BPMN canvas.',
      default: false,
    },
    'bpmn.editor.showInternalCustomProperties': {
      category: 'BPMN Editor',
      type: 'boolean',
      label: 'Show Internal Custom Properties',
      description: 'Display internal custom extension properties on BPMN elements.',
      default: false,
    },
    'bpmn.editor.showDocumentationMarker': {
      category: 'BPMN Editor',
      type: 'boolean',
      label: 'Show Documentation Marker',
      description: 'Display a visual marker on elements that have documentation attached.',
      default: true,
    },
    'bpmn.editor.showMultipleOutgoingSequenceFlowsMarkers': {
      category: 'BPMN Editor',
      type: 'boolean',
      label: 'Show Multiple Outgoing Sequence Flows Markers',
      description: 'Show error markers on flow nodes with multiple outgoing sequence flows.',
      default: true,
    },
    'bpmn.editor.dataObjectDetailLevel': {
      category: 'BPMN Editor',
      type: 'string',
      label: 'Data Object Detail Level',
      description: 'Controls how much detail is shown for data objects on the canvas.',
      default: DataObjectDetailLevel.showAll,
      enum: [
        DataObjectDetailLevel.showAll,
        DataObjectDetailLevel.hideInputAssociations,
        DataObjectDetailLevel.hideAllAssociations,
        DataObjectDetailLevel.hideAll,
      ],
      enumLabels: {
        [DataObjectDetailLevel.showAll]: 'Show Everything',
        [DataObjectDetailLevel.hideInputAssociations]: 'Hide Input Associations',
        [DataObjectDetailLevel.hideAllAssociations]: 'Hide All Associations',
        [DataObjectDetailLevel.hideAll]: 'Hide Everything',
      },
    },
    'bpmn.editor.customColors': {
      category: 'BPMN Editor',
      type: 'array',
      label: 'Custom Colors',
      description: 'Named fill and border colors available in the BPMN element color picker.',
      default: [],
      items: {
        type: 'object',
        properties: {
          label: {
            type: 'string',
            label: 'Name',
            description: 'Shown in the color picker.',
            default: '',
          },
          backgroundColor: {
            type: 'color',
            label: 'Fill',
            description: 'Background fill color.',
            default: '#808080',
          },
          borderColor: {
            type: 'color',
            label: 'Border',
            description: 'Outline color.',
            default: '#404040',
          },
        },
      },
    },
  });

  bifrost.solution.registerDefaultIncludedFiles(['**/*.bpmn', '**/*.xml']);

  bifrost.symbolIndex.registerSymbolIndexerWorkerClient(BPMN_DOCUMENT_TYPE, new BpmnSymbolIndexerWorkerClient());

  bifrost.searchIndex.registerSearchIndexerWorkerClient(BPMN_DOCUMENT_TYPE, new BpmnSearchIndexerWorkerClient());
  bifrost.searchIndex.registerSearchResultFilter(BPMN_DOCUMENT_TYPE, (searchResult: SearchResult) => {
    return searchResult.metadata.isSelectable && searchResult.label != null && searchResult.label !== '';
  });

  bifrost.searchView.onOpenSearchResult(BPMN_DOCUMENT_TYPE, (searchResult: SearchResult) => {
    const editorDocument = bifrost.editors.focusOrOpenEditorDocument(searchResult.uri);
    const elementId = searchResult.metadata.elementId;

    bifrost.editors
      .getEditorDocumentModel<BpmnDocumentModel>(editorDocument)
      .then((bpmnDocumentModel: BpmnDocumentModel) => {
        bpmnDocumentModel.onceInteractive(() => {
          bpmnDocumentModel.zoomToElement(elementId);
          bpmnDocumentModel.selection.selectElement(elementId);
        });
      });
  });

  bifrost.icons.registerIcons({
    'bpmn/editor-tab/bpmn': 'ph-fill ph-file-text bpmn__editor--tab-icon',
    'bpmn/editor-tab/docs': 'ph-fill ph-file-text bpmn__editor--tab-icon',
    'bpmn/search-result/types/BusinessRuleTask': 'bpmn-icon-business-rule-task',
    'bpmn/search-result/types/CallActivity': 'bpmn-icon-call-activity',
    'bpmn/search-result/types/ComplexGateway': 'bpmn-icon-gateway-complex',
    'bpmn/search-result/types/DataInputAssociation': 'bpmn-icon-data-input',
    'bpmn/search-result/types/DataObjectReference': 'bpmn-icon-data-object',
    'bpmn/search-result/types/DataOutputAssociation': 'bpmn-icon-data-output',
    'bpmn/search-result/types/DataStoreReference': 'bpmn-icon-data-store',
    'bpmn/search-result/types/EndEvent': 'bpmn-icon-end-event-none',
    'bpmn/search-result/types/EventBasedGateway': 'bpmn-icon-gateway-eventbased',
    'bpmn/search-result/types/EventSubprocess': 'bpmn-icon-event-subprocess-expanded',
    'bpmn/search-result/types/ExclusiveGateway': 'bpmn-icon-gateway-xor',
    'bpmn/search-result/types/Gateway': 'bpmn-icon-gateway-none',
    'bpmn/search-result/types/Group': 'bpmn-icon-group',
    'bpmn/search-result/types/IntermediateCatchEvent': 'bpmn-icon-intermediate-event-none',
    'bpmn/search-result/types/IntermediateThrowEvent': 'bpmn-icon-intermediate-event-none',
    'bpmn/search-result/types/Lane': 'bpmn-icon-lane',
    'bpmn/search-result/types/ManualTask': 'bpmn-icon-manual-task',
    'bpmn/search-result/types/ParallelGateway': 'bpmn-icon-gateway-parallel',
    'bpmn/search-result/types/Participant': 'bpmn-icon-participant',
    'bpmn/search-result/types/ReceiveTask': 'bpmn-icon-receive-task',
    'bpmn/search-result/types/ScriptTask': 'bpmn-icon-script-task',
    'bpmn/search-result/types/SendTask': 'bpmn-icon-send-task',
    'bpmn/search-result/types/SequenceFlow': 'bpmn-icon-connection',
    'bpmn/search-result/types/ServiceTask': 'bpmn-icon-service-task',
    'bpmn/search-result/types/StartEvent': 'bpmn-icon-start-event-none',
    'bpmn/search-result/types/SubProcess': 'bpmn-icon-subprocess-collapsed',
    'bpmn/search-result/types/Task': 'bpmn-icon-task-none',
    'bpmn/search-result/types/TextAnnotation': 'bpmn-icon-text-annotation',
    'bpmn/search-result/types/Transaction': 'bpmn-icon-transaction',
    'bpmn/search-result/types/AdHocSubprocess': 'bpmn-icon-ad-hoc-marker',
    'bpmn/search-result/types/UserTask': 'bpmn-icon-user-task',
    'bpmn/element/UserTask/DynamicForm': 'ph ph-magic-wand icon-dynamic-form',
    'bpmn/element/UserTask/ConfirmForm': 'ph ph-check icon-confirm-form',
    'bpmn/element/UserTask/CustomForm': 'ph ph-book-open-text icon-custom-form',
    'bpmn/element/color': (
      <svg className="icon-custom-color" xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 448 512">
        {/* Font Awesome Pro 6.4.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc. */}
        <path
          className="icon-primary"
          fill="var(--icon-primary-color)"
          d="M64 400V112a16 16 0 0 1 16-16h288a16 16 0 0 1 16 16v288a16 16 0 0 1-16 16H80a16 16 0 0 1-16-16z"
        />
        <path
          className="icon-secondary"
          fill="var(--icon-secondary-color)"
          d="M400 32H48A48 48 0 0 0 0 80v352a48 48 0 0 0 48 48h352a48 48 0 0 0 48-48V80a48 48 0 0 0-48-48zm-16 368a16 16 0 0 1-16 16H80a16 16 0 0 1-16-16V112a16 16 0 0 1 16-16h288a16 16 0 0 1 16 16z"
        />
      </svg>
    ),
    'bpmn/element/color-placeholder': <span className="icon-custom-color"></span>,
    'bpmn/element/multiple-colors': 'ph ph-palette icon-custom-color',
    'bpmn/element/no-color': 'ph ph-prohibit icon-custom-color',
    'bpmn/participant': 'bpmn-icon-participant',
  });

  initializeBpmnCommands(bifrost);
  initializeSanitizerCommands(bifrost);
  initializeBpmnMenus(bifrost);

  bifrost.keybindings.registerKeyBindings({
    client: '*',
    os: 'macos',
    bindings: {
      body: {
        'cmd-n': 'bpmn.editor.newBpmnDocument',
      },
      '.kbm-editor[data-editor-document-type=bpmn]': {
        backspace: 'bpmn.editor.deleteSelectedElements',
        'cmd-c': 'bpmn.editor.copySelectedElements',
        'cmd-v': 'bpmn.editor.pasteElements',

        left: 'bpmn.editor.moveSelectedElementsLeft',
        'shift-left': 'bpmn.editor.moveSelectedElementsLeftAccelerated',
        right: 'bpmn.editor.moveSelectedElementsRight',
        'shift-right': 'bpmn.editor.moveSelectedElementsRightAccelerated',
        up: 'bpmn.editor.moveSelectedElementsUp',
        'shift-up': 'bpmn.editor.moveSelectedElementsUpAccelerated',
        down: 'bpmn.editor.moveSelectedElementsDown',
        'shift-down': 'bpmn.editor.moveSelectedElementsDownAccelerated',
      },
    },
  });

  bifrost.keybindings.registerKeyBindings({
    client: '*',
    os: 'windows',
    bindings: {
      body: {
        'ctrl-n': 'bpmn.editor.newBpmnDocument',
      },
      '.kbm-editor[data-editor-document-type=bpmn]': {
        delete: 'bpmn.editor.deleteSelectedElements',
        'ctrl-c': 'bpmn.editor.copySelectedElements',
        'ctrl-v': 'bpmn.editor.pasteElements',

        left: 'bpmn.editor.moveSelectedElementsLeft',
        'shift-left': 'bpmn.editor.moveSelectedElementsLeftAccelerated',
        right: 'bpmn.editor.moveSelectedElementsRight',
        'shift-right': 'bpmn.editor.moveSelectedElementsRightAccelerated',
        up: 'bpmn.editor.moveSelectedElementsUp',
        'shift-up': 'bpmn.editor.moveSelectedElementsUpAccelerated',
        down: 'bpmn.editor.moveSelectedElementsDown',
        'shift-down': 'bpmn.editor.moveSelectedElementsDownAccelerated',
      },
    },
  });

  bifrost.keybindings.registerKeyBindings({
    client: '*',
    os: 'linux',
    bindings: {
      body: {
        'ctrl-n': 'bpmn.editor.newBpmnDocument',
      },
      '.kbm-editor[data-editor-document-type=bpmn]': {
        delete: 'bpmn.editor.deleteSelectedElements',
        'ctrl-c': 'bpmn.editor.copySelectedElements',
        'ctrl-v': 'bpmn.editor.pasteElements',

        left: 'bpmn.editor.moveSelectedElementsLeft',
        'shift-left': 'bpmn.editor.moveSelectedElementsLeftAccelerated',
        right: 'bpmn.editor.moveSelectedElementsRight',
        'shift-right': 'bpmn.editor.moveSelectedElementsRightAccelerated',
        up: 'bpmn.editor.moveSelectedElementsUp',
        'shift-up': 'bpmn.editor.moveSelectedElementsUpAccelerated',
        down: 'bpmn.editor.moveSelectedElementsDown',
        'shift-down': 'bpmn.editor.moveSelectedElementsDownAccelerated',
      },
    },
  });

  initializeBpmnPanes(bifrost);

  initializeBpmnHelpTexts(bifrost);
  initializeFeelContextCommands(bifrost);
}
