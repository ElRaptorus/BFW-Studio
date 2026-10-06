import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocumentRendererProps } from '#bifrost/contracts/EditorTypes';
import { EVENT_METADATA_UPDATED } from '#bifrost/contracts/internal/EditorEvents';
import { Icon } from '#components/Icon';
import { useScrollPositionManager } from '#components/ScrollPositionManager';
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
import { EditorToolbarMenu } from '#components/editor/EditorToolbarMenu';
import { EditorToolbarRight } from '#components/editor/EditorToolbarRight';
import { EditorToolbarTextInput } from '#components/editor/EditorToolbarTextInput';

import React, { useEffect, useReducer, useState } from 'react';

import type SourceOverviewDocumentModel from './SourceOverviewDocumentModel';
import { isModelFile } from './SourceOverviewDocumentModel';
import type { OverviewFile } from './SourceOverviewDocumentModel';
import { ChangeRow } from './components/ChangeRow';
import { SourceHistory } from './components/SourceHistory';
import { OVERVIEW_BASE_MENU_ID } from './overviewCommands';
import './styles/source-overview.scss';

const HISTORY_SEARCH_DEBOUNCE_MILLISECONDS = 300;

function Notice(props: { testId: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="source-overview__empty" {...{ [`data-test--${props.testId}`]: true }}>
      {props.children}
    </div>
  );
}

/** The scrolling area. Each tab of each document keeps its position while another tab or a diff is in front. */
function ScrollingOverview(props: { scrollKey: string; children: React.ReactNode }): React.JSX.Element {
  const connectScrollTarget = useScrollPositionManager(props.scrollKey, { precise: true });
  return (
    <div className="source-overview" data-test--source-overview ref={connectScrollTarget}>
      {props.children}
    </div>
  );
}

/** All changed files as one compact list, BPMN and DMN files first. */
function ChangeList(props: {
  model: SourceOverviewDocumentModel;
  repositoryRoot: string;
  bifrost: Bifrost;
  files: readonly OverviewFile[];
  emptyText: string;
}): React.JSX.Element {
  const { model, repositoryRoot, bifrost, files, emptyText } = props;

  if (files.length === 0) {
    return <Notice testId="no-changes">{emptyText}</Notice>;
  }

  const sortedFiles = [
    ...files.filter((file) => isModelFile(file.path)),
    ...files.filter((file) => !isModelFile(file.path)),
  ];
  return (
    <div className="source-overview__change-list" data-test--change-list>
      {sortedFiles.map((file) => (
        <ChangeRow
          key={file.path}
          bifrost={bifrost}
          repositoryRoot={repositoryRoot}
          file={file}
          digest={model.getDigest(file)}
          onSummarize={(summarizedFile) =>
            bifrost.commands.executeCommand('git.overview.summarizeFile', [model, summarizedFile])
          }
        />
      ))}
    </div>
  );
}

/** Each tab renders only its own content. */
function renderTab(
  model: SourceOverviewDocumentModel,
  mode: ReturnType<SourceOverviewDocumentModel['getMode']>,
  repositoryRoot: string,
  bifrost: Bifrost,
): React.JSX.Element {
  if (mode !== 'history') {
    return renderChanges(model, repositoryRoot, bifrost);
  }
  return (
    <SourceHistory
      bifrost={bifrost}
      repositoryRoot={repositoryRoot}
      entries={model.getHistory()}
      hasMore={model.hasMoreHistory()}
      searchText={model.getHistorySearchText()}
      getExpandedCommit={(hash) => model.getExpandedCommit(hash)}
      getDigest={(file) => model.getDigest(file)}
      onToggleCommit={(hash) => bifrost.commands.executeCommand('git.overview.toggleCommit', [model, hash])}
      onLoadMore={() => bifrost.commands.executeCommand('git.overview.loadMoreHistory', [model])}
    />
  );
}

function renderChanges(
  model: SourceOverviewDocumentModel,
  repositoryRoot: string,
  bifrost: Bifrost,
): React.JSX.Element {
  if (model.getMode() === 'uncommitted') {
    return (
      <ChangeList
        model={model}
        repositoryRoot={repositoryRoot}
        bifrost={bifrost}
        files={model.getUncommittedFiles()}
        emptyText="No uncommitted changes on the current branch."
      />
    );
  }

  const comparison = model.getComparison();
  if (comparison.kind === 'loading') {
    return <Notice testId="comparison-loading">Loading the changes of this branch…</Notice>;
  }
  if (comparison.kind === 'failed') {
    return (
      <Notice testId="comparison-failed">
        The changes of this branch could not be read. Press refresh to try again.
      </Notice>
    );
  }
  if (comparison.kind === 'no-base') {
    return (
      <Notice testId="no-base">
        There is no other branch to compare this one with yet. Choose one with the Base branch button.
      </Notice>
    );
  }
  if (comparison.kind === 'on-base') {
    return (
      <Notice testId="on-base">
        You are on {comparison.base}, so there is nothing to compare. Switch to another branch, or choose a different
        base.
      </Notice>
    );
  }
  return (
    <>
      <p className="source-overview__muted" data-test--comparison-hint>
        Shows committed changes only.
      </p>
      <ChangeList
        model={model}
        repositoryRoot={repositoryRoot}
        bifrost={bifrost}
        files={comparison.files}
        emptyText={`This branch has no changes compared with ${comparison.base}.`}
      />
    </>
  );
}

function renderUnavailable(availability: string): React.JSX.Element {
  if (availability === 'disabled') {
    return (
      <Notice testId="overview-disabled">
        Git integration is disabled. Enable it in Settings → Git Cruiser → Enabled.
      </Notice>
    );
  }
  if (availability === 'git-missing') {
    return <Notice testId="overview-no-git">Git was not found on this system. Install Git and restart.</Notice>;
  }
  return <Notice testId="overview-no-repository">No Git repository detected in the current solution.</Notice>;
}

/** Typing is applied after a short pause; the field is rebuilt per repository, so a new repository starts empty. */
function HistorySearchField(props: { bifrost: Bifrost; model: SourceOverviewDocumentModel }): React.JSX.Element {
  const { bifrost, model } = props;
  const [text, setText] = useState(model.getHistorySearchText());

  useEffect(() => {
    const timer = setTimeout(() => void model.setHistorySearchText(text), HISTORY_SEARCH_DEBOUNCE_MILLISECONDS);
    return () => clearTimeout(timer);
  }, [model, text]);

  return (
    <EditorToolbarTextInput
      studio={bifrost}
      value={text}
      onChange={setText}
      placeholder="Search commit messages"
      icon="ph ph-magnifying-glass"
      dataTestId="history-search"
    />
  );
}

export default function SourceOverviewDocumentRenderer(props: EditorDocumentRendererProps): React.JSX.Element | null {
  const { studio: bifrost, editorDocument } = props;

  const [model, setModel] = useState<SourceOverviewDocumentModel | null>(null);
  const [errorWhileLoading, setErrorWhileLoading] = useState<string | null>(null);
  const [, forceRender] = useReducer((revision: number) => revision + 1, 0);

  useEffect(() => {
    let cancelled = false;
    let subscription: { dispose: () => void } | null = null;

    bifrost.editors
      .getEditorDocumentModel<SourceOverviewDocumentModel>(editorDocument)
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
          title="Error while loading the Source Overview"
          subtitle="The state of the repository could not be read."
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

  const availability = model.getAvailability();
  const repositoryRoot = model.getRepositoryRoot();
  const mode = model.getMode();
  const isComparison = mode === 'comparison';
  const base = model.getComparison().base;

  return (
    <Editor>
      <EditorTitle>
        <EditorTitleLeft>
          <EditorTitleHeroIcon studio={bifrost} icon="ph-light ph-git-branch" />
          <EditorTitleText studio={bifrost} label={model.getRepositoryName()} sublabel={model.getStatusSummary()} />
        </EditorTitleLeft>
      </EditorTitle>

      <EditorToolbar>
        <EditorToolbarLeft>
          <EditorToolbarButton
            studio={bifrost}
            icon="ph ph-pencil-simple-line"
            label="Uncommitted changes"
            tooltip="The changes you made since the last commit"
            className={mode === 'uncommitted' ? 'editor-toolbar__button--active' : ''}
            command="git.overview.showUncommitted"
            commandArgs={[model]}
            dataTestId="overview-mode-uncommitted"
          />
          <EditorToolbarButton
            studio={bifrost}
            icon="ph ph-clock-counter-clockwise"
            label="Current Branch"
            tooltip="Commit history of the current branch"
            className={mode === 'history' ? 'editor-toolbar__button--active' : ''}
            command="git.overview.showHistory"
            commandArgs={[model]}
            dataTestId="overview-mode-history"
          />
          <EditorToolbarButton
            studio={bifrost}
            icon="ph ph-git-diff"
            label={base == null ? 'Current vs. base' : `Current vs. ${base}`}
            tooltip="Everything this branch changed compared with its base branch"
            className={isComparison ? 'editor-toolbar__button--active' : ''}
            command="git.overview.showComparison"
            commandArgs={[model]}
            dataTestId="overview-mode-comparison"
          />
          {isComparison && (
            <EditorToolbarMenu
              studio={bifrost}
              icon="ph ph-git-branch"
              label="Base branch"
              tooltip="Choose the branch to compare with"
              menuId={OVERVIEW_BASE_MENU_ID}
              menuArgs={[model]}
            />
          )}
        </EditorToolbarLeft>
        <EditorToolbarRight>
          {mode === 'history' && availability === 'ready' && (
            <HistorySearchField key={repositoryRoot} bifrost={bifrost} model={model} />
          )}
          <EditorToolbarButton
            studio={bifrost}
            icon="ph ph-arrows-clockwise"
            tooltip="Read the repository again"
            command="git.overview.refresh"
            commandArgs={[model]}
            dataTestId="overview-refresh"
          />
          <EditorToolbarButton
            studio={bifrost}
            icon="ph ph-question"
            tooltip="What is the Source Overview?"
            command="std.help.openToTheSide"
            commandArgs={['git/overview']}
            dataTestId="overview-help"
          />
        </EditorToolbarRight>
      </EditorToolbar>

      <EditorContent>
        <ScrollingOverview scrollKey={`source-overview:${editorDocument.uri}:${mode}`}>
          {availability !== 'ready' || repositoryRoot == null
            ? renderUnavailable(availability)
            : renderTab(model, mode, repositoryRoot, bifrost)}
        </ScrollingOverview>
      </EditorContent>
    </Editor>
  );
}
