import type { StudioAgent } from '../StudioAgent';
import { ASSERT_VISIBLE_TIMEOUT } from '../StudioAgent';

export default class LeftMenuBar {
  private studioAgent: StudioAgent;

  constructor(studioAgent: StudioAgent) {
    this.studioAgent = studioAgent;
  }

  async togglePane(paneId: string): Promise<void> {
    const itemSelector = `[data-menu-bar-item-id="${paneId}"]`;

    await this.studioAgent.clickOn(itemSelector);
    await this.studioAgent.pause(1500);
  }

  async assertPaneIsActive(paneId: string): Promise<void> {
    const itemSelector = `[data-menu-bar-item-id="${paneId}"]`;

    await this.studioAgent.getTestDriver().client!.waitUntil(
      async () => {
        const active = await this.studioAgent.getAttribute(itemSelector, 'data-test--active');
        return active === 'true';
      },
      { timeout: ASSERT_VISIBLE_TIMEOUT, timeoutMsg: `Pane '${paneId}' did not become active in time` },
    );

    await this.studioAgent.assertPaneVisible(paneId);
  }

  async assertPaneIsNotActive(paneId: string): Promise<void> {
    const itemSelector = `[data-menu-bar-item-id="${paneId}"]`;

    await this.studioAgent.getTestDriver().client!.waitUntil(
      async () => {
        const active = await this.studioAgent.getAttribute(itemSelector, 'data-test--active');
        return active !== 'true';
      },
      { timeout: ASSERT_VISIBLE_TIMEOUT, timeoutMsg: `Pane '${paneId}' should NOT be active` },
    );

    await this.studioAgent.assertPaneNotVisible(paneId);
  }
}
