import type { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneGroupObject } from '#bifrost/contracts/PaneTypes';

import React, { useCallback, useState } from 'react';

import { useBifrost } from '../../bifrostContext';

export type PaneGroupTabBarVariant = 'icon' | 'text';

type PaneGroupTabBarProps = {
  groups: PaneGroupObject[];
  activeGroupId: string;
  onSelectGroup: (groupId: string) => void;
  editorDocument: EditorDocument | null;
  editorDocumentModel: EditorDocumentModel | null;
  variant: PaneGroupTabBarVariant;
};

export function getDisplayableGroups(
  groups: PaneGroupObject[],
  editorDocument: EditorDocument | null,
  editorDocumentModel: EditorDocumentModel | null,
  bifrost: any,
): PaneGroupObject[] {
  return groups.filter((group) => {
    if (group.panes.length === 0) {
      return false;
    }
    return group.panes.some((pane) => {
      const provider = bifrost.panes.getPaneProvider(pane.providerId);
      if (provider.shouldBeDisplayed == null) {
        return true;
      }
      return provider.shouldBeDisplayed(editorDocument, editorDocumentModel, bifrost);
    });
  });
}

function resolveGroupLabel(group: PaneGroupObject): string {
  if (group.label) {
    return group.label;
  }
  return group.groupId.charAt(0).toUpperCase() + group.groupId.slice(1);
}

function resolveIconClass(group: PaneGroupObject): string | null {
  if (typeof group.icon === 'function') {
    return group.icon();
  }
  if (typeof group.icon === 'string') {
    return group.icon;
  }
  return null;
}

function deriveLetterAbbreviation(label: string): string {
  const words = label.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return label.substring(0, 2).toUpperCase();
}

export default function PaneGroupTabBar(props: PaneGroupTabBarProps): React.JSX.Element {
  const bifrost = useBifrost();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const displayableGroups = getDisplayableGroups(
    props.groups,
    props.editorDocument,
    props.editorDocumentModel,
    bifrost,
  );

  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const { onSelectGroup } = props;
  const handleContextMenuSelect = useCallback(
    (groupId: string) => {
      onSelectGroup(groupId);
      setContextMenu(null);
    },
    [onSelectGroup],
  );

  if (props.variant === 'icon') {
    return (
      <div className="pane-group-tab-bar pane-group-tab-bar--icon" onContextMenu={handleContextMenu}>
        {displayableGroups.map((group) => {
          const isActive = group.groupId === props.activeGroupId;
          const iconClass = resolveIconClass(group);
          const label = resolveGroupLabel(group);

          return (
            <button
              key={group.groupId}
              className={`pane-group-tab-icon${isActive ? ' pane-group-tab-icon--active' : ''}`}
              onClick={() => props.onSelectGroup(group.groupId)}
              title={label}
              type="button"
              data-test--pane-group-tab={group.groupId}
            >
              {iconClass != null ? (
                <i className={iconClass} />
              ) : (
                <span className="pane-group-tab-icon__abbr">{deriveLetterAbbreviation(label)}</span>
              )}
            </button>
          );
        })}

        {contextMenu != null && (
          <>
            <div className="pane-group-context-menu-backdrop" onClick={closeContextMenu} />
            <div className="pane-group-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
              {displayableGroups.map((group) => (
                <button
                  key={group.groupId}
                  className={`pane-group-context-menu__item${group.groupId === props.activeGroupId ? ' pane-group-context-menu__item--active' : ''}`}
                  onClick={() => handleContextMenuSelect(group.groupId)}
                  type="button"
                >
                  {resolveIconClass(group) != null && <i className={resolveIconClass(group)!} />}
                  <span>{resolveGroupLabel(group)}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="pane-group-tab-bar pane-group-tab-bar--text">
      {displayableGroups.map((group) => {
        const isActive = group.groupId === props.activeGroupId;

        return (
          <button
            key={group.groupId}
            className={`pane-group-tab-text${isActive ? ' pane-group-tab-text--active' : ''}`}
            onClick={() => props.onSelectGroup(group.groupId)}
            type="button"
            data-test--pane-group-tab={group.groupId}
          >
            {resolveGroupLabel(group)}
          </button>
        );
      })}
    </div>
  );
}
