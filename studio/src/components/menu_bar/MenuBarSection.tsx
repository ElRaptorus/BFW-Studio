import type { MenuBarItem } from '#bifrost/contracts/MenuBarTypes';

import React, { Fragment } from 'react';

import type { IconComponent } from '@evil/bifrost_fw_sdk';
import { Icon } from '@evil/bifrost_fw_sdk';

import MenuBarButton from './MenuBarButton';
import MenuBarMenu from './MenuBarMenu';
import MenuBarPaneContentToggle from './MenuBarPaneContentToggle';
import MenuBarSelect from './MenuBarSelect';
import { menuBarItemKey } from './menuBarItemKey';

type MenuBarSectionProps = {
  items: MenuBarItem[];
  align?: 'left' | 'center' | 'right';
};

export default function MenuBarSection(props: MenuBarSectionProps): React.JSX.Element {
  const classNames = ['menu-bar-section'];
  if (props.align === 'right') {
    classNames.push('menu-bar-section--right');
  }

  return (
    <div className={classNames.join(' ')}>
      {props.items.map((item: MenuBarItem) => (
        <Fragment key={menuBarItemKey(item)}>{renderMenuBarItemObject(item, Icon)}</Fragment>
      ))}
    </div>
  );
}

function renderMenuBarItemObject(item: MenuBarItem, Icon: IconComponent): React.JSX.Element | null {
  if (item.visible === false) {
    return null;
  }

  switch (item.type) {
    case 'divider':
      return <div className="menu-bar__divider" {...getHtmlAttributes(item)} />;
    case 'menu':
      return (
        <MenuBarMenu
          icon={item.icon}
          menu={item.menu}
          tooltip={item.tooltip}
          htmlAttributes={getHtmlAttributes(item)}
        />
      );
    case 'button':
      return (
        <MenuBarButton
          icon={item.icon}
          command={item.command}
          commandArgs={item.commandArgs}
          tooltip={item.tooltip}
          htmlAttributes={getHtmlAttributes(item)}
        />
      );
    case 'pane_content_toggle':
      return (
        <MenuBarPaneContentToggle
          icon={item.icon}
          tooltip={item.tooltip}
          paneAreaId={item.paneAreaId}
          paneId={item.paneId}
          htmlAttributes={getHtmlAttributes(item)}
        />
      );
    case 'select':
      return (
        <MenuBarSelect
          entries={item.entries}
          value={item.value}
          command={item.command}
          tooltip={item.tooltip}
          htmlAttributes={getHtmlAttributes(item)}
        />
      );
    case 'text':
      return (
        <div
          className="menu-bar__text"
          data-bs-title={item.tooltip}
          data-bs-toggle="tooltip"
          {...getHtmlAttributes(item)}
        >
          {item.label}
        </div>
      );
    case 'icon':
      return (
        <span data-bs-title={item.tooltip} data-bs-toggle="tooltip" {...getHtmlAttributes(item)}>
          <Icon id={item.icon} />
        </span>
      );
    default:
      console.error(`Unknown type for MenuBarObject: '${(item as any).type}' (${JSON.stringify(item, null, 2)})`);
      return null;
  }
}

function getHtmlAttributes(item: MenuBarItem): Record<string, any> {
  const htmlAttributes: Record<string, any> = {};

  htmlAttributes[`data-menu-bar-item-id`] = item.id;

  return htmlAttributes;
}
