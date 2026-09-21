import { Bifrost } from '#bifrost/Bifrost';
import type { FileHandlingService } from '#bifrost/common/FileHandlingService';
import type { EditorDocumentRendererProps } from '#bifrost/contracts/EditorTypes';
import { Checkbox } from '#components/Checkbox';
import { Icon } from '#components/Icon';
import ProductNameHeadline from '#components/ProductNameHeadline';
import { Editor } from '#components/editor/Editor';
import { EditorContent } from '#components/editor/EditorContent';

import React, { useEffect, useState } from 'react';

import type { StartpageCardDescriptor } from '.';

const FLAVOR_TOP = 'Toll the great Bell once! Pull the lever forward, to engage the Piston and Pump\u2026';
const FLAVOR_MIDDLE =
  'Toll the great Bell twice! With the push of the Button, fire the Engine and spark the Turbine into life\u2026';
const FLAVOR_BOTTOM = 'Toll the great Bell Thrice! Sing praise to the God of all Machines!';

export default function StartpageRenderer(props: EditorDocumentRendererProps): React.JSX.Element {
  const bifrost = props.studio;
  const cmd = bifrost.commands.getClickHandler();

  const openOnStartupValue = bifrost.settings.get('startpage.general.openOnStartupIfEmpty');
  const changeOpenOnStartupValue = (event: React.ChangeEvent<HTMLInputElement>): void => {
    bifrost.settings.set('startpage.general.openOnStartupIfEmpty', event.target.checked);
  };

  const tip = bifrost.commands.executeCommand<React.JSX.Element>('std.help.getDidYouKnowText');
  const heroCards = bifrost.commands.executeCommand<StartpageCardDescriptor[]>('std.startpage.getHeroCards');
  const actionCards = bifrost.commands.executeCommand<StartpageCardDescriptor[]>('std.startpage.getActionCards');
  const legacyExtraComponents = bifrost.commands.executeCommand<React.JSX.Element[]>('std.startpage.getExtraRenderer');

  const builtInHeroCards: StartpageCardDescriptor[] = [
    {
      key: 'bpmn',
      icon: 'ph-fill ph-plus-square',
      title: 'BPMN',
      description: 'Create a new Business Process Diagram',
      command: 'bpmn.editor.newBpmnDocument',
      testId: 'startpage-hero-bpmn',
    },
    {
      key: 'dmn',
      icon: 'ph-fill ph-plus-square',
      title: 'DMN',
      description: 'Create a new Decision Flow',
      command: 'dmn.editor.newDmnDocument',
      testId: 'startpage-hero-dmn',
    },
    {
      key: 'solution',
      icon: 'ph-fill ph-plus-square',
      title: 'Solution',
      description: 'Create a Solution for modelling a new Business Landscape',
      command: 'std.solution.createSolution',
      testId: 'startpage-hero-solution',
    },
  ];

  const builtInActionCards: StartpageCardDescriptor[] = [
    {
      key: 'open-file',
      icon: 'ph ph-file',
      title: 'Open File',
      command: 'std.editor.openDocument',
      description: '',
      testId: 'startpage-action-open-file',
    },
    {
      key: 'open-folder',
      icon: 'ph ph-folder-open',
      title: 'Open Folder',
      command: 'std.editor.openFolderAsSolution',
      description: '',
      testId: 'startpage-action-open-folder',
    },
    {
      key: 'pick-theme',
      icon: 'ph ph-palette',
      title: 'Pick a Theme',
      command: 'std.workbench.chooseTheme',
      description: '',
      testId: 'startpage-action-pick-theme',
    },
    {
      key: 'search-files',
      icon: 'ph ph-magnifying-glass',
      title: 'Search Files',
      command: 'std.quickJump.show',
      description: '',
      testId: 'startpage-action-search-files',
    },
    {
      key: 'search-commands',
      icon: 'ph ph-terminal',
      title: 'Search Commands',
      command: 'std.quickJump.showCommands',
      description: '',
      testId: 'startpage-action-search-commands',
    },
    {
      key: 'machine-sanctum',
      icon: 'ph ph-flask',
      title: 'Visit Machine Sanctum',
      command: 'dev.machineSanctum.open',
      description: '',
      testId: 'startpage-action-machine-sanctum',
    },
  ];

  const allHeroCards = [...builtInHeroCards, ...heroCards];
  const allActionCards = [...builtInActionCards, ...actionCards];

  return (
    <Editor>
      <EditorContent>
        <div className="startpage" data-test--startpage="true">
          <div className="startpage__content">
            <div className="startpage__header">
              <ProductNameHeadline
                productName={bifrost.env.productName}
                releaseChannelName={bifrost.env.releaseChannelName}
              />
            </div>

            <hr className="startpage__separator" />
            <p className="startpage__flavor">{FLAVOR_TOP}</p>

            <div className="startpage__hero-grid" data-test--startpage-hero-grid="true">
              {allHeroCards.map((card) => (
                <HeroCard key={card.key} card={card} cmd={cmd} />
              ))}
            </div>

            <p className="startpage__flavor">{FLAVOR_MIDDLE}</p>
            <hr className="startpage__separator" />

            <h2 className="startpage__section-title">Recent</h2>
            <div className="startpage__recent">
              <RecentItems bifrost={bifrost} />
            </div>

            <hr className="startpage__separator" />
            <h2 className="startpage__section-title">Explore and Customize</h2>

            <div className="startpage__action-grid" data-test--startpage-action-grid="true">
              {allActionCards.map((card) => (
                <div
                  key={card.key}
                  className="startpage__action-card"
                  onClick={cmd(card.command, card.commandArgs)}
                  {...(card.testId ? { [`data-test--${card.testId}`]: true } : {})}
                >
                  {card.title}
                </div>
              ))}
              {legacyExtraComponents.map((component) => component)}
            </div>

            <div className="startpage__footer">
              <Checkbox
                checked={openOnStartupValue}
                onChange={(event) => changeOpenOnStartupValue(event)}
                label="Show Welcome Page at startup"
              />
              <p className="startpage__tip">
                <b>Did you know?</b> {tip}
              </p>
            </div>

            <hr className="startpage__separator startpage__footer-flavor" />
            <p className="startpage__flavor">{FLAVOR_BOTTOM}</p>
          </div>
        </div>
      </EditorContent>
    </Editor>
  );
}

function HeroCard({
  card,
  cmd,
}: {
  card: StartpageCardDescriptor;
  cmd: (command: string, args?: any[]) => (event: React.MouseEvent) => void;
}): React.JSX.Element {
  return (
    <div
      className="startpage__hero-card"
      onClick={cmd(card.command, card.commandArgs)}
      {...(card.testId ? { [`data-test--${card.testId}`]: true } : {})}
    >
      <div className="startpage__hero-card-icon-row">
        <span className="startpage__hero-card-icon">
          <Icon id={card.icon} />
        </span>
        <span className="startpage__hero-card-title">{card.title}</span>
      </div>
      <p className="startpage__hero-card-description">{card.description}</p>
    </div>
  );
}

function RecentItems({ bifrost }: { bifrost: Bifrost }): React.JSX.Element {
  const bifrostInternal = Bifrost.cast(bifrost);
  const cmd = bifrost.commands.getClickHandler();

  const recentSolutions = bifrostInternal.recentlyOpened
    .getRecentlyOpenedSolutions()
    .filter((item: any) => item.uri.match(/^file:/) != null)
    .slice(0, 5);

  const recentFiles = bifrostInternal.recentlyOpened.getRecentlyOpenedFiles().slice(0, 5);

  if (recentSolutions.length === 0 && recentFiles.length === 0) {
    return <RecentItemsEmptyState bifrost={bifrost} />;
  }

  return (
    <ul className="unstyled">
      {recentSolutions.map((solution) => {
        const isSolutionFile = solution.uri.endsWith('.bfwsln');
        const iconId = `${isSolutionFile ? 'ph-fill ph-tree-view' : 'ph-fill ph-folder'} treeview__icon--ph-folder`;
        const label = bifrostInternal.files.getFilename(solution.uri);
        const displayLabel = isSolutionFile && label.endsWith('.bfwsln') ? label.slice(0, -'.bfwsln'.length) : label;

        return (
          <li key={solution.uri}>
            <a href="#" onClick={cmd('std.solution.openDirectory', [solution.uri])}>
              <span className="recent-tabs__icon">
                <Icon id={iconId} />
              </span>{' '}
              {displayLabel}
            </a>{' '}
            <AsyncDirectoryLabel files={bifrostInternal.files} uri={solution.uri} />
          </li>
        );
      })}
      {recentFiles.map((recentItem) => (
        <li key={recentItem.uri}>
          <a href="#" onClick={cmd('std.editor.focusOrOpenDocument', [recentItem.uri, recentItem.label])}>
            <span className="recent-tabs__icon">
              <Icon id={recentItem.icon ?? 'ph ph-file'} />
            </span>{' '}
            {bifrostInternal.files.getFilename(recentItem.uri)}
          </a>{' '}
          <AsyncDirectoryLabel files={bifrostInternal.files} uri={recentItem.uri} />
        </li>
      ))}
    </ul>
  );
}

function RecentItemsEmptyState({ bifrost }: { bifrost: Bifrost }): React.JSX.Element {
  const cmd = bifrost.commands.getClickHandler();

  return (
    <span className="startpage__recent-empty">
      After opening{' '}
      <a href="#" onClick={cmd('std.editor.openDocument')}>
        files
      </a>{' '}
      or{' '}
      <a href="#" onClick={cmd('std.editor.openFolderAsSolution')}>
        directories
      </a>
      , the most recent ones will show up here.
    </span>
  );
}

function AsyncDirectoryLabel({ files, uri }: { files: FileHandlingService; uri: string }): React.JSX.Element {
  const [dir, setDir] = useState<string | null>(null);

  useEffect(() => {
    files.getLocalDirectoryOrNull(uri, true).then(setDir);
  }, [files, uri]);

  return (
    <span className="text-muted startpage__directory-label" title={dir ?? undefined}>
      {dir ?? ''}
    </span>
  );
}
