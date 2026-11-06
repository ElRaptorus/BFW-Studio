import { matchesPage } from '#bifrost/common/CategoryManager';
import { EVENT_MENU_BAR_UPDATED } from '#bifrost/common/MenuBarManager';
import type { MenuBarItem } from '#bifrost/contracts/MenuBarTypes';
import type { PaneGroupObject } from '#bifrost/contracts/PaneTypes';
import type { WorkbenchCategoryDefinition, WorkbenchPageDefinition } from '#bifrost/contracts/WorkbenchTypes';
import { EVENT_PANE_LAYOUT_UPDATED } from '#bifrost/contracts/internal/PaneEvents';
import {
  EVENT_WORKBENCH_CATEGORIES_UPDATED,
  EVENT_WORKBENCH_PAGE_ACTIVATED,
} from '#bifrost/contracts/internal/WorkbenchEvents';

import React, { useEffect, useReducer } from 'react';

import { useBifrost } from '../../bifrostContext';
import { Icon } from '../Icon';
import MenuBarSection from '../menu_bar/MenuBarSection';
import { buildLayoutToggleItems } from './headerLayoutToggles';
import { buildPageBarSections } from './pageBarSections';

const WEB_HAMBURGER_ITEMS: MenuBarItem[] = [
  { type: 'menu', id: 'header-hamburger', icon: 'std/menubar/hamburger', menu: 'std/application/main' },
];

type PageBarEntry =
  | { kind: 'page'; page: WorkbenchPageDefinition }
  | { kind: 'group'; page: WorkbenchPageDefinition; group: PaneGroupObject };

function resolvePageBarGroupLabel(group: PaneGroupObject): string {
  if (group.label) {
    return group.label;
  }
  return group.groupId.charAt(0).toUpperCase() + group.groupId.slice(1);
}

function resolvePageBarGroupIconId(page: WorkbenchPageDefinition, group: PaneGroupObject): string {
  if (typeof group.icon === 'function') {
    return group.icon();
  }
  if (typeof group.icon === 'string') {
    return group.icon;
  }
  return page.icon;
}

/**
 * The header: Home and the web hamburger (start), the main categories (centered on the window) and at the end the
 * header menu bar items (plugins) and Control. Below it sits the page bar of the active category: the page entries; a
 * page with two or more left pane groups shows one entry per group (start), the `pageBarCenter` items such as the
 * Engine cluster (centered), and the `pageBarEnd` items, a divider and the layout toggles (end). Categories without
 * pages are hidden unless `workbench.categories.showEmpty` is set.
 */
export default function WorkbenchHeader(): React.JSX.Element {
  const bifrost = useBifrost();
  const [, forceUpdate] = useReducer((revision: number) => revision + 1, 0);

  useEffect(() => {
    const subscriptions = [
      bifrost.categories.on(EVENT_WORKBENCH_PAGE_ACTIVATED, () => forceUpdate()),
      bifrost.categories.on(EVENT_WORKBENCH_CATEGORIES_UPDATED, () => forceUpdate()),
      bifrost.menuBar.on(EVENT_MENU_BAR_UPDATED, () => forceUpdate()),
      bifrost.panes.on(EVENT_PANE_LAYOUT_UPDATED, () => forceUpdate()),
    ];
    return () => subscriptions.forEach((subscription) => subscription.dispose());
  }, [bifrost]);

  const categories = bifrost.categories;
  const visibleCategories = categories.getVisibleCategories();
  const activeCategoryId = categories.getActiveCategoryId();
  const activePageId = categories.getActivePageId();
  const pagesOfActiveCategory = activeCategoryId != null ? categories.getPagesOfCategory(activeCategoryId) : [];

  const isOnActivePage = (item: MenuBarItem) =>
    item.pages == null || (activePageId != null && matchesPage(item.pages, activePageId));
  const menuBarItems = bifrost.menuBar.getViewData().items;
  const headerMenuBarItems = menuBarItems.header.filter(isOnActivePage);
  const pageBarCenterItems = menuBarItems.pageBarCenter.filter(isOnActivePage);
  const pageBarEndItems = menuBarItems.pageBarEnd.filter(isOnActivePage);

  const pageBarEntries: PageBarEntry[] = [];
  for (const page of pagesOfActiveCategory) {
    const leftGroups = bifrost.panes.getLeftPaneGroupsOfPage(page.id);
    if (leftGroups.length >= 2) {
      for (const group of leftGroups) {
        pageBarEntries.push({ kind: 'group', page, group });
      }
    } else {
      pageBarEntries.push({ kind: 'page', page });
    }
  }

  const pageBar = buildPageBarSections({
    pageCount: pageBarEntries.length,
    centerItems: pageBarCenterItems,
    endItems: pageBarEndItems,
    layoutToggleItems: buildLayoutToggleItems(bifrost.panes.getViewData()),
  });

  const renderCategory = (category: WorkbenchCategoryDefinition): React.JSX.Element => (
    <button
      key={category.id}
      type="button"
      className={`workbench-header__category${category.id === activeCategoryId ? ' workbench-header__category--active' : ''}`}
      data-category-id={category.id}
      title={category.label}
      aria-label={category.label}
      aria-pressed={category.id === activeCategoryId}
      onClick={() => bifrost.commands.executeCommand('std.workbench.activateCategory', [category.id])}
    >
      <Icon id={category.icon} />
      {category.placement === 'main' && <span className="workbench-header__label">{category.label}</span>}
    </button>
  );

  return (
    <div
      className="workbench-header-container"
      data-category-id={activeCategoryId ?? undefined}
      data-page-id={activePageId ?? undefined}
    >
      <div className="workbench-header">
        <div className="workbench-header__group workbench-header__group--start">
          {visibleCategories.filter((category) => category.placement === 'start').map(renderCategory)}
          {bifrost.env.isWeb && <MenuBarSection items={WEB_HAMBURGER_ITEMS} align="left" />}
        </div>
        <div className="workbench-header__group workbench-header__group--main">
          {visibleCategories.filter((category) => category.placement === 'main').map(renderCategory)}
        </div>
        <div className="workbench-header__group workbench-header__group--end">
          {headerMenuBarItems.length > 0 && <MenuBarSection items={headerMenuBarItems} align="right" />}
          {visibleCategories.filter((category) => category.placement === 'end').map(renderCategory)}
        </div>
      </div>
      {pageBar.visible && (
        <div className="workbench-page-bar">
          <div className="workbench-page-bar__pages">
            {pageBarEntries.map((entry) => {
              if (entry.kind === 'page') {
                const page = entry.page;
                const isActive = page.id === activePageId;
                return (
                  <button
                    key={page.id}
                    type="button"
                    className={`workbench-page-bar__page${isActive ? ' workbench-page-bar__page--active' : ''}`}
                    data-page-id={page.id}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => bifrost.commands.executeCommand('std.workbench.activatePage', [page.id])}
                  >
                    <Icon id={page.icon} />
                    <span>{page.label}</span>
                  </button>
                );
              }
              const { page, group } = entry;
              const isActive = page.id === activePageId && group.visible;
              const paneId = group.panes[group.activePaneIndex ?? 0]?.id ?? group.panes[0].id;
              return (
                <button
                  key={`${page.id}/${group.groupId}`}
                  type="button"
                  className={`workbench-page-bar__page${isActive ? ' workbench-page-bar__page--active' : ''}`}
                  data-page-id={page.id}
                  data-test--pane-group-tab={group.groupId}
                  data-test--active={isActive}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => bifrost.commands.executeCommand('std.workbench.toggleLeftPaneAreaItem', [paneId])}
                >
                  <Icon id={resolvePageBarGroupIconId(page, group)} />
                  <span>{resolvePageBarGroupLabel(group)}</span>
                </button>
              );
            })}
          </div>
          <div className="workbench-page-bar__section workbench-page-bar__section--center">
            {pageBar.centerItems.length > 0 && <MenuBarSection items={[...pageBar.centerItems]} align="center" />}
          </div>
          <div className="workbench-page-bar__items">
            {pageBar.endItems.length > 0 && <MenuBarSection items={[...pageBar.endItems]} align="right" />}
            {pageBar.showDivider && <div className="menu-bar__divider" />}
            {pageBar.layoutToggleItems.length > 0 && (
              <MenuBarSection items={[...pageBar.layoutToggleItems]} align="right" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
