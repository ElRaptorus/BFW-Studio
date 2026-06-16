import {
  BpmnViewerComponentAdapter,
  EVENT_BPMN_VIEWER_ADAPTER_SELECTION_CHANGED,
} from '#modules/bpmn-core/BpmnViewerComponentAdapter';
import type { EngineConnectionManager } from '#modules/engine-core';
import { ENGINE_COMMANDS, EngineContextBreadcrumb } from '#modules/engine-core';

import React, { useEffect, useRef, useState } from 'react';

import type { EditorDocumentRendererProps, Studio } from '@evil/bifrost_fw_sdk';
import {
  Editor,
  EditorContent,
  EditorLoadingErrorHint,
  EditorTitle,
  EditorTitleCenter,
  EditorTitleHeroIcon,
  EditorTitleLeft,
  EditorTitleText,
  EditorToolbar,
  EditorToolbarButton,
  EditorToolbarCenter,
  EditorToolbarLeft,
  EditorToolbarRight,
} from '@evil/bifrost_fw_sdk';

import { MODEL_VIEWER_COMMANDS } from '../commands/ModelViewerCommands';
import { resolveAuthLabel } from '../helpers/resolveAuthLabel';
import { useEditorModel } from '../hooks/useEditorModel';
import type { ModelViewerDocumentModel } from '../models/ModelViewerDocumentModel';
import type { ModelViewerModelData, ModelViewerSelection } from '../types';
import './../engine-model-viewer.scss';

function ProcessExplorerBreadcrumb(props: {
  studio: Studio;
  engineId: string;
  engineDisplayName: string;
  processModelId: string;
}): React.JSX.Element {
  return (
    <span className="engine-model-viewer-breadcrumb">
      <EngineContextBreadcrumb
        studio={props.studio}
        engineId={props.engineId}
        engineDisplayName={props.engineDisplayName}
      />
      <span className="engine-model-viewer-breadcrumb__sep"> → </span>
      <a
        className="engine-context-breadcrumb"
        href="#"
        onClick={(event) => {
          event.preventDefault();
          props.studio.commands.executeCommand('engine.workspace.openProcessExplorer', [props.engineId]);
        }}
      >
        Processes
      </a>
    </span>
  );
}

export default function ModelViewerRenderer(props: EditorDocumentRendererProps): React.JSX.Element {
  const { studio, editorDocument } = props;
  const bifrost: Studio = studio;
  const model = useEditorModel<ModelViewerDocumentModel>(bifrost, editorDocument);
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const adapterRef = useRef<BpmnViewerComponentAdapter | null>(null);

  const connectionManager = bifrost.getSharedRessource<EngineConnectionManager>('engineConnectionManager');
  const engineId = model?.getEngineId() ?? '';
  const processModelId = model?.getProcessModelId() ?? '';
  const connection = connectionManager.getConnection(engineId);
  const engineDisplayName = connection?.displayName ?? engineId;
  const engineUrl = connection?.url ?? '';

  const data = (editorDocument.data?.current as ModelViewerModelData | null) ?? {
    processModelId,
    name: null,
    version: null,
    enabled: true,
    deployedAt: null,
    xml: null,
    versions: [],
    loading: true,
    error: null,
    lastUpdated: null,
    engineIsOnline: true,
    connectionGracePeriodExpired: false,
  };

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!viewerContainerRef.current || !data.xml || !model) {
      return;
    }

    if (adapterRef.current) {
      adapterRef.current.dispose();
      adapterRef.current = null;
    }

    const adapter = new BpmnViewerComponentAdapter(
      'engine-model-viewer',
      {
        bpmnRenderer: {
          defaultFillColor: 'var(--color-bpmn-defaultFillColor)',
          defaultStrokeColor: 'var(--color-bpmn-defaultStrokeColor)',
        },
      },
      [],
    );

    adapterRef.current = adapter;
    model.registerViewerAdapter(adapter);

    void adapter.initialize(data.xml).then(() => {
      if (!viewerContainerRef.current) {
        return;
      }
      adapter.attachToHtmlElement(viewerContainerRef.current);

      adapter.onceInteractive(() => {
        setIsLoading(false);
        model.refreshOverlays();
      });
    });

    adapter.on(EVENT_BPMN_VIEWER_ADAPTER_SELECTION_CHANGED, (selectedElements: any[]) => {
      const selectedIds: string[] = (selectedElements ?? []).map((element: any) => element.id);
      if (selectedIds.length === 0) {
        model.clearSelection();
        return;
      }
      const elementId = selectedIds[0];
      const element = adapter.getElementRegistry().get(elementId) as any;
      if (!element) {
        model.clearSelection();
        return;
      }
      const businessObject = element.businessObject ?? {};
      const selection: ModelViewerSelection = {
        elementId,
        elementType: businessObject.$type ?? 'unknown',
        elementName: businessObject.name ?? null,
        businessObject,
      };
      model.selectElement(selection);
    });

    return () => {
      adapter.dispose();
      adapterRef.current = null;
      model.registerViewerAdapter(null);
      setIsLoading(true);
    };
  }, [data.xml, model, bifrost, engineId, processModelId]);

  return (
    <Editor>
      <EditorTitle>
        <EditorTitleLeft>
          <EditorTitleHeroIcon studio={bifrost} icon="ph-duotone ph-flow-arrow" />
          <EditorTitleText
            studio={bifrost}
            label={data.version ? `${data.name ?? processModelId} (v${data.version})` : (data.name ?? processModelId)}
            sublabel={
              <ProcessExplorerBreadcrumb
                studio={bifrost}
                engineId={engineId}
                engineDisplayName={engineDisplayName}
                processModelId={processModelId}
              />
            }
          />
        </EditorTitleLeft>
        <EditorTitleCenter />
      </EditorTitle>

      <EditorToolbar>
        <EditorToolbarLeft>
          <EditorToolbarButton
            studio={bifrost}
            icon="ph-duotone ph-export"
            tooltip="Export diagram as PNG or SVG"
            command="std.editor.showExportDialog.engine-model-viewer"
            commandArgs={[editorDocument]}
          />
          <EditorToolbarButton
            studio={bifrost}
            icon="ph ph-download"
            tooltip="Download BPMN XML"
            command={MODEL_VIEWER_COMMANDS.downloadXml}
            commandArgs={[editorDocument]}
          />
        </EditorToolbarLeft>
        <EditorToolbarCenter>
          <EditorToolbarButton
            studio={bifrost}
            icon="ph ph-arrows-in"
            tooltip="Zoom to fit viewport"
            command={MODEL_VIEWER_COMMANDS.fit}
            commandArgs={[editorDocument]}
          />
          <EditorToolbarButton
            studio={bifrost}
            icon="ph ph-arrows-out"
            tooltip="Zoom to actual size"
            command={MODEL_VIEWER_COMMANDS.zoomActualSize}
            commandArgs={[editorDocument]}
          />
          <EditorToolbarButton
            studio={bifrost}
            icon="ph ph-arrow-clockwise"
            tooltip="Refresh"
            command={MODEL_VIEWER_COMMANDS.refresh}
            commandArgs={[editorDocument]}
          />
        </EditorToolbarCenter>
        <EditorToolbarRight>
          <EditorToolbarButton
            studio={bifrost}
            tooltip="Toggle Inspector"
            icon="ph ph-rows"
            command="std.workbench.toggleInspectorPanel"
          />
          <EditorToolbarButton
            studio={bifrost}
            tooltip="Settings"
            icon="ph ph-gear"
            command="std.settings.openUserSettings"
          />
          <EditorToolbarButton
            studio={bifrost}
            icon="ph ph-key"
            label={resolveAuthLabel(connectionManager, engineUrl)}
            command={ENGINE_COMMANDS.setAuthToken}
            commandArgs={[engineUrl]}
          />
        </EditorToolbarRight>
      </EditorToolbar>

      <EditorContent>
        {!data.engineIsOnline && !data.connectionGracePeriodExpired && (
          <EditorLoadingErrorHint errorMessage="Connection to engine lost. Attempting to reconnect..." />
        )}
        {!data.engineIsOnline && data.connectionGracePeriodExpired && (
          <EditorLoadingErrorHint errorMessage="Engine is not reachable." />
        )}
        <div className="engine-model-viewer">
          {data.error && <div className="engine-model-viewer__error">{data.error}</div>}

          {data.versions.length > 1 && (
            <div className="engine-model-viewer__version-bar">
              <label htmlFor="version-select">Version:</label>
              <select
                id="version-select"
                className="engine-model-viewer__version-select"
                value={data.version ?? ''}
                onChange={(event) => void model?.switchVersion(event.target.value || null)}
              >
                {data.versions.map((entry) => (
                  <option key={entry.version ?? 'latest'} value={entry.version ?? ''}>
                    {entry.version ?? '(no version)'}
                    {entry.enabled ? '' : ' (disabled)'}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="engine-model-viewer__instances-link"
                onClick={() =>
                  bifrost.commands.executeCommand('engine.workspace.openInstanceSearch', [
                    engineId,
                    { processModelId, version: data.version ?? undefined },
                  ])
                }
              >
                Which instances run this version?
              </button>
            </div>
          )}

          {data.versions.length <= 1 && (
            <div className="engine-model-viewer__version-bar">
              <button
                type="button"
                className="engine-model-viewer__instances-link"
                onClick={() =>
                  bifrost.commands.executeCommand('engine.workspace.openInstanceSearch', [engineId, { processModelId }])
                }
              >
                Search instances of this model
              </button>
            </div>
          )}

          {data.loading && !data.xml && <div className="engine-model-viewer__loading">Loading process model...</div>}

          {data.xml && (
            <div className="engine-model-viewer__canvas" ref={viewerContainerRef}>
              {isLoading && <div className="engine-model-viewer__loading">Loading diagram...</div>}
            </div>
          )}
        </div>
      </EditorContent>
    </Editor>
  );
}
