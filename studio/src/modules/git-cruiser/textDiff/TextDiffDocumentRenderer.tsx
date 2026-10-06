import type { EditorDocumentRendererProps } from '#bifrost/contracts/EditorTypes';
import { EVENT_METADATA_UPDATED } from '#bifrost/contracts/internal/EditorEvents';
import { DiffEditor } from '#components/DiffEditor';
import { Icon } from '#components/Icon';
import { Editor } from '#components/editor/Editor';
import { EditorContent } from '#components/editor/EditorContent';
import { EditorLoadingError } from '#components/editor/EditorLoadingError';
import { EditorTitle } from '#components/editor/EditorTitle';
import { EditorTitleHeroIcon } from '#components/editor/EditorTitleHeroIcon';
import { EditorTitleLeft } from '#components/editor/EditorTitleLeft';
import { EditorTitleText } from '#components/editor/EditorTitleText';
import { EditorToolbar } from '#components/editor/EditorToolbar';
import { EditorToolbarButton } from '#components/editor/EditorToolbarButton';
import { EditorToolbarLeft } from '#components/editor/EditorToolbarLeft';

import React, { useEffect, useReducer, useState } from 'react';

import type TextDiffDocumentModel from './TextDiffDocumentModel';
import './styles/component.text-diff.scss';
import { getTextDiffLanguage } from './textDiffContent';

export default function TextDiffDocumentRenderer(props: EditorDocumentRendererProps): React.JSX.Element | null {
  const { studio: bifrost, editorDocument } = props;

  const [model, setModel] = useState<TextDiffDocumentModel | null>(null);
  const [errorWhileLoading, setErrorWhileLoading] = useState<string | null>(null);
  const [, forceRender] = useReducer((revision: number) => revision + 1, 0);

  useEffect(() => {
    let cancelled = false;
    let subscription: { dispose: () => void } | null = null;

    bifrost.editors
      .getEditorDocumentModel<TextDiffDocumentModel>(editorDocument)
      .then((loadedModel) => {
        if (cancelled) {
          return;
        }
        subscription = loadedModel.on(EVENT_METADATA_UPDATED, () => forceRender());
        setModel(loadedModel);
      })
      .catch((reason) => {
        if (!cancelled) {
          setErrorWhileLoading(reason.message);
        }
      });

    return () => {
      cancelled = true;
      subscription?.dispose();
    };
  }, [bifrost.editors, editorDocument]);

  if (errorWhileLoading != null) {
    return (
      <Editor>
        <EditorLoadingError
          title="Error while loading the comparison"
          subtitle="The file could not be read for one of the two versions."
          errorMessage={errorWhileLoading}
        />
      </Editor>
    );
  }

  if (model == null) {
    return (
      <Editor>
        <EditorContent>
          <div className="editor-loading__backdrop">
            <div className="editor-loading__content ph-3x">
              <Icon id="ph-light ph-gear ph-spin" />
            </div>
          </div>
        </EditorContent>
      </Editor>
    );
  }

  const relativePath = model.getRelativePath();
  const fileName = relativePath.substring(relativePath.lastIndexOf('/') + 1);

  return (
    <Editor>
      <EditorTitle>
        <EditorTitleLeft>
          <EditorTitleHeroIcon studio={bifrost} icon="ph-light ph-git-diff" />
          <EditorTitleText
            studio={bifrost}
            label={fileName}
            sublabel={`${model.getBeforeLabel()} ↔ ${model.getAfterLabel()}`}
            tooltip={relativePath}
          />
        </EditorTitleLeft>
      </EditorTitle>

      <EditorToolbar>
        <EditorToolbarLeft>
          {model.getFileExists() && (
            <EditorToolbarButton
              studio={bifrost}
              icon="ph ph-file-text"
              label="Open File"
              tooltip="Open the file these versions belong to"
              command="std.editor.focusOrOpenDocument"
              commandArgs={[model.getFileUri()]}
              dataTestId="diff-open-file"
            />
          )}
        </EditorToolbarLeft>
      </EditorToolbar>

      <EditorContent>
        {model.canCompare() ? (
          <div className="text-diff__content">
            <DiffEditor
              key={model.getRevision()}
              studio={bifrost}
              language={getTextDiffLanguage(relativePath)}
              readOnly={true}
              beforeValue={model.getBeforeText()}
              afterValue={model.getAfterText()}
              htmlAttributes={{ 'data-test--text-diff': true }}
            />
          </div>
        ) : (
          <div className="text-diff__notice" data-test--text-diff-notice>
            <Icon id="ph-light ph-info" />
            <span>This file is binary or too large to compare as text.</span>
          </div>
        )}
      </EditorContent>
    </Editor>
  );
}
