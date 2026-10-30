import type { EditorDocumentRendererProps } from '#bifrost/contracts/EditorTypes';
import { Icon } from '#components/Icon';
import { Editor } from '#components/editor/Editor';
import { EditorContent } from '#components/editor/EditorContent';
import { EditorLoadingError } from '#components/editor/EditorLoadingError';
import { EditorTitle } from '#components/editor/EditorTitle';
import { EditorTitleHeroIcon } from '#components/editor/EditorTitleHeroIcon';
import { EditorTitleLeft } from '#components/editor/EditorTitleLeft';
import { EditorTitleRight } from '#components/editor/EditorTitleRight';
import { EditorTitleText } from '#components/editor/EditorTitleText';
import { EditorToolbar } from '#components/editor/EditorToolbar';
import { EditorToolbarButton } from '#components/editor/EditorToolbarButton';
import { EditorToolbarCenter } from '#components/editor/EditorToolbarCenter';
import { EditorToolbarLeft } from '#components/editor/EditorToolbarLeft';
import { EditorToolbarRight } from '#components/editor/EditorToolbarRight';
import { SplitterLayout } from '#components/splitter/SplitterLayout';
import 'diagram-js/assets/diagram-js.css';

import React, { useEffect, useReducer, useRef, useState } from 'react';

import { EVENT_RELOADING, EVENT_RELOADING_DONE } from '../diff/LandscapeDiffDocumentModel';
import { RELATION_LINES_HINT } from '../diff/LandscapeDiffDocumentRenderer';
import type LandscapeHistoryPreviewDocumentModel from './LandscapeHistoryPreviewDocumentModel';

type ViewMode = 'preview' | 'diff';

function formatCommitDate(date: string): string {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function LandscapeHistoryPreviewDocumentRenderer(
  props: EditorDocumentRendererProps,
): React.JSX.Element | null {
  const { studio: bifrost, editorDocument } = props;

  const [model, setModel] = useState<LandscapeHistoryPreviewDocumentModel | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('diff');
  const [errorWhileLoading, setErrorWhileLoading] = useState<string | null>(null);
  const [, forceRender] = useReducer((x: number) => x + 1, 0);

  const previewRef = useRef<HTMLDivElement | null>(null);
  const beforeRef = useRef<HTMLDivElement | null>(null);
  const afterRef = useRef<HTMLDivElement | null>(null);
  const loadingIndicatorRef = useRef<HTMLDivElement | null>(null);
  const previewAttachedRef = useRef(false);
  const diffAttachedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const subscriptions: { dispose: () => void }[] = [];

    bifrost.editors
      .getEditorDocumentModel<LandscapeHistoryPreviewDocumentModel>(editorDocument)
      .then((loadedModel) => {
        if (cancelled) {
          return;
        }
        loadedModel.onViewerModeChanged((newMode) => setViewMode(newMode));
        subscriptions.push(
          loadedModel.on(EVENT_RELOADING, () => {
            setErrorWhileLoading(null);
            previewAttachedRef.current = false;
            diffAttachedRef.current = false;
            if (loadingIndicatorRef.current) {
              loadingIndicatorRef.current.style.display = '';
            }
            forceRender();
          }),
          loadedModel.on(EVENT_RELOADING_DONE, () => forceRender()),
        );
        setModel(loadedModel);
      })
      .catch((error) => {
        if (!cancelled) {
          setErrorWhileLoading(error.message);
        }
      });

    return () => {
      cancelled = true;
      subscriptions.forEach((subscription) => subscription.dispose());
    };
  }, [bifrost.editors, editorDocument]);

  useEffect(() => {
    previewAttachedRef.current = false;
    diffAttachedRef.current = false;
  }, [viewMode]);

  useEffect(() => {
    if (!model?.isReadyForInteraction() || model.isInitializing()) {
      return;
    }
    const hideLoadingIndicator = (): void => {
      if (loadingIndicatorRef.current) {
        loadingIndicatorRef.current.style.display = 'none';
      }
    };
    if (viewMode === 'preview' && !previewAttachedRef.current && previewRef.current) {
      previewAttachedRef.current = true;
      model.attachPreview(previewRef.current);
      hideLoadingIndicator();
    } else if (viewMode === 'diff' && !diffAttachedRef.current && beforeRef.current && afterRef.current) {
      diffAttachedRef.current = true;
      void model.attachTo(beforeRef.current, afterRef.current).then(hideLoadingIndicator);
    }
  });

  if (errorWhileLoading != null || editorDocument.metadata?.errorWhileReload != null) {
    return (
      <Editor>
        <EditorLoadingError
          title="Error while loading the history preview"
          subtitle="The historical version of the map could not be shown. Make sure the file exists, the Git repository is accessible and both versions are readable maps."
          errorMessage={errorWhileLoading || editorDocument.metadata?.errorWhileReload}
        />
      </Editor>
    );
  }

  if (model == null) {
    return null;
  }

  const shortHash = model.getShortHash();
  const { currentChangeNumber, maxChangeNumber } = model.getCurrentAndMaxChanges();

  return (
    <Editor>
      <EditorTitle>
        <EditorTitleLeft>
          <EditorTitleHeroIcon studio={bifrost} icon="bpmn-landscape/diff/history-preview" />
          <EditorTitleText
            studio={bifrost}
            label={`${model.getFilename()} @ ${shortHash}`}
            sublabel={`${model.getCommitMessage()} — ${model.getCommitAuthor()}, ${formatCommitDate(model.getCommitDate())}`}
          />
        </EditorTitleLeft>
        {viewMode === 'diff' && (
          <EditorTitleRight>
            <span className="editor-title__item">
              Change {currentChangeNumber || '-'} / {maxChangeNumber}
            </span>
            <span className="editor-title__item" onClick={() => model.selectPreviousChange()}>
              <Icon id="ph-light ph-caret-left" />
            </span>
            <span className="editor-title__item" onClick={() => model.selectNextChange()}>
              <Icon id="ph-light ph-caret-right" />
            </span>
          </EditorTitleRight>
        )}
      </EditorTitle>

      <EditorToolbar>
        <EditorToolbarLeft>
          <EditorToolbarButton
            studio={bifrost}
            className={viewMode === 'diff' ? 'editor-toolbar__button--active' : ''}
            icon="ph ph-git-diff"
            label="Diff"
            tooltip="Compare the current and the selected version"
            command="bpmn.landscape.diff.historyPreview.changeViewMode"
            commandArgs={[model, 'diff']}
            dataTestId="landscape-history-mode-diff"
          />
          <EditorToolbarButton
            studio={bifrost}
            className={viewMode === 'preview' ? 'editor-toolbar__button--active' : ''}
            icon="ph ph-eye"
            label="Preview"
            tooltip="Show the selected version on its own"
            command="bpmn.landscape.diff.historyPreview.changeViewMode"
            commandArgs={[model, 'preview']}
            dataTestId="landscape-history-mode-preview"
          />
        </EditorToolbarLeft>
        <EditorToolbarCenter>
          <EditorToolbarButton
            studio={bifrost}
            icon="ph ph-arrows-out"
            tooltip="Zoom to viewport"
            command="std.editor.zoomToViewport"
            commandArgs={[editorDocument]}
          />
          <EditorToolbarButton
            studio={bifrost}
            icon="ph ph-arrows-in"
            tooltip="Zoom to actual size"
            command="std.editor.zoomToActualSize"
            commandArgs={[editorDocument]}
          />
        </EditorToolbarCenter>
        <EditorToolbarRight>
          <EditorToolbarButton
            studio={bifrost}
            icon="ph ph-arrow-counter-clockwise"
            label="Restore"
            tooltip="Restore this version of the map"
            command="bpmn.landscape.diff.history.restoreFile"
            commandArgs={[editorDocument]}
            dataTestId="landscape-history-restore"
          />
        </EditorToolbarRight>
      </EditorToolbar>

      <EditorContent>
        <div className="editor__hint landscape-diff__relation-hint" data-test--landscape-history-relation-hint>
          {RELATION_LINES_HINT}
        </div>
        {viewMode === 'preview' && (
          <div
            className="landscape-diff__canvas"
            style={{ flex: 1 }}
            ref={previewRef}
            data-test--landscape-history-preview
          />
        )}
        {viewMode === 'diff' && (
          <SplitterLayout
            customClassName="splitter-layout--bpmn-diff"
            percentage={true}
            secondaryInitialSize={50}
            primaryMinSize={10}
            secondaryMinSize={10}
          >
            <div className="bpmn-diff__before landscape-diff__canvas" ref={beforeRef}>
              <div className="diff-title diff-title--before">Current</div>
            </div>
            <div className="bpmn-diff__after landscape-diff__canvas" ref={afterRef}>
              <div className="diff-title diff-title--after">Historical ({shortHash})</div>
            </div>
          </SplitterLayout>
        )}
        <div className="editor-loading__backdrop" ref={loadingIndicatorRef}>
          <div className="editor-loading__content ph-3x">
            <Icon id="ph-light ph-gear ph-spin" />
          </div>
        </div>
      </EditorContent>
    </Editor>
  );
}
