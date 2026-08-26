import type { Bifrost } from '#bifrost/Bifrost';
import type { IconComponent } from '#bifrost/contracts/IconTypes';
import type { TreeBadge, TreeItemDropCallbackFn, TreeItemStyles } from '#bifrost/contracts/TreeTypes';
import type { ItemInstance } from '@headless-tree/core';
import { useDrag, useDrop } from 'react-dnd';

import type { CSSProperties } from 'react';
import React from 'react';

import { useDecoration } from './DecorationContext';
import type { TreeItemData } from './TreeDataAdapter';

export const NATIVE_FILE_TYPE = '__NATIVE_FILE__';

export type ExternalFileDropCallbackFn = (files: File[], targetItem: any) => void;

type HeadlessTreeItemProps = {
  item: ItemInstance<TreeItemData>;
  dataVersion: number;
  isExpanded: boolean;
  isSelected: boolean;
  selectedCount: number;
  studio: Bifrost;
  iconComponent: IconComponent;
  onContextMenu: (itemData: TreeItemData, event: MouseEvent) => void;
  onActionIconClick?: (data: TreeItemData & Record<string, any>, event: any) => void;
  onDragAndDropItem?: TreeItemDropCallbackFn;
  onExternalFileDrop?: ExternalFileDropCallbackFn;
};

export const HeadlessTreeItem = React.memo(function HeadlessTreeItem(props: HeadlessTreeItemProps): React.JSX.Element {
  const { item, isExpanded, isSelected, iconComponent: IconComponent, onContextMenu } = props;
  const data = item.getItemData();
  const meta = item.getItemMeta();
  const depth = meta.level;

  const decoration = useDecoration(data.metadata?.uri);
  const effectiveStyles = decoration?.styles ? { ...data.styles, ...decoration.styles } : data.styles;
  const effectiveBadges = decoration?.badges ? [...(data.badges ?? []), ...decoration.badges] : data.badges;

  const isExpandable = item.isFolder();

  const twistieIconQuery = isExpanded ? 'std/tree/twistie-open' : 'std/tree/twistie-closed';
  const labelIconClassName =
    data.labelIcon == null ? null : data.labelIcon.replace('{closed:open}', isExpanded ? 'open' : 'closed');

  let actionIconOrComponent: React.JSX.Element | null = null;
  if (data.actionIcon != null) {
    actionIconOrComponent = (
      <div className="treeview__action-icon">
        <IconComponent id={data.actionIcon} />
      </div>
    );
  }
  let actionIconOrComponentOnHover: React.JSX.Element | null = null;
  if (data.actionIconOnHover != null) {
    actionIconOrComponentOnHover = (
      <div className="treeview__action-icon-hover">
        <IconComponent id={data.actionIconOnHover} />
      </div>
    );
  }

  let actionIconsOnHoverRow: React.JSX.Element | null = null;
  if (data.actionIconsOnHover != null && data.actionIconsOnHover.length > 0) {
    actionIconsOnHoverRow = (
      <div className="treeview__action-icons-hover">
        {data.actionIconsOnHover.map((action: { icon: string; tooltip?: string; id: string }) => (
          <span
            key={action.id}
            className="treeview__action-icon-item"
            data-bs-title={action.tooltip}
            data-bs-toggle="tooltip"
            onClick={(e: any) => {
              e.stopPropagation();
              props.onActionIconClick?.({ ...data, actionId: action.id }, e);
            }}
          >
            <IconComponent id={action.icon} />
          </span>
        ))}
      </div>
    );
  }
  if (data.actionInput === 'checkbox') {
    actionIconOrComponent = <input type="checkbox" />;
  }

  const twistieIcon = isExpandable ? <IconComponent id={twistieIconQuery} /> : null;
  const labelIcon = labelIconClassName == null ? null : <IconComponent id={labelIconClassName} />;

  const onActionIconClick = (event: any): void => {
    const isLeftMouseButton = event.button === 0;
    if (props.onActionIconClick != null && isLeftMouseButton && !isExpandable) {
      event.stopPropagation();
      props.onActionIconClick(data, event);
    }
  };

  const handleContextMenu = (event: any) => {
    event.preventDefault();
    onContextMenu(data, event);
  };

  const tooltip = [data.labelTooltip, data.actionTooltip]
    .filter((text: string | undefined) => text != null)
    .join(' • ');

  const labelStyle = effectiveStyles == null ? undefined : getTreeViewLabelStyles(effectiveStyles);
  const subLabelStyle = effectiveStyles == null ? undefined : getTreeViewSubLabelStyles(effectiveStyles);

  const label = (
    <span className="treeview__label-container" style={labelStyle}>
      <span className="treeview__label">{highlight(data.label, data.labelHighlight)}</span>
    </span>
  );

  const sublabel = data.sublabel && (
    <span className="treeview__sublabel" style={subLabelStyle}>
      {highlight(data.sublabel, data.sublabelHighlight)}
    </span>
  );

  const classNames = [
    'treeview__entry',
    isSelected ? 'treeview__entry--selected' : null,
    `treeview__entry--${data.type}`,
    `treeview__entry--depth-${depth}`,
    data.metadata?.isTemporary ? 'treeview__entry--temporary' : '',
  ];

  const enableDragAndDrop = !!props.onDragAndDropItem;

  const dataTestAttrs: Record<string, string> = {
    'data-test--tree-entry-type': data.type,
  };
  if (data.metadata?.uri) {
    dataTestAttrs['data-test--tree-entry-uri'] = data.metadata.uri;
  }

  const { ref: htRef, ...htPropsWithoutRef } = item.getProps();
  const indentStyle = { paddingLeft: `${depth * 16}px` };

  const isDraggable = enableDragAndDrop && (data.type === 'file' || data.type === 'directory');

  const acceptTypes = props.onExternalFileDrop ? ['tree_item', NATIVE_FILE_TYPE] : ['tree_item'];

  const [{ isDragging }, drag] = useDrag(
    () => ({
      type: 'tree_item',
      item: { ...data, selected: isSelected },
      canDrag: isDraggable,
      collect: (monitor: any) => ({
        isDragging: !!monitor.isDragging(),
      }),
    }),
    [data.metadata?.uri, data.type, isSelected, isDraggable],
  );

  const [{ isOver }, drop] = useDrop(
    () => ({
      accept: acceptTypes,
      canDrop: (draggedItem: any, monitor: any) => {
        if (!enableDragAndDrop) {
          return false;
        }
        if (monitor.getItemType() === NATIVE_FILE_TYPE) {
          return true;
        }
        const sourceUri = draggedItem.metadata?.uri;
        const targetUri = data.metadata?.uri;
        if (!sourceUri || !targetUri) {
          return false;
        }
        if (sourceUri === targetUri) {
          return false;
        }
        if (draggedItem.type === 'directory' && targetUri.startsWith(sourceUri + '/')) {
          return false;
        }
        return true;
      },
      drop: (draggedItem: any, monitor: any) => {
        if (monitor.getItemType() === NATIVE_FILE_TYPE) {
          props.onExternalFileDrop?.(draggedItem.files, data);
        } else {
          props.onDragAndDropItem?.(draggedItem, data);
        }
      },
      collect: (monitor: any) => ({
        isOver: monitor.isOver() && monitor.canDrop(),
      }),
    }),
    [data.metadata?.uri, data.type, props.onExternalFileDrop, enableDragAndDrop],
  );

  if (enableDragAndDrop) {
    classNames.push(isOver ? 'treeview__entry--over' : '', isDragging ? 'treeview__entry--dragging' : '');
  }

  let entry: React.JSX.Element;

  if (!enableDragAndDrop) {
    entry = (
      <div
        ref={htRef}
        {...htPropsWithoutRef}
        className={classNames.join(' ')}
        style={indentStyle}
        onContextMenu={handleContextMenu}
        data-bs-title={tooltip}
        data-bs-toggle="tooltip"
        {...dataTestAttrs}
      >
        <div className="treeview__action-or-twistie" onClick={onActionIconClick}>
          {twistieIcon}
          {actionIconOrComponent}
          {actionIconOrComponentOnHover}
        </div>
        {labelIcon && <span className="treeview__icon">{labelIcon}</span>} {label} {sublabel}
        <TreeItemBadges badges={effectiveBadges} styles={effectiveStyles} iconComponent={IconComponent} />
        {actionIconsOnHoverRow}
      </div>
    );
  } else {
    const innerRef = (node: HTMLElement | null) => {
      if (isDraggable) {
        (drag as any)(node);
      }
      if (typeof htRef === 'function') {
        htRef(node);
      }
    };

    entry = (
      <div ref={drop as any}>
        <div
          ref={innerRef}
          {...htPropsWithoutRef}
          className={classNames.join(' ')}
          style={indentStyle}
          onContextMenu={handleContextMenu}
          data-bs-title={tooltip}
          data-bs-toggle="tooltip"
          {...dataTestAttrs}
        >
          <div className="treeview__action-or-twistie" onClick={onActionIconClick}>
            {twistieIcon}
            {actionIconOrComponent}
            {actionIconOrComponentOnHover}
          </div>
          {labelIcon && <span className="treeview__icon">{labelIcon}</span>} {label} {sublabel}
          <TreeItemBadges badges={effectiveBadges} styles={effectiveStyles} iconComponent={IconComponent} />
          {actionIconsOnHoverRow}
          {isDragging && isSelected && props.selectedCount > 1 && (
            <span className="treeview__drag-count">{props.selectedCount}</span>
          )}
        </div>
      </div>
    );
  }

  return entry;
});

/**
 * Wraps `phrase` matches in highlight spans. React text nodes handle escaping.
 */
function highlight(text: string, phrase?: string): React.ReactNode {
  if (!phrase) {
    return text;
  }
  const pattern = escapeRegExp(phrase);
  const regex = new RegExp(pattern, 'gi');

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<React.Fragment key={`t-${lastIndex}`}>{text.slice(lastIndex, match.index)}</React.Fragment>);
    }
    parts.push(
      <span key={`h-${match.index}`} className="treeview__highlight">
        {match[0]}
      </span>,
    );
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(<React.Fragment key={`t-${lastIndex}`}>{text.slice(lastIndex)}</React.Fragment>);
  }

  return parts;
}

function escapeRegExp(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

type TreeItemBadgesProps = {
  badges?: TreeBadge[];
  styles?: TreeItemStyles;
  iconComponent: IconComponent;
};

function TreeItemBadges(props: TreeItemBadgesProps): React.JSX.Element | null {
  if (props.badges == null) {
    return null;
  }
  const badgeStyle = props.styles == null ? undefined : getTreeViewBadgeStyles(props.styles);
  return (
    <span className="treeview__badges" style={badgeStyle}>
      {renderBadges(props.badges, props.iconComponent)}
    </span>
  );
}

function renderBadges(badges: TreeBadge[], iconComponent: IconComponent): React.JSX.Element[] {
  const lastBadgeIndex = badges.length - 1;
  return badges.map((badge: TreeBadge, badgePosition: number) => {
    const suffix = badgePosition < lastBadgeIndex ? <span className="treeview__badge-separator">{', '}</span> : null;
    switch (badge.type) {
      case 'character':
        return (
          <span className="treeview__badge" key={`character:${badge.character}`}>
            {badge.character}
            {suffix}
          </span>
        );
      case 'number':
        return (
          <span className="treeview__badge" key={`number:${badge.number}`}>
            {badge.number}
            {suffix}
          </span>
        );
      case 'icon': {
        const Icon = iconComponent;
        return (
          <span className="treeview__badge" key={`icon:${badge.icon}`}>
            <Icon id={badge.icon} />
            {suffix}
          </span>
        );
      }
    }
  });
}

const LABEL_COLORS: Record<string, string> = {
  black: 'var(--color-black)',
  gray: 'var(--color-grey)',
  white: 'var(--color-white)',
  blue: 'var(--color-blue)',
  yellow: 'var(--color-yellow)',
  gold: 'var(--color-gold)',
  red: 'var(--color-red)',
  purple: 'var(--color-purple)',
  orange: 'var(--color-orange)',
  green: 'var(--color-green)',
};

function resolveColor(colorName: string | undefined): string | undefined {
  if (!colorName) {
    return undefined;
  }
  if (colorName.startsWith('var(')) {
    return colorName;
  }
  if (colorName.match(/^#[a-fA-F0-9]{3,8}$/)) {
    return colorName;
  }
  return LABEL_COLORS[colorName];
}

function getTreeViewLabelStyles(styles: TreeItemStyles): CSSProperties | undefined {
  const result: CSSProperties = {};
  const color = resolveColor(styles.labelColor);
  if (color) {
    result.color = color;
  }
  if (styles.shrinking === true) {
    result.flexShrink = 1;
  } else if (styles.shrinking === false) {
    result.flexShrink = 0;
  }
  if (Object.keys(result).length === 0) {
    return undefined;
  }
  return result;
}

function getTreeViewSubLabelStyles(styles: TreeItemStyles): CSSProperties | undefined {
  const color = resolveColor(styles.subLabelColor);
  if (!color) {
    return undefined;
  }
  return { color };
}

function getTreeViewBadgeStyles(styles: TreeItemStyles): CSSProperties | undefined {
  const color = resolveColor(styles.badgeColor);
  if (!color) {
    return undefined;
  }
  return { color };
}
