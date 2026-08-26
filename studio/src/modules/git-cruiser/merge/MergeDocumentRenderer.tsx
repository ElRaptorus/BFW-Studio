import type { AbstractSubscription } from '#bifrost/common/AbstractEmitter';
import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import type { EditorDocumentRendererProps } from '#bifrost/contracts/EditorTypes';
import type { MergeResolverProps } from '#bifrost/contracts/MergeTypes';
import { EVENT_METADATA_UPDATED } from '#bifrost/contracts/internal/EditorEvents';
import { Icon } from '#components/Icon';
import { Editor } from '#components/editor/Editor';
import { EditorContent } from '#components/editor/EditorContent';
import { EditorLoadingError } from '#components/editor/EditorLoadingError';
import { EditorTitle } from '#components/editor/EditorTitle';
import { EditorTitleLeft } from '#components/editor/EditorTitleLeft';
import { EditorTitleText } from '#components/editor/EditorTitleText';
import { EditorToolbar } from '#components/editor/EditorToolbar';
import { EditorToolbarButton } from '#components/editor/EditorToolbarButton';
import { EditorToolbarCenter } from '#components/editor/EditorToolbarCenter';
import { EditorToolbarLeft } from '#components/editor/EditorToolbarLeft';
import { EditorToolbarRight } from '#components/editor/EditorToolbarRight';

import React from 'react';

import { EVENT_MERGE_FILE_CHANGED, EVENT_RESOLUTION_CHANGED, type MergeConflictKind } from '../GitTypes';
import type MergeDocumentModel from './MergeDocumentModel';
import './styles/component.merge-editor.scss';

export default class MergeDocumentRenderer extends React.Component<EditorDocumentRendererProps, any> {
  private resolverRef: React.MutableRefObject<any>;
  private model: MergeDocumentModel | null = null;
  private subscriptions: AbstractSubscription[] = [];
  private isAlreadyMounted = false;

  private cachedResolverProps: MergeResolverProps | null = null;
  private cachedBlobsKey = '';

  constructor(props: EditorDocumentRendererProps) {
    super(props);

    this.resolverRef = { current: null };

    this.state = {
      errorWhileLoading: null,
      loading: true,
    };

    props.studio.editors
      .getEditorDocumentModel<MergeDocumentModel>(props.editorDocument)
      .then((model) => {
        this.model = model;
        model.resolverRef = this.resolverRef;
        this.setState({ loading: false });

        this.subscriptions.push(
          model.on(EVENT_METADATA_UPDATED, () => this.forceUpdate()),
          model.on(EVENT_MERGE_FILE_CHANGED, () => this.forceUpdate()),
          model.on(EVENT_RESOLUTION_CHANGED, () => this.forceUpdate()),
        );

        if (this.isAlreadyMounted) {
          this.forceUpdate();
        }
      })
      .catch((reason) => {
        this.setState({ errorWhileLoading: reason.message });
      });
  }

  componentDidMount(): void {
    this.isAlreadyMounted = true;
  }

  componentWillUnmount(): void {
    this.subscriptions.forEach((subscription) => subscription.dispose());
    if (this.model) {
      this.model.resolverRef = null;
    }
  }

  private handleResolverDataReady = (): void => {
    this.model?.notifyResolverReady();
  };

  private handleResolutionChanged = (progress: {
    totalConflicts: number;
    resolvedConflicts: number;
    isComplete: boolean;
  }): void => {
    this.model?.updateResolutionProgress(progress);
  };

  render(): React.JSX.Element | null {
    if (this.state.errorWhileLoading != null) {
      return (
        <Editor>
          <EditorLoadingError title="Error loading merge resolver" errorMessage={this.state.errorWhileLoading} />
        </Editor>
      );
    }

    if (this.state.loading || this.model == null) {
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

    return this.renderActiveState();
  }

  private renderActiveState(): React.JSX.Element {
    assertNotNull(this.model, 'this.model');

    const ResolverComponent = this.model.resolveResolverComponent();
    const entry = this.model.getCurrentEntry();
    const filename = entry?.relativePath ?? 'this file';

    return (
      <Editor>
        {this.renderTitleBar()}
        {this.renderToolbar()}
        <EditorContent>
          {ResolverComponent != null ? (
            this.renderResolverContent(ResolverComponent)
          ) : (
            <EditorLoadingError
              title="No merge resolver"
              errorMessage={`No merge editor is registered for ${filename}. Only BPMN and DMN files can be resolved in the merge editor.`}
            />
          )}
        </EditorContent>
      </Editor>
    );
  }

  private renderTitleBar(): React.JSX.Element {
    const bifrost = this.props.studio;

    assertNotNull(this.model, 'this.model');

    const progress = this.model.getProgress();
    const entry = this.model.getCurrentEntry();
    const filename = entry?.relativePath ?? '...';
    const resolutionProgress = this.model.getResolutionProgress();

    function getConflictSublabel(kind: MergeConflictKind): string {
      if (kind === 'ours-deleted') {
        return 'This file was deleted on your branch but modified on the incoming branch.';
      }
      if (kind === 'theirs-deleted') {
        return 'This file was modified on your branch but deleted on the incoming branch.';
      }
      if (kind === 'added-by-both') {
        return 'Both branches independently added this file. Choose which version to keep.';
      }
      return 'Both branches modified this file. Choose which version to accept.';
    }

    return (
      <EditorTitle>
        <EditorTitleLeft>
          <EditorTitleText
            studio={bifrost}
            label={`${this.model.getMergeStateTypeCapitalized()} Conflict (File ${progress.current} of ${progress.total}): ${filename}`}
            sublabel={getConflictSublabel(this.model.conflictKind)}
          />
          {resolutionProgress != null && resolutionProgress.totalConflicts > 0 && (
            <span className="merge-overview__progress-indicator">
              {resolutionProgress.isComplete ? (
                <Icon id="ph-duotone ph-check-circle" />
              ) : (
                <Icon id="ph-light ph-circle-notch" />
              )}
              {` ${resolutionProgress.resolvedConflicts} / ${resolutionProgress.totalConflicts} resolved`}
            </span>
          )}
        </EditorTitleLeft>
      </EditorTitle>
    );
  }

  private renderToolbar(): React.JSX.Element {
    const bifrost = this.props.studio;

    assertNotNull(this.model, 'this.model');

    const conflictKind = this.model.conflictKind;
    const isDeleteConflict = conflictKind === 'ours-deleted' || conflictKind === 'theirs-deleted';
    const resolutionProgress = this.model.getResolutionProgress();
    const hasResolutionProgress = resolutionProgress != null && resolutionProgress.totalConflicts > 0;

    return (
      <EditorToolbar>
        <EditorToolbarLeft>
          {hasResolutionProgress ? (
            <>
              <EditorToolbarButton
                studio={bifrost}
                icon="ph ph-check-circle"
                label="Resolve & Stage"
                tooltip="Write the result, stage the file, and advance to the next conflict"
                command="git.merge.resolveAndStage"
                commandArgs={[this.model]}
              />
              <EditorToolbarButton
                studio={bifrost}
                icon="ph ph-check"
                label="Accept Ours"
                tooltip="Accept the current branch version for all remaining conflicts"
                command="git.merge.acceptAllOurs"
                commandArgs={[this.model]}
              />
              <EditorToolbarButton
                studio={bifrost}
                icon="ph ph-check"
                label="Accept Theirs"
                tooltip="Accept the incoming branch version for all remaining conflicts"
                command="git.merge.acceptAllTheirs"
                commandArgs={[this.model]}
              />
            </>
          ) : (
            <>
              <EditorToolbarButton
                studio={bifrost}
                icon="ph ph-check"
                label="Accept Ours"
                tooltip="Accept the current branch version and resolve this file"
                command="git.merge.acceptOurs"
                commandArgs={[this.model]}
              />
              <EditorToolbarButton
                studio={bifrost}
                icon="ph ph-check"
                label="Accept Theirs"
                tooltip="Accept the incoming branch version and resolve this file"
                command="git.merge.acceptTheirs"
                commandArgs={[this.model]}
              />
              {!isDeleteConflict && (
                <>
                  <EditorToolbarButton
                    studio={bifrost}
                    icon="ph ph-pencil-simple"
                    label="Accept Ours & Edit"
                    tooltip="Accept current branch version and open in the editor for manual adjustments"
                    command="git.merge.acceptOursThenEdit"
                    commandArgs={[this.model]}
                  />
                  <EditorToolbarButton
                    studio={bifrost}
                    icon="ph ph-pencil-simple"
                    label="Accept Theirs & Edit"
                    tooltip="Accept incoming branch version and open in the editor for manual adjustments"
                    command="git.merge.acceptTheirsThenEdit"
                    commandArgs={[this.model]}
                  />
                </>
              )}
            </>
          )}
        </EditorToolbarLeft>
        <EditorToolbarCenter>
          <EditorToolbarButton
            studio={bifrost}
            icon="ph ph-arrows-out"
            tooltip="Zoom to viewport"
            command="git.merge.zoomToViewport"
            commandArgs={[this.model]}
          />
          <EditorToolbarButton
            studio={bifrost}
            icon="ph ph-arrows-in"
            tooltip="Zoom to actual size"
            command="git.merge.zoomToActualSize"
            commandArgs={[this.model]}
          />
          <EditorToolbarButton
            studio={bifrost}
            icon="ph ph-push-pin"
            tooltip="Zoom to selected element"
            command="git.merge.zoomToSelectedElement"
            commandArgs={[this.model]}
          />
        </EditorToolbarCenter>
        <EditorToolbarRight>
          <EditorToolbarButton
            studio={bifrost}
            icon="ph ph-skip-forward"
            label="Next File"
            tooltip="Proceed to the next file with unresolved conflicts"
            command="git.merge.skip"
            commandArgs={[this.model]}
          />
        </EditorToolbarRight>
      </EditorToolbar>
    );
  }

  private getResolverProps(): MergeResolverProps {
    assertNotNull(this.model, 'this.model');
    const entry = this.model.getCurrentEntry();
    assertNotNull(entry, 'entry');

    const base = this.model.blobs?.base ?? null;
    const ours = this.model.blobs?.ours ?? null;
    const theirs = this.model.blobs?.theirs ?? null;
    const blobsKey = `${entry.relativePath}\0${base?.length}\0${ours?.length}\0${theirs?.length}`;

    if (this.cachedResolverProps == null || this.cachedBlobsKey !== blobsKey) {
      this.cachedBlobsKey = blobsKey;
      this.cachedResolverProps = {
        studio: this.props.studio,
        blobs: { base, ours, theirs },
        conflictKind: this.model.conflictKind,
        operationKind: this.model.getMergeStateType(),
        entry: { relativePath: entry.relativePath, uri: entry.uri },
        resolverRef: this.resolverRef,
        onDataReady: this.handleResolverDataReady,
        onResolutionChanged: this.handleResolutionChanged,
      };
    }

    return this.cachedResolverProps;
  }

  private renderResolverContent(ResolverComponent: React.ComponentType<MergeResolverProps>): React.JSX.Element {
    const props = this.getResolverProps();
    return <ResolverComponent {...props} />;
  }
}
