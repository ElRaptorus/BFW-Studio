import { SplitterLayout } from '#components/splitter/SplitterLayout';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'diagram-js-minimap/assets/diagram-js-minimap.css';

import React, { useEffect, useReducer, useRef, useState } from 'react';

import type { EditorDocumentRendererProps } from '@evil/bifrost_fw_sdk';
import {
  Editor,
  EditorContent,
  EditorLoadingError,
  EditorTitle,
  EditorTitleHeroIcon,
  EditorTitleLeft,
  EditorTitleRight,
  EditorTitleText,
  EditorToolbar,
  EditorToolbarButton,
  EditorToolbarCenter,
  EditorToolbarLeft,
  EditorToolbarRight,
  Icon,
} from '@evil/bifrost_fw_sdk';

import { EVENT_RELOADING, EVENT_RELOADING_DONE } from '../BpmnDiffDocumentModel';
import type BpmnHistoryPreviewDocumentModel from './BpmnHistoryPreviewDocumentModel';

type ViewMode = 'preview' | 'diff';

export default function BpmnHistoryPreviewDocumentRenderer(
  props: EditorDocumentRendererProps,
): React.JSX.Element | null {
  const { studio: bifrost, editorDocument } = props;

  const [model, setModel] = useState<BpmnHistoryPreviewDocumentModel | null>(null);
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
      .getEditorDocumentModel<BpmnHistoryPreviewDocumentModel>(editorDocument)
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
          loadedModel.on(EVENT_RELOADING_DONE, () => {
            forceRender();
          }),
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

    if (viewMode === 'preview' && !previewAttachedRef.current && previewRef.current) {
      previewAttachedRef.current = true;
      model.attachPreview(previewRef.current);
      if (loadingIndicatorRef.current) {
        loadingIndicatorRef.current.style.display = 'none';
      }
    } else if (viewMode === 'diff' && !diffAttachedRef.current && beforeRef.current && afterRef.current) {
      diffAttachedRef.current = true;
      model.attachTo(beforeRef.current, afterRef.current).then(() => {
        if (loadingIndicatorRef.current) {
          loadingIndicatorRef.current.style.display = 'none';
        }
      });
    }
  });

  if (errorWhileLoading != null || editorDocument.metadata?.errorWhileReload != null) {
    const errorMessage = errorWhileLoading || editorDocument.metadata?.errorWhileReload;

    return (
      <Editor>
        <EditorLoadingError
          title="Error while loading the history preview"
          subtitle="The historical data could not be retrieved. Please ensure the file exists and the git repository is accessible."
          errorMessage={errorMessage}
        />
      </Editor>
    );
  }

  if (model == null) {
    return null;
  }

  const filename = model.getFilename();
  const shortHash = model.getShortHash();
  const message = model.getCommitMessage();
  const author = model.getCommitAuthor();
  const dateStr = model.getCommitDate();

  let formattedDate: string;
  try {
    formattedDate = new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    formattedDate = dateStr;
  }

  const showChangeNav = viewMode === 'diff';
  const { currentChangeNumber, maxChangeNumber } = model.getCurrentAndMaxChanges();

  return (
    <Editor>
      <EditorTitle>
        <EditorTitleLeft>
          <EditorTitleHeroIcon studio={bifrost} icon="bpmn-diff/history-preview" />
          <EditorTitleText
            studio={bifrost}
            label={`${filename} @ ${shortHash}`}
            sublabel={`${message} — ${author}, ${formattedDate}`}
          />
        </EditorTitleLeft>
        {showChangeNav && (
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
            className={viewMode === 'diff' ? 'bpmn-diff__history-previewmode--active' : ''}
            icon="ph ph-git-diff"
            tooltip="Compare current and selected versions"
            command="bpmn.diff.historyPreview.changeViewMode"
            commandArgs={[model, 'diff']}
          />
          <EditorToolbarButton
            studio={bifrost}
            className={viewMode === 'preview' ? 'bpmn-diff__history-previewmode--active' : ''}
            icon="ph ph-eye"
            tooltip="Show preview of the selected version"
            command="bpmn.diff.historyPreview.changeViewMode"
            commandArgs={[model, 'preview']}
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
          <EditorToolbarButton
            studio={bifrost}
            icon="ph ph-push-pin"
            tooltip="Zoom to selected element"
            command="std.editor.zoomToSelectedElement"
          />
        </EditorToolbarCenter>
        <EditorToolbarRight>
          <EditorToolbarButton
            studio={bifrost}
            icon="ph ph-arrow-counter-clockwise"
            label="Restore"
            tooltip="Restore this version of the diagram"
            command="bpmn.diff.history.restoreFile"
            commandArgs={[editorDocument]}
          />
        </EditorToolbarRight>
      </EditorToolbar>

      <EditorContent>
        {viewMode === 'preview' && <div style={{ flex: 1, position: 'relative' }} ref={previewRef} />}
        {viewMode === 'diff' && (
          <SplitterLayout
            customClassName="splitter-layout--bpmn-diff"
            percentage={true}
            secondaryInitialSize={50}
            primaryMinSize={10}
            secondaryMinSize={10}
          >
            <div className="bpmn-diff__before" ref={beforeRef}>
              <div className="diff-title diff-title--before">Current</div>
            </div>
            <div className="bpmn-diff__after" ref={afterRef}>
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
