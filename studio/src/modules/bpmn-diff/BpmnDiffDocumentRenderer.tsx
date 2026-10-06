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
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'diagram-js-minimap/assets/diagram-js-minimap.css';

import React, { useEffect, useReducer, useRef, useState } from 'react';

import type BpmnDiffDocumentModel from './BpmnDiffDocumentModel';
import { EVENT_RELOADING, EVENT_RELOADING_DONE } from './BpmnDiffDocumentModel';

enum DiffMode {
  OriginalVsCurrent,
  CurrentVsOriginal,
  TwoFiles,
}

function getDiffMode(beforeData: string, afterData: string): DiffMode {
  if (beforeData === 'original' && afterData === 'current') {
    return DiffMode.OriginalVsCurrent;
  } else if (beforeData === 'current' && afterData === 'original') {
    return DiffMode.CurrentVsOriginal;
  }
  return DiffMode.TwoFiles;
}

export default function BpmnDiffDocumentRenderer(props: EditorDocumentRendererProps): React.JSX.Element | null {
  const { studio: bifrost, editorDocument } = props;

  const [model, setModel] = useState<BpmnDiffDocumentModel | null>(null);
  const [errorWhileLoading, setErrorWhileLoading] = useState<string | null>(null);
  const [, forceRender] = useReducer((x: number) => x + 1, 0);

  const beforeRef = useRef<HTMLDivElement | null>(null);
  const afterRef = useRef<HTMLDivElement | null>(null);
  const loadingIndicatorRef = useRef<HTMLDivElement | null>(null);
  const attachedRef = useRef(false);

  const parsedFragmentUri = parseOpenInNewTabUrl(editorDocument.uri);
  const diffMode = getDiffMode(parsedFragmentUri.data.beforeData, parsedFragmentUri.data.afterData);
  const parentUri = parsedFragmentUri.parentUri;

  const parentEditorDocument = bifrost.editors.getEditorDocumentByUri(parentUri) as EditorDocument | undefined;

  useEffect(() => {
    let cancelled = false;
    const subscriptions: { dispose: () => void }[] = [];

    if (parentEditorDocument != null) {
      bifrost.editors.getEditorDocumentModel(parentEditorDocument).then((parentModel) => {
        if (cancelled) {
          return;
        }
        subscriptions.push(
          parentModel.on(EVENT_METADATA_UPDATED, (metadata: any) => {
            if (metadata?.fileChangedFromOutside != null || metadata?.removedFromFileSystem != null) {
              setModel((current) => {
                current?.reload();
                return current;
              });
            }
          }),
          parentModel.on(EVENT_DATA_UPDATED, () => {
            setModel((current) => {
              current?.reload();
              return current;
            });
          }),
        );
      });
    }

    bifrost.editors
      .getEditorDocumentModel<BpmnDiffDocumentModel>(editorDocument)
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
          loadedModel.on(EVENT_RELOADING_DONE, () => {
            forceRender();
          }),
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
      model.attachTo(beforeRef.current, afterRef.current).then(() => {
        if (loadingIndicatorRef.current) {
          loadingIndicatorRef.current.style.display = 'none';
        }
      });
    }
  });

  const viewMode = model?.getViewMode() ?? 'visual';

  // The canvases were measured while hidden (or not at all), so fit them again when they become visible.
  useEffect(() => {
    if (viewMode === 'visual' && model?.isReadyForInteraction()) {
      model.zoomToViewport();

      const selectedElements = model.getSelectedElements();
      if (selectedElements != null && selectedElements.length > 0) {
        void model.zoomToElements(selectedElements.map((element) => element.id));
      }
    }
    // Only a change of the view mode should re-fit; the model reference is stable once loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  if (errorWhileLoading != null || editorDocument.metadata?.errorWhileReload != null) {
    const errorMessage = errorWhileLoading || editorDocument.metadata?.errorWhileReload;

    let subtitle: React.JSX.Element;
    if (parentEditorDocument != null) {
      subtitle = (
        <>
          You could try to{' '}
          <a href="#" onClick={() => bifrost.editors.focusOrOpenEditorDocument(parentEditorDocument!)}>
            go to the parent document
          </a>{' '}
          and save/discard the changes. Make sure to make a backup beforehand. For example, you could export the parent
          document as a new file. (File -{'>'} Export File as ...)
        </>
      );
    } else {
      subtitle = <>Please make sure that diff-before and diff-after point to valid BPMN files.</>;
    }

    return (
      <Editor>
        <EditorLoadingError title="Error while loading the diff view" subtitle={subtitle} errorMessage={errorMessage} />
      </Editor>
    );
  }

  if (model == null) {
    return null;
  }

  const beforeFilename = model.getBeforeFilename() || '...';
  const afterFilename = model.getAfterFilename() || '...';

  const beforeUri = model.getBeforeUri();
  const afterUri = model.getAfterUri();

  const { beforeLabel, afterLabel } = parsedFragmentUri.data;

  let sublabel: React.JSX.Element;
  if (beforeLabel != null && afterLabel != null) {
    sublabel = (
      <>
        Comparing {beforeLabel} with {afterLabel}.
      </>
    );
  } else if (diffMode === DiffMode.TwoFiles) {
    sublabel = (
      <>
        Comparing &apos;
        <a href="#" onClick={() => bifrost.editors.focusOrOpenEditorDocument(beforeUri)}>
          {beforeFilename}
        </a>
        &apos; (before) with &apos;
        <a href="#" onClick={() => bifrost.editors.focusOrOpenEditorDocument(afterUri)}>
          {afterFilename}
        </a>
        &apos; (after).
      </>
    );
  } else if (diffMode === DiffMode.OriginalVsCurrent) {
    sublabel = (
      <>
        Comparing the last saved version of &apos;
        <a href="#" onClick={() => bifrost.editors.focusOrOpenEditorDocument(parentEditorDocument!)}>
          {beforeFilename}
        </a>
        &apos; (before) with the unsaved working copy (after).
      </>
    );
  } else {
    sublabel = (
      <>
        Comparing your changes of &apos;
        <a href="#" onClick={() => bifrost.editors.focusOrOpenEditorDocument(parentEditorDocument!)}>
          {beforeFilename}
        </a>
        &apos; (before) with the new data of the file (after).
      </>
    );
  }

  const { currentChangeNumber, maxChangeNumber } = model.getCurrentAndMaxChanges();

  return (
    <Editor>
      <EditorTitle>
        <EditorTitleLeft>
          <EditorTitleHeroIcon studio={bifrost} icon="ph-light ph-git-branch bpmn__diff-view--tab-icon" />
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
            command="bpmn.diff.exportBeforeToNewFile"
            commandArgs={[editorDocument]}
          />
          {parsedFragmentUri.data.sourceFileUri != null && (
            <EditorToolbarButton
              studio={bifrost}
              icon="ph ph-file-text"
              label="Open File"
              tooltip="Open the file these versions belong to"
              command="std.editor.focusOrOpenDocument"
              commandArgs={[parsedFragmentUri.data.sourceFileUri]}
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
              <EditorToolbarButton
                studio={bifrost}
                icon="ph ph-push-pin"
                tooltip="Zoom to selected element"
                command="std.editor.zoomToSelectedElement"
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
            tooltip="Compare the diagrams side by side"
            command="bpmn.diff.showVisualView"
            commandArgs={[editorDocument]}
            dataTestId="diff-view-visual"
          />
          <EditorToolbarButton
            studio={bifrost}
            className={viewMode === 'xml' ? 'editor-toolbar__button--active' : ''}
            icon="ph ph-code"
            label="XML"
            tooltip="Compare the XML sources line by line"
            command="bpmn.diff.showXmlView"
            commandArgs={[editorDocument]}
            dataTestId="diff-view-xml"
          />
          <EditorToolbarButton
            studio={bifrost}
            icon="ph ph-list-checks"
            label="Show Summary"
            tooltip="Show a curated list of all changes"
            command="bpmn.diff.showChangeSummaryDialog"
            commandArgs={[editorDocument]}
          />
        </EditorToolbarRight>
      </EditorToolbar>

      <EditorContent>
        <SplitterLayout
          customClassName={`splitter-layout--bpmn-diff${viewMode === 'xml' ? ' diff-view--hidden' : ''}`}
          percentage={true}
          secondaryInitialSize={50}
          primaryMinSize={10}
          secondaryMinSize={10}
        >
          <div className="bpmn-diff__before" ref={beforeRef}>
            <div className="diff-title diff-title--before">Before</div>
          </div>
          <div className="bpmn-diff__after" ref={afterRef}>
            <div className="diff-title diff-title--after">After</div>
          </div>
        </SplitterLayout>
        {viewMode === 'xml' && (
          <div className="diff-xml-view">
            <DiffEditor
              key={model.getXmlRevision()}
              studio={bifrost}
              language="xml"
              readOnly={true}
              beforeValue={model.getBeforeXml()}
              afterValue={model.getAfterXml()}
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
