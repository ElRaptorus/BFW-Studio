import type { EditorDocumentRendererProps } from '#bifrost/contracts/EditorTypes';
import { useDropTarget } from '#components/DragAndDrop';
import { Icon } from '#components/Icon';
import { Editor } from '#components/editor/Editor';
import { EditorContent } from '#components/editor/EditorContent';
import { EditorLoadingError } from '#components/editor/EditorLoadingError';
import { EditorTitle } from '#components/editor/EditorTitle';
import { EditorTitleText } from '#components/editor/EditorTitleText';
import 'diagram-js/assets/diagram-js.css';
import 'diagram-js-minimap/assets/diagram-js-minimap.css';

import React, { useEffect, useRef, useState } from 'react';

import type LandscapeMapDocumentModel from './LandscapeMapDocumentModel';
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

  const { isOver, dropTargetProps } = useDropTarget({
    accept: ['tree_item'],
    canDrop: (subject) => subject.item?.metadata?.processId != null,
    onDrop: (subject, event) => {
      const point = model?.toCanvasPoint(event.clientX, event.clientY);
      if (point == null) {
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
