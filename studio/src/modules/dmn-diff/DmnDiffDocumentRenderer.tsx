import { parseOpenInNewTabUrl } from '#bifrost/common/OpenInNewTabUrl';
import type { EditorDocument, EditorDocumentRendererProps } from '#bifrost/contracts/EditorTypes';
import { EVENT_DATA_UPDATED, EVENT_METADATA_UPDATED } from '#bifrost/contracts/internal/EditorEvents';
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
import 'dmn-js/dist/assets/diagram-js.css';
import 'dmn-js/dist/assets/dmn-js-drd.css';

import React, { useEffect, useReducer, useRef, useState } from 'react';

import type DmnDiffDocumentModel from './DmnDiffDocumentModel';
import { EVENT_RELOADING, EVENT_RELOADING_DONE } from './DmnDiffDocumentModel';

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

export default function DmnDiffDocumentRenderer(props: EditorDocumentRendererProps): React.JSX.Element | null {
  const { studio: bifrost, editorDocument } = props;

  const [model, setModel] = useState<DmnDiffDocumentModel | null>(null);
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
      .getEditorDocumentModel<DmnDiffDocumentModel>(editorDocument)
      .then((loadedModel) => {
        if (cancelled) {
          return;
        }

        subscriptions.push(
          loadedModel.on(EVENT_METADATA_UPDATED, (metadata: any) => {
            if (metadata?.errorWhileReload != null && metadata.errorWhileReload.trim() !== '') {
              setErrorWhileLoading(metadata.errorWhileReload);
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
          and save/discard the changes.
        </>
      );
    } else {
      subtitle = <>Please make sure that diff-before and diff-after point to valid DMN files.</>;
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

  let sublabel: React.JSX.Element;
  if (diffMode === DiffMode.TwoFiles) {
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
          <EditorTitleHeroIcon studio={bifrost} icon="ph-light ph-git-branch dmn-diff__tab-icon" />
          <EditorTitleText studio={bifrost} label={beforeFilename} sublabel={sublabel} />
        </EditorTitleLeft>
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
      </EditorTitle>

      <EditorToolbar>
        <EditorToolbarLeft />
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
            icon="ph ph-list-checks"
            label="Show Summary"
            tooltip="Show a curated list of all changes"
            command="dmn.diff.showChangeSummaryDialog"
            commandArgs={[editorDocument]}
          />
        </EditorToolbarRight>
      </EditorToolbar>

      <EditorContent>
        <SplitterLayout
          customClassName="splitter-layout--bpmn-diff"
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
        <div className="editor-loading__backdrop" ref={loadingIndicatorRef}>
          <div className="editor-loading__content ph-3x">
            <Icon id="ph-light ph-gear ph-spin" />
          </div>
        </div>
      </EditorContent>
    </Editor>
  );
}
