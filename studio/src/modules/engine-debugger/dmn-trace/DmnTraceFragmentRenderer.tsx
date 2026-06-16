import {
  DmnViewerComponentAdapter,
  EVENT_DMN_VIEWER_SELECTION_CHANGED,
  EVENT_DMN_VIEWER_VIEW_CHANGED,
} from '#modules/dmn-core/DmnViewerComponentAdapter';
import type { EngineConnectionManager } from '#modules/engine-core';
import { getShortId } from '#modules/engine-core';
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

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { EditorDocumentRendererProps, Studio } from '@evil/bifrost_fw_sdk';
import {
  Editor,
  EditorContent,
  EditorLoadingErrorHint,
  EditorToolbar,
  EditorToolbarButton,
  EditorToolbarCenter,
  EditorToolbarLeft,
  EditorToolbarRight,
  EditorToolbarText,
  Icon,
} from '@evil/bifrost_fw_sdk';

import '../../dmn-editor/styles/dmn.scss';
import './DmnTraceFragment.scss';
import type { DmnTraceFragmentModel } from './DmnTraceFragmentModel';
import type { DmnFlowNodeTypeProperties, DmnTraceFragmentData } from './DmnTraceTypes';

const DMN_TYPE_MAP: Record<string, DrgElementType> = {
  'dmn:Decision': 'decision',
  'dmn:InputData': 'inputData',
  'dmn:BusinessKnowledgeModel': 'businessKnowledgeModel',
  'dmn:KnowledgeSource': 'knowledgeSource',
  'dmn:DecisionService': 'decisionService',
};

export default function DmnTraceFragmentRenderer(props: EditorDocumentRendererProps): React.JSX.Element {
  const { studio, editorDocument } = props;
  const model = useModel(studio, editorDocument);
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const adapterRef = useRef<DmnViewerComponentAdapter | null>(null);
  const [isCanvasLoading, setIsCanvasLoading] = useState(true);
  const [activeViewLabel, setActiveViewLabel] = useState<string | null>(null);
  const [hasDrd, setHasDrd] = useState(true);

  const data = (editorDocument.data?.current as DmnTraceFragmentData | null) ?? {
    flowNodeInstance: null,
    dmnXml: null,
    loading: true,
    error: null,
  };

  const traceProperties = model?.getTraceProperties() ?? null;

  const connectionManager = studio.getSharedRessource<EngineConnectionManager>('engineConnectionManager');
  const engineId = model?.engineId ?? '';
  const connection = connectionManager?.getConnection(engineId);
  const engineDisplayName = connection?.displayName ?? engineId;

  const flowNodeName = data.flowNodeInstance?.flowNodeId ?? '';
  const decisionRef = traceProperties?.decision_ref ?? '';
  const shortFniId = data.flowNodeInstance?.id ? getShortId(data.flowNodeInstance.id) : '';

  useEffect(() => {
    if (!viewerContainerRef.current || !data.dmnXml || !model) {
      return;
    }

    if (adapterRef.current) {
      adapterRef.current.dispose();
      adapterRef.current = null;
    }

    const adapter = new DmnViewerComponentAdapter('dmn-trace-fragment', {
      drdRenderer: {
        defaultFillColor: 'var(--color-dmn-defaultFillColor)',
        defaultStrokeColor: 'var(--color-dmn-defaultStrokeColor)',
      },
    });

    adapterRef.current = adapter;
    model.registerViewerAdapter(adapter);

    void adapter.initialize(data.dmnXml).then(() => {
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
        const loadedTraceProperties = model.getTraceProperties();
        if (drdAvailable && loadedTraceProperties) {
          adapter.zoomToViewport();
          applyTraceOverlays(adapter, loadedTraceProperties);
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
  }, [data.dmnXml, model]);

  const handleBackToDrd = useCallback(() => {
    adapterRef.current?.openDrd();
  }, []);

  const handleGoToDebugger = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      if (model?.processInstanceId && engineId) {
        const debuggerUri = `engine-debug://${engineId}/${model.processInstanceId}`;
        studio.commands.executeCommand('std.editor.focusOrOpenDocument', [debuggerUri]);
      }
    },
    [studio, model, engineId],
  );

  if (data.loading) {
    return (
      <Editor>
        <EditorContent>
          <div className="dmn-trace-fragment__loading">Loading DMN evaluation trace...</div>
        </EditorContent>
      </Editor>
    );
  }

  if (data.error) {
    return (
      <Editor>
        <EditorContent>
          <EditorLoadingErrorHint errorMessage={data.error} />
        </EditorContent>
      </Editor>
    );
  }

  return (
    <Editor>
      <EditorToolbar>
        <EditorToolbarLeft>
          <EditorToolbarText studio={studio}>
            DMN Trace for &quot;
            <a href="#" onClick={handleGoToDebugger}>
              {flowNodeName}
            </a>
            &quot; ({shortFniId}) &mdash; {decisionRef}
            {engineDisplayName && (
              <>
                {' '}
                on <em>{engineDisplayName}</em>
              </>
            )}
          </EditorToolbarText>
        </EditorToolbarLeft>
        <EditorToolbarCenter>
          <EditorToolbarButton
            studio={studio}
            icon="ph ph-arrows-out"
            tooltip="Zoom to viewport"
            command="std.editor.zoomToViewport.engine-debug.dmn-trace"
            commandArgs={[editorDocument]}
          />
          <EditorToolbarButton
            studio={studio}
            icon="ph ph-arrows-in"
            tooltip="Zoom to actual size"
            command="std.editor.zoomToActualSize.engine-debug.dmn-trace"
            commandArgs={[editorDocument]}
          />
        </EditorToolbarCenter>
        <EditorToolbarRight>
          <EditorToolbarButton
            studio={studio}
            icon="ph ph-graph"
            label="View Definition"
            tooltip={`Open "${decisionRef}" in Decision Viewer`}
            command="engine.debugger.dmnTrace.viewDefinition"
            commandArgs={[editorDocument]}
          />
          <EditorToolbarButton
            studio={studio}
            icon="ph ph-microscope"
            tooltip="Toggle inspector panel"
            command="std.workbench.toggleInspectorPanel"
          />
        </EditorToolbarRight>
      </EditorToolbar>

      <EditorContent>
        <div className="dmn-trace-fragment">
          <DmnTraceInfoBar traceProperties={traceProperties} />

          {activeViewLabel && (
            <div className="dmn-trace-fragment__view-bar">
              <button type="button" className="dmn-trace-fragment__back-to-drd" onClick={handleBackToDrd}>
                <Icon id="ph ph-arrow-left" />
                Back to DRD
              </button>
              <span className="dmn-trace-fragment__view-label">{activeViewLabel}</span>
            </div>
          )}

          {data.dmnXml ? (
            <div className="dmn-trace-fragment__canvas-container">
              {!hasDrd && !activeViewLabel && (
                <div className="dmn-trace-fragment__no-dmndi">
                  <Icon id="ph ph-info" />
                  <span>No diagram layout available. Trace data is shown in the property panes.</span>
                </div>
              )}
              <div
                className="dmn-trace-fragment__canvas"
                ref={viewerContainerRef}
                style={{ display: !hasDrd && !activeViewLabel ? 'none' : undefined }}
              >
                {isCanvasLoading && <div className="dmn-trace-fragment__loading">Loading diagram...</div>}
              </div>
            </div>
          ) : (
            <div className="dmn-trace-fragment__no-diagram">
              <Icon id="ph ph-warning-circle" />
              <span>
                DMN diagram not available (the decision may have been undeployed). Trace data is shown in the property
                panes.
              </span>
            </div>
          )}
        </div>
      </EditorContent>
    </Editor>
  );
}

function DmnTraceInfoBar(props: { traceProperties: DmnFlowNodeTypeProperties | null }): React.JSX.Element | null {
  const { traceProperties } = props;
  if (!traceProperties) {
    return null;
  }

  const durationMs = (traceProperties.duration_us / 1000).toFixed(1);
  const decisionCount = traceProperties.trace.decisions.length;
  const coercionCount = traceProperties.trace.input_coercions.filter((coercion) => coercion.coerced).length;

  return (
    <div className="dmn-trace-fragment__info-bar">
      <span className="dmn-trace-fragment__info-badge">
        <Icon id="ph ph-timer" />
        {durationMs} ms
      </span>
      <span className="dmn-trace-fragment__info-badge">
        <Icon id="ph ph-graph" />
        {decisionCount} decision{decisionCount !== 1 ? 's' : ''} evaluated
      </span>
      <span className="dmn-trace-fragment__info-badge">
        <Icon id="ph ph-check-circle" />
        Hit Policy: {traceProperties.hit_policy}
      </span>
      {traceProperties.matched_rules.length > 0 && (
        <span className="dmn-trace-fragment__info-badge">
          <Icon id="ph ph-list-checks" />
          {traceProperties.matched_rules.length} rule{traceProperties.matched_rules.length !== 1 ? 's' : ''} matched
        </span>
      )}
      {coercionCount > 0 && (
        <span className="dmn-trace-fragment__info-badge dmn-trace-fragment__info-badge--coercion">
          <Icon id="ph ph-swap" />
          {coercionCount} input{coercionCount !== 1 ? 's' : ''} coerced
        </span>
      )}
    </div>
  );
}

function applyTraceOverlays(adapter: DmnViewerComponentAdapter, traceProperties: DmnFlowNodeTypeProperties): void {
  const overlays = adapter.getDrdOverlays();
  const elementRegistry = adapter.getDrdElementRegistry();
  if (!overlays || !elementRegistry) {
    return;
  }

  const evaluatedDecisionIds = new Set(traceProperties.trace.decisions.map((decision) => decision.decision_model_id));

  elementRegistry.forEach((element: any) => {
    const businessObject = element.businessObject;
    if (!businessObject || businessObject.$type !== 'dmn:Decision') {
      return;
    }

    const decisionId = businessObject.id;
    const traceEntry = traceProperties.trace.decisions.find((decision) => decision.decision_model_id === decisionId);

    if (traceEntry) {
      const durationMs = (traceEntry.duration_microseconds / 1000).toFixed(1);
      const matchedCount = traceEntry.matched_rules.length;

      const overlayHtml = document.createElement('div');
      overlayHtml.className = 'dmn-trace-overlay dmn-trace-overlay--evaluated';
      overlayHtml.innerHTML = `<span class="dmn-trace-overlay__duration">${durationMs} ms</span>`;
      if (matchedCount > 0) {
        overlayHtml.innerHTML += `<span class="dmn-trace-overlay__rules">${matchedCount} rule${matchedCount !== 1 ? 's' : ''}</span>`;
      }
      overlayHtml.title = `${traceEntry.hit_policy} — ${durationMs} ms — ${matchedCount} rule${matchedCount !== 1 ? 's' : ''} matched`;

      overlays.add(decisionId, 'trace-result', {
        position: { bottom: 0, right: 0 },
        html: overlayHtml,
      });
    } else if (!evaluatedDecisionIds.has(decisionId)) {
      const dimOverlay = document.createElement('div');
      dimOverlay.className = 'dmn-trace-overlay dmn-trace-overlay--unevaluated';
      dimOverlay.title = 'Not evaluated in this execution';

      overlays.add(decisionId, 'trace-dim', {
        position: { top: 0, left: 0 },
        html: dimOverlay,
      });
    }
  });
}

function useModel(studio: Studio, editorDocument: any): DmnTraceFragmentModel | null {
  const [model, setModel] = useState<DmnTraceFragmentModel | null>(null);

  const modelPromise = useMemo(() => {
    return studio.editors.getEditorDocumentModel<DmnTraceFragmentModel>(editorDocument);
  }, [studio, editorDocument]);

  useEffect(() => {
    let disposed = false;
    void modelPromise.then((resolvedModel) => {
      if (!disposed) {
        setModel(resolvedModel);
      }
    });
    return () => {
      disposed = true;
    };
  }, [modelPromise]);

  return model;
}
