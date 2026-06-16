import { Bifrost } from '#bifrost/Bifrost';
import {
  PERMISSION_DISPLAY,
  type PermissionDisplayInfo,
} from '#bifrost/common/plugin-host/permissions/PermissionDisplay';
import type { PluginPermission } from '#bifrost/common/plugin-host/permissions/PermissionTypes';
import { EVENT_PLUGIN_LIST_CHANGED } from '#bifrost/contracts/PluginHostTypes';

import React, { useCallback, useMemo } from 'react';

import type { EditorDocument, PaneComponentProps, PluginInfo } from '@evil/bifrost_fw_sdk';
import { PaneBody, buildSimplePropertyPaneProvider } from '@evil/bifrost_fw_sdk';

const WARNING_LEVEL_ORDER: Record<PermissionDisplayInfo['warningLevel'], number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

function getWarningLevelClass(level: PermissionDisplayInfo['warningLevel']): string {
  switch (level) {
    case 'low':
      return 'plugin-info-pane__perm--low';
    case 'medium':
      return 'plugin-info-pane__perm--medium';
    case 'high':
      return 'plugin-info-pane__perm--high';
    case 'critical':
      return 'plugin-info-pane__perm--critical';
  }
}

function PermissionsList({ permissions }: { permissions: string[] }): React.JSX.Element {
  const sorted = useMemo(() => {
    return [...permissions].sort((left, right) => {
      const leftInfo = PERMISSION_DISPLAY[left as PluginPermission];
      const rightInfo = PERMISSION_DISPLAY[right as PluginPermission];
      const leftOrder = leftInfo != null ? WARNING_LEVEL_ORDER[leftInfo.warningLevel] : -1;
      const rightOrder = rightInfo != null ? WARNING_LEVEL_ORDER[rightInfo.warningLevel] : -1;
      return rightOrder - leftOrder;
    });
  }, [permissions]);

  if (sorted.length === 0) {
    return (
      <div className="plugin-info-pane__section">
        <div className="plugin-info-pane__section-title">Permissions</div>
        <div className="plugin-info-pane__no-perms">No special permissions required.</div>
      </div>
    );
  }

  return (
    <div className="plugin-info-pane__section" data-test--plugin-info-pane-permissions>
      <div className="plugin-info-pane__section-title">Permissions</div>
      <div className="plugin-info-pane__perm-list">
        {sorted.map((perm) => {
          const info = PERMISSION_DISPLAY[perm as PluginPermission];
          if (info == null) {
            return (
              <div key={perm} className="plugin-info-pane__perm-row">
                <span className="plugin-info-pane__perm-label">{perm}</span>
              </div>
            );
          }
          return (
            <div key={perm} className={`plugin-info-pane__perm-row ${getWarningLevelClass(info.warningLevel)}`}>
              <span className="plugin-info-pane__perm-icon">{info.icon}</span>
              <div className="plugin-info-pane__perm-info">
                <span className="plugin-info-pane__perm-label">{info.label}</span>
                <span className="plugin-info-pane__perm-desc">{info.description}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AuthorSection({ plugin }: { plugin: PluginInfo }): React.JSX.Element | null {
  const handleLinkClick = useCallback((ev: React.MouseEvent, url: string) => {
    ev.preventDefault();
    import('electron').then(({ shell }) => shell.openExternal(url));
  }, []);

  if (!plugin.author && !plugin.homepage && (!plugin.keywords || plugin.keywords.length === 0)) {
    return null;
  }

  return (
    <div className="plugin-info-pane__section" data-test--plugin-info-pane-author>
      <div className="plugin-info-pane__section-title">Author</div>
      {plugin.author && <div className="plugin-info-pane__row">{plugin.author}</div>}
      {plugin.homepage && (
        <a
          className="plugin-info-pane__link"
          href={plugin.homepage}
          title={plugin.homepage}
          onClick={(ev) => handleLinkClick(ev, plugin.homepage!)}
          data-test--plugin-info-homepage
        >
          {plugin.homepage.replace(/^https?:\/\//, '')}
        </a>
      )}
      {plugin.keywords && plugin.keywords.length > 0 && (
        <div className="plugin-info-pane__tags">
          {plugin.keywords.map((tag) => (
            <span key={tag} className="plugin-info-pane__tag">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function HealthSection({ plugin }: { plugin: PluginInfo }): React.JSX.Element {
  return (
    <div className="plugin-info-pane__section" data-test--plugin-info-pane-health>
      <div className="plugin-info-pane__section-title">Health</div>
      <div className="plugin-info-pane__row">
        <span className="plugin-info-pane__health-label">Status</span>
        <span className={`plugin-info-pane__health-value plugin-info-pane__health-status--${plugin.status}`}>
          {plugin.status}
        </span>
      </div>
      {plugin.errorMessage && (
        <div className="plugin-info-pane__row">
          <span className="plugin-info-pane__health-label">Error</span>
          <span className="plugin-info-pane__health-value plugin-info-pane__health-status--error">
            {plugin.errorMessage}
          </span>
        </div>
      )}
    </div>
  );
}

function PluginInfoPaneContent(props: PaneComponentProps): React.JSX.Element {
  const bifrost = Bifrost.cast(props.studio);
  const pluginName = props.editorDocument.uri.replace('about:plugin-readme/', '');

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const sub = bifrost.plugins.on(EVENT_PLUGIN_LIST_CHANGED, onStoreChange);
      return () => sub.dispose();
    },
    [bifrost.plugins],
  );

  const getSnapshot = useCallback(
    () => bifrost.plugins.getPluginList().find((pl) => pl.name === pluginName) ?? null,
    [bifrost.plugins, pluginName],
  );

  const pluginInfo = React.useSyncExternalStore(subscribe, getSnapshot);

  if (pluginInfo == null) {
    return (
      <PaneBody>
        <div className="plugin-info-pane__empty">Plugin not found.</div>
      </PaneBody>
    );
  }

  const permissions = pluginInfo.manifest?.permissions ?? [];

  return (
    <PaneBody>
      <div className="plugin-info-pane" data-test--plugin-info-pane={pluginName}>
        {pluginInfo.packageName && (
          <div className="plugin-info-pane__section" data-test--plugin-info-pane-package>
            <div className="plugin-info-pane__section-title">Package</div>
            <div className="plugin-info-pane__row">{pluginInfo.packageName}</div>
          </div>
        )}
        <AuthorSection plugin={pluginInfo} />
        <PermissionsList permissions={permissions} />
        <HealthSection plugin={pluginInfo} />
      </div>
    </PaneBody>
  );
}

function isPluginReadmeDocument(editorDocument: EditorDocument): boolean {
  return editorDocument?.documentType === 'plugin-readme';
}

function getTitle(editorDocument: EditorDocument): string {
  const pluginName = editorDocument.uri.replace('about:plugin-readme/', '');
  return `Plugin Info: ${pluginName}`;
}

export const paneProvider = buildSimplePropertyPaneProvider(isPluginReadmeDocument, getTitle, PluginInfoPaneContent);
