import { parseOpenInNewTabUrl } from '#bifrost/common/OpenInNewTabUrl';
import type { EditorDocument, EditorDocumentRendererProps } from '#bifrost/contracts/EditorTypes';
import { EVENT_DATA_UPDATED, EVENT_METADATA_UPDATED } from '#bifrost/contracts/internal/EditorEvents';
import { DiffEditor } from '#components/DiffEditor';
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

import type LandscapeDiffDocumentModel from './LandscapeDiffDocumentModel';
import { EVENT_RELOADING, EVENT_RELOADING_DONE } from './LandscapeDiffDocumentModel';

export const RELATION_LINES_HINT =
  "Relation lines are not shown: calls, messages and signals are inferred from the solution's BPMN files at runtime and cannot be diffed reliably between versions.";

export default function LandscapeDiffDocumentRenderer(props: EditorDocumentRendererProps): React.JSX.Element | null {
  const { studio: bifrost, editorDocument } = props;

  const [model, setModel] = useState<LandscapeDiffDocumentModel | null>(null);
  const [errorWhileLoading, setErrorWhileLoading] = useState<string | null>(null);
  const [, forceRender] = useReducer((x: number) => x + 1, 0);

  const beforeRef = useRef<HTMLDivElement | null>(null);
  const afterRef = useRef<HTMLDivElement | null>(null);
  const loadingIndicatorRef = useRef<HTMLDivElement | null>(null);
  const attachedRef = useRef(false);

  const parsedFragmentUri = parseOpenInNewTabUrl(editorDocument.uri);
  const { beforeLabel, afterLabel, afterData, sourceFileUri } = parsedFragmentUri.data;
  const parentEditorDocument = bifrost.editors.getEditorDocumentByUri(parsedFragmentUri.parentUri) as
    | EditorDocument
    | undefined;

  useEffect(() => {
    let cancelled = false;
    const subscriptions: { dispose: () => void }[] = [];
    const reloadModel = (): void =>
      setModel((current) => {
        void current?.reload();
        return current;
      });

    if (parentEditorDocument != null) {
      void bifrost.editors.getEditorDocumentModel(parentEditorDocument).then((parentModel) => {
        if (cancelled) {
          return;
        }
        subscriptions.push(
          parentModel.on(EVENT_METADATA_UPDATED, (metadata: any) => {
            if (metadata?.fileChangedFromOutside != null || metadata?.removedFromFileSystem != null) {
              reloadModel();
            }
          }),
          parentModel.on(EVENT_DATA_UPDATED, reloadModel),
        );
      });
    }

    bifrost.editors
      .getEditorDocumentModel<LandscapeDiffDocumentModel>(editorDocument)
      .then((loadedModel) => {
        if (cancelled) {
          return;
        }
        subscriptions.push(
          loadedModel.on(EVENT_METADATA_UPDATED, (metadata: any) => {
            if (metadata?.errorWhileReload != null && metadata.errorWhileReload.trim() !== '') {
              setErrorWhileLoading(metadata.errorWhileReload);
            }
            if (metadata?.viewMode != null) {
              forceRender();
            }
          }),
          loadedModel.on(EVENT_RELOADING, () => {
            setErrorWhileLoading(null);
            attachedRef.current = false;
            if (loadingIndicatorRef.current) {
              loadingIndicatorRef.current.style.display = '';
            }
            forceRender();
          }),
          loadedModel.on(EVENT_RELOADING_DONE, () => forceRender()),
        );
        setModel(loadedModel);
      })
      .catch((reason) => {
        if (!cancelled) {
          setErrorWhileLoading(reason.message);
        }
      });

    return () => {
      cancelled = true;
      subscriptions.forEach((subscription) => subscription.dispose());
    };
  }, [bifrost.editors, editorDocument, parentEditorDocument]);

  useEffect(() => {
    if (
      model == null ||
      model.isInitializing() ||
      attachedRef.current ||
      editorDocument.metadata?.errorWhileReload != null ||
      errorWhileLoading != null
    ) {
      return;
    }
    if (beforeRef.current && afterRef.current) {
      attachedRef.current = true;
      void model.attachTo(beforeRef.current, afterRef.current).then(() => {
        if (loadingIndicatorRef.current) {
          loadingIndicatorRef.current.style.display = 'none';
        }
      });
    }
  });

  const viewMode = model?.getViewMode() ?? 'visual';

  // The canvases were measured while hidden, so fit them again when they become visible.
  useEffect(() => {
    if (viewMode === 'visual' && model?.isReadyForInteraction()) {
      model.zoomToViewport();
    }
    // eslint-disable-next-line react/exhaustive-deps -- only a change of the view mode re-fits; the model is stable once loaded
  }, [viewMode]);

  if (errorWhileLoading != null || editorDocument.metadata?.errorWhileReload != null) {
    const subtitle =
      parentEditorDocument == null ? (
        <>Please make sure that both sides of the diff are readable landscape maps.</>
      ) : (
        <>
          You could try to{' '}
          <a href="#" onClick={() => bifrost.editors.focusOrOpenEditorDocument(parentEditorDocument)}>
            go to the map
          </a>{' '}
          and save or discard the changes.
        </>
      );
    return (
      <Editor>
        <EditorLoadingError
          title="Error while loading the diff view"
          subtitle={subtitle}
          errorMessage={errorWhileLoading || editorDocument.metadata?.errorWhileReload}
        />
      </Editor>
    );
  }

  if (model == null) {
    return null;
  }

  const beforeFilename = model.getBeforeFilename() || '...';
  const afterFilename = model.getAfterFilename() || '...';

  let sublabel: React.JSX.Element;
  if (beforeLabel != null && afterLabel != null) {
    sublabel = (
      <>
        Comparing {beforeLabel} with {afterLabel}.
      </>
    );
  } else if (afterData === 'current') {
    sublabel = (
      <>
        Comparing the last saved version of &apos;
        <a href="#" onClick={() => bifrost.editors.focusOrOpenEditorDocument(model.getBeforeUri())}>
          {beforeFilename}
        </a>
        &apos; (before) with the unsaved working copy (after).
      </>
    );
  } else {
    sublabel = (
      <>
        Comparing &apos;
        <a href="#" onClick={() => bifrost.editors.focusOrOpenEditorDocument(model.getBeforeUri())}>
          {beforeFilename}
        </a>
        &apos; (before) with &apos;
        <a href="#" onClick={() => bifrost.editors.focusOrOpenEditorDocument(model.getAfterUri())}>
          {afterFilename}
        </a>
        &apos; (after).
      </>
    );
  }

  const { currentChangeNumber, maxChangeNumber } = model.getCurrentAndMaxChanges();

  return (
    <Editor>
      <EditorTitle>
        <EditorTitleLeft>
          <EditorTitleHeroIcon studio={bifrost} icon="ph-light ph-git-branch landscape-diff__tab-icon" />
          <EditorTitleText studio={bifrost} label={beforeFilename} sublabel={sublabel} />
        </EditorTitleLeft>
        <EditorTitleRight>
          {viewMode === 'visual' && (
            <>
              <span className="editor-title__item">
                Change {currentChangeNumber || '-'} / {maxChangeNumber}
              </span>
              <span className="editor-title__item" onClick={() => model.selectPreviousChange()}>
                <Icon id="ph-light ph-caret-left" />
              </span>
              <span className="editor-title__item" onClick={() => model.selectNextChange()}>
                <Icon id="ph-light ph-caret-right" />
              </span>
            </>
          )}
        </EditorTitleRight>
      </EditorTitle>

      <EditorToolbar>
        <EditorToolbarLeft>
          <EditorToolbarButton
            studio={bifrost}
            icon="ph ph-file-arrow-down"
            label="Export 'Before'"
            tooltip="Save the before version as a new map file"
            command="bpmn.landscape.diff.exportBeforeToNewFile"
            commandArgs={[editorDocument]}
            dataTestId="landscape-diff-export-before"
          />
          {sourceFileUri != null && (
            <EditorToolbarButton
              studio={bifrost}
              icon="ph ph-file-text"
              label="Open File"
              tooltip="Open the file these versions belong to"
              command="std.editor.focusOrOpenDocument"
              commandArgs={[sourceFileUri]}
              dataTestId="diff-open-file"
            />
          )}
        </EditorToolbarLeft>
        <EditorToolbarCenter>
          {viewMode === 'visual' && (
            <>
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
            </>
          )}
        </EditorToolbarCenter>
        <EditorToolbarRight>
          <EditorToolbarButton
            studio={bifrost}
            className={viewMode === 'visual' ? 'editor-toolbar__button--active' : ''}
            icon="ph ph-columns"
            label="Visual"
            tooltip="Compare the maps side by side"
            command="bpmn.landscape.diff.showVisualView"
            commandArgs={[editorDocument]}
            dataTestId="diff-view-visual"
          />
          <EditorToolbarButton
            studio={bifrost}
            className={viewMode === 'xml' ? 'editor-toolbar__button--active' : ''}
            icon="ph ph-code"
            label="XML"
            tooltip="Compare the map files line by line"
            command="bpmn.landscape.diff.showXmlView"
            commandArgs={[editorDocument]}
            dataTestId="diff-view-xml"
          />
          <EditorToolbarButton
            studio={bifrost}
            icon="ph ph-list-checks"
            label="Show Summary"
            tooltip="Show a curated list of all changes"
            command="bpmn.landscape.diff.showChangeSummaryDialog"
            commandArgs={[editorDocument]}
            dataTestId="landscape-diff-summary"
          />
        </EditorToolbarRight>
      </EditorToolbar>

      <EditorContent>
        {viewMode === 'visual' && (
          <div className="editor__hint landscape-diff__relation-hint" data-test--landscape-diff-relation-hint>
            {RELATION_LINES_HINT}
          </div>
        )}
        <SplitterLayout
          customClassName={`splitter-layout--bpmn-diff${viewMode === 'xml' ? ' diff-view--hidden' : ''}`}
          percentage={true}
          secondaryInitialSize={50}
          primaryMinSize={10}
          secondaryMinSize={10}
        >
          <div className="bpmn-diff__before landscape-diff__canvas" ref={beforeRef}>
            <div className="diff-title diff-title--before">Before</div>
          </div>
          <div className="bpmn-diff__after landscape-diff__canvas" ref={afterRef}>
            <div className="diff-title diff-title--after">After</div>
          </div>
        </SplitterLayout>
        {viewMode === 'xml' && (
          <div className="diff-xml-view">
            <DiffEditor
              key={model.getTextRevision()}
              studio={bifrost}
              language="xml"
              readOnly={true}
              beforeValue={model.getBeforeText()}
              afterValue={model.getAfterText()}
            />
          </div>
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
