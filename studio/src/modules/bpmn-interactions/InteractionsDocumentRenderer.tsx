import type { EditorDocumentRendererProps } from '#bifrost/contracts/EditorTypes';
import { showContextMenu } from '#components/ContextMenuFunctions';
import { Editor } from '#components/editor/Editor';
import { EditorContent } from '#components/editor/EditorContent';
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
import 'diagram-js/assets/diagram-js.css';
import 'diagram-js-minimap/assets/diagram-js-minimap.css';

import React, { useEffect, useRef, useState } from 'react';

import type InteractionsDocumentModel from './InteractionsDocumentModel';
import {
  INTERACTIONS_HIDE_SETTING,
  INTERACTIONS_LAYOUT_SETTING,
  INTERACTIONS_PAGE_ID,
  readInteractionsSetting,
} from './InteractionsDocumentModel';
import './styles/interactions.scss';

function InteractionsEmptyState(props: { children: React.ReactNode; action?: React.ReactNode }): React.JSX.Element {
  return (
    <div className="interactions-empty" data-test--interactions-empty>
      <p>{props.children}</p>
      {props.action}
    </div>
  );
}

function diagramStateLabel(model: InteractionsDocumentModel | null, generating: boolean, stale: boolean): string {
  if (generating) {
    return 'Generating…';
  }
  if (model == null || !model.hasGeneratedDiagram()) {
    return 'Not generated';
  }
  if (stale) {
    return 'Out of date';
  }
  return 'Up to date';
}

function selectionCountLabel(processCount: number): string {
  return `${processCount} ${processCount === 1 ? 'process' : 'processes'}`;
}

export default function InteractionsDocumentRenderer(props: EditorDocumentRendererProps): React.JSX.Element {
  const { studio, editorDocument } = props;
  const [model, setModel] = useState<InteractionsDocumentModel | null>(null);

  useEffect(() => {
    let cancelled = false;
    void studio.editors.getEditorDocumentModel<InteractionsDocumentModel>(editorDocument).then((loaded) => {
      if (!cancelled) {
        setModel(loaded);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [studio, editorDocument]);

  const canvasHostRef = useRef<HTMLDivElement | null>(null);

  const solution = studio.solution.getSolution();
  const hasSolution = solution != null;
  const hideWithoutInteraction = readInteractionsSetting(studio, INTERACTIONS_HIDE_SETTING) === true;
  const layoutMode = readInteractionsSetting(studio, INTERACTIONS_LAYOUT_SETTING);
  const layoutIsStations = layoutMode === 'stations';

  const selectionCount = model?.getSelectedProcessReferences().length ?? 0;
  const hasDiagram = model?.hasGeneratedDiagram() === true;
  const generating = model?.isGenerating() === true;
  const stale = model?.isStale() === true;
  const focusMode = model?.getFocusMode() === true;
  const showCanvas = hasSolution && selectionCount > 0;
  const generateTooltip = stale
    ? 'Regenerate: the processes or the selection changed since the last generation'
    : 'Generate: build the interaction graph from the selected processes';
  const diagramLabel = diagramStateLabel(model, generating, stale);
  const diagramIsOutOfDate = stale && !generating;
  const clickHandler = studio.commands.getClickHandler();

  useEffect(() => {
    const host = canvasHostRef.current;
    if (model == null || host == null || !showCanvas || !hasDiagram) {
      return;
    }
    model.attachTo(host);
    return () => model.detach();
  }, [model, showCanvas, hasDiagram]);

  useEffect(() => {
    const host = canvasHostRef.current;
    if (model == null || host == null || !hasDiagram) {
      return;
    }
    const openContextMenu = (event: MouseEvent): void => {
      const elementId = (event.target as Element).closest('[data-element-id]')?.getAttribute('data-element-id') ?? null;
      void showContextMenu(event, 'bpmn/interactions/element', [elementId]);
    };
    host.addEventListener('contextmenu', openContextMenu);
    return () => host.removeEventListener('contextmenu', openContextMenu);
  }, [model, hasDiagram]);

  const solutionSublabel = hasSolution ? solution.name : 'No solution';

  return (
    <Editor>
      <EditorTitle>
        <EditorTitleLeft>
          <EditorTitleHeroIcon studio={studio} icon="bpmn-interactions/page/interactions" />
          <EditorTitleText studio={studio} label="Interactions" sublabel={solutionSublabel} />
        </EditorTitleLeft>
        <EditorTitleCenter>
          <EditorTitleTextSimple
            label={<span data-test--interactions-selection-count>{selectionCountLabel(selectionCount)}</span>}
            sublabel="Selection"
          />
        </EditorTitleCenter>
        <EditorTitleRight>
          <EditorTitleTextSimple
            label={
              <span
                className={diagramIsOutOfDate ? 'interactions-title__diagram-state--stale' : undefined}
                data-test--interactions-diagram-state
                {...(diagramIsOutOfDate ? { 'data-test--interactions-stale': true } : {})}
              >
                {diagramLabel}
              </span>
            }
            sublabel="Diagram"
          />
        </EditorTitleRight>
      </EditorTitle>
      <EditorToolbar>
        <EditorToolbarLeft>
          <EditorToolbarButton
            studio={studio}
            icon="ph ph-export"
            tooltip="Export the diagram as an image"
            command="std.editor.showExportDialog.bpmn-interactions-map"
            dataTestId="interactions-export"
          />
        </EditorToolbarLeft>
        <EditorToolbarCenter>
          <EditorToolbarButton
            studio={studio}
            icon={generating ? 'ph-light ph-gear ph-spin' : 'ph ph-play'}
            tooltip={generateTooltip}
            command="bpmn.interactions.generate"
            dataTestId="interactions-generate"
          />
          <EditorToolbarButton
            studio={studio}
            icon="ph ph-eye-slash"
            tooltip="Omit selected processes that have no line in the current view"
            className={hideWithoutInteraction ? 'editor-toolbar__button--active' : ''}
            command="bpmn.interactions.toggleHideProcessesWithoutInteraction"
            dataTestId="interactions-hide-without-interaction"
          />
          <EditorToolbarButton
            studio={studio}
            icon="ph ph-flow-arrow"
            tooltip="Direct layout: one line per throw/catch pair"
            className={!layoutIsStations ? 'editor-toolbar__button--active' : ''}
            command="bpmn.interactions.setLayout"
            commandArgs={['direct']}
            dataTestId="interactions-layout-direct"
          />
          <EditorToolbarButton
            studio={studio}
            icon="ph ph-train-simple"
            tooltip="Stations layout: lines run through shared station nodes"
            className={layoutIsStations ? 'editor-toolbar__button--active' : ''}
            command="bpmn.interactions.setLayout"
            commandArgs={['stations']}
            dataTestId="interactions-layout-stations"
          />
          <EditorToolbarButton
            studio={studio}
            icon="ph ph-arrows-in"
            tooltip="Fit the diagram to the viewport"
            command="std.editor.zoomToViewport"
            commandArgs={[editorDocument]}
            dataTestId="interactions-zoom-to-viewport"
          />
          <EditorToolbarButton
            studio={studio}
            icon="ph ph-arrows-out"
            tooltip="Zoom to actual size"
            command="std.editor.zoomToActualSize"
            commandArgs={[editorDocument]}
            dataTestId="interactions-zoom-to-actual-size"
          />
        </EditorToolbarCenter>
        <EditorToolbarRight>
          <EditorToolbarButton
            studio={studio}
            icon="ph ph-crosshair"
            tooltip="Dim unrelated elements (F)"
            className={focusMode ? 'editor-toolbar__button--active' : ''}
            command="bpmn.interactions.toggleFocusMode"
            dataTestId="interactions-focus"
          />
          <EditorToolbarButton
            studio={studio}
            icon="ph ph-magnifying-glass"
            tooltip="Find (Ctrl+F)"
            command="bpmn.interactions.find"
            dataTestId="interactions-find"
          />
          <EditorToolbarButton
            studio={studio}
            icon="ph ph-question"
            tooltip="What is Interactions?"
            command="std.help.openToTheSide"
            commandArgs={[INTERACTIONS_PAGE_ID]}
            dataTestId="interactions-help"
          />
        </EditorToolbarRight>
      </EditorToolbar>
      <EditorContent>
        {!hasSolution && (
          <InteractionsEmptyState
            action={
              <button
                type="button"
                className="btn btn-secondary"
                onClick={clickHandler('std.solution.openSolutionFile')}
              >
                Open Solution…
              </button>
            }
          >
            Interactions are drawn from the processes of an open solution.
          </InteractionsEmptyState>
        )}
        {hasSolution && selectionCount === 0 && (
          <InteractionsEmptyState>Select processes on the left, then Generate.</InteractionsEmptyState>
        )}
        {showCanvas && (
          <>
            {!hasDiagram && <InteractionsEmptyState>Generate to draw the interactions.</InteractionsEmptyState>}
            {hasDiagram && <div ref={canvasHostRef} className="interactions-map" data-test--interactions-canvas />}
          </>
        )}
      </EditorContent>
    </Editor>
  );
}
