import * as fs from 'fs';
import * as assert from 'node:assert';
import * as path from 'path';
import { afterEach, beforeEach, describe, it } from 'vitest';

import type { StudioAgent } from '../../StudioAgent';
import { ASSERT_VISIBLE_TIMEOUT, createAndStartStudioAgent } from '../../StudioAgent';

const TREE_SELECTOR = '[data-test--tree="std/file-explorer/open-solution"]';
const TREE_ENTRY_SELECTOR = `${TREE_SELECTOR} .treeview__entry`;
const PROJECT_ENTRY_SELECTOR = `${TREE_SELECTOR} [data-test--tree-entry-type="project"]`;

const FIXTURES_DIR = path.join(__dirname, '..', '..', 'fixtures');
const ESSLN_TEMP_PATH = path.join(FIXTURES_DIR, 'test-solution-multi.essln');

function createEsslnFile(folders: { path: string; name?: string }[]): void {
  const content = {
    folders: folders.map((folder) => (folder.name ? { path: folder.path, name: folder.name } : { path: folder.path })),
    settings: {},
  };
  fs.writeFileSync(ESSLN_TEMP_PATH, JSON.stringify(content, null, 2) + '\n');
}

function removeEsslnFile(): void {
  if (fs.existsSync(ESSLN_TEMP_PATH)) {
    fs.unlinkSync(ESSLN_TEMP_PATH);
  }
}

describe('solutions', () => {
  let studioAgent: StudioAgent;

  afterEach(async ({ task }) => {
    studioAgent.updateTestContext({
      testName: task.name,
      testFile: __filename,
      state: task.result?.state === 'fail' ? 'failed' : 'passed',
    });
    await studioAgent?.stopAndRecordErrors();
    removeEsslnFile();
  });

  describe('single-root (backwards compatibility)', () => {
    beforeEach(async ({ task }) => {
      studioAgent = await createAndStartStudioAgent({ testName: task.name, testFile: __filename });
    });

    it('should open a directory as single-root solution', async () => {
      await studioAgent.openFixturesDirectoryAsSolution('test-solution-simple');

      const projectCount = await studioAgent.getSolutionProjectCount();
      assert.strictEqual(projectCount, 1, 'Single-root solution should have exactly one project');

      const solutionFileUri = await studioAgent.getSolutionFileUri();
      assert.strictEqual(solutionFileUri, null, 'Single-root solution should have no solutionFileUri');

      await studioAgent.assertNoErrorsPresentAndIdle();
    });

    it('should show files at depth-0 when single-root (flattened)', async () => {
      await studioAgent.openFixturesDirectoryAsSolution('test-solution-simple');

      const projectEntries = await studioAgent.getProjectEntryCount();
      assert.strictEqual(projectEntries, 0, 'Single-root should flatten away the project entry');

      const depthZeroEntries = await studioAgent.getElementCount(`${TREE_SELECTOR} .treeview__entry--depth-0`);
      assert.ok(depthZeroEntries > 0, 'Should have files at depth-0');

      await studioAgent.assertNoErrorsPresentAndIdle();
    });
  });

  describe('multi-root (.essln file)', () => {
    beforeEach(async ({ task }) => {
      createEsslnFile([
        { path: path.join(FIXTURES_DIR, 'test-solution-multi-a') },
        { path: path.join(FIXTURES_DIR, 'test-solution-multi-b') },
      ]);
      studioAgent = await createAndStartStudioAgent({ testName: task.name, testFile: __filename });
    });

    it('should open a .essln file as multi-root solution', async () => {
      await studioAgent.openSolutionFileFromFixtures('test-solution-multi.essln');

      const projectCount = await studioAgent.getSolutionProjectCount();
      assert.strictEqual(projectCount, 2, 'Multi-root solution should have two projects');

      const solutionFileUri = await studioAgent.getSolutionFileUri();
      assert.ok(solutionFileUri != null, 'Multi-root solution should have a solutionFileUri');
      assert.ok(solutionFileUri!.endsWith('.essln'), 'solutionFileUri should end with .essln');

      await studioAgent.assertNoErrorsPresentAndIdle();
    });

    it('should show project entries as top-level sections in multi-root', async () => {
      await studioAgent.openSolutionFileFromFixtures('test-solution-multi.essln');

      const projectEntries = await studioAgent.getProjectEntryCount();
      assert.strictEqual(projectEntries, 2, 'Should show two project entries');

      await studioAgent.assertNoErrorsPresentAndIdle();
    });

    it('should display files from both projects', async () => {
      await studioAgent.openSolutionFileFromFixtures('test-solution-multi.essln');

      await studioAgent.assertVisible(`.treeview__label=process_a1.bpmn`, ASSERT_VISIBLE_TIMEOUT);
      await studioAgent.assertVisible(`.treeview__label=process_a2.bpmn`, ASSERT_VISIBLE_TIMEOUT);
      await studioAgent.assertVisible(`.treeview__label=process_b1.bpmn`, ASSERT_VISIBLE_TIMEOUT);
      await studioAgent.assertVisible(`.treeview__label=process_b2.bpmn`, ASSERT_VISIBLE_TIMEOUT);

      await studioAgent.assertNoErrorsPresentAndIdle();
    });

    it('should open a file from the first project via quick jump', async () => {
      await studioAgent.openSolutionFileFromFixtures('test-solution-multi.essln');

      await studioAgent.assertVisible(`.treeview__label=process_a1.bpmn`, ASSERT_VISIBLE_TIMEOUT);
      await studioAgent.openViaQuickJump('process_a1.bpmn');
      await studioAgent.assertVisible('[data-test--editors--focused-document-type="bpmn"]', ASSERT_VISIBLE_TIMEOUT);

      await studioAgent.assertNoErrorsPresentAndIdle();
    });

    it('should open a file from the second project via quick jump', async () => {
      await studioAgent.openSolutionFileFromFixtures('test-solution-multi.essln');

      await studioAgent.assertVisible(`.treeview__label=process_b1.bpmn`, ASSERT_VISIBLE_TIMEOUT);
      await studioAgent.openViaQuickJump('process_b1.bpmn');
      await studioAgent.assertVisible('[data-test--editors--focused-document-type="bpmn"]', ASSERT_VISIBLE_TIMEOUT);

      await studioAgent.assertNoErrorsPresentAndIdle();
    });

    it('should open files from different projects in sequence', async () => {
      await studioAgent.openSolutionFileFromFixtures('test-solution-multi.essln');

      await studioAgent.openViaQuickJump('process_a1.bpmn');
      await studioAgent.assertVisible('[data-test--editors--focused-document-type="bpmn"]', ASSERT_VISIBLE_TIMEOUT);

      await studioAgent.openViaQuickJump('process_b2.bpmn');
      await studioAgent.assertVisible('[data-test--editors--focused-document-type="bpmn"]', ASSERT_VISIBLE_TIMEOUT);

      const focusedUri = await studioAgent.getFocusedDocumentUri();
      assert.ok(
        focusedUri.includes('process_b2.bpmn'),
        `Focused document should be process_b2.bpmn, got: ${focusedUri}`,
      );

      await studioAgent.assertNoErrorsPresentAndIdle();
    });

    it('should toggle hidden files across all projects', async () => {
      await studioAgent.openSolutionFileFromFixtures('test-solution-multi.essln');

      const itemCountBefore = await studioAgent.getElementCount(TREE_ENTRY_SELECTOR);

      await studioAgent.openViaCommandSearch('toggle hidden files');
      await studioAgent.waitForSolutionEntryCountChanged(itemCountBefore);

      const itemCountAfter = await studioAgent.getElementCount(TREE_ENTRY_SELECTOR);
      assert.ok(
        itemCountAfter !== itemCountBefore,
        `Entry count should change after toggling hidden files (before: ${itemCountBefore}, after: ${itemCountAfter})`,
      );

      await studioAgent.assertNoErrorsPresentAndIdle();
    });

    it('should search across multiple projects', async () => {
      await studioAgent.openSolutionFileFromFixtures('test-solution-multi.essln');

      await studioAgent.leftMenuBar.togglePane('pane/left/search');
      await studioAgent.assertPaneVisible('pane/left/search');

      await studioAgent.sendKeyboardInput([...'Start'.split(''), 'enter']);
      await studioAgent.pause(2000);

      const searchResultCount = await studioAgent.getElementCount(
        '[data-test--pane="pane/left/search"] .treeview__entry',
      );
      assert.ok(searchResultCount > 0, 'Search should find results across projects');

      await studioAgent.assertNoErrorsPresentAndIdle();
    });
  });

  describe('multi-root (.essln with custom names)', () => {
    beforeEach(async ({ task }) => {
      createEsslnFile([
        { path: path.join(FIXTURES_DIR, 'test-solution-multi-a'), name: 'Project Alpha' },
        { path: path.join(FIXTURES_DIR, 'test-solution-multi-b'), name: 'Project Beta' },
      ]);
      studioAgent = await createAndStartStudioAgent({ testName: task.name, testFile: __filename });
    });

    it('should display custom project names from the .essln file', async () => {
      await studioAgent.openSolutionFileFromFixtures('test-solution-multi.essln');

      await studioAgent.assertVisible(`.treeview__label=Project Alpha`, ASSERT_VISIBLE_TIMEOUT);
      await studioAgent.assertVisible(`.treeview__label=Project Beta`, ASSERT_VISIBLE_TIMEOUT);

      await studioAgent.assertNoErrorsPresentAndIdle();
    });
  });

  describe('multi-root (add/remove folders via API)', () => {
    beforeEach(async ({ task }) => {
      studioAgent = await createAndStartStudioAgent({ testName: task.name, testFile: __filename });
    });

    it('should add a second folder to a single-root solution', async () => {
      await studioAgent.openFixturesDirectoryAsSolution('test-solution-multi-a');

      const projectCountBefore = await studioAgent.getSolutionProjectCount();
      assert.strictEqual(projectCountBefore, 1);

      const folderBUri = studioAgent.getFixturesAbsoluteFileUri('test-solution-multi-b');
      await studioAgent.addFolderToSolutionViaApi(folderBUri);

      const projectCountAfter = await studioAgent.getSolutionProjectCount();
      assert.strictEqual(projectCountAfter, 2, 'Should have two projects after adding folder');

      await studioAgent.assertVisible(`.treeview__label=process_b1.bpmn`, ASSERT_VISIBLE_TIMEOUT);
      await studioAgent.assertVisible(`.treeview__label=process_b2.bpmn`, ASSERT_VISIBLE_TIMEOUT);

      await studioAgent.assertNoErrorsPresentAndIdle();
    });

    it('should show project entries after adding a second folder', async () => {
      await studioAgent.openFixturesDirectoryAsSolution('test-solution-multi-a');

      const folderBUri = studioAgent.getFixturesAbsoluteFileUri('test-solution-multi-b');
      await studioAgent.addFolderToSolutionViaApi(folderBUri);

      const projectEntries = await studioAgent.getProjectEntryCount();
      assert.strictEqual(projectEntries, 2, 'Should show two project entries after adding folder');

      await studioAgent.assertNoErrorsPresentAndIdle();
    });

    it('should remove a folder from a multi-root solution', async () => {
      await studioAgent.openFixturesDirectoryAsSolution('test-solution-multi-a');
      const folderBUri = studioAgent.getFixturesAbsoluteFileUri('test-solution-multi-b');
      await studioAgent.addFolderToSolutionViaApi(folderBUri);

      const projectCountBefore = await studioAgent.getSolutionProjectCount();
      assert.strictEqual(projectCountBefore, 2);

      const projectIds = await studioAgent.getSolutionProjectIds();
      await studioAgent.removeFolderFromSolutionViaApi(projectIds[1]);

      const projectCountAfter = await studioAgent.getSolutionProjectCount();
      assert.strictEqual(projectCountAfter, 1, 'Should have one project after removal');

      await studioAgent.assertNoErrorsPresentAndIdle();
    });

    it('should keep project entry visible after removing down to one project (explicit solution)', async () => {
      await studioAgent.openFixturesDirectoryAsSolution('test-solution-multi-a');
      const folderBUri = studioAgent.getFixturesAbsoluteFileUri('test-solution-multi-b');
      await studioAgent.addFolderToSolutionViaApi(folderBUri);

      const projectIds = await studioAgent.getSolutionProjectIds();
      await studioAgent.removeFolderFromSolutionViaApi(projectIds[1]);

      const isExplicit = await studioAgent.isExplicitSolution();
      assert.strictEqual(isExplicit, true, 'Solution should remain explicit after removal');

      const projectEntries = await studioAgent.getProjectEntryCount();
      assert.strictEqual(projectEntries, 1, 'Should still show one project entry (not flattened)');

      await studioAgent.assertNoErrorsPresentAndIdle();
    });

    it('should mark solution as explicit after adding a folder', async () => {
      await studioAgent.openFixturesDirectoryAsSolution('test-solution-multi-a');

      const isExplicitBefore = await studioAgent.isExplicitSolution();
      assert.strictEqual(isExplicitBefore, false, 'Single-root should not be explicit');

      const folderBUri = studioAgent.getFixturesAbsoluteFileUri('test-solution-multi-b');
      await studioAgent.addFolderToSolutionViaApi(folderBUri);

      const isExplicitAfter = await studioAgent.isExplicitSolution();
      assert.strictEqual(isExplicitAfter, true, 'Should be explicit after adding a folder');

      await studioAgent.assertNoErrorsPresentAndIdle();
    });

    it('should reject adding a duplicate folder', async () => {
      await studioAgent.openFixturesDirectoryAsSolution('test-solution-multi-a');

      const existingProjectUri = await studioAgent.getProjectBaseUri(0);
      assert.ok(existingProjectUri != null, 'Should have a project base URI');

      await studioAgent.addFolderToSolutionViaApi(existingProjectUri!);

      const projectCount = await studioAgent.getSolutionProjectCount();
      assert.strictEqual(projectCount, 1, 'Should still have one project');

      await studioAgent.assertVisible('[data--test--unexpected-notifications]', ASSERT_VISIBLE_TIMEOUT);
    });

    it('should reject removing the last folder', async () => {
      await studioAgent.openFixturesDirectoryAsSolution('test-solution-multi-a');

      const projectIds = await studioAgent.getSolutionProjectIds();

      await studioAgent.removeFolderFromSolutionViaApi(projectIds[0]);

      const projectCount = await studioAgent.getSolutionProjectCount();
      assert.strictEqual(projectCount, 1, 'Should still have one project');

      await studioAgent.assertVisible('[data--test--unexpected-notifications]', ASSERT_VISIBLE_TIMEOUT);
    });
  });

  describe('multi-root (context menu)', () => {
    beforeEach(async ({ task }) => {
      createEsslnFile([
        { path: path.join(FIXTURES_DIR, 'test-solution-multi-a') },
        { path: path.join(FIXTURES_DIR, 'test-solution-multi-b') },
      ]);
      studioAgent = await createAndStartStudioAgent({ testName: task.name, testFile: __filename });
    });

    it('should show context menu on project root in multi-root', async () => {
      await studioAgent.openSolutionFileFromFixtures('test-solution-multi.essln');

      const projectEntries = await studioAgent.getProjectEntryCount();
      assert.strictEqual(projectEntries, 2);

      await studioAgent.rightClickOn(`${PROJECT_ENTRY_SELECTOR}`);
      await studioAgent.assertContextMenuVisible(ASSERT_VISIBLE_TIMEOUT);

      await studioAgent.assertNoErrorsPresent();
    });
  });

  describe('rename project label', () => {
    beforeEach(async ({ task }) => {
      createEsslnFile([
        { path: path.join(FIXTURES_DIR, 'test-solution-multi-a'), name: 'Original Name' },
        { path: path.join(FIXTURES_DIR, 'test-solution-multi-b') },
      ]);
      studioAgent = await createAndStartStudioAgent({ testName: task.name, testFile: __filename });
    });

    it('should rename a project label via API', async () => {
      await studioAgent.openSolutionFileFromFixtures('test-solution-multi.essln');

      await studioAgent.assertVisible(`.treeview__label=Original Name`, ASSERT_VISIBLE_TIMEOUT);

      const folderAUri = studioAgent.getFixturesAbsoluteFileUri('test-solution-multi-a');
      await studioAgent.renameSolutionProjectViaApi(folderAUri, 'Renamed Project');

      await studioAgent.assertVisible(`.treeview__label=Renamed Project`, ASSERT_VISIBLE_TIMEOUT);

      await studioAgent.assertNoErrorsPresentAndIdle();
    });
  });

  describe('close solution', () => {
    beforeEach(async ({ task }) => {
      studioAgent = await createAndStartStudioAgent({ testName: task.name, testFile: __filename });
    });

    it('should clear the file explorer when closing a solution', async () => {
      await studioAgent.openFixturesDirectoryAsSolution('test-solution-simple');

      const treeEntries = await studioAgent.getElementCount(TREE_ENTRY_SELECTOR);
      assert.ok(treeEntries > 0, 'Should have entries before closing');

      await studioAgent.closeSolutionViaApi();

      const treeEntriesAfter = await studioAgent.getElementCount(TREE_ENTRY_SELECTOR);
      assert.strictEqual(treeEntriesAfter, 0, 'File explorer should be empty after closing solution');

      const hasSolution = await studioAgent.hasOpenSolution();
      assert.strictEqual(hasSolution, false, 'Should have no open solution');

      await studioAgent.assertNoErrorsPresent();
    });

    it('should clear the file explorer when closing a multi-root solution', async () => {
      createEsslnFile([
        { path: path.join(FIXTURES_DIR, 'test-solution-multi-a') },
        { path: path.join(FIXTURES_DIR, 'test-solution-multi-b') },
      ]);

      await studioAgent.openSolutionFileFromFixtures('test-solution-multi.essln');

      const projectCount = await studioAgent.getSolutionProjectCount();
      assert.strictEqual(projectCount, 2);

      await studioAgent.closeSolutionViaApi();

      const treeEntriesAfter = await studioAgent.getElementCount(TREE_ENTRY_SELECTOR);
      assert.strictEqual(treeEntriesAfter, 0, 'File explorer should be empty after closing');

      await studioAgent.assertNoErrorsPresent();
    });
  });

  describe('dirty tracking', () => {
    beforeEach(async ({ task }) => {
      studioAgent = await createAndStartStudioAgent({ testName: task.name, testFile: __filename });
    });

    it('should not be dirty for a fresh single-root solution', async () => {
      await studioAgent.openFixturesDirectoryAsSolution('test-solution-simple');

      const isDirty = await studioAgent.isSolutionDirty();
      assert.strictEqual(isDirty, false, 'Fresh single-root should not be dirty');

      await studioAgent.assertNoErrorsPresentAndIdle();
    });

    it('should be dirty after adding a folder (no .essln file)', async () => {
      await studioAgent.openFixturesDirectoryAsSolution('test-solution-multi-a');

      const folderBUri = studioAgent.getFixturesAbsoluteFileUri('test-solution-multi-b');
      await studioAgent.addFolderToSolutionViaApi(folderBUri);

      const isDirty = await studioAgent.isSolutionDirty();
      assert.strictEqual(isDirty, true, 'Should be dirty after adding a folder without .essln');

      await studioAgent.assertNoErrorsPresentAndIdle();
    });

    it('should not be dirty for a freshly opened .essln solution', async () => {
      createEsslnFile([
        { path: path.join(FIXTURES_DIR, 'test-solution-multi-a') },
        { path: path.join(FIXTURES_DIR, 'test-solution-multi-b') },
      ]);

      await studioAgent.openSolutionFileFromFixtures('test-solution-multi.essln');

      const isDirty = await studioAgent.isSolutionDirty();
      assert.strictEqual(isDirty, false, 'Freshly opened .essln should not be dirty');

      await studioAgent.assertNoErrorsPresentAndIdle();
    });
  });

  describe('save solution', () => {
    beforeEach(async ({ task }) => {
      studioAgent = await createAndStartStudioAgent({ testName: task.name, testFile: __filename });
    });

    it('should not enable saveSolution for a single-root solution', async () => {
      await studioAgent.openFixturesDirectoryAsSolution('test-solution-simple');

      const isEnabled = await studioAgent.isCommandEnabled('std.solution.saveSolution');
      assert.strictEqual(isEnabled, false, 'saveSolution should be disabled for single-root');

      await studioAgent.assertNoErrorsPresentAndIdle();
    });

    it('should enable saveSolution for an explicit solution', async () => {
      await studioAgent.openFixturesDirectoryAsSolution('test-solution-multi-a');

      const folderBUri = studioAgent.getFixturesAbsoluteFileUri('test-solution-multi-b');
      await studioAgent.addFolderToSolutionViaApi(folderBUri);

      const isEnabled = await studioAgent.isCommandEnabled('std.solution.saveSolution');
      assert.strictEqual(isEnabled, true, 'saveSolution should be enabled for explicit solution');

      await studioAgent.assertNoErrorsPresentAndIdle();
    });

    it('should persist changes when saving an existing .essln solution', async () => {
      createEsslnFile([
        { path: path.join(FIXTURES_DIR, 'test-solution-multi-a'), name: 'Before Rename' },
        { path: path.join(FIXTURES_DIR, 'test-solution-multi-b') },
      ]);

      await studioAgent.openSolutionFileFromFixtures('test-solution-multi.essln');

      const folderAUri = studioAgent.getFixturesAbsoluteFileUri('test-solution-multi-a');
      await studioAgent.renameSolutionProjectViaApi(folderAUri, 'After Rename');

      const contentAfterRename = JSON.parse(fs.readFileSync(ESSLN_TEMP_PATH, 'utf-8'));
      assert.strictEqual(
        contentAfterRename.folders[0].name,
        'After Rename',
        'Rename should auto-save to the .essln file',
      );

      await studioAgent.assertNoErrorsPresentAndIdle();
    });
  });

  describe('multi-root (.essln file persistence)', () => {
    beforeEach(async ({ task }) => {
      createEsslnFile([
        { path: path.join(FIXTURES_DIR, 'test-solution-multi-a') },
        { path: path.join(FIXTURES_DIR, 'test-solution-multi-b') },
      ]);
      studioAgent = await createAndStartStudioAgent({ testName: task.name, testFile: __filename });
    });

    it('should verify .essln file exists and is valid JSON', async () => {
      assert.ok(fs.existsSync(ESSLN_TEMP_PATH), '.essln file should exist');

      const content = JSON.parse(fs.readFileSync(ESSLN_TEMP_PATH, 'utf-8'));
      assert.ok(Array.isArray(content.folders), 'folders should be an array');
      assert.strictEqual(content.folders.length, 2, 'Should have two folders');
      assert.ok(content.folders[0].path, 'Each folder should have a path');
      assert.ok(content.folders[1].path, 'Each folder should have a path');
    });

    it('should open the .essln file and verify project structure matches', async () => {
      await studioAgent.openSolutionFileFromFixtures('test-solution-multi.essln');

      const content = JSON.parse(fs.readFileSync(ESSLN_TEMP_PATH, 'utf-8'));
      const projectCount = await studioAgent.getSolutionProjectCount();

      assert.strictEqual(projectCount, content.folders.length, 'Project count should match folder count in .essln');

      await studioAgent.assertNoErrorsPresentAndIdle();
    });
  });
});
