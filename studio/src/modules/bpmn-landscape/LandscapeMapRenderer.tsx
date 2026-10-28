import type { EditorDocumentRendererProps } from '#bifrost/contracts/EditorTypes';
import { Checkbox } from '#components/Checkbox';
import { showContextMenu } from '#components/ContextMenuFunctions';
import { useDropTarget } from '#components/DragAndDrop';
import { Icon } from '#components/Icon';
import { Editor } from '#components/editor/Editor';
import { EditorContent } from '#components/editor/EditorContent';
import { EditorLoadingError } from '#components/editor/EditorLoadingError';
import { EditorTitle } from '#components/editor/EditorTitle';
import { EditorTitleText } from '#components/editor/EditorTitleText';
import { EditorToolbar } from '#components/editor/EditorToolbar';
import { EditorToolbarButton } from '#components/editor/EditorToolbarButton';
import { EditorToolbarLeft } from '#components/editor/EditorToolbarLeft';
import { EditorToolbarRight } from '#components/editor/EditorToolbarRight';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';
import 'diagram-js/assets/diagram-js.css';
import 'diagram-js-minimap/assets/diagram-js-minimap.css';

import React, { useEffect, useRef, useState } from 'react';

import type LandscapeMapDocumentModel from './LandscapeMapDocumentModel';
import { SHOW_GRID_SETTING } from './LandscapeMapDocumentModel';
import './styles/landscape.scss';

function TitleWarning(props: { studio: EditorDocumentRendererProps['studio']; label: string; sublabel: string }) {
  return (
    <>
      <div className="editor-title__icon editor-title__icon--warning">
        <Icon id="ph ph-warning" />
      </div>
      <EditorTitleText studio={props.studio} label={props.label} sublabel={props.sublabel} />
    </>
  );
}

/** A map file row of the Maps explorer. */
function isMapRow(item: any): boolean {
  return item?.type === 'file' && /\.bfwmap$/i.test(item.metadata?.uri ?? '');
}

export default function LandscapeMapRenderer(props: EditorDocumentRendererProps): React.JSX.Element {
  const { studio, editorDocument } = props;
  const [model, setModel] = useState<LandscapeMapDocumentModel | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const metadata = editorDocument.metadata ?? {};
  const parseErrors = model?.getParseErrors() ?? [];

  useEffect(() => {
    let cancelled = false;
    void studio.editors.getEditorDocumentModel<LandscapeMapDocumentModel>(editorDocument).then((loaded) => {
      if (!cancelled) {
        setModel(loaded);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [studio, editorDocument]);

  const readable = parseErrors.length === 0;
  useEffect(() => {
    const host = canvasHostRef.current;
    if (model == null || host == null || !readable) {
      return;
    }
    model.attachTo(host);
    return () => model.detach();
  }, [model, readable]);

  useEffect(() => {
    const host = canvasHostRef.current;
    if (model == null || host == null || !readable) {
      return;
    }
    const openContextMenu = (event: MouseEvent): void => {
      const elementId = (event.target as Element).closest('[data-element-id]')?.getAttribute('data-element-id') ?? null;
      const elementType = model.selectForContextMenu(elementId);
      void showContextMenu(event, 'bpmn/landscape/element', [elementType == null ? null : elementId, elementType]);
    };
    host.addEventListener('contextmenu', openContextMenu);
    return () => host.removeEventListener('contextmenu', openContextMenu);
  }, [model, readable]);

  const { isOver, dropTargetProps } = useDropTarget({
    accept: ['tree_item'],
    canDrop: (subject) => subject.item?.metadata?.processId != null || isMapRow(subject.item),
    onDrop: (subject, event) => {
      const point = model?.toCanvasPoint(event.clientX, event.clientY);
      if (point == null) {
        return;
      }
      if (isMapRow(subject.item)) {
        void studio.commands.executeCommand('bpmn.landscape.addMapLinkToMap', [
          { mapUri: subject.item.metadata.uri, ...point },
        ]);
        return;
      }
      const { processId, fileUri } = subject.item.metadata;
      void studio.commands.executeCommand('bpmn.landscape.addProcessToMap', [{ processId, fileUri, ...point }]);
    },
  });

  if (model != null && !readable) {
    return (
      <Editor>
        <EditorContent>
          <EditorLoadingError
            title="This landscape map cannot be read"
            subtitle="The Studio does not save over this file. Fix it in a text editor; the map opens again as soon as the file can be read."
            errorMessage={parseErrors.join('\n')}
          />
        </EditorContent>
      </Editor>
    );
  }

  return (
    <Editor>
      <EditorTitle>
        {metadata.removedFromFileSystem && (
          <TitleWarning
            studio={studio}
            label="Error: File does not exist"
            sublabel="The file was moved, deleted or renamed from outside Studio. You can bring the file to a working state by saving this editor."
          />
        )}
        {metadata.errorOnReloadingFile && (
          <TitleWarning
            studio={studio}
            label="Error while reloading the file"
            sublabel={`The file was changed from outside Studio and cannot be read: ${metadata.errorOnReloadingFile} Saving this editor writes the map shown here.`}
          />
        )}
        {metadata.fileChangedFromOutside && (
          <TitleWarning
            studio={studio}
            label="File was changed"
            sublabel="The file was changed from outside Studio. Saving this editor overwrites those changes."
          />
        )}
      </EditorTitle>
      <EditorToolbar>
        <EditorToolbarLeft>
          <EditorToolbarButton
            studio={studio}
            icon="ph ph-crosshair"
            label="Focus"
            tooltip="Dim everything that is not related to the selection (F)"
            className={metadata.focusMode === true ? 'editor-toolbar__button--active' : ''}
            command="bpmn.landscape.toggleFocusMode"
            dataTestId="landscape-focus-mode"
          />
          <EditorToolbarButton
            studio={studio}
            icon="ph ph-export"
            label="Export"
            tooltip="Export the map as an image"
            command="std.editor.showExportDialog.bpmn-landscape-map"
            dataTestId="landscape-export"
          />
          {studio.commands.isRegistered('git.showGitDiff') && (
            <EditorToolbarButton
              studio={studio}
              icon="ph ph-git-diff"
              label="Show Changes"
              tooltip="Compare the map file against the last commit"
              command="git.showGitDiff"
              commandArgs={[editorDocument.uri]}
              dataTestId="landscape-show-changes"
            />
          )}
          {studio.commands.isRegistered('git.showFileHistory') && (
            <EditorToolbarButton
              studio={studio}
              icon="git-cruiser/history"
              label="History"
              tooltip="Browse the commit history of this map"
              command="git.showFileHistory"
              commandArgs={[editorDocument.uri]}
              dataTestId="landscape-history"
            />
          )}
        </EditorToolbarLeft>
        <EditorToolbarRight>
          <Checkbox
            label="Show Grid"
            checked={studio.settings.get(SHOW_GRID_SETTING, editorDocument.uri) !== false}
            onChange={() => void studio.commands.executeCommand('bpmn.landscape.toggleShowGrid')}
            htmlAttributes={{ 'data-test--landscape-show-grid': true }}
          />
          <EditorToolbarButton
            studio={studio}
            icon="ph ph-arrows-in"
            tooltip="Zoom to viewport"
            label="Zoom to viewport"
            command="std.editor.zoomToViewport"
            commandArgs={[editorDocument]}
            dataTestId="landscape-zoom-to-viewport"
          />
        </EditorToolbarRight>
      </EditorToolbar>
      <EditorContent>
        <div
          {...dropTargetProps}
          ref={canvasHostRef}
          className={`landscape-map${isOver ? ' landscape-map--drop-target' : ''}`}
          data-test--landscape-canvas
        />
      </EditorContent>
    </Editor>
  );
}
