import type { Bifrost } from '#bifrost/Bifrost';

import type { EditorDocument, TreeViewMediator } from '@evil/bifrost_fw_sdk';
import { isUrlForOpenInNewTab, parseOpenInNewTabUrl } from '@evil/bifrost_fw_sdk';

import { EVENT_EDITOR_AREA_FOCUS_UPDATED } from '../../../../../studio-sdk/src/contracts/internal/EditorEvents';

const DEBOUNCE_MS = 150;

export function initializeFileExplorerAutoReveal(bifrost: Bifrost): void {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  bifrost.editors.on(
    EVENT_EDITOR_AREA_FOCUS_UPDATED,
    (focusedEditorDocument: EditorDocument | null, _blurredEditorDocument: EditorDocument | null) => {
      if (debounceTimer != null) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        handleFocusChange(bifrost, focusedEditorDocument);
      }, DEBOUNCE_MS);
    },
  );
}

function handleFocusChange(bifrost: Bifrost, focusedEditorDocument: EditorDocument | null): void {
  if (!bifrost.settings.get('std.explorer.cursorFollowsTabs')) {
    return;
  }

  if (focusedEditorDocument == null) {
    return;
  }

  const originalUri = focusedEditorDocument.uri;

  revealInOpenEditors(bifrost, originalUri);
  revealInSolutionExplorer(bifrost, originalUri);
}

async function revealInOpenEditors(bifrost: Bifrost, uri: string): Promise<void> {
  if (!bifrost.views.isRegistered('std/file-explorer/open-editors')) {
    return;
  }

  try {
    const treeViewMediator = bifrost.views.getById<TreeViewMediator>('std/file-explorer/open-editors');
    await treeViewMediator.waitForAndSelectEntriesByMetadataFilter((metadata) => metadata.uri === uri);

    const selectedEntry = document.querySelector(treeViewMediator.domSelector + ' .treeview__entry--selected') as any;
    selectedEntry?.scrollIntoViewIfNeeded();
  } catch {
    // Entry may not exist in the tree
  }
}

async function revealInSolutionExplorer(bifrost: Bifrost, originalUri: string): Promise<void> {
  try {
    let resolvedUri = originalUri;

    if (isUrlForOpenInNewTab(originalUri)) {
      resolvedUri = parseOpenInNewTabUrl(originalUri).parentUri;
    }

    if (!bifrost.files.isLocalFilename(resolvedUri)) {
      return;
    }

    if (!bifrost.solution.containsEditorDocumentWithUri(resolvedUri)) {
      return;
    }

    bifrost.commands.executeCommand('std.fileExplorer.revealUri', [resolvedUri]);
  } catch {
    // Fragment URI may be malformed or solution lookup may fail
  }
}
