import type { Bifrost } from '#bifrost/Bifrost';
import type { PluginInfo } from '#bifrost/contracts/PluginHostTypes';

import React, { useCallback, useEffect, useRef, useState } from 'react';

import { usePluginLogo } from './usePluginLogo';

interface PluginCardProps {
  bifrost: Bifrost;
  plugin: PluginInfo;
  onToggle: (pluginName: string) => void;
  onDisable: (pluginName: string) => void;
  onUninstall: (plugin: PluginInfo) => void;
  onShowError: (plugin: PluginInfo) => void;
  onOpenReadme: (plugin: PluginInfo) => void;
  onOpenSettings: (plugin: PluginInfo) => void;
  onTrustAndReEnable: (pluginName: string) => void;
}

function getStatusBadge(status: PluginInfo['status']): React.JSX.Element | null {
  switch (status) {
    case 'disabled':
      return <span className="plugin-card__badge plugin-card__badge--disabled">Disabled</span>;
    case 'error':
      return <span className="plugin-card__badge plugin-card__badge--error">Error</span>;
    case 'quarantined':
      return <span className="plugin-card__badge plugin-card__badge--quarantined">Quarantined</span>;
    default:
      return null;
  }
}

function hasPermissions(plugin: PluginInfo): boolean {
  const perms = plugin.manifest?.permissions;
  return perms != null && perms.length > 0;
}

export function PluginCard({
  bifrost,
  plugin,
  onToggle,
  onDisable,
  onUninstall,
  onShowError,
  onOpenReadme,
  onOpenSettings,
  onTrustAndReEnable,
}: PluginCardProps): React.JSX.Element {
  const logoDataUri = usePluginLogo(bifrost, plugin.logoPath);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const handleOutsideClick = (ev: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(ev.target as Node)) {
        closeMenu();
      }
    };

    document.addEventListener('mousedown', handleOutsideClick, true);
    return () => document.removeEventListener('mousedown', handleOutsideClick, true);
  }, [menuOpen, closeMenu]);

  const classNames = ['plugin-card'];
  if (plugin.status === 'disabled') {
    classNames.push('plugin-card--disabled');
  }
  if (plugin.status === 'error') {
    classNames.push('plugin-card--error');
  }
  if (plugin.status === 'pending') {
    classNames.push('plugin-card--pending');
  }
  if (plugin.status === 'quarantined') {
    classNames.push('plugin-card--quarantined');
  }

  const deprecationTitle = typeof plugin.deprecated === 'string' ? plugin.deprecated : 'This plugin is deprecated';

  return (
    <div
      className={classNames.join(' ')}
      data-test--plugin-card={plugin.name}
      onClick={() => onOpenReadme(plugin)}
      role="button"
      tabIndex={0}
      onKeyDown={(ev) => ev.key === 'Enter' && onOpenReadme(plugin)}
    >
      {logoDataUri && (
        <img
          className="plugin-card__logo"
          src={logoDataUri}
          alt={`${plugin.displayName} logo`}
          data-test--plugin-card-logo={plugin.name}
        />
      )}
      <div className="plugin-card__body">
        <div className="plugin-card__header">
          {plugin.deprecated && (
            <span
              className="plugin-card__deprecation-icon ph ph-warning"
              title={deprecationTitle}
              data-test--plugin-card-deprecated={plugin.name}
            />
          )}
          {!plugin.author && (
            <span
              className="plugin-card__missing-author-icon ph ph-warning"
              title="Missing author information"
              data-test--plugin-card-missing-author={plugin.name}
            />
          )}
          <span className="plugin-card__name" title={plugin.displayName}>
            {plugin.displayName}
          </span>

          <div className="plugin-card__menu-anchor" ref={menuRef}>
            <button
              className="plugin-card__menu-trigger"
              title="Plugin actions"
              data-test--plugin-menu-trigger={plugin.name}
              onClick={(ev) => {
                ev.stopPropagation();
                setMenuOpen((prev) => !prev);
              }}
            >
              <span className="ph ph-wrench" />
            </button>
            {menuOpen && (
              <div className="plugin-card__menu" data-test--plugin-menu={plugin.name}>
                <button
                  className="plugin-card__menu-item"
                  data-test--plugin-menu-toggle={plugin.name}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onToggle(plugin.name);
                    closeMenu();
                  }}
                >
                  {plugin.status === 'error' && plugin.enabled ? (
                    <>
                      <span className="ph ph-arrow-clockwise" />
                      Retry
                    </>
                  ) : (
                    <>
                      <span className={`ph ${plugin.enabled ? 'ph-toggle-right' : 'ph-toggle-left'}`} />
                      {plugin.enabled ? 'Disable' : 'Enable'}
                    </>
                  )}
                </button>
                {plugin.status === 'error' && (
                  <button
                    className="plugin-card__menu-item"
                    data-test--plugin-menu-disable={plugin.name}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onDisable(plugin.name);
                      closeMenu();
                    }}
                  >
                    <span className="ph ph-toggle-right" />
                    Disable
                  </button>
                )}
                {plugin.status === 'quarantined' && (
                  <button
                    className="plugin-card__menu-item"
                    data-test--plugin-menu-trust-reenable={plugin.name}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onTrustAndReEnable(plugin.name);
                      closeMenu();
                    }}
                  >
                    <span className="ph ph-shield-check" />
                    Trust &amp; Re-enable
                  </button>
                )}
                {plugin.status !== 'disabled' && plugin.status !== 'error' && (
                  <button
                    className="plugin-card__menu-item"
                    data-test--plugin-menu-settings={plugin.name}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onOpenSettings(plugin);
                      closeMenu();
                    }}
                  >
                    <span className="ph ph-gear" />
                    Settings
                  </button>
                )}
                <div className="plugin-card__menu-separator" />
                <button
                  className="plugin-card__menu-item plugin-card__menu-item--danger"
                  data-test--plugin-menu-uninstall={plugin.name}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onUninstall(plugin);
                    closeMenu();
                  }}
                >
                  <span className="ph ph-trash" />
                  Uninstall
                </button>
              </div>
            )}
          </div>
        </div>
        {(getStatusBadge(plugin.status) != null || hasPermissions(plugin)) && (
          <div className="plugin-card__badges">
            {getStatusBadge(plugin.status)}
            {hasPermissions(plugin) && (
              <span
                className="plugin-card__badge plugin-card__badge--permissions"
                title="This plugin requests special permissions"
                data-test--plugin-card-permissions={plugin.name}
              >
                Permissions
              </span>
            )}
          </div>
        )}
        {plugin.description && (
          <div className="plugin-card__description" title={plugin.description}>
            {plugin.description}
          </div>
        )}
        <div className="plugin-card__meta">
          <span className="plugin-card__version">{plugin.version}</span>
          {plugin.author && (
            <>
              <span className="plugin-card__meta-sep">&middot;</span>
              <span className="plugin-card__author">{plugin.author}</span>
            </>
          )}
        </div>
        {plugin.status === 'pending' && (
          <div className="plugin-card__pending">
            <span className="ph ph-clock" />
            <span>Pending activation</span>
          </div>
        )}
        {plugin.status === 'error' && plugin.errorMessage && (
          <div className="plugin-card__error">
            <span className="ph ph-warning-circle" />
            <a
              className="plugin-card__error-link"
              role="button"
              tabIndex={0}
              onClick={(ev) => {
                ev.stopPropagation();
                onShowError(plugin);
              }}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter') {
                  ev.stopPropagation();
                  onShowError(plugin);
                }
              }}
              data-test--plugin-error-details={plugin.name}
            >
              Error Details
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
