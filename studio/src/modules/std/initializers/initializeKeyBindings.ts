import type { Bifrost } from '#bifrost/Bifrost';

export function initializeKeyBindings(bifrost: Bifrost): void {
  bifrost.keybindings.registerKeyBindings({
    client: '*',
    os: 'macos',
    bindings: {
      body: {
        'cmd-1': 'std.editor.zoomToActualSize',
        'cmd-2': 'std.editor.zoomToViewport',
        'cmd-3': 'std.editor.zoomToSelectedElement',
        'cmd-alt-p': 'std.workbench.focusPerformanceInspector',
        'cmd-shift-b': 'std.workbench.toggleFocusMode',
        'cmd-shift-e': 'std.workbench.focusExplorer',
        'cmd-shift-f': 'std.workbench.focusSearch',
        'cmd-shift-j': 'std.workbench.showSymbolsForWorkspace',
        'cmd-shift-p': 'std.quickJump.showCommands',
        'cmd-b': 'std.workbench.togglePanels',
        'cmd-f': 'std.editor.showAndFocusInlineSearch',
        'cmd-j': 'std.quickJump.show',
        'cmd-n': 'bpmn.editor.newBpmnDocument',
        'cmd-o': 'std.editor.openDocument',
        'cmd-s': 'std.editor.saveFocusedDocument',
        'cmd-w': 'std.editor.closeFocusedDocumentOrWindow',
        'cmd-z': 'std.editor.undoInFocusedEditorDocument',
        'cmd-y': 'std.editor.redoInFocusedEditorDocument',
        'cmd-k cmd-t': 'std.workbench.chooseTheme',
        'cmd-shift-o': 'std.workbench.showSymbolsForFocusedEditorDocument',
        'cmd-shift-s': 'std.editor.saveFocusedDocumentAs',
        'cmd-shift-t': 'std.editor.reopenRecentlyClosedDocument',
        'cmd-alt-s': 'std.editor.saveUnsavedDocuments',
        'cmd-r': 'std.window.reload',
      },
      '.kbm-editor-inline-search': {
        esc: 'std.editor.closeInlineSearch',
      },
      '.kbm-treeview': {
        backspace: 'std.solution.deleteSelectedElementsInFileExplorer',
        enter: 'std.solution.renameFileOrDirectory',
      },
      '.kbm-dialog': {
        esc: 'std.dialog.close',
      },
    },
  });

  bifrost.keybindings.registerKeyBindings({
    client: '*',
    os: '*',
    ignoreForFormInput: false,
    bindings: {
      '.kbm-quick-jump': {
        up: 'std.quickJump.selectPrevious',
        down: 'std.quickJump.selectNext',
        enter: 'std.quickJump.openSelected',
        esc: 'std.quickJump.hide',
      },
    },
  });

  bifrost.keybindings.registerKeyBindings({
    client: '*',
    os: 'windows',
    bindings: {
      body: {
        'ctrl-1': 'std.editor.zoomToActualSize',
        'ctrl-2': 'std.editor.zoomToViewport',
        'ctrl-3': 'std.editor.zoomToSelectedElement',
        'ctrl-alt-p': 'std.workbench.focusPerformanceInspector',
        'ctrl-shift-b': 'std.workbench.toggleFocusMode',
        'ctrl-shift-e': 'std.workbench.focusExplorer',
        'ctrl-shift-f': 'std.workbench.focusSearch',
        'ctrl-shift-j': 'std.workbench.showSymbolsForWorkspace',
        'ctrl-shift-p': 'std.quickJump.showCommands',
        'ctrl-b': 'std.workbench.togglePanels',
        'ctrl-f': 'std.editor.showAndFocusInlineSearch',
        'ctrl-j': 'std.quickJump.show',
        'ctrl-n': 'bpmn.editor.newBpmnDocument',
        'ctrl-o': 'std.editor.openDocument',
        'ctrl-s': 'std.editor.saveFocusedDocument',
        'ctrl-w': 'std.editor.closeFocusedDocumentOrWindow',
        'ctrl-z': 'std.editor.undoInFocusedEditorDocument',
        'ctrl-y': 'std.editor.redoInFocusedEditorDocument',
        'ctrl-k ctrl-t': 'std.workbench.chooseTheme',
        'ctrl-shift-o': 'std.workbench.showSymbolsForFocusedEditorDocument',
        'ctrl-shift-t': 'std.editor.reopenRecentlyClosedDocument',
        'ctrl-shift-s': 'std.editor.saveFocusedDocumentAs',
        'ctrl-alt-s': 'std.editor.saveUnsavedDocuments',
        'ctrl-r': 'std.window.reload',
      },
      '.kbm-quick-jump': {
        up: 'std.quickJump.selectPrevious',
        down: 'std.quickJump.selectNext',
        enter: 'std.quickJump.openSelected',
        esc: 'std.quickJump.hide',
      },
      '.kbm-treeview': {
        delete: 'std.solution.deleteSelectedElementsInFileExplorer',
        f2: 'std.solution.renameFileOrDirectory',
      },
      '.kbm-dialog': {
        esc: 'std.dialog.close',
      },
    },
  });

  bifrost.keybindings.registerKeyBindings({
    client: '*',
    os: 'linux',
    bindings: {
      body: {
        'ctrl-1': 'std.editor.zoomToActualSize',
        'ctrl-2': 'std.editor.zoomToViewport',
        'ctrl-3': 'std.editor.zoomToSelectedElement',
        'ctrl-alt-p': 'std.workbench.focusPerformanceInspector',
        'ctrl-shift-b': 'std.workbench.toggleFocusMode',
        'ctrl-shift-e': 'std.workbench.focusExplorer',
        'ctrl-shift-f': 'std.workbench.focusSearch',
        'ctrl-shift-j': 'std.workbench.showSymbolsForWorkspace',
        'ctrl-shift-p': 'std.quickJump.showCommands',
        'ctrl-b': 'std.workbench.togglePanels',
        'ctrl-f': 'std.editor.showAndFocusInlineSearch',
        'ctrl-j': 'std.quickJump.show',
        'ctrl-n': 'bpmn.editor.newBpmnDocument',
        'ctrl-o': 'std.editor.openDocument',
        'ctrl-s': 'std.editor.saveFocusedDocument',
        'ctrl-w': 'std.editor.closeFocusedDocumentOrWindow',
        'ctrl-z': 'std.editor.undoInFocusedEditorDocument',
        'ctrl-y': 'std.editor.redoInFocusedEditorDocument',
        'ctrl-k ctrl-t': 'std.workbench.chooseTheme',
        'ctrl-shift-o': 'std.workbench.showSymbolsForFocusedEditorDocument',
        'ctrl-shift-t': 'std.editor.reopenRecentlyClosedDocument',
        'ctrl-shift-s': 'std.editor.saveFocusedDocumentAs',
        'ctrl-alt-s': 'std.editor.saveUnsavedDocuments',
        'ctrl-r': 'std.window.reload',
      },
      '.kbm-quick-jump': {
        up: 'std.quickJump.selectPrevious',
        down: 'std.quickJump.selectNext',
        enter: 'std.quickJump.openSelected',
        esc: 'std.quickJump.hide',
      },
      '.kbm-treeview': {
        backspace: 'std.solution.deleteSelectedElementsInFileExplorer',
        f2: 'std.solution.renameFileOrDirectory',
      },
      '.kbm-dialog': {
        esc: 'std.dialog.close',
      },
    },
  });

  bifrost.keybindings.registerKeyBindings({
    client: 'electron',
    os: 'macos',
    bindings: {
      body: {
        'cmd-alt-right': 'std.editor.focusNextDocument',
        'cmd-alt-left': 'std.editor.focusPrevDocument',
        'cmd-shift-n': 'std.window.new',
        'cmd-q': 'std.window.quit',
      },
    },
  });

  bifrost.keybindings.registerKeyBindings({
    client: 'electron',
    os: 'windows',
    bindings: {
      body: {
        'ctrl-tab': 'std.editor.focusNextDocument',
        'ctrl-shift-tab': 'std.editor.focusPrevDocument',
        'ctrl-shift-n': 'std.window.new',
        'ctrl-f4': 'std.editor.closeFocusedDocument',
        'ctrl-w': 'std.editor.closeFocusedDocumentOrWindow',
        'alt-f4': 'std.window.quit',
      },
    },
  });

  bifrost.keybindings.registerKeyBindings({
    client: 'electron',
    os: 'linux',
    bindings: {
      body: {
        'ctrl-tab': 'std.editor.focusNextDocument',
        'ctrl-shift-tab': 'std.editor.focusPrevDocument',
        'ctrl-shift-n': 'std.window.new',
        'ctrl-f4': 'std.editor.closeFocusedDocument',
        'ctrl-w': 'std.editor.closeFocusedDocumentOrWindow',
        'alt-f4': 'std.window.quit',
      },
    },
  });
}
