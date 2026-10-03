import { EditorMediator } from '#bifrost/browser/EditorMediator';
import { AbstractEmitter } from '#bifrost/common/AbstractEmitter';
import { CategoryManager } from '#bifrost/common/CategoryManager';
import assert from 'node:assert';
import { beforeEach, describe, it, vi } from 'vitest';

class FakeStorage {
  value: any = null;
  load() {
    return this.value;
  }
  save(value: any) {
    this.value = JSON.parse(JSON.stringify(value));
  }
  clear() {
    this.value = null;
  }
}

function createFixture(storage = new FakeStorage()) {
  vi.stubGlobal('window', { addEventListener: () => undefined });
  const categories = new CategoryManager();
  categories.registerCategory({ id: 'design', label: 'Design', icon: 'x', placement: 'main', order: 1 });
  categories.registerCategory({ id: 'debug', label: 'Debug', icon: 'x', placement: 'main', order: 2 });
  categories.registerPage({ id: 'design/workspace', categoryId: 'design', label: 'Workspace', icon: 'x', order: 1 });
  categories.registerPage({ id: 'design/source', categoryId: 'design', label: 'Source', icon: 'x', order: 2 });
  categories.registerPage({ id: 'debug/engines', categoryId: 'debug', label: 'Engines', icon: 'x', order: 1 });
  categories.activatePage('design/workspace');

  const notifications: any[] = [];
  const events = new AbstractEmitter();
  const bifrost: any = {
    categories,
    events,
    notifications: { open: (notification: any) => notifications.push(notification) },
    settings: { get: () => false, resourceMoved: () => undefined },
    recentlyOpened: { addRecentlyOpenedEditorDocumentItem: () => undefined },
    recentlyClosed: { addItem: () => undefined },
    files: new AbstractEmitter(),
  };
  const mediator = new EditorMediator(storage as any, bifrost);
  const register = (id: string, pattern: RegExp, page: string) =>
    mediator.registerDocumentType(id, {
      uriMatch: pattern,
      page,
      icon: 'x',
      rendererKey: `${id}-renderer`,
      rendererConstructor: class {},
      modelKey: null,
    } as any);
  return { mediator, categories, notifications, storage, register };
}

describe('EditorMediator pages', () => {
  let fixture: ReturnType<typeof createFixture>;

  beforeEach(() => {
    fixture = createFixture();
    fixture.register('workspace-type', /\.wsp$/, 'design/workspace');
    fixture.register('source-type', /\.src$/, 'design/source');
    fixture.register('active-type', /\.act$/, 'active');
    fixture.register('lost-type', /\.lost$/, 'nowhere/page');
  });

  it('R1: opens a document on the page of its type and activates that page', () => {
    fixture.mediator.focusOrOpenEditorDocument('file:///a.src');
    assert.strictEqual(fixture.categories.getActivePageId(), 'design/source');
    assert.deepStrictEqual(
      fixture.mediator.getOpenEditorDocumentsOfPage('design/source').map((document) => document.uri),
      ['file:///a.src'],
    );
    assert.deepStrictEqual(fixture.mediator.getOpenEditorDocumentsOfPage('design/workspace'), []);
  });

  it('R1: refocusing an open document activates its page again', () => {
    fixture.mediator.focusOrOpenEditorDocument('file:///a.src');
    fixture.mediator.focusOrOpenEditorDocument('file:///b.wsp');
    assert.strictEqual(fixture.categories.getActivePageId(), 'design/workspace');
    fixture.mediator.focusOrOpenEditorDocument('file:///a.src');
    assert.strictEqual(fixture.categories.getActivePageId(), 'design/source');
  });

  it("R1: 'active' opens on the current page", () => {
    fixture.categories.activatePage('debug/engines');
    fixture.mediator.focusOrOpenEditorDocument('file:///c.act');
    assert.strictEqual(fixture.mediator.getOpenEditorDocumentsOfPage('debug/engines').length, 1);
  });

  it('R1: refuses an unregistered page with an error notification', () => {
    assert.throws(() => fixture.mediator.focusOrOpenEditorDocument('file:///d.lost'));
    assert.strictEqual(fixture.notifications.length, 1);
    assert.strictEqual(fixture.notifications[0].type, 'error');
    assert.strictEqual(fixture.mediator.getOpenEditorDocuments().length, 0);
  });

  it('R3/R4: focus follows the active page, enumeration spans all pages', () => {
    fixture.mediator.focusOrOpenEditorDocument('file:///a.src');
    fixture.mediator.focusOrOpenEditorDocument('file:///b.wsp');
    assert.strictEqual(fixture.mediator.getFocusedEditorDocument()?.uri, 'file:///b.wsp');
    fixture.categories.activatePage('design/source');
    assert.strictEqual(fixture.mediator.getFocusedEditorDocument()?.uri, 'file:///a.src');
    assert.strictEqual(fixture.mediator.getOpenEditorDocuments().length, 2);
  });

  it('R2: lookups by URI find documents on any page', () => {
    fixture.mediator.focusOrOpenEditorDocument('file:///a.src');
    fixture.categories.activatePage('design/workspace');
    assert.strictEqual(fixture.mediator.getEditorDocumentByUri('file:///a.src')?.uri, 'file:///a.src');
  });

  it('R5: page-local editors and the page of a document', () => {
    fixture.mediator.focusOrOpenEditorDocument('file:///a.src');
    fixture.mediator.focusOrOpenEditorDocument('file:///b.wsp');
    fixture.mediator.focusOrOpenEditorDocument('file:///c.wsp');

    const workspaceUris = fixture.mediator
      .getOpenEditorsOfPage('design/workspace')
      .flatMap((editor) => editor.editorDocuments.map((document) => document.uri));
    assert.deepStrictEqual(workspaceUris, ['file:///b.wsp', 'file:///c.wsp']);
    assert.deepStrictEqual(fixture.mediator.getOpenEditorsOfPage('debug/engines'), []);

    const sourceDocument = fixture.mediator.getEditorDocumentByUri('file:///a.src');
    assert.ok(sourceDocument);
    assert.strictEqual(fixture.mediator.getPageIdOfEditorDocument(sourceDocument), 'design/source');
    assert.strictEqual(
      fixture.mediator.getPageIdOfEditorDocument({ uri: 'file:///not-open.src' } as any),
      'design/workspace',
    );
  });

  it('closing the last document of the active page stays on that page', async () => {
    fixture.mediator.focusOrOpenEditorDocument('file:///b.wsp');
    fixture.mediator.focusOrOpenEditorDocument('file:///a.src');
    fixture.categories.activatePage('design/workspace');

    const workspaceDocument = fixture.mediator.getEditorDocumentByUri('file:///b.wsp');
    assert.ok(workspaceDocument);
    await fixture.mediator.closeEditorDocumentsUntilUserCancels([workspaceDocument]);

    assert.strictEqual(fixture.categories.getActivePageId(), 'design/workspace');
    assert.deepStrictEqual(fixture.mediator.getOpenEditorDocumentsOfPage('design/workspace'), []);
    assert.strictEqual(fixture.mediator.getOpenEditorDocumentsOfPage('design/source').length, 1);
  });

  it('closing the focused document of a background page leaves the active page and its focus alone', async () => {
    fixture.mediator.focusOrOpenEditorDocument('file:///b.wsp');
    fixture.mediator.focusOrOpenEditorDocument('file:///a.src');
    fixture.mediator.focusOrOpenEditorDocument('file:///c.src');
    fixture.categories.activatePage('design/workspace');

    const backgroundDocument = fixture.mediator.getEditorDocumentByUri('file:///c.src');
    assert.ok(backgroundDocument);
    await fixture.mediator.closeEditorDocument(backgroundDocument);

    assert.strictEqual(fixture.categories.getActivePageId(), 'design/workspace');
    assert.strictEqual(fixture.mediator.getFocusedEditorDocument()?.uri, 'file:///b.wsp');
    assert.deepStrictEqual(
      fixture.mediator.getOpenEditorDocumentsOfPage('design/source').map((document) => document.uri),
      ['file:///a.src'],
    );
  });

  it('focusing a document for a save prompt activates its page', async () => {
    fixture.mediator.focusOrOpenEditorDocument('file:///a.src');
    fixture.categories.activatePage('design/workspace');

    const sourceDocument = fixture.mediator.getEditorDocumentByUri('file:///a.src');
    assert.ok(sourceDocument);
    await fixture.mediator.focusEditorDocumentAndWaitForVisible(sourceDocument);

    assert.strictEqual(fixture.categories.getActivePageId(), 'design/source');
    assert.strictEqual(fixture.mediator.getFocusedEditorDocument()?.uri, 'file:///a.src');
  });

  it('persists format v2 and restores it; ignores state without a version', () => {
    fixture.mediator.focusOrOpenEditorDocument('file:///a.src');
    assert.strictEqual(fixture.storage.value.version, 2);

    const restored = createFixture(fixture.storage);
    restored.mediator.restoreFromLastSession();
    assert.strictEqual(restored.mediator.getOpenEditorDocumentsOfPage('design/source').length, 1);

    const legacy = new FakeStorage();
    legacy.value = { layout: { type: 'row', columns: [] } };
    const ignored = createFixture(legacy);
    ignored.mediator.restoreFromLastSession();
    assert.strictEqual(ignored.mediator.getOpenEditorDocuments().length, 0);
  });
});

describe('EditorMediator page settings', () => {
  function createFixtureWithHome(storage = new FakeStorage()) {
    const fixture = createFixture(storage);
    fixture.categories.registerCategory({ id: 'home', label: 'Home', icon: 'x', placement: 'start', order: 0 });
    fixture.categories.registerPage({
      id: 'home/welcome',
      categoryId: 'home',
      label: 'Welcome',
      icon: 'x',
      order: 0,
      defaultDocumentUri: 'about:start',
      editorTabsVisible: false,
    });
    fixture.register('workspace-type', /\.wsp$/, 'design/workspace');
    fixture.register('start-type', /^about:start$/, 'home/welcome');
    return fixture;
  }

  it('opens the default document when a page without documents is activated', () => {
    const fixture = createFixtureWithHome();
    fixture.categories.activatePage('home/welcome');
    assert.deepStrictEqual(
      fixture.mediator.getOpenEditorDocumentsOfPage('home/welcome').map((document) => document.uri),
      ['about:start'],
    );
    // Re-activating does not open a second copy.
    fixture.categories.activatePage('design/workspace');
    fixture.categories.activatePage('home/welcome');
    assert.strictEqual(fixture.mediator.getOpenEditorDocumentsOfPage('home/welcome').length, 1);
  });

  it('does not open the default document when another document opens on that page', () => {
    const fixture = createFixtureWithHome();
    fixture.register('start-other', /^about:start-other$/, 'home/welcome');
    fixture.mediator.focusOrOpenEditorDocument('about:start-other');
    assert.deepStrictEqual(
      fixture.mediator.getOpenEditorDocumentsOfPage('home/welcome').map((document) => document.uri),
      ['about:start-other'],
    );
  });

  it('closing the default document of a page reopens it instead of leaving the page', async () => {
    const fixture = createFixtureWithHome();
    fixture.mediator.focusOrOpenEditorDocument('file:///b.wsp');
    fixture.categories.activatePage('home/welcome');

    const startDocument = fixture.mediator.getEditorDocumentByUri('about:start');
    assert.ok(startDocument);
    await fixture.mediator.closeEditorDocument(startDocument);

    assert.strictEqual(fixture.categories.getActivePageId(), 'home/welcome');
    assert.deepStrictEqual(
      fixture.mediator.getOpenEditorDocumentsOfPage('home/welcome').map((document) => document.uri),
      ['about:start'],
    );
  });

  it('hides editor tabs on pages that disable them', () => {
    const fixture = createFixtureWithHome();
    assert.strictEqual(fixture.mediator.getViewData().editorTabsVisible, true);
    fixture.categories.activatePage('home/welcome');
    assert.strictEqual(fixture.mediator.getViewData().editorTabsVisible, false);
  });

  it('shows the tabs of such a page while it holds a second document, and hides them again at one', () => {
    const fixture = createFixtureWithHome();
    fixture.register('start-other', /^about:start-other$/, 'home/welcome');
    fixture.categories.activatePage('home/welcome');
    fixture.mediator.focusOrOpenEditorDocument('about:start-other');
    assert.strictEqual(fixture.mediator.getOpenEditorDocumentsOfPage('home/welcome').length, 2);
    assert.strictEqual(fixture.mediator.getViewData().editorTabsVisible, true);

    const otherDocument = fixture.mediator.getEditorDocumentByUri('about:start-other');
    assert.ok(otherDocument);
    fixture.mediator.closeEditorDocument(otherDocument);
    assert.strictEqual(fixture.mediator.getViewData().editorTabsVisible, false);
  });

  it('moves documents of a page that no longer exists to the page of their type', () => {
    const original = createFixtureWithHome();
    original.mediator.focusOrOpenEditorDocument('file:///kept.wsp');
    const stored = JSON.parse(JSON.stringify(original.storage.value));
    stored.pages['gone/page'] = stored.pages['design/workspace'];
    delete stored.pages['design/workspace'];
    const storage = new FakeStorage();
    storage.value = stored;

    const restored = createFixtureWithHome(storage);
    restored.mediator.restoreFromLastSession();
    assert.deepStrictEqual(
      restored.mediator.getOpenEditorDocumentsOfPage('design/workspace').map((document) => document.uri),
      ['file:///kept.wsp'],
    );
  });

  it('keeps relocated documents and their unsaved content when the target page is stored after them', () => {
    const storedPageWith = (uri: string) => {
      const original = createFixtureWithHome();
      original.mediator.focusOrOpenEditorDocument(uri);
      return JSON.parse(JSON.stringify(original.storage.value.pages['design/workspace']));
    };
    const orphanPage = storedPageWith('file:///moved.wsp');
    const setUnsavedContent = (node: any): void => {
      if (node?.uri === 'file:///moved.wsp') {
        node.data.current = 'unsaved content';
      } else if (node != null && typeof node === 'object') {
        Object.values(node).forEach(setUnsavedContent);
      }
    };
    setUnsavedContent(orphanPage);
    const storage = new FakeStorage();
    storage.value = {
      version: 2,
      pages: { 'gone/page': orphanPage, 'design/workspace': storedPageWith('file:///kept.wsp') },
    };

    const restored = createFixtureWithHome(storage);
    restored.mediator.restoreFromLastSession();
    assert.deepStrictEqual(
      restored.mediator
        .getOpenEditorDocumentsOfPage('design/workspace')
        .map((document) => document.uri)
        .sort(),
      ['file:///kept.wsp', 'file:///moved.wsp'],
    );
    assert.strictEqual(restored.mediator.getEditorDocumentByUri('file:///moved.wsp')?.data.current, 'unsaved content');
  });
});

describe('EditorMediator removed pages', () => {
  it('moves the documents of a page removed at runtime to the page of their type and keeps unsaved content', () => {
    const fixture = createFixture();
    fixture.categories.registerPage({
      id: 'design/plugin',
      categoryId: 'design',
      label: 'Plugin',
      icon: 'x',
      order: 9,
    });
    fixture.register('workspace-type', /\.wsp$/, 'design/workspace');
    fixture.register('plugin-type', /\.plg$/, 'design/plugin');
    fixture.mediator.focusOrOpenEditorDocument('file:///a.plg');
    fixture.mediator.getEditorDocumentByUri('file:///a.plg')!.data.current = 'unsaved';
    fixture.categories.activatePage('design/plugin');

    fixture.categories.unregisterPage('design/plugin');

    assert.deepStrictEqual(fixture.mediator.getOpenEditorDocumentsOfPage('design/plugin'), []);
    assert.deepStrictEqual(
      fixture.mediator
        .getOpenEditorDocumentsOfPage('design/workspace')
        .map((document) => document.uri)
        .sort(),
      ['file:///a.plg'],
    );
    assert.strictEqual(fixture.mediator.getEditorDocumentByUri('file:///a.plg')?.data.current, 'unsaved');
  });
});
