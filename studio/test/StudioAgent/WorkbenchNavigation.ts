import type { StudioAgent } from '../StudioAgent';
import { ASSERT_VISIBLE_TIMEOUT } from '../StudioAgent';

const HEADER_SELECTOR = '.workbench-header-container';

/** The page and pane group each left pane lives in. A tab strip appears when a page has two or more left groups. */
const LEFT_PANE_LOCATIONS: Record<string, { pageId: string; groupId: string; hasTabStrip: boolean }> = {
  'pane/left/explorer': { pageId: 'design/workspace', groupId: 'explorer', hasTabStrip: true },
  'pane/left/search': { pageId: 'design/workspace', groupId: 'search', hasTabStrip: true },
  'pane/left/git': { pageId: 'design/source', groupId: 'git', hasTabStrip: false },
  'pane/left/engines': { pageId: 'debug/engines', groupId: 'engines', hasTabStrip: false },
  'pane/left/plugins': { pageId: 'control/plugins', groupId: 'plugins', hasTabStrip: false },
};

/** Drives the header categories, the page bar and the left tab strip. */
export default class WorkbenchNavigation {
  private studioAgent: StudioAgent;

  constructor(studioAgent: StudioAgent) {
    this.studioAgent = studioAgent;
  }

  async activateCategory(categoryId: string): Promise<void> {
    await this.studioAgent.clickOn(`.workbench-header__category[data-category-id="${categoryId}"]`);
    await this.studioAgent.pause(500);
  }

  async activatePage(pageId: string): Promise<void> {
    const categoryId = pageId.split('/')[0];
    if ((await this.getActivePageId()) === pageId) {
      return;
    }
    await this.activateCategory(categoryId);
    if ((await this.getActivePageId()) !== pageId) {
      await this.studioAgent.clickOn(`.workbench-page-bar__page[data-page-id="${pageId}"]`);
      await this.studioAgent.pause(500);
    }
    await this.assertActivePage(pageId);
  }

  async getActivePageId(): Promise<string | null> {
    return (await this.studioAgent.getAttribute(HEADER_SELECTOR, 'data-page-id')) ?? null;
  }

  async assertActivePage(pageId: string): Promise<void> {
    await this.studioAgent.getTestDriver().client!.waitUntil(async () => (await this.getActivePageId()) === pageId, {
      timeout: ASSERT_VISIBLE_TIMEOUT,
      timeoutMsg: `Page '${pageId}' did not become active in time`,
    });
  }

  /** A category opens on the page it showed last, so callers that only care about the category assert this. */
  async assertActiveCategory(categoryId: string): Promise<void> {
    await this.studioAgent
      .getTestDriver()
      .client!.waitUntil(
        async () => (await this.studioAgent.getAttribute(HEADER_SELECTOR, 'data-category-id')) === categoryId,
        { timeout: ASSERT_VISIBLE_TIMEOUT, timeoutMsg: `Category '${categoryId}' did not become active in time` },
      );
  }

  /** Navigates to the page of the left pane and, where the page has a tab strip, selects the pane's group. */
  async showLeftPane(paneId: string): Promise<void> {
    const location = this.getLocation(paneId);
    await this.activatePage(location.pageId);
    if (location.hasTabStrip) {
      await this.studioAgent.switchToPaneGroup(location.groupId);
    }
    await this.studioAgent.pause(500);
  }

  async assertLeftPaneIsActive(paneId: string): Promise<void> {
    const location = this.getLocation(paneId);
    await this.assertActivePage(location.pageId);

    if (location.hasTabStrip) {
      const tabSelector = `[data-test--pane-group-tab="${location.groupId}"]`;
      await this.studioAgent
        .getTestDriver()
        .client!.waitUntil(
          async () => (await this.studioAgent.getAttribute(tabSelector, 'data-test--active')) === 'true',
          { timeout: ASSERT_VISIBLE_TIMEOUT, timeoutMsg: `Pane '${paneId}' did not become active in time` },
        );
    }

    await this.studioAgent.assertPaneVisible(paneId);
  }

  async assertLeftPaneIsNotActive(paneId: string): Promise<void> {
    await this.studioAgent.assertPaneNotVisible(paneId);
  }

  private getLocation(paneId: string): { pageId: string; groupId: string; hasTabStrip: boolean } {
    const location = LEFT_PANE_LOCATIONS[paneId];
    if (location == null) {
      throw new Error(`Unknown left pane '${paneId}'. Known panes: ${Object.keys(LEFT_PANE_LOCATIONS).join(', ')}`);
    }
    return location;
  }
}
