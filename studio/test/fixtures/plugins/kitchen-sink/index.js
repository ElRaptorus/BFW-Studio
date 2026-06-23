/**
 * Kitchen Sink — exercises every Plugin API feature.
 *
 * This is the canonical fixture plugin for verifying the Studio's plugin
 * runtime. It covers every available API namespace so integration tests
 * can exercise the full surface area.
 *
 * Registered commands (all namespaced under `plugin.kitchen-sink.*`):
 *
 *   ─── Lifecycle & Introspection ─────────────────────────────────
 *   getStatus          → returns the full internal state snapshot
 *   getEnv             → returns the plugin environment (paths, API version)
 *   getLifecycle       → returns the ordered list of lifecycle events
 *
 *   ─── Notifications API ─────────────────────────────────────────
 *   showInfo           → opens an info notification, returns the notification id
 *   showWarning        → opens a warning notification, returns the notification id
 *   showError          → opens an error notification, returns the notification id
 *   updateNotification → updates the last opened notification with new content
 *   closeNotification  → closes the last opened notification
 *   showNotificationWithActions → opens notification with Accept/Decline actions
 *   showStickyNotification     → opens a sticky warning notification
 *   getLastNotificationResponse → returns the last notification action response
 *
 *   ─── Dialogs API ──────────────────────────────────────────────
 *   showDialog         → opens a custom dialog with text input + checkbox
 *   showPrompt         → opens a simple text prompt dialog
 *   showDialogNonBlocking → opens dialog without awaiting (for cleanup tests)
 *
 *   ─── Settings API ─────────────────────────────────────────────
 *   readSetting        → reads `plugin.kitchen-sink.kitchenSinkValue` from settings
 *   writeSetting       → writes a value to `plugin.kitchen-sink.kitchenSinkValue`
 *   hasSetting         → checks if `plugin.kitchen-sink.kitchenSinkValue` is registered
 *   getSettingSchema   → returns the schema descriptor for `plugin.kitchen-sink.kitchenSinkValue`
 *   getAllSchemas      → returns all registered setting schemas
 *   getSettingDefault  → returns the default value for `plugin.kitchen-sink.kitchenSinkValue`
 *   getAllDefaults     → returns all registered default values
 *   addToArraySetting  → pushes a value onto `plugin.kitchen-sink.testArray`
 *   removeFromArray    → removes a value from `plugin.kitchen-sink.testArray`
 *   readArraySetting   → reads `plugin.kitchen-sink.testArray`
 *
 *   ─── Commands API ─────────────────────────────────────────────
 *   executeExternal    → calls an arbitrary Bifrost command by name
 *   tryExecute         → tryToExecuteCommand wrapper, returns {success, returnValue/error}
 *   checkEnabled       → isCommandEnabled for a given command name
 *   checkRegistered    → isRegistered for a given command name
 *   listCommands       → getCommands(), returns all registered {name, description, visibleInSearch}
 *   searchableCommand  → a command registered with visibleInSearch: true (visible in palette)
 *
 *   ─── Status Bar API ────────────────────────────────────────────
 *   (auto-registered)  → registers a "Kitchen Sink: Ready" button on activate
 *   updateStatusBarItem→ replaces the status bar item label
 *   unregisterStatusBarItem → removes the status bar item
 *   showProgress       → shows a progress indicator, stores the handle
 *   updateProgress     → updates the active progress label
 *   doneProgress       → completes the active progress indicator
 *   isStatusBarVisible → returns whether the status bar is visible
 *
 *   ─── MenuBar API ───────────────────────────────────────────────
 *   (auto-registered)  → registers a quick action button in the right area
 *   (auto-registered)  → registers a pane toggle modifier after plugins toggle
 *   isMenuBarVisible   → returns whether the menu bar is visible
 *
 *   ─── Editors API — Dirty State & Save ────────────────────────
 *   setDirty           → marks a document dirty or clean via api.editors.setDirty
 *   registerSave       → registers an onSaveRequest handler for a URI
 *   unregisterSave     → disposes the onSaveRequest handler
 *   getSaveCount       → returns the number of times the save delegate was invoked
 *
 *   ─── Diagnostics API ──────────────────────────────────────────
 *   setDiagnostics     → sets test diagnostics on a URI
 *   clearDiagnostics   → clears all diagnostics for this plugin
 *   getDiagnostics     → returns diagnostics, optionally for a URI
 *   getDiagnosticCount → returns aggregate {errors, warnings, infos}
 *   getDiagnosticsChangeCount → returns how often onDidChange fired
 *
 *   ─── Workspace API ─────────────────────────────────────────────
 *   readProjectFile     → reads a text file from a project folder
 *   writeStorageFile    → writes a text file to the plugin's storage dir
 *   readStorageFile     → reads a text file from the plugin's storage dir
 *   listProjectDir      → lists entries in a project folder
 *   statFile            → returns stat info for a URI
 *   createStorageDir    → creates a subdirectory in plugin storage
 *   deleteStorageFile   → deletes a file from plugin storage
 *   getProjectFolders   → returns the current solution's project folders
 *   readOutOfScope      → attempts to read a file outside allowed scope (should fail)
 *   watchStorageDir     → starts watching the plugin storage directory
 *   getWatcherEvents    → returns file change events captured by the watcher
 *   disposeWatcher      → stops the active file watcher
 *   getSolutionChangeCount → returns how often onDidChangeSolution fired
 *
 *   ─── Pane Visibility API ────────────────────────────────────
 *   setPaneVisible     → calls api.panes.setVisible(paneId, visible)
 *
 *   ─── Events API — editorFocusChanged ──────────────────────
 *   (auto-subscribed)  → subscribes to editorFocusChanged, stores events
 *   getEditorFocusEvents → returns captured editor focus events
 *   clearEditorFocusEvents → clears the captured events
 *
 *   ─── Tree View API ────────────────────────────────────────────
 *   registerTreeView   → registers a test tree view in the left area
 *   updateTreeData     → pushes sample tree data to the registered view
 *   clearTreeData      → pushes an empty array to clear tree data
 *   getTreeViewRegistered → returns whether the tree view was registered
 *
 *   ─── Themes API ───────────────────────────────────────────────
 *   registerTheme      → registers a test dark theme with custom tokens
 *   unregisterTheme    → unregisters the previously registered theme
 *   getActiveTheme     → returns the currently active theme ID
 *   getThemeRegistered → returns whether a theme was registered
 *
 *   ─── Menus API ────────────────────────────────────────────────
 *   (auto-registered)  → adds a "Kitchen Sink View Entry" to View submenu
 */

const lifecycle = [];
let lastNotificationId = null;
let settingsObservedValue = null;
let deactivated = false;
let activeProgressHandle = null;
let saveDisposer = null;
let saveCount = 0;
let diagnosticsChangeCount = 0;
let lastNotificationResponse = null;
let fileWatcherDisposer = null;
let fileWatcherEvents = [];
let solutionChangeCount = 0;
let editorFocusEvents = [];
let treeViewRegistered = false;
let themeRegistered = false;

exports.activate = async (api) => {
  lifecycle.push('activate:start');

  // ─── Lifecycle & Introspection ────────────────────────────────

  await api.commands.register(
    'getStatus',
    () => ({
      lifecycle: [...lifecycle],
      deactivated,
      lastNotificationId,
      settingsObservedValue,
      env: { ...api.env },
    }),
    { visibleInSearch: true, description: 'Kitchen Sink: Get Status' },
  );

  await api.commands.register('getEnv', () => ({ ...api.env }), {
    visibleInSearch: true,
    description: 'Kitchen Sink: Get Environment',
  });

  await api.commands.register('getLifecycle', () => [...lifecycle], {
    visibleInSearch: true,
    description: 'Kitchen Sink: Get Lifecycle',
  });

  // ─── Notifications API ────────────────────────────────────────

  await api.commands.register(
    'showInfo',
    async (message) => {
      lastNotificationId = await api.notifications.open({
        type: 'info',
        content: message ?? 'Kitchen Sink info',
      });
      return lastNotificationId;
    },
    { visibleInSearch: true, description: 'Kitchen Sink: Show Info' },
  );

  await api.commands.register(
    'showWarning',
    async (message) => {
      lastNotificationId = await api.notifications.open({
        type: 'warning',
        content: message ?? 'Kitchen Sink warning',
      });
      return lastNotificationId;
    },
    { visibleInSearch: true, description: 'Kitchen Sink: Show Warning' },
  );

  await api.commands.register(
    'showError',
    async (message) => {
      lastNotificationId = await api.notifications.open({
        type: 'error',
        content: message ?? 'Kitchen Sink error',
      });
      return lastNotificationId;
    },
    { visibleInSearch: true, description: 'Kitchen Sink: Show Error' },
  );

  await api.commands.register(
    'updateNotification',
    async (content) => {
      if (lastNotificationId == null) return null;
      await api.notifications.update(lastNotificationId, { content: content ?? 'Updated!' });
      return lastNotificationId;
    },
    { visibleInSearch: true, description: 'Kitchen Sink: Update Notification' },
  );

  await api.commands.register(
    'closeNotification',
    async () => {
      if (lastNotificationId == null) return false;
      await api.notifications.close(lastNotificationId);
      lastNotificationId = null;
      return true;
    },
    { visibleInSearch: true, description: 'Kitchen Sink: Close current Notification' },
  );

  // ─── Notifications API — Actions + Sticky ───────────────────

  await api.commands.register('showNotificationWithActions', async () => {
    const notificationId = await api.notifications.open({
      type: 'info',
      content: 'Choose an action',
      actions: [
        { action: 'accept', label: 'Accept', default: true },
        { action: 'decline', label: 'Decline' },
      ],
    });

    await api.notifications.onResponse(notificationId, (response) => {
      lastNotificationResponse = response;
    });

    return notificationId;
  });

  await api.commands.register('showStickyNotification', async () => {
    return api.notifications.open({
      type: 'warning',
      content: 'This is a sticky notification',
      sticky: true,
    });
  });

  await api.commands.register('getLastNotificationResponse', async () => {
    return lastNotificationResponse;
  });

  // ─── Dialogs API ──────────────────────────────────────────

  await api.commands.register('showDialog', async () => {
    const result = await api.dialogs.open({
      title: 'Kitchen Sink Dialog',
      content: [
        { type: 'text_input', id: 'name', label: 'Name', value: 'Test', focus: true },
        { type: 'checkbox', id: 'agree', label: 'I agree', checked: false },
      ],
      actions: [
        { label: 'Cancel', response: 'cancel', cancel: true },
        { label: 'Submit', response: 'submit', default: true },
      ],
    });
    return result;
  });

  await api.commands.register('showPrompt', async () => {
    return api.dialogs.prompt('Enter a value', 'Type here...');
  });

  await api.commands.register('showDialogNonBlocking', () => {
    api.dialogs.open({
      title: 'Non-Blocking Dialog',
      content: [{ type: 'text', text: 'This dialog is opened without awaiting its result.' }],
      actions: [{ label: 'Close', response: 'close', cancel: true }],
    });
  });

  // ─── Settings API — Registration ─────────────────────────────

  await api.settings.register({
    'plugin.kitchen-sink.kitchenSinkValue': {
      type: 'string',
      label: 'Kitchen Sink Value',
      description: 'A test setting exercised by the kitchen-sink fixture plugin.',
      category: 'Kitchen Sink',
      default: '',
    },
    'plugin.kitchen-sink.kitchenSinkArray': {
      type: 'array',
      label: 'Kitchen Sink Array',
      description: 'An array setting for testing add/removeValue.',
      category: 'Kitchen Sink',
      default: [],
    },
  });

  // ─── Settings API — Read / Write ─────────────────────────────

  await api.commands.register(
    'readSetting',
    async () => {
      return api.settings.get('plugin.kitchen-sink.kitchenSinkValue');
    },
    { visibleInSearch: true, description: 'Kitchen Sink: Read Setting' },
  );

  await api.commands.register('writeSetting', async (value) => {
    await api.settings.set('plugin.kitchen-sink.kitchenSinkValue', value ?? 'written-by-plugin');
  });

  await api.settings.onDidChange('plugin.kitchen-sink.kitchenSinkValue', (newValue) => {
    settingsObservedValue = newValue;
  });

  // ─── Settings API — Introspection ────────────────────────────

  await api.commands.register('hasSetting', async (key) => {
    return api.settings.has(key ?? 'plugin.kitchen-sink.kitchenSinkValue');
  });

  await api.commands.register(
    'getSettingSchema',
    async (key) => {
      return api.settings.getSchema(key ?? 'plugin.kitchen-sink.kitchenSinkValue');
    },
    { visibleInSearch: true, description: 'Kitchen Sink: Get Setting Schema' },
  );

  await api.commands.register(
    'getAllSchemas',
    async () => {
      return api.settings.getSchemas();
    },
    { visibleInSearch: true, description: 'Kitchen Sink: Get All Setting Schemas' },
  );

  await api.commands.register(
    'getSettingDefault',
    async (key) => {
      return api.settings.getDefault(key ?? 'plugin.kitchen-sink.kitchenSinkValue');
    },
    { visibleInSearch: true, description: 'Kitchen Sink: Get Setting Default' },
  );

  await api.commands.register(
    'getAllDefaults',
    async () => {
      return api.settings.getDefaults();
    },
    { visibleInSearch: true, description: 'Kitchen Sink: Get All Setting Defaults' },
  );

  // ─── Settings API — Array mutations ──────────────────────────

  await api.commands.register('addToArraySetting', async (value) => {
    await api.settings.add('plugin.kitchen-sink.kitchenSinkArray', value ?? 'item');
  });

  await api.commands.register('removeFromArray', async (value) => {
    await api.settings.removeValue('plugin.kitchen-sink.kitchenSinkArray', value ?? 'item');
  });

  await api.commands.register(
    'readArraySetting',
    async () => {
      return api.settings.get('plugin.kitchen-sink.kitchenSinkArray');
    },
    { visibleInSearch: true, description: 'Kitchen Sink: Read Array Setting' },
  );

  await api.commands.register('tryAddOutsideNamespace', async (key, value) => {
    try {
      await api.settings.add(key ?? 'other.key', value ?? 'val');
      return 'ok';
    } catch (err) {
      return err.message;
    }
  });

  await api.commands.register('tryRemoveOutsideNamespace', async (key, value) => {
    try {
      await api.settings.removeValue(key ?? 'other.key', value ?? 'val');
      return 'ok';
    } catch (err) {
      return err.message;
    }
  });

  // ─── Commands API — Execution ────────────────────────────────

  await api.commands.register('executeExternal', async (commandName, ...args) => {
    return api.commands.executeCommand(commandName, args);
  });

  await api.commands.register('tryExecute', async (commandName, ...args) => {
    return api.commands.tryToExecuteCommand(commandName, args);
  });

  // ─── Commands API — Introspection ────────────────────────────

  await api.commands.register('checkEnabled', async (commandName, ...args) => {
    return api.commands.isCommandEnabled(commandName, args);
  });

  await api.commands.register('checkRegistered', async (commandName) => {
    return api.commands.isRegistered(commandName);
  });

  await api.commands.register('listCommands', async () => {
    return api.commands.getCommands();
  });

  // ─── Commands API — register (visibleInSearch) ────────────────

  await api.commands.register(
    'searchableCommand',
    async () => {
      await api.notifications.open({
        type: 'info',
        content: 'I am the very model of a modern major gineral.',
      });
      return 'I am the very model of a modern major gineral.';
    },
    { visibleInSearch: true, description: 'Kitchen Sink: Searchable Test Command' },
  );

  // ─── Status Bar API ─────────────────────────────────────────

  await api.statusBar.registerStatusBarItem('left', 'kitchen-sink.status', [
    {
      type: 'button',
      id: 'kitchen-sink.status',
      content: { type: 'text', label: 'Kitchen Sink: Ready' },
      tooltip: 'Kitchen Sink status indicator',
      command: 'plugin.kitchen-sink.getStatus',
    },
  ]);

  await api.commands.register('updateStatusBarItem', async (label) => {
    await api.statusBar.updateStatusBarItem('kitchen-sink.status', [
      {
        type: 'button',
        id: 'kitchen-sink.status',
        content: { type: 'text', label: label ?? 'Kitchen Sink: Updated' },
        tooltip: 'Kitchen Sink status indicator',
        command: 'plugin.kitchen-sink.getStatus',
      },
    ]);
  });

  await api.commands.register('unregisterStatusBarItem', async () => {
    await api.statusBar.unregisterStatusBarItem('kitchen-sink.status');
  });

  await api.commands.register('showProgress', async (label) => {
    activeProgressHandle = await api.statusBar.showProgress(label ?? 'Kitchen Sink progress...');
    return true;
  });

  await api.commands.register('updateProgress', async (label) => {
    if (activeProgressHandle == null) return false;
    activeProgressHandle.update(label ?? 'Kitchen Sink progress updated');
    return true;
  });

  await api.commands.register('doneProgress', async () => {
    if (activeProgressHandle == null) return false;
    activeProgressHandle.done();
    activeProgressHandle = null;
    return true;
  });

  await api.commands.register('isStatusBarVisible', async () => {
    return api.statusBar.isVisible();
  });

  // ─── MenuBar API ────────────────────────────────────────────

  await api.menuBar.registerMenuBarItem('right', [
    {
      type: 'button',
      id: 'kitchen-sink.quickAction',
      icon: 'ph-lightning',
      tooltip: 'Kitchen Sink Quick Action',
      command: 'plugin.kitchen-sink.getStatus',
    },
  ]);

  await api.menuBar.registerMenuBarItemModifier({
    insertAfter: 'pane/left/plugins',
    items: [
      {
        type: 'pane_content_toggle',
        id: 'kitchen-sink.sidebarToggle',
        icon: 'ph-flask',
        tooltip: 'Kitchen Sink Sidebar',
        paneAreaId: 'left',
        paneId: 'kitchen-sink.sidebar',
      },
    ],
  });

  await api.commands.register('isMenuBarVisible', async () => {
    return api.menuBar.isVisible();
  });

  // ─── Editors API — Dirty State & Save ──────────────────────

  await api.commands.register('setDirty', async (uri, isDirty) => {
    await api.editors.setDirty(uri, isDirty);
  });

  await api.commands.register('registerSave', async (uri) => {
    saveCount = 0;
    const disposer = await api.editors.onSaveRequest(uri, async () => {
      saveCount++;
    });
    saveDisposer = disposer;
  });

  await api.commands.register('unregisterSave', async () => {
    if (saveDisposer != null) {
      saveDisposer.dispose();
      saveDisposer = null;
    }
  });

  await api.commands.register('getSaveCount', async () => {
    return saveCount;
  });

  // ─── Diagnostics API ────────────────────────────────────────

  await api.commands.register('setDiagnostics', async (uri, diagnostics) => {
    await api.diagnostics.set(
      uri ?? 'file:///test/kitchen-sink.bpmn',
      diagnostics ?? [
        { severity: 'error', message: 'Test error from kitchen-sink' },
        { severity: 'warning', message: 'Test warning from kitchen-sink' },
      ],
    );
  });

  await api.commands.register('clearDiagnostics', async () => {
    await api.diagnostics.clear();
  });

  await api.commands.register('getDiagnostics', async (uri) => {
    return api.diagnostics.get(uri);
  });

  await api.commands.register('getDiagnosticCount', async () => {
    return api.diagnostics.getCount();
  });

  await api.commands.register('getDiagnosticsChangeCount', async () => {
    return diagnosticsChangeCount;
  });

  await api.diagnostics.onDidChange(() => {
    diagnosticsChangeCount++;
  });

  // ─── Workspace API ─────────────────────────────────────────

  await api.commands.register('readProjectFile', async (uri) => {
    return api.workspace.readFile(uri);
  });

  await api.commands.register('writeStorageFile', async (filename, content) => {
    const storageUri = `file://${api.env.storagePath}/${filename ?? 'test.txt'}`;
    await api.workspace.writeFile(storageUri, content ?? 'hello from kitchen-sink');
    return storageUri;
  });

  await api.commands.register('readStorageFile', async (filename) => {
    const storageUri = `file://${api.env.storagePath}/${filename ?? 'test.txt'}`;
    return api.workspace.readFile(storageUri);
  });

  await api.commands.register('writeBinaryStorageFile', async (filename, base64Content) => {
    const storageUri = `file://${api.env.storagePath}/${filename ?? 'binary-test.bin'}`;
    await api.workspace.writeBinaryFile(storageUri, base64Content ?? 'AQID');
    return storageUri;
  });

  await api.commands.register('readBinaryStorageFile', async (filename) => {
    const storageUri = `file://${api.env.storagePath}/${filename ?? 'binary-test.bin'}`;
    return api.workspace.readBinaryFile(storageUri);
  });

  await api.commands.register('listProjectDir', async (uri) => {
    return api.workspace.listDirectory(uri);
  });

  await api.commands.register('statFile', async (uri) => {
    return api.workspace.stat(uri);
  });

  await api.commands.register('createStorageDir', async (dirname) => {
    const dirUri = `file://${api.env.storagePath}/${dirname ?? 'subdir'}`;
    await api.workspace.createDirectory(dirUri);
    return dirUri;
  });

  await api.commands.register('deleteStorageFile', async (filename) => {
    const storageUri = `file://${api.env.storagePath}/${filename ?? 'test.txt'}`;
    await api.workspace.deleteFile(storageUri);
  });

  await api.commands.register('getProjectFolders', async () => {
    return api.workspace.getProjectFolders();
  });

  await api.commands.register('readOutOfScope', async () => {
    try {
      await api.workspace.readFile('file:///etc/passwd');
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  await api.commands.register('watchStorageDir', async () => {
    fileWatcherEvents = [];
    const storageUri = `file://${api.env.storagePath}`;
    const disposer = await api.workspace.onDidChangeFile(storageUri, (event) => {
      fileWatcherEvents.push(event);
    });
    fileWatcherDisposer = disposer;
    return true;
  });

  await api.commands.register('getWatcherEvents', async () => {
    return [...fileWatcherEvents];
  });

  await api.commands.register('disposeWatcher', async () => {
    if (fileWatcherDisposer != null) {
      fileWatcherDisposer.dispose();
      fileWatcherDisposer = null;
    }
  });

  await api.workspace.onDidChangeSolution(() => {
    solutionChangeCount++;
  });

  await api.commands.register('getSolutionChangeCount', async () => {
    return solutionChangeCount;
  });

  // ─── Pane Visibility API ───────────────────────────────────

  await api.commands.register('setPaneVisible', async (paneId, visible) => {
    await api.panes.setVisible(paneId ?? 'ks-testpane', visible ?? true);
  });

  // ─── Events API — editorFocusChanged ─────────────────────

  await api.events.on('editorFocusChanged', (event) => {
    editorFocusEvents.push(event);
  });

  await api.commands.register('getEditorFocusEvents', async () => {
    return [...editorFocusEvents];
  });

  await api.commands.register('clearEditorFocusEvents', async () => {
    editorFocusEvents = [];
  });

  // ─── Tree View API ──────────────────────────────────────────

  await api.commands.register('registerTreeView', async () => {
    if (!treeViewRegistered) {
      await api.views.registerTreeView({
        id: 'ks-tree',
        title: 'Kitchen Sink Tree',
        area: 'left',
        icon: 'ph-tree-structure',
      });
      treeViewRegistered = true;
    }
    return { registered: true };
  });

  await api.commands.register('updateTreeData', async () => {
    await api.views.updateTreeData('ks-tree', [
      {
        id: 'root-dir',
        type: 'directory',
        label: 'src',
        icon: 'ph-folder',
        expanded: true,
        children: [
          {
            id: 'file-1',
            type: 'file',
            label: 'index.ts',
            icon: 'ph-file-ts',
            command: 'getStatus',
            metadata: { path: 'src/index.ts' },
            badges: [{ type: 'character', character: 'M' }],
          },
          {
            id: 'file-2',
            type: 'file',
            label: 'utils.ts',
            icon: 'ph-file-ts',
            metadata: { path: 'src/utils.ts' },
          },
        ],
      },
      {
        id: 'section-1',
        type: 'section',
        label: 'Dependencies',
      },
    ]);
    return { updated: true };
  });

  await api.commands.register('clearTreeData', async () => {
    await api.views.updateTreeData('ks-tree', []);
    return { cleared: true };
  });

  await api.commands.register('getTreeViewRegistered', async () => {
    return treeViewRegistered;
  });

  // ─── Themes API ────────────────────────────────────────────

  await api.commands.register('registerTheme', async () => {
    await api.themes.register({
      id: 'ks-test-dark',
      label: 'Kitchen Sink Test Dark',
      type: 'dark',
      tokens: {
        'theme-bg': '#1a1a2e',
        'theme-fg': '#e0e0e0',
        'theme-accent': '#e94560',
      },
    });
    themeRegistered = true;
    return { registered: true };
  });

  await api.commands.register('unregisterTheme', async () => {
    await api.themes.unregister('ks-test-dark');
    themeRegistered = false;
    return { unregistered: true };
  });

  await api.commands.register('getActiveTheme', async () => {
    return api.themes.getActiveTheme();
  });

  await api.commands.register('getThemeRegistered', async () => {
    return themeRegistered;
  });

  // ─── Menus API ─────────────────────────────────────────────

  await api.menus.registerMenuModifier('std/application/main', {
    items: [
      {
        type: 'command',
        id: 'plugin.kitchen-sink.viewEntry',
        label: 'Kitchen Sink View Entry',
        command: 'plugin.kitchen-sink.getStatus',
      },
    ],
    position: {
      type: 'appendToSubmenu',
      submenuId: 'view',
    },
  });

  lifecycle.push('activate:end');
};

exports.deactivate = async () => {
  lifecycle.push('deactivate');
  deactivated = true;
};
