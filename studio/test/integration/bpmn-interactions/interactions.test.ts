import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { StudioAgent } from '../../StudioAgent';
import { ASSERT_VISIBLE_TIMEOUT, createAndStartStudioAgent } from '../../StudioAgent';
import type { InteractionsWorkspace } from './interactionsWorkspace';
import { createInteractionsWorkspace } from './interactionsWorkspace';

const TIMEOUT = ASSERT_VISIBLE_TIMEOUT;
const INTERACTIONS_PAGE = 'discover/interactions';
const PROCESSES_PANE = 'discover/interactions/processes';
const CANVAS = '[data-test--interactions-canvas]';

const FIXTURE_PROCESS_IDS = ['order-process', 'payment-process', 'shipping-process'] as const;

type SolutionScanCatalogEntry = {
  kind: string;
  uri: string;
  processes?: { id: string }[];
};

type SolutionScanSnapshot = {
  catalog: SolutionScanCatalogEntry[];
};

/** The scan of the current solution; entries of a previous test's workspace (same process ids) are left out. */
async function readWorkspaceCatalog(studioAgent: StudioAgent, workspace: string): Promise<SolutionScanSnapshot> {
  const snapshot = (await studioAgent.executeInRenderer(
    `return bifrost.getSharedRessource('bpmn-landscape/solution-scan').getSnapshot();`,
  )) as SolutionScanSnapshot | null;
  return { catalog: (snapshot?.catalog ?? []).filter((entry) => entry.uri.includes(workspace)) };
}

async function readSolutionScanSnapshot(studioAgent: StudioAgent, workspace: string): Promise<SolutionScanSnapshot> {
  await studioAgent.waitUntil(
    async () => {
      const foundProcessIds = new Set<string>();
      for (const entry of (await readWorkspaceCatalog(studioAgent, workspace)).catalog) {
        for (const process of entry.kind === 'bpmn' ? (entry.processes ?? []) : []) {
          foundProcessIds.add(process.id);
        }
      }
      return FIXTURE_PROCESS_IDS.every((processId) => foundProcessIds.has(processId));
    },
    {
      timeout: TIMEOUT,
      timeoutMsg: 'The solution scan catalog did not list all three fixture processes of this workspace',
    },
  );
  return readWorkspaceCatalog(studioAgent, workspace);
}

function processReferencesFromCatalog(
  snapshot: SolutionScanSnapshot,
  processIds: readonly string[],
): { uri: string; processId: string }[] {
  const references: { uri: string; processId: string }[] = [];
  for (const processId of processIds) {
    let matched = false;
    for (const entry of snapshot.catalog) {
      if (entry.kind !== 'bpmn') {
        continue;
      }
      const process = entry.processes?.find((candidate) => candidate.id === processId);
      if (process != null) {
        references.push({ uri: entry.uri, processId: process.id });
        matched = true;
        break;
      }
    }
    expect(matched, `catalog has no process ${processId}`).toBe(true);
  }
  return references;
}

function processesPaneLabel(label: string): string {
  return `//*[@data-test--tree="bpmn-interactions/processes"]//span[contains(@class, "treeview__label") and normalize-space(.)="${label}"]`;
}

async function fixtureProcessReferences(
  studioAgent: StudioAgent,
  workspace: string,
  processIds: readonly string[] = FIXTURE_PROCESS_IDS,
): Promise<{ uri: string; processId: string }[]> {
  const snapshot = await readSolutionScanSnapshot(studioAgent, workspace);
  return processReferencesFromCatalog(snapshot, processIds);
}

async function isMasterCheckboxEnabled(studioAgent: StudioAgent): Promise<boolean> {
  return (await studioAgent.executeInRenderer(
    `const checkbox = document.querySelector('[data-test--interactions-select-all-processes]');
     return checkbox instanceof HTMLInputElement && !checkbox.disabled;`,
  )) as boolean;
}

async function isInteractionsToolbarToggleActive(
  studioAgent: StudioAgent,
  dataTestAttribute: string,
): Promise<boolean> {
  return (await studioAgent.executeInRenderer(
    `return document.querySelector('[data-test--${dataTestAttribute}]')?.classList.contains('editor-toolbar__button--active') === true`,
  )) as boolean;
}

/** Reads the title bar, because the graph summary counts the generated diagram once one exists, not the selection. */
async function waitForSelectionCount(studioAgent: StudioAgent, expectedCount: number): Promise<void> {
  await studioAgent.waitUntil(
    async () =>
      (await studioAgent.executeInRenderer(
        `return document.querySelector('[data-test--interactions-selection-count]')?.textContent ?? ''`,
      )) === `${expectedCount} ${expectedCount === 1 ? 'process' : 'processes'}`,
    {
      timeout: TIMEOUT,
      timeoutMsg: 'The selection did not reach the Interactions view',
    },
  );
}

async function waitForGeneratedPorts(studioAgent: StudioAgent): Promise<void> {
  await studioAgent.waitUntil(
    async () => {
      const summary = await studioAgent.interactionsGetGraphSummary();
      return (summary?.portCount ?? 0) > 0;
    },
    {
      timeout: TIMEOUT,
      timeoutMsg: 'Generate drew no ports',
    },
  );
}

async function interactionsSelectProcessesAndWait(
  studioAgent: StudioAgent,
  references: { uri: string; processId: string }[],
): Promise<void> {
  await studioAgent.interactionsSelectProcesses(references);
  await waitForSelectionCount(studioAgent, references.length);
}

async function interactionsGenerateAndWait(studioAgent: StudioAgent): Promise<void> {
  await studioAgent.interactionsGenerate();
  await waitForGeneratedPorts(studioAgent);
}

function isPng(content: Buffer): boolean {
  return (
    content.length >= 8 && content.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  );
}

describe('bpmn-interactions', () => {
  let studioAgent: StudioAgent;
  const createdWorkspaces: string[] = [];

  const createWorkspace = (prefix: string): InteractionsWorkspace => {
    const interactionsWorkspace = createInteractionsWorkspace(prefix);
    createdWorkspaces.push(interactionsWorkspace.workspace);
    return interactionsWorkspace;
  };

  beforeAll(async () => {
    studioAgent = await createAndStartStudioAgent({ testName: 'setup', testFile: __filename });
    await studioAgent.executeInRenderer(
      'window.__interactionsOriginalDialogs = { showSaveFile: bifrost.dialog.showSaveFile };',
    );
    // The User layer is the fallback for every solution, so a value left there would change what each test starts with.
    await studioAgent.executeInRenderer(`
      return Promise.all(
        ['bpmn.interactions.layout', 'bpmn.interactions.hideProcessesWithoutInteraction']
          .map((key) => bifrost.settings.removeFromScope({ scope: 'user' }, key)),
      );
    `);
  });

  beforeEach(async ({ task }) => {
    studioAgent.updateTestContext({ testName: task.name, testFile: __filename });
    expect(await studioAgent.getFocusedDocumentUri(), 'the previous test left a document open').toBe('');
  });

  afterEach(async ({ task }) => {
    studioAgent.updateTestContext({
      testName: task.name,
      testFile: __filename,
      state: task.result?.state === 'fail' ? 'failed' : 'passed',
    });
    await studioAgent.recordErrors();
    await studioAgent.closeActiveDialog();
    await studioAgent.closeAllNotifications();
    await studioAgent.executeInRenderer('Object.assign(bifrost.dialog, window.__interactionsOriginalDialogs);');
    await studioAgent.executeCommand('std.workbench.activatePage', ['design/workspace']);
    await studioAgent.closeOpenEditors('bpmn');
    await studioAgent.closeSolutionViaApi();
    for (const workspace of createdWorkspaces.splice(0)) {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  afterAll(async () => {
    await studioAgent?.stop();
  });

  const openInteractions = async (interactionsWorkspace: InteractionsWorkspace): Promise<void> => {
    await studioAgent.openSolutionFile(interactionsWorkspace.solutionFile);
    await studioAgent.navigation.activatePage(INTERACTIONS_PAGE);
    await studioAgent.navigation.showLeftPane(PROCESSES_PANE);
    await readSolutionScanSnapshot(studioAgent, interactionsWorkspace.workspace);
    await studioAgent.waitUntil(async () => isMasterCheckboxEnabled(studioAgent), {
      timeout: TIMEOUT,
      timeoutMsg: 'The Interactions Processes pane did not become ready',
    });
    await waitForSelectionCount(studioAgent, 0);
  };

  describe('help', () => {
    it('opens the help text to the side', async () => {
      const interactionsWorkspace = createWorkspace('bfw-interactions-help-');
      await openInteractions(interactionsWorkspace);
      await studioAgent.clickOn('[data-test--interactions-help]');
      await studioAgent.assertVisible('.help-page', TIMEOUT);

      const helpText = String(await studioAgent.getText('.help-page'));
      expect(helpText).toContain('Direct versus Stations layout');

      await studioAgent.assertNoErrorsPresentAndIdle();
    });
  });

  describe('generation', () => {
    let interactionsWorkspace: InteractionsWorkspace;

    const prepare = async (): Promise<void> => {
      interactionsWorkspace = createWorkspace('bfw-interactions-generate-');
      await openInteractions(interactionsWorkspace);
    };

    it('selects processes, generates, and reports graph counts in direct layout', async () => {
      await prepare();
      await interactionsSelectProcessesAndWait(
        studioAgent,
        await fixtureProcessReferences(studioAgent, interactionsWorkspace.workspace),
      );
      await interactionsGenerateAndWait(studioAgent);
      await studioAgent.assertVisible(CANVAS, TIMEOUT);
      const summary = await studioAgent.interactionsGetGraphSummary();
      expect(summary).toEqual({
        processCount: 3,
        portCount: 7,
        lineCount: 3,
        stationCount: 0,
        portsWithPartnersOutsideView: 0,
        portsWithoutPartnerInSolution: 0,
      });
      await studioAgent.assertNoErrorsPresentAndIdle();
    });

    it('switches to station layout and counts stations and lines', async () => {
      await prepare();
      await interactionsSelectProcessesAndWait(
        studioAgent,
        await fixtureProcessReferences(studioAgent, interactionsWorkspace.workspace),
      );
      await interactionsGenerateAndWait(studioAgent);
      await studioAgent.assertVisible(CANVAS, TIMEOUT);
      await studioAgent.executeCommand('bpmn.interactions.setLayout', ['stations']);
      await studioAgent.waitUntil(async () => (await studioAgent.interactionsGetGraphSummary())?.stationCount === 3, {
        timeout: TIMEOUT,
        timeoutMsg: 'Station layout did not produce three stations',
      });
      const summary = await studioAgent.interactionsGetGraphSummary();
      expect(summary?.lineCount).toBe(6);
      expect(summary?.stationCount).toBe(3);
      await studioAgent.assertNoErrorsPresentAndIdle();
    });
  });

  describe('stale marker', () => {
    let interactionsWorkspace: InteractionsWorkspace;

    const prepare = async (): Promise<void> => {
      interactionsWorkspace = createWorkspace('bfw-interactions-stale-');
      await openInteractions(interactionsWorkspace);
      await interactionsSelectProcessesAndWait(
        studioAgent,
        await fixtureProcessReferences(studioAgent, interactionsWorkspace.workspace),
      );
      await interactionsGenerateAndWait(studioAgent);
      await studioAgent.assertVisible(CANVAS, TIMEOUT);
    };

    it('shows the out-of-date marker after the process selection changes', async () => {
      await prepare();
      expect(await studioAgent.interactionsIsStale()).toBe(false);

      await interactionsSelectProcessesAndWait(
        studioAgent,
        await fixtureProcessReferences(studioAgent, interactionsWorkspace.workspace, [
          'order-process',
          'payment-process',
        ]),
      );

      await studioAgent.waitUntil(async () => studioAgent.interactionsIsStale(), {
        timeout: TIMEOUT,
        timeoutMsg: 'The diagram did not become stale after the selection changed',
      });
      await studioAgent.assertVisible('[data-test--interactions-stale]', TIMEOUT);
      await studioAgent.assertNoErrorsPresentAndIdle();
    });

    it('shows the out-of-date marker after a BPMN file changes on disk', async () => {
      await prepare();
      expect(await studioAgent.interactionsIsStale()).toBe(false);

      const shippingPath = path.join(interactionsWorkspace.workspace, 'shipping-process.bpmn');
      const original = fs.readFileSync(shippingPath, 'utf8');
      fs.writeFileSync(shippingPath, original.replace('name="Ship order"', 'name="Ship the order"'));

      await studioAgent.waitUntil(async () => studioAgent.interactionsIsStale(), {
        timeout: TIMEOUT,
        timeoutMsg: 'The diagram did not become stale after a BPMN file changed',
      });
      await studioAgent.assertVisible('[data-test--interactions-stale]', TIMEOUT);

      await interactionsGenerateAndWait(studioAgent);
      await studioAgent.waitUntil(async () => !(await studioAgent.interactionsIsStale()), {
        timeout: TIMEOUT,
        timeoutMsg: 'Regenerating did not clear the out-of-date marker',
      });
      await studioAgent.assertNoErrorsPresentAndIdle();
    });
  });

  describe('toolbar settings', () => {
    let interactionsWorkspace: InteractionsWorkspace;

    const prepare = async (): Promise<void> => {
      interactionsWorkspace = createWorkspace('bfw-interactions-settings-');
      await openInteractions(interactionsWorkspace);
    };

    const readSolutionSettings = (): Record<string, unknown> => {
      const parsed = JSON.parse(fs.readFileSync(interactionsWorkspace.solutionFile, 'utf8')) as {
        settings?: Record<string, unknown>;
      };
      return parsed.settings ?? {};
    };

    it('persists layout and hide toggles in the solution file across reload', async () => {
      await prepare();
      await studioAgent.clickOn('[data-test--interactions-layout-stations]');
      await studioAgent.clickOn('[data-test--interactions-hide-without-interaction]');

      await studioAgent.waitUntil(() => readSolutionSettings()['bpmn.interactions.layout'] === 'stations', {
        timeout: TIMEOUT,
        timeoutMsg: 'Layout was not written into the solution file',
      });
      const settings = readSolutionSettings();
      expect(settings['bpmn.interactions.hideProcessesWithoutInteraction']).toBe(true);

      await studioAgent.closeSolutionViaApi();
      await studioAgent.openSolutionFile(interactionsWorkspace.solutionFile);
      await studioAgent.navigation.activatePage(INTERACTIONS_PAGE);

      await studioAgent.waitUntil(
        async () => await isInteractionsToolbarToggleActive(studioAgent, 'interactions-layout-stations'),
        { timeout: TIMEOUT, timeoutMsg: 'The Stations layout was not restored after reopening the solution' },
      );
      expect(await isInteractionsToolbarToggleActive(studioAgent, 'interactions-layout-direct')).toBe(false);
      expect(await isInteractionsToolbarToggleActive(studioAgent, 'interactions-hide-without-interaction')).toBe(true);

      await studioAgent.assertNoErrorsPresentAndIdle();
    });
  });

  describe('selection helpers', () => {
    let interactionsWorkspace: InteractionsWorkspace;

    const prepare = async (): Promise<void> => {
      interactionsWorkspace = createWorkspace('bfw-interactions-selection-');
      await openInteractions(interactionsWorkspace);
    };

    it('adds the entire solution to the selection without generating', async () => {
      await prepare();
      await studioAgent.clickOn('[data-test--interactions-select-all-processes]');
      await waitForSelectionCount(studioAgent, 3);
      expect(
        await studioAgent.interactionsGetGraphSummary(),
        'Add entire solution selects without generating',
      ).toMatchObject({ processCount: 3, portCount: 0 });
      expect(await studioAgent.executeInRenderer(`return document.querySelector('${CANVAS}') == null`)).toBe(true);
      await studioAgent.clickOn('[data-test--interactions-generate]');
      await waitForGeneratedPorts(studioAgent);
      await studioAgent.assertVisible(CANVAS, TIMEOUT);
      const summary = await studioAgent.interactionsGetGraphSummary();
      expect(summary?.processCount).toBe(3);
      await studioAgent.assertNoErrorsPresentAndIdle();
    });

    it('clears the selection with the master checkbox', async () => {
      await prepare();
      await studioAgent.clickOn('[data-test--interactions-select-all-processes]');
      await waitForSelectionCount(studioAgent, 3);
      await studioAgent.clickOn('[data-test--interactions-select-all-processes]');
      await waitForSelectionCount(studioAgent, 0);
      await studioAgent.assertVisible('[data-test--interactions-empty]', TIMEOUT);
      await studioAgent.assertNoErrorsPresentAndIdle();
    });

    it('generates every process after the master checkbox selects all', async () => {
      await prepare();
      await studioAgent.clickOn('[data-test--interactions-select-all-processes]');
      await waitForSelectionCount(studioAgent, 3);
      await interactionsGenerateAndWait(studioAgent);
      await studioAgent.assertVisible(CANVAS, TIMEOUT);
      const summary = await studioAgent.interactionsGetGraphSummary();
      expect(summary?.processCount).toBe(3);
      expect(summary?.lineCount).toBe(3);
      await studioAgent.assertNoErrorsPresentAndIdle();
    });

    it('selects a single process from its row checkbox', async () => {
      await prepare();
      // File rows start collapsed, so the process row only exists after expanding its file.
      await studioAgent.clickOn(processesPaneLabel('payment-process.bpmn'));
      await studioAgent.assertVisible(processesPaneLabel('Payment Process'), TIMEOUT);
      const paymentProcessCheckbox = `${processesPaneLabel('Payment Process')}/ancestor::div[contains(@class, "treeview__entry")][1]//input[@data-test--tree-entry-checkbox]`;
      await studioAgent.clickOn(paymentProcessCheckbox);
      await waitForSelectionCount(studioAgent, 1);
      // Ticking a process must not collapse its file.
      await studioAgent.assertVisible(processesPaneLabel('Payment Process'), TIMEOUT);
      await studioAgent.assertNoErrorsPresentAndIdle();
    });
  });

  describe('stubs and navigation', () => {
    let interactionsWorkspace: InteractionsWorkspace;

    const prepare = async (): Promise<void> => {
      interactionsWorkspace = createWorkspace('bfw-interactions-stub-');
      await openInteractions(interactionsWorkspace);
    };

    it('adds partner processes when a stub is clicked', async () => {
      await prepare();
      await interactionsSelectProcessesAndWait(
        studioAgent,
        await fixtureProcessReferences(studioAgent, interactionsWorkspace.workspace, ['order-process']),
      );
      await interactionsGenerateAndWait(studioAgent);
      await studioAgent.assertVisible('[data-test--interactions-stub]', TIMEOUT);
      await studioAgent.clickOn('[data-test--interactions-stub]');
      await studioAgent.waitUntil(async () => (await studioAgent.interactionsGetGraphSummary())?.processCount === 2, {
        timeout: TIMEOUT,
        timeoutMsg: 'Stub click did not add partners and regenerate',
      });
      await studioAgent.assertNoErrorsPresentAndIdle();
    });

    it('opens the payment process in the Designer from a pane double-click', async () => {
      await prepare();
      await studioAgent.navigation.showLeftPane(PROCESSES_PANE);
      await studioAgent.clickOn(processesPaneLabel('payment-process.bpmn'));
      await studioAgent.assertVisible(processesPaneLabel('Payment Process'), TIMEOUT);
      await studioAgent.doubleClickOn(processesPaneLabel('Payment Process'));
      await studioAgent.assertVisible('[data-test--editors--focused-document-type="bpmn"]', TIMEOUT);
      const focusedUri = await studioAgent.getFocusedDocumentUri();
      expect(focusedUri).toContain('payment-process.bpmn');
      await studioAgent.assertNoErrorsPresentAndIdle();
    });
  });

  describe('export', () => {
    let interactionsWorkspace: InteractionsWorkspace;
    let exportPath: string;

    const prepare = async (): Promise<void> => {
      interactionsWorkspace = createWorkspace('bfw-interactions-export-');
      exportPath = path.join(interactionsWorkspace.workspace, 'Interactions-interactions.png');
      await openInteractions(interactionsWorkspace);
      await interactionsSelectProcessesAndWait(
        studioAgent,
        await fixtureProcessReferences(studioAgent, interactionsWorkspace.workspace),
      );
      await interactionsGenerateAndWait(studioAgent);
      await studioAgent.assertVisible(CANVAS, TIMEOUT);
      await studioAgent.executeInRenderer('bifrost.dialog.showSaveFile = async (options) => options.defaultPath;');
    };

    it('writes a PNG image to the default path next to the solution file', async () => {
      await prepare();
      fs.rmSync(exportPath, { force: true });
      await studioAgent.clickOn('[data-test--interactions-export]');
      await studioAgent.waitUntil(async () => fs.existsSync(exportPath) && isPng(fs.readFileSync(exportPath)), {
        timeout: TIMEOUT,
        timeoutMsg: `${exportPath} was not written as a PNG`,
      });
      await studioAgent.assertNoErrorsPresentAndIdle();
    });
  });
});
