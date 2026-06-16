import { Bifrost } from '#bifrost/Bifrost';
import { EVENT_PLUGIN_LIST_CHANGED } from '#bifrost/contracts/PluginHostTypes';

import React, { useCallback, useEffect, useState } from 'react';

import type {
  EditorDocument,
  EditorDocumentModel,
  PaneComponentProps,
  PaneProvider,
  PluginInfo,
  Studio,
} from '@evil/bifrost_fw_sdk';
import { Pane, PaneBody, PaneHeader, PaneHeaderIcon } from '@evil/bifrost_fw_sdk';

import { PluginCard } from './PluginCard';
import './plugins.scss';

function humanizeDomainSegment(segment: string): string {
  return segment.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (ch) => ch.toUpperCase());
}

function findSettingsCategory(studio: Studio, pluginDisplayName: string): string | null {
  const schemas = studio.settings.getSchemas();
  for (const [key, descriptor] of schemas) {
    const category = descriptor.category ?? humanizeDomainSegment(key.split('.')[0]);
    if (category === pluginDisplayName) {
      return category;
    }
  }
  return null;
}

export const paneProvider: PaneProvider = {
  getPaneTitle,
  Pane: PaneFull,
  PaneContent,
};

function getPaneTitle(
  _editorDocument: EditorDocument,
  _editorDocumentModel: EditorDocumentModel,
  _studio: Studio,
): string {
  return 'Installed';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane classNames="app-layout__full-height-pane">
      <PaneHeader
        studio={props.studio}
        title={getPaneTitle(props.editorDocument, props.editorDocumentModel, props.studio)}
        className="pane-header--hero"
        paneId={props.paneId}
        collapsed={props.collapsed}
      >
        <PaneHeaderIcon
          studio={props.studio}
          icon="ph ph-arrow-clockwise"
          tooltip="Refresh Plugins"
          command="plugins.refreshPluginList"
          dataTestId="plugins-refresh"
        />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element {
  const bifrost = Bifrost.cast(props.studio);

  const [plugins, setPlugins] = useState<PluginInfo[]>(bifrost.plugins.getPluginList());

  useEffect(() => {
    const pluginsChangedSub = bifrost.plugins.on(EVENT_PLUGIN_LIST_CHANGED, () => {
      console.log('EVENT_PLUGIN_LIST_CHANGED TRIGGERED');
      setPlugins(bifrost.plugins.getPluginList());
    });
    return () => {
      pluginsChangedSub.dispose();
    };
  }, [bifrost.plugins]);

  const handleOpenSettings = useCallback(
    (info: PluginInfo) => {
      const category = findSettingsCategory(props.studio, info.displayName);
      if (category) {
        props.studio.commands.executeCommand('std.settings.openUserSettingsAtCategory', [category]);
      } else {
        props.studio.editors.focusOrOpenEditorDocument('about:settings', 'Settings');
      }
    },
    [props.studio],
  );

  if (plugins.length === 0) {
    return (
      <PaneBody>
        <div className="plugins-pane__empty" data-test--plugins-pane-empty>
          <span className="plugins-pane__empty-icon ph ph-puzzle-piece" />
          <p>No plugins installed.</p>
          <button
            type="button"
            className="plugins-pane__open-folder"
            data-test--plugins-open-folder
            onClick={() => props.studio.commands.executeCommand('plugins.openPluginFolder')}
          >
            <span className="ph ph-folder-open" />
            Open Plugin Folder
          </button>
        </div>
      </PaneBody>
    );
  }

  return (
    <PaneBody>
      <div className="plugins-pane__list" data-test--plugins-pane-list>
        {plugins.map((plugin) => (
          <PluginCard
            bifrost={bifrost}
            key={plugin.name}
            plugin={plugin}
            onToggle={(name) => bifrost.plugins.togglePlugin(name)}
            onDisable={(name) => bifrost.plugins.disablePlugin(name)}
            onUninstall={(info) => bifrost.plugins.uninstallPlugin(info)}
            onTrustAndReEnable={(name) => bifrost.plugins.trustAndReEnablePlugin(name)}
            onShowError={(info) => {
              props.studio.commands.executeCommand('std.dialog.openCopyAndPaste', [
                `Error: ${info.displayName || info.name}`,
                info.errorMessage ?? 'Unknown error',
              ]);
            }}
            onOpenReadme={(info) => {
              props.studio.editors.focusOrOpenEditorDocument(`about:plugin-readme/${info.name}`, info.displayName);
            }}
            onOpenSettings={handleOpenSettings}
          />
        ))}
      </div>
    </PaneBody>
  );
}
