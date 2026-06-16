import type { Bifrost } from '#bifrost/Bifrost';
import type { EngineConnectionManager } from '#modules/engine-core';
import { checkEngineConnectivity } from '#modules/engine-core';

import React from 'react';

import {
  DEBUGGER_URI_PATTERN,
  DMN_TRACE_DOCUMENT_TYPE,
  DMN_TRACE_URI_PATTERN,
  DOCS_FRAGMENT_URI_PATTERN,
  ENGINE_DEBUGGER_DOCUMENT_TYPE,
  INSPECTOR_ITEM_URI_PATTERN,
  JSON_PROPERTY_URI_PATTERN,
  USER_TASK_VIEW_DOCUMENT_TYPE,
  USER_TASK_VIEW_URI_PATTERN,
} from './Constants';
import DebuggerDocumentationFragmentRenderer from './DocumentationFragmentRenderer';
import EngineBpmnDebuggerEditorDocumentModel from './EngineBpmnDebuggerEditorDocumentModel';
import EngineBpmnDebuggerRenderer from './EngineBpmnDebuggerRenderer';
import './EngineDebugger.scss';
import { DmnTraceFragmentModel } from './dmn-trace/DmnTraceFragmentModel';
import DmnTraceFragmentRenderer from './dmn-trace/DmnTraceFragmentRenderer';
import { DmnTraceInspector } from './dmn-trace/DmnTraceInspector';
import initializeCommands from './initializers/initializeCommands';
import { initializeKeyBindings } from './initializers/initializeKeyBindings';
import { initializeMenus } from './initializers/initializeMenus';
import { initializePanes } from './initializers/initializePanes';
import DebuggerInspectorItemFragmentRenderer from './inspector/DebuggerInspectorItemFragmentRenderer';
import { EngineBpmnDebuggerDocumentInspector } from './inspector/DebuggerInspectorPane';
import FlowNodeInstanceJsonPropertyFragmentRenderer from './property-panel/FlowNodeInstanceJsonPropertyFragmentRenderer';
import ProcessInstanceJsonPropertyFragmentRenderer from './property-panel/ProcessInstanceJsonPropertyFragmentRenderer';
import TaskViewRenderer from './task-viewer/TaskViewRenderer';

export async function onLoad(bifrost: Bifrost): Promise<void> {
  const connectionManager = bifrost.getSharedRessource<EngineConnectionManager>('engineConnectionManager');

  registerIcons(bifrost);
  initializeCommands(bifrost, connectionManager);
  initializePanes(bifrost);
  initializeMenus(bifrost);
  initializeKeyBindings(bifrost);

  bifrost.editors.registerDocumentType(ENGINE_DEBUGGER_DOCUMENT_TYPE, {
    uriMatch: DEBUGGER_URI_PATTERN,
    modelKey: 'EngineDebuggerDocumentModel',
    modelConstructor: EngineBpmnDebuggerEditorDocumentModel,
    rendererKey: 'EngineDebuggerRenderer',
    rendererConstructor: EngineBpmnDebuggerRenderer,
    inspectorKey: 'EngineDebuggerDocumentInspector',
    inspectorConstructor: EngineBpmnDebuggerDocumentInspector,
    icon: 'engine-debugger/main',
    canOpen: (uri: string) => checkEngineConnectivity(bifrost, uri),
  });

  bifrost.editors.registerDocumentType(USER_TASK_VIEW_DOCUMENT_TYPE, {
    uriMatch: USER_TASK_VIEW_URI_PATTERN,
    modelKey: null,
    rendererKey: 'EngineDebuggerUserTaskRenderer',
    rendererConstructor: TaskViewRenderer,
    icon: 'engine-debugger/task-view',
  });

  bifrost.editors.registerDocumentType('engine-debugger.json-property', {
    uriMatch: JSON_PROPERTY_URI_PATTERN,
    modelKey: null,
    rendererKey: 'EngineDebuggerJsonPropertyFragment',
    rendererConstructor: FlowNodeInstanceJsonPropertyFragmentRenderer,
    icon: 'engine-debugger/json-fragment',
  });

  bifrost.editors.registerDocumentType('engine-debugger.process-json-property', {
    uriMatch: /^fragment\+engine-debug\.process-json-property:/i,
    modelKey: null,
    rendererKey: 'EngineDebuggerProcessJsonPropertyFragment',
    rendererConstructor: ProcessInstanceJsonPropertyFragmentRenderer,
    icon: 'engine-debugger/json-fragment',
  });

  bifrost.editors.registerDocumentType('engine-debugger.docs', {
    uriMatch: DOCS_FRAGMENT_URI_PATTERN,
    modelKey: null,
    rendererKey: 'EngineDebuggerDocsFragment',
    rendererConstructor: DebuggerDocumentationFragmentRenderer,
    icon: 'bpmn/editor-tab/docs',
  });

  bifrost.editors.registerDocumentType('engine-debugger.inspector-item', {
    uriMatch: INSPECTOR_ITEM_URI_PATTERN,
    modelKey: null,
    rendererKey: 'EngineDebuggerInspectorItemFragment',
    rendererConstructor: DebuggerInspectorItemFragmentRenderer,
    icon: 'engine-debugger/json-fragment',
  });

  bifrost.editors.registerDocumentType(DMN_TRACE_DOCUMENT_TYPE, {
    uriMatch: DMN_TRACE_URI_PATTERN,
    modelKey: 'DmnTraceFragmentModel',
    modelConstructor: DmnTraceFragmentModel,
    rendererKey: 'DmnTraceFragmentRenderer',
    rendererConstructor: DmnTraceFragmentRenderer,
    inspectorKey: 'DmnTraceInspector',
    inspectorConstructor: DmnTraceInspector,
    icon: 'engine-debugger/dmn-trace',
    canOpen: (uri: string) => checkEngineConnectivity(bifrost, uri),
  });
}

function registerIcons(bifrost: Bifrost): void {
  const gearPath =
    'M128,80a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Zm88-29.84q.06-2.16,0-4.32l14.92-18.64a8,8,0,0,0,1.48-7.06,107.21,107.21,0,0,0-10.88-26.25,8,8,0,0,0-6-3.93l-23.72-2.64q-1.48-1.56-3-3L186,40.54a8,8,0,0,0-3.94-6,107.71,107.71,0,0,0-26.25-10.87,8,8,0,0,0-7.06,1.49L130.16,40Q128,40,125.84,40L107.2,25.11a8,8,0,0,0-7.06-1.48A107.6,107.6,0,0,0,73.89,34.51a8,8,0,0,0-3.93,6L67.32,64.27q-1.56,1.49-3,3L40.54,70a8,8,0,0,0-6,3.94,107.71,107.71,0,0,0-10.87,26.25,8,8,0,0,0,1.49,7.06L40,125.84Q40,128,40,130.16L25.11,148.8a8,8,0,0,0-1.48,7.06,107.21,107.21,0,0,0,10.88,26.25,8,8,0,0,0,6,3.93l23.72,2.64q1.49,1.56,3,3L70,215.46a8,8,0,0,0,3.94,6,107.71,107.71,0,0,0,26.25,10.87,8,8,0,0,0,7.06-1.49L125.84,216q2.16.06,4.32,0l18.64,14.92a8,8,0,0,0,7.06,1.48,107.21,107.21,0,0,0,26.25-10.88,8,8,0,0,0,3.93-6l2.64-23.72q1.56-1.48,3-3L215.46,186a8,8,0,0,0,6-3.94,107.71,107.71,0,0,0,10.87-26.25,8,8,0,0,0-1.49-7.06Zm-16.1-6.5a73.93,73.93,0,0,1,0,8.68,8,8,0,0,0,1.74,5.68l14.19,17.73a91.57,91.57,0,0,1-6.23,15L187.11,168a8,8,0,0,0-5.1,2.64,74.11,74.11,0,0,1-6.14,6.14A8,8,0,0,0,173.23,182l-2.51,22.58a91.32,91.32,0,0,1-15,6.23l-17.74-14.19a8,8,0,0,0-5-1.75h-.67a73.68,73.68,0,0,1-8.68,0,8,8,0,0,0-5.68,1.74L100.25,210.8a91.57,91.57,0,0,1-15-6.23L82.77,182a8,8,0,0,0-2.64-5.1,74.11,74.11,0,0,1-6.14-6.14A8,8,0,0,0,68.89,168l-22.58-2.51a91.32,91.32,0,0,1-6.23-15l14.19-17.74a8,8,0,0,0,1.74-5.67,73.68,73.68,0,0,1,0-8.68,8,8,0,0,0-1.74-5.68L40.08,94.93a91.57,91.57,0,0,1,6.23-15L68.89,82.4A8,8,0,0,0,74,79.76a74.11,74.11,0,0,1,6.14-6.14A8,8,0,0,0,82.77,68.52L85.28,45.94a91.32,91.32,0,0,1,15-6.23l17.74,14.19a8,8,0,0,0,5.68,1.74,73.68,73.68,0,0,1,8.68,0,8,8,0,0,0,5.68-1.74L155.75,39.71a91.57,91.57,0,0,1,15,6.23L173.23,68.52a8,8,0,0,0,2.64,5.1,74.11,74.11,0,0,1,6.14,6.14,8,8,0,0,0,5.1,2.64l22.58,2.51a91.32,91.32,0,0,1,6.23,15l-14.19,17.74A8,8,0,0,0,199.9,123.66Z';
  const bugFillPath =
    'M168,92a12,12,0,1,1-12-12A12,12,0,0,1,168,92ZM100,80a12,12,0,1,0,12,12A12,12,0,0,0,100,80Zm116,64A87.76,87.76,0,0,1,213,167l22.24,9.72A8,8,0,0,1,232,192a7.89,7.89,0,0,1-3.2-.67L207.38,182a88,88,0,0,1-158.76,0L27.2,191.33A7.89,7.89,0,0,1,24,192a8,8,0,0,1-3.2-15.33L43,167A87.76,87.76,0,0,1,40,144v-8H16a8,8,0,0,1,0-16H40v-8a87.76,87.76,0,0,1,3-23L20.8,79.33a8,8,0,1,1,6.4-14.66L48.62,74a88,88,0,0,1,158.76,0l21.42-9.36a8,8,0,0,1,6.4,14.66L213,89.05a87.76,87.76,0,0,1,3,23v8h24a8,8,0,0,1,0,16H216Zm-80,0a8,8,0,0,0-16,0v64a8,8,0,0,0,16,0Zm64-32a72,72,0,0,0-144,0v8H200Z';

  bifrost.icons.registerIcons({
    'engine-debugger/main': (
      <svg viewBox="0 0 256 256" className="engine__debugger--tab-icon" style={{ width: '1.33em', height: '1.33em' }}>
        <path fill="var(--color-engine__debugger-icon-primary)" d={gearPath} />
        <g transform="translate(120,120) scale(0.75)">
          <path fill="var(--color-engine__debugger-icon-secondary)" d={bugFillPath} />
        </g>
      </svg>
    ),
    'engine-debugger/task-view': 'ph-duotone ph-clipboard-text',
    'engine-debugger/hero': 'ph-fill ph-bug engine__debugger--hero-icon ph-lg',
    'engine-debugger/json-fragment': 'ph-duotone ph-brackets-curly treeview__icon--ph-brackets-curly',
    'engine-debugger/dmn-trace': 'ph-duotone ph-graph',
  });
}
