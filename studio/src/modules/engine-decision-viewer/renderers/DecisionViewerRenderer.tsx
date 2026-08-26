import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocumentRendererProps } from '#bifrost/contracts/EditorTypes';
import { Icon } from '#components/Icon';
import { Editor } from '#components/editor/Editor';
import { EditorContent } from '#components/editor/EditorContent';
import { EditorLoadingErrorHint } from '#components/editor/EditorLoadingErrorHint';
import { EditorTitle } from '#components/editor/EditorTitle';
import { EditorTitleCenter } from '#components/editor/EditorTitleCenter';
import { EditorTitleHeroIcon } from '#components/editor/EditorTitleHeroIcon';
import { EditorTitleLeft } from '#components/editor/EditorTitleLeft';
import { EditorTitleText } from '#components/editor/EditorTitleText';
import { EditorToolbar } from '#components/editor/EditorToolbar';
import { EditorToolbarButton } from '#components/editor/EditorToolbarButton';
import { EditorToolbarCenter } from '#components/editor/EditorToolbarCenter';
import { EditorToolbarLeft } from '#components/editor/EditorToolbarLeft';
import { EditorToolbarRight } from '#components/editor/EditorToolbarRight';
import {
  DmnViewerComponentAdapter,
  EVENT_DMN_VIEWER_SELECTION_CHANGED,
  EVENT_DMN_VIEWER_VIEW_CHANGED,
} from '#modules/dmn-core/DmnViewerComponentAdapter';
import type { EngineConnectionManager } from '#modules/engine-core';
import { ENGINE_COMMANDS, getHumanizedDateTime, resolveHealthState } from '#modules/engine-core';
import type { DrgElementType, DrgSelection } from '#modules/engine-decision-viewer/types/dmnModelTypes';
import 'dmn-js/dist/assets/diagram-js.css';
import 'dmn-js/dist/assets/dmn-font/css/dmn-embedded.css';
import 'dmn-js/dist/assets/dmn-js-boxed-expression-controls.css';
import 'dmn-js/dist/assets/dmn-js-boxed-expression.css';
import 'dmn-js/dist/assets/dmn-js-decision-table-controls.css';
import 'dmn-js/dist/assets/dmn-js-decision-table.css';
import 'dmn-js/dist/assets/dmn-js-drd.css';
import 'dmn-js/dist/assets/dmn-js-literal-expression.css';
import 'dmn-js/dist/assets/dmn-js-shared.css';

import React, { useCallback, useEffect, useRef, useState } from 'react';

import '../../dmn-editor/styles/dmn.scss';
import { DECISION_VIEWER_COMMANDS } from '../commands/DecisionViewerCommands';
import { DecisionViewerBreadcrumb } from '../components/DecisionViewerBreadcrumb';
import { EvaluationPanel } from '../components/EvaluationPanel';
import { ImportChainPanel } from '../components/ImportChainPanel';
import { resolveAuthLabel } from '../helpers/resolveAuthLabel';
import { useEditorModel } from '../hooks/useEditorModel';
import type { DecisionViewerDocumentModel, DecisionViewerModelData } from '../models/DecisionViewerDocumentModel';
import './DecisionViewerRenderer.scss';

const DMN_TYPE_MAP: Record<string, DrgElementType> = {
  'dmn:Decision': 'decision',
  'dmn:InputData': 'inputData',
  'dmn:BusinessKnowledgeModel': 'businessKnowledgeModel',
  'dmn:KnowledgeSource': 'knowledgeSource',
  'dmn:DecisionService': 'decisionService',
};

export default function DecisionViewerRenderer(props: EditorDocumentRendererProps): React.JSX.Element {
  const { studio, editorDocument } = props;
  const bifrost: Bifrost = studio;
  const model = useEditorModel<DecisionViewerDocumentModel>(bifrost, editorDocument);
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const adapterRef = useRef<DmnViewerComponentAdapter | null>(null);
  const [isCanvasLoading, setIsCanvasLoading] = useState(true);
  const [activeViewLabel, setActiveViewLabel] = useState<string | null>(null);
  const [hasDrd, setHasDrd] = useState(true);

  const connectionManager = bifrost.getSharedRessource<EngineConnectionManager>('engineConnectionManager');

  const engineId = model?.getEngineId() ?? '';
  const connection = connectionManager.getConnection(engineId);
  const engineDisplayName = connection?.displayName ?? engineId;
  const engineUrl = connection?.url ?? '';

  const data = (editorDocument.data?.current as DecisionViewerModelData | null) ?? {
    definition: null,
    xml: null,
    versions: [],
    selectedVersion: null,
    loading: true,
    error: null,
    lastUpdated: null,
    evaluationPanelOpen: false,
    evaluationInput: '{}',
    evaluationResult: null,
    evaluationError: null,
    evaluationLoading: false,
    selectedDecisionModelId: null,
    engineIsOnline: true,
    connectionGracePeriodExpired: false,
  };

  const healthState = resolveHealthState(
    connection?.state === 'connected' ? true : null,
    connectionManager.getHealthOverride(engineId),
  );

  useEffect(() => {
    if (!viewerContainerRef.current || !data.xml || !model) {
      return;
    }

    if (adapterRef.current) {
      adapterRef.current.dispose();
      adapterRef.current = null;
    }

    const adapter = new DmnViewerComponentAdapter('engine-decision-viewer', {
      drdRenderer: {
        defaultFillColor: 'var(--color-dmn-defaultFillColor)',
        defaultStrokeColor: 'var(--color-dmn-defaultStrokeColor)',
      },
    });

    adapterRef.current = adapter;
    model.registerViewerAdapter(adapter);

    void adapter.initialize(data.xml).then(() => {
      if (!viewerContainerRef.current) {
        return;
      }

      adapter.attachToHtmlElement(viewerContainerRef.current);

      const drdAvailable = adapter.hasDrdView();
      setHasDrd(drdAvailable);

      if (drdAvailable) {
        adapter.openDrd();
      }

      adapter.onceInteractive(() => {
        setIsCanvasLoading(false);
        if (drdAvailable) {
          adapter.zoomToViewport();
        }
      });
    });

    adapter.on(EVENT_DMN_VIEWER_SELECTION_CHANGED, (selectedElements: any[]) => {
      const elements = selectedElements ?? [];
      if (elements.length === 0) {
        model.selectElement(null);
        return;
      }

      const element = elements[0];
      const businessObject = element.businessObject ?? element;
      const dmnType = businessObject.$type as string;
      const mappedType = DMN_TYPE_MAP[dmnType];

      if (mappedType) {
        const selection: DrgSelection = {
          type: mappedType,
          elementId: businessObject.id ?? element.id,
        };
        model.selectElement(selection);
        if (mappedType === 'decision') {
          model.setSelectedDecisionModelId(businessObject.id ?? element.id);
        }
      } else {
        model.selectElement(null);
      }
    });

    adapter.on(EVENT_DMN_VIEWER_VIEW_CHANGED, (event: { activeView: { type: string; name: string } | null }) => {
      const viewType = event.activeView?.type;
      if (viewType === 'drd' || viewType == null) {
        setActiveViewLabel(null);
      } else {
        setActiveViewLabel(event.activeView?.name ?? viewType);
      }
    });

    return () => {
      adapter.dispose();
      adapterRef.current = null;
      model.registerViewerAdapter(null);
      setIsCanvasLoading(true);
      setActiveViewLabel(null);
    };
  }, [data.xml, model, bifrost, engineId]);

  const handleBackToDrd = useCallback(() => {
    adapterRef.current?.openDrd();
  }, []);

  const handleVersionChange = useCallback(
    (version: string | null) => {
      void model?.switchVersion(version);
    },
    [model],
  );

  const parsedModel = model?.getParsedModel() ?? null;
  const decisionLabel = data.definition?.name ?? parsedModel?.name ?? model?.getDecisionModelId() ?? 'Decision';
  const enabledLabel = data.definition?.enabled === false ? 'Disabled' : 'Enabled';

  return (
    <Editor>
      <EditorTitle>
        <EditorTitleLeft>
          <EditorTitleHeroIcon studio={bifrost} icon="ph-duotone ph-graph" />
          <EditorTitleText
            studio={bifrost}
            label={decisionLabel}
            sublabel={
              <DecisionViewerBreadcrumb
                studio={bifrost}
                engineId={engineId}
                engineDisplayName={engineDisplayName}
                healthState={healthState}
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
            icon="ph ph-export"
            tooltip="Export decision diagram"
            command="std.editor.showExportDialog.engine-decision-viewer"
          />
          <EditorToolbarButton
            studio={bifrost}
            icon="ph ph-download"
            tooltip="Download DMN XML"
            command={DECISION_VIEWER_COMMANDS.downloadXml}
            commandArgs={[editorDocument]}
          />
        </EditorToolbarLeft>
        <EditorToolbarCenter>
          <EditorToolbarButton
            studio={bifrost}
            icon="ph ph-arrows-out"
            tooltip="Zoom to viewport"
            command={`std.editor.zoomToViewport.engine-decision-viewer`}
            commandArgs={[editorDocument]}
          />
          <EditorToolbarButton
            studio={bifrost}
            icon="ph ph-arrows-in"
            tooltip="Zoom to actual size"
            command={`std.editor.zoomToActualSize.engine-decision-viewer`}
            commandArgs={[editorDocument]}
          />
          <EditorToolbarButton
            studio={bifrost}
            icon="ph ph-flask"
            tooltip="Test Decision"
            command={DECISION_VIEWER_COMMANDS.toggleEvaluation}
            commandArgs={[editorDocument]}
          />
          <EditorToolbarButton
            studio={bifrost}
            icon="ph ph-arrow-clockwise"
            tooltip="Refresh decision model"
            command={DECISION_VIEWER_COMMANDS.refresh}
            commandArgs={[editorDocument]}
          />
        </EditorToolbarCenter>
        <EditorToolbarRight>
          <EditorToolbarButton
            studio={bifrost}
            icon="ph ph-microscope"
            tooltip="Toggle inspector panel"
            command="std.workbench.toggleInspectorPanel"
          />
          <EditorToolbarButton
            studio={bifrost}
            icon="ph ph-wrench"
            label="Settings"
            tooltip="Open settings"
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
        <div className="engine-decision-viewer">
          {data.error && (
            <div className="engine-decision-viewer__error">
              <Icon id="ph ph-warning-circle" />
              <span>{data.error}</span>
            </div>
          )}

          <div className="engine-decision-viewer__version-bar">
            <span
              className={`engine-decision-viewer__status-badge${data.definition?.enabled === false ? ' engine-decision-viewer__status-badge--disabled' : ''}`}
            >
              {enabledLabel}
            </span>
            <label htmlFor="decision-version-select">Version:</label>
            <select
              id="decision-version-select"
              className="engine-decision-viewer__version-select"
              value={data.selectedVersion ?? ''}
              onChange={(event) => {
                const value = event.target.value;
                handleVersionChange(value === '' ? null : value);
              }}
              disabled={data.loading}
            >
              <option value="">Latest</option>
              {data.versions.map((version) => (
                <option key={version.version ?? version.id} value={version.version ?? ''}>
                  {version.version ?? '(no version)'}
                  {version.enabled === false ? ' (disabled)' : ''}
                </option>
              ))}
            </select>
          </div>

          {data.loading && !data.xml && (
            <div className="engine-decision-viewer__loading">Loading decision model...</div>
          )}

          {parsedModel && (
            <ImportChainPanel
              studio={bifrost}
              engineId={engineId}
              imports={parsedModel.imports}
              currentModelName={decisionLabel}
            />
          )}

          {activeViewLabel && (
            <div className="engine-decision-viewer__view-bar">
              <button type="button" className="engine-decision-viewer__back-to-drd" onClick={handleBackToDrd}>
                <Icon id="ph ph-arrow-left" />
                Back to DRD
              </button>
              <span className="engine-decision-viewer__view-label">{activeViewLabel}</span>
            </div>
          )}

          {data.xml && (
            <div className="engine-decision-viewer__canvas-container">
              {!hasDrd && !activeViewLabel && (
                <div className="engine-decision-viewer__no-dmndi">
                  <Icon id="ph ph-info" />
                  <span>This decision model has no diagram layout information.</span>
                </div>
              )}
              <div
                className="engine-decision-viewer__canvas"
                ref={viewerContainerRef}
                style={{ display: !hasDrd && !activeViewLabel ? 'none' : undefined }}
              >
                {isCanvasLoading && <div className="engine-decision-viewer__loading">Loading diagram...</div>}
              </div>
              <EvaluationPanel
                open={data.evaluationPanelOpen}
                inputJson={data.evaluationInput}
                loading={data.evaluationLoading}
                error={data.evaluationError}
                result={data.evaluationResult}
                onInputChange={(value) => model?.setEvaluationInput(value)}
                onEvaluate={() => void model?.evaluateDecision()}
                onClose={() => model?.toggleEvaluationPanel()}
                onOpenImportedModel={(modelId) => model?.openImportedModel(modelId)}
              />
            </div>
          )}

          {data.lastUpdated && (
            <div className="engine-decision-viewer__footer">Updated {getHumanizedDateTime(data.lastUpdated)}</div>
          )}
        </div>
      </EditorContent>
    </Editor>
  );
}
