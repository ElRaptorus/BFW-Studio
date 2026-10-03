import type { MenuBarItem } from '#bifrost/contracts/MenuBarTypes';

export type PageBarSections = {
  /** The page bar renders when it has page tabs to switch between, items, or layout toggles. */
  readonly visible: boolean;
  readonly centerItems: readonly MenuBarItem[];
  readonly endItems: readonly MenuBarItem[];
  readonly layoutToggleItems: readonly MenuBarItem[];
  /** A divider separates the end items from the layout toggles only when both exist. */
  readonly showDivider: boolean;
};

export function buildPageBarSections(input: {
  pageCount: number;
  centerItems: readonly MenuBarItem[];
  endItems: readonly MenuBarItem[];
  layoutToggleItems: readonly MenuBarItem[];
}): PageBarSections {
  const { pageCount, centerItems, endItems, layoutToggleItems } = input;
  return {
    visible: pageCount > 1 || centerItems.length > 0 || endItems.length > 0 || layoutToggleItems.length > 0,
    centerItems,
    endItems,
    layoutToggleItems,
    showDivider: endItems.length > 0 && layoutToggleItems.length > 0,
  };
}
