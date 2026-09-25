import type { Bifrost } from '#bifrost/Bifrost';
import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import type { EditorDocumentRendererProps } from '#bifrost/contracts/EditorTypes';
import { Icon } from '#components/Icon';
import { Editor } from '#components/editor/Editor';
import { EditorContent } from '#components/editor/EditorContent';
import { EditorLoadingError } from '#components/editor/EditorLoadingError';
import { EditorLoadingErrorHint } from '#components/editor/EditorLoadingErrorHint';
import { EditorTitle } from '#components/editor/EditorTitle';
import { EditorTitleCenter } from '#components/editor/EditorTitleCenter';
import { EditorTitleHeroIcon } from '#components/editor/EditorTitleHeroIcon';
import { EditorTitleLeft } from '#components/editor/EditorTitleLeft';
import { EditorTitleRight } from '#components/editor/EditorTitleRight';
import { EditorTitleText } from '#components/editor/EditorTitleText';
import { EditorTitleTextSimple } from '#components/editor/EditorTitleTextSimple';
import { EditorToolbar } from '#components/editor/EditorToolbar';
import { EditorToolbarButton } from '#components/editor/EditorToolbarButton';
import { EditorToolbarCenter } from '#components/editor/EditorToolbarCenter';
import { EditorToolbarLeft } from '#components/editor/EditorToolbarLeft';
import { EditorToolbarRight } from '#components/editor/EditorToolbarRight';
import type { BpmnViewerComponentAdapter } from '#modules/bpmn-core/BpmnViewerComponentAdapter';
import { EVENT_BPMN_VIEWER_ADAPTER_ROOT_CHANGED } from '#modules/bpmn-core/BpmnViewerComponentAdapter';
import '#modules/bpmn-editor/styles/bpmn-breadcrumb-bar.scss';
import {
  ENGINE_COMMANDS,
  EngineContextBreadcrumb,
  EngineVersionGate,
  ProcessInstanceStateBadge,
  getShortId,
  resolveHealthState,
} from '#modules/engine-core';
import type { EngineConnectionManager } from '#modules/engine-core';
import { is } from 'bpmn-js/lib/util/ModelUtil';

import React, { useEffect, useReducer, useRef, useState } from 'react';

import {
  getHumanReadableTextForDataObjectSetting,
  showAllDataObjectDetails,
} from '../bpmn-core/DataObjectDetailsSettings';
import { ENGINE_DEBUGGER_DOCUMENT_TYPE } from './Constants';
import type EngineBpmnDebuggerEditorDocumentModel from './EngineBpmnDebuggerEditorDocumentModel';
import './EngineDebugger.scss';
import { ProcessInstanceNonExistentHint } from './ProcessInstanceNonExistentHint';

interface BreadcrumbEntry {
  id: string;
  label: string;
  targetSubprocessId: string | null;
}

function buildBreadcrumbChain(adapter: BpmnViewerComponentAdapter): BreadcrumbEntry[] {
  const canvas = adapter.getCanvas();
  const currentRoot = canvas.getRootElement();
  if (currentRoot == null) {
    return [];
  }

  const chain: BreadcrumbEntry[] = [];
  let businessObject = currentRoot.businessObject;

  while (businessObject != null) {
    const name = businessObject.name || businessObject.id;
    const type: string = businessObject.$type;

    if (is(businessObject, 'bpmn:SubProcess')) {
      chain.unshift({ id: businessObject.id, label: name, targetSubprocessId: businessObject.id });
    } else if (type === 'bpmn:Process') {
      chain.unshift({ id: businessObject.id, label: name, targetSubprocessId: null });
    }

    businessObject = businessObject.$parent;
  }

  return chain;
}

function navigateToPlane(adapter: BpmnViewerComponentAdapter, targetSubprocessId: string | null): void {
  const canvas = adapter.getCanvas();

  if (targetSubprocessId != null) {
    const targetRoot = canvas.findRoot(`${targetSubprocessId}_plane`);
    if (targetRoot != null) {
      canvas.setRootElement(targetRoot);
    }
    return;
  }

  const roots = canvas.getRootElements();
  const mainRoot = roots.find(
    (root: any) => root.businessObject != null && !is(root.businessObject, 'bpmn:SubProcess'),
  );
  if (mainRoot != null) {
    canvas.setRootElement(mainRoot);
  }
}

function DebuggerSubprocessBreadcrumbBar(props: { adapter: BpmnViewerComponentAdapter }): React.JSX.Element | null {
  const { adapter } = props;
  const [rootRevision, setRootRevision] = useState(0);

  useEffect(() => {
    const subscription = adapter.on(EVENT_BPMN_VIEWER_ADAPTER_ROOT_CHANGED, () => {
      setRootRevision((revision) => revision + 1);
    });
    return () => subscription.dispose();
  }, [adapter]);

  const rootElement = adapter.getCanvas().getRootElement();
  if (rootElement?.businessObject == null || !is(rootElement.businessObject, 'bpmn:SubProcess')) {
    return null;
  }

  const chain = buildBreadcrumbChain(adapter);

  return (
    <div className="bpmn-breadcrumb-bar" key={rootRevision}>
      {chain.map((entry, index) => {
        const isLast = index === chain.length - 1;
        return (
          <React.Fragment key={entry.id}>
            {index > 0 && <span className="bpmn-breadcrumb-bar__separator">›</span>}
            <span
              className={`bpmn-breadcrumb-bar__item${isLast ? ' bpmn-breadcrumb-bar__item--active' : ''}`}
              onClick={isLast ? undefined : () => navigateToPlane(adapter, entry.targetSubprocessId)}
            >
              {entry.label}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function EngineBpmnDebuggerRenderer(props: EditorDocumentRendererProps): React.JSX.Element | null {
  const { studio, editorDocument } = props;

  const [model, setModel] = useState<EngineBpmnDebuggerEditorDocumentModel | null>(null);
  const [, forceRender] = useReducer((x: number) => x + 1, 0);

  const bpmnViewerRef = useRef<HTMLDivElement | null>(null);
  const loadingIndicatorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    studio.editors
      .getEditorDocumentModel<EngineBpmnDebuggerEditorDocumentModel>(editorDocument)
      .then((documentModel: EngineBpmnDebuggerEditorDocumentModel) => {
        if (cancelled) {
          return;
        }

        documentModel.onEngineReconnect(() => forceRender());
        documentModel.onProcessModelUpdated(() => forceRender());
        documentModel.onSettingsUpdated(() => forceRender());
        setModel(documentModel);
      });

    return () => {
      cancelled = true;
    };
  }, [editorDocument, studio.editors]);

  useEffect(() => {
    if (
      editorDocument.metadata?.isInitialized !== true ||
      !model?.engineIsOnline ||
      model.processInstance == null ||
      !loadingIndicatorRef.current ||
      loadingIndicatorRef.current.style.display === 'none'
    ) {
      return;
    }

    updateEditorLabel(model, studio, editorDocument);
    attachBpmnDocument(model, bpmnViewerRef);
    hideLoadingIndicatorIfPresent(model, loadingIndicatorRef);
  });

  if (model == null) {
    return null;
  }

  const cmd = studio.commands.getClickHandler();
  const connectionManager = studio.getSharedRessource<EngineConnectionManager>('engineConnectionManager');
  const connection = connectionManager.getConnection(model.engineId);
  const healthState = resolveHealthState(
    connection?.state === 'connected' ? true : null,
    connectionManager.getHealthOverride(model.engineId),
  );

  const engineIsOnline = model.engineIsOnline;
  const hasProcessInstance = model.processInstance != null;
  const autoFollowClass = model.isAutoFollowEnabled ? 'engine__debugger_auto_follow--enabled' : '';

  let businessKeyLink: string | React.JSX.Element = hasProcessInstance ? '—' : 'Loading...';
  if (model.processInstance?.businessKey != null) {
    businessKeyLink = !engineIsOnline ? (
      model.processInstance?.businessKey
    ) : (
      <a
        href="#"
        onClick={cmd('engine.debugger.showAllInstancesWithBusinessKey', [
          model.engineId,
          model.processInstance?.businessKey,
        ])}
      >
        {model.processInstance?.businessKey}
      </a>
    );
  }

  let processModelLink: string | React.JSX.Element = model.processModel?.name ?? model.processModel?.id ?? 'Loading...';
  const linkAvailable = studio.commands.isCommandEnabled('engine.workspace.openModelViewer', [
    model.engineId,
    model.processInstance?.processModelId ?? '',
  ]);
  if (linkAvailable && model.processInstance?.processModelId) {
    processModelLink = (
      <a
        href="#"
        data-bs-title="View deployed process model"
        data-bs-toggle="tooltip"
        onClick={cmd('engine.workspace.openModelViewer', [model.engineId, model.processInstance.processModelId])}
      >
        {model.processModel?.name ?? model.processModel?.id}
      </a>
    );
  }

  return (
    <Editor>
      <EditorTitle>
        <EditorTitleLeft>
          <EditorTitleHeroIcon studio={studio} className="engine__debugger--hero-icon" icon="ph-fill ph-bug" />
          <EditorTitleText
            studio={studio}
            label={<span>Debugging: {processModelLink}</span>}
            sublabel={
              <>
                <EngineContextBreadcrumb
                  studio={studio}
                  engineId={model.engineId}
                  engineDisplayName={model.engineDisplayName}
                  healthState={healthState}
                />
                {' / '}
                {engineIsOnline ? (
                  <a href="#" onClick={cmd('engine.workspace.openInstanceSearch', [model.engineId])}>
                    Process Instances
                  </a>
                ) : (
                  'Process Instances'
                )}
              </>
            }
          />
        </EditorTitleLeft>
        <EditorTitleCenter>
          <EditorTitleTextSimple
            label={
              <span>
                {getShortId(model.calledProcessInstanceId)}{' '}
                {hasProcessInstance && <ProcessInstanceStateBadge state={model.processInstance!.state} />}
              </span>
            }
            sublabel={'Instance'}
            tooltip={model.calledProcessInstanceId}
          />
        </EditorTitleCenter>
        <EditorTitleRight>
          <EditorTitleTextSimple
            label={businessKeyLink}
            tooltip={hasProcessInstance && engineIsOnline ? 'View all instances with this business key' : ''}
            sublabel="Business Key"
          />
        </EditorTitleRight>
      </EditorTitle>
      <EditorToolbar>
        <EditorToolbarLeft>
          <EditorToolbarButton
            studio={studio}
            tooltip="Export Process Instance"
            icon="ph-duotone ph-export"
            command={`std.editor.showExportDialog.${ENGINE_DEBUGGER_DOCUMENT_TYPE}`}
            commandArgs={[model]}
          />
          <EditorToolbarButton
            studio={studio}
            tooltip="Download BPMN"
            icon="ph-bold ph-download"
            command={`engine.debugger.downloadBpmn`}
            commandArgs={[model]}
          />
        </EditorToolbarLeft>
        <EditorToolbarCenter>
          <EditorToolbarButton
            studio={studio}
            icon="ph ph-stop-circle"
            tooltip="Abort Process Instance"
            command="engine.debugger.abortProcessInstance"
            commandArgs={[model]}
          />
          <EditorToolbarButton
            studio={studio}
            icon="ph ph-arrow-clockwise"
            tooltip="Retry"
            command="engine.debugger.retryWithConfirmation"
            commandArgs={[model]}
          />
          {!model.processInstance?.parentProcessInstanceId && (
            <EditorToolbarButton
              studio={studio}
              icon="ph-fill ph-clock-counter-clockwise"
              tooltip="Restart, using the same Business Key and payload"
              command="engine.debugger.restartProcessInstance"
              commandArgs={[model.engineId, model.processInstance]}
            />
          )}
          <EditorToolbarButton
            studio={studio}
            icon="ph ph-arrows-out"
            tooltip="Zoom to viewport"
            command="std.editor.zoomToViewport"
            commandArgs={[editorDocument]}
          />
          <EditorToolbarButton
            studio={studio}
            icon="ph ph-arrows-in"
            tooltip="Zoom to actual size"
            command="std.editor.zoomToActualSize"
            commandArgs={[editorDocument]}
          />
          <EditorToolbarButton
            className={autoFollowClass}
            studio={studio}
            icon="ph ph-push-pin"
            tooltip="Auto follow"
            command="engine.debugger.toggleAutoFollow"
          />
          <EditorToolbarButton
            studio={studio}
            icon="ph ph-arrows-clockwise"
            tooltip="Refresh"
            command="engine.debugger.refresh"
            commandArgs={[model]}
          />
          {model.processInstance?.parentProcessInstanceId && (
            <EditorToolbarButton
              studio={studio}
              icon="ph ph-arrow-line-up"
              tooltip="Go to Parent Process Instance"
              command="engine.debugger.goToParentProcessInstance"
              commandArgs={[model.engineId, model.processInstance.parentProcessInstanceId]}
            />
          )}
          {model.rootProcessInstanceId &&
            model.rootProcessInstanceId !== model.processInstance?.parentProcessInstanceId && (
              <EditorToolbarButton
                studio={studio}
                icon="ph ph-arrow-line-up"
                tooltip="Go to Root Process Instance"
                command="engine.debugger.focusOrOpen"
                commandArgs={[model.engineId, model.rootProcessInstanceId]}
              />
            )}
        </EditorToolbarCenter>
        <EditorToolbarRight>
          <EditorToolbarButton
            studio={studio}
            icon="ph ph-microscope"
            tooltip="Debugger Inspector"
            command="engine.debugger.workbench.openOrFocusInspector"
          />
          <EditorToolbarButton
            studio={studio}
            icon="ph ph-terminal"
            tooltip="Expression Runner"
            command="engine.debugger.workbench.openAndFocusExpressionRunner"
          />
          <EditorToolbarButton
            studio={studio}
            icon="ph ph-wrench"
            tooltip="Debugger Settings"
            command="engine.debugger.settings"
          />
          <EditorToolbarButton
            studio={studio}
            icon="ph ph-key"
            tooltip="Set auth token"
            command={ENGINE_COMMANDS.setAuthToken}
            commandArgs={[model.engineUrl]}
          />
        </EditorToolbarRight>
      </EditorToolbar>

      {renderEditorContent(model, studio)}
    </Editor>
  );

  function renderEditorContent(model: EngineBpmnDebuggerEditorDocumentModel, studio: Bifrost): React.JSX.Element {
    const error = model.lastError;
    const errorStatus = error?.statusCode ?? Number(error?.code);
    const isTimeoutError = error && (errorStatus === 408 || errorStatus === 503 || errorStatus === 504);

    if (model.engineIsOnline && error && !isTimeoutError) {
      if (errorStatus === 404) {
        return ProcessInstanceNonExistentHint({
          studio: studio,
          processInstanceId: model.calledProcessInstanceId,
        });
      }

      return (
        <EditorLoadingError
          title="Loading Process Instance failed"
          subtitle="The following error occured while accessing the engine"
          errorMessage={JSON.stringify(
            { message: error.message, name: error.name, code: error.code, stack: error.stack },
            null,
            2,
          )}
        />
      );
    }

    if (model.engineIsOnline && model.isInitialized && !model.processInstance) {
      return ProcessInstanceNonExistentHint({
        studio: studio,
        processInstanceId: model.calledProcessInstanceId,
      });
    }

    const connectingHint = model.initialConnectionSuccessful
      ? 'Connection to engine lost. Attempting to reconnect...'
      : 'Connecting to engine...';

    const showConnectingHint = !model.engineIsOnline && !model.connectionGracePeriodExpired;
    const showEngineIsOfflineHint = !model.engineIsOnline && model.connectionGracePeriodExpired;

    return (
      <EditorContent ref={bpmnViewerRef}>
        {model.bpmnViewerComponentAdapter && (
          <DebuggerSubprocessBreadcrumbBar adapter={model.bpmnViewerComponentAdapter} />
        )}
        {showConnectingHint && <EditorLoadingErrorHint errorMessage={connectingHint} />}
        {showEngineIsOfflineHint && <EditorLoadingErrorHint errorMessage="Engine is not reachable." />}
        {isTimeoutError && (
          <EditorLoadingErrorHint
            errorMessage="Request timed out"
            retryNowHandler={() => {
              model.refresh();
            }}
          />
        )}
        {!model.engineVersionIsSupported && (
          <EngineVersionGate engineVersion={model.engineInfo?.name} minimumVersion="1.0.0">
            <span />
          </EngineVersionGate>
        )}
        <div className="editor-loading__backdrop" ref={loadingIndicatorRef}>
          {showEngineIsOfflineHint ? (
            <div className="editor-loading__content ph-5x">
              <Icon id="ph-bold ph-file-exclamation" />
            </div>
          ) : (
            <div className="editor-loading__content ph-5x">
              <Icon id="ph-bold ph-gear ph-spin" />
            </div>
          )}
        </div>
        {model && !showAllDataObjectDetails(model.dataObjectDetailLevel) && (
          <div
            className="engine-debugger__hidden-data-object-elements-hint"
            data-bs-title={`Data Object visibility level is set to '${getHumanReadableTextForDataObjectSetting(
              model.dataObjectDetailLevel,
            )}'`}
            data-bs-toggle="tooltip"
          >
            <Icon id="ph ph-eye-slash" />
          </div>
        )}
      </EditorContent>
    );
  }
}

async function updateEditorLabel(
  model: EngineBpmnDebuggerEditorDocumentModel,
  studio: Bifrost,
  editorDocument: EditorDocumentRendererProps['editorDocument'],
): Promise<void> {
  assertNotNull(model, 'model');
  const processInstance = model.processInstance;

  if (processInstance == null) {
    return;
  }

  const processModelName = model.processModel?.name ?? processInstance.processModelId;
  const shortProcessInstanceId = getShortId(model.calledProcessInstanceId);

  const editorDocumentLabel = `Instance: ${shortProcessInstanceId} • ${processModelName} • ${model.engineDisplayName}`;
  studio.editors.updateEditorDocumentLabel(editorDocument, editorDocumentLabel);
}

function attachBpmnDocument(
  model: EngineBpmnDebuggerEditorDocumentModel,
  bpmnViewerRef: React.RefObject<HTMLDivElement | null>,
): void {
  if (bpmnViewerRef.current == null) {
    return;
  }
  assertNotNull(model, 'model');
  model.attachToHtmlElement(bpmnViewerRef.current);
}

function hideLoadingIndicatorIfPresent(
  model: EngineBpmnDebuggerEditorDocumentModel,
  loadingIndicatorRef: React.RefObject<HTMLDivElement | null>,
): void {
  assertNotNull(model, 'model');
  model.onceInteractive(() => {
    if (loadingIndicatorRef.current != null) {
      loadingIndicatorRef.current.style.display = 'none';
    }
  });
}
