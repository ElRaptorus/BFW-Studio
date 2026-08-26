import type { EditorDocumentRendererProps } from '#bifrost/contracts/EditorTypes';

import React, { useEffect, useRef, useState } from 'react';

interface PlaceholderEditorDocumentRendererContext {
  pluginName: string;
  /** Human-readable plugin name (manifest `displayName`, falling back to the plugin name). */
  pluginDisplayName: string;
  /** Triggers plugin activation (permission dialog included). Resolves once activation settles. */
  activatePlugin: () => Promise<void>;
  /**
   * Returns `true` if this placeholder's document type id has NOT yet been replaced by the
   * plugin's real `registerWebviewDocumentType()` call.
   */
  isStillPlaceholder: () => boolean;
}

type PlaceholderState = 'activating' | 'denied' | 'failed' | 'mismatch';

/**
 * Factory that creates a React component shown for a manifest-declared
 * `contributes.editorDocumentTypes` entry before the owning plugin has activated.
 *
 * On mount, triggers plugin activation. Once activation settles:
 * - If the plugin's `activate()` replaced this placeholder with a real registration
 *   (via `registerWebviewDocumentType()`), the tab is closed and reopened so it
 *   resolves to the real editor renderer.
 * - If the user denied the plugin's permission request, shows a terminal "denied" state.
 * - If activation itself failed (plugin error or quarantine), shows a terminal "failed" state.
 * - If activation succeeded but did not result in a matching registration (the plugin's
 *   `activate()` never called `registerWebviewDocumentType()` with this id), shows a
 *   terminal "did not register an editor" error state.
 */
export function createPlaceholderEditorDocumentRenderer(
  context: PlaceholderEditorDocumentRendererContext,
): React.FC<EditorDocumentRendererProps> {
  return function PlaceholderEditorDocumentRenderer(props: EditorDocumentRendererProps): React.JSX.Element {
    const { studio, editorDocument, uri } = props;
    const [state, setState] = useState<PlaceholderState>('activating');
    const triggeredRef = useRef(false);

    useEffect(() => {
      if (triggeredRef.current) {
        return;
      }
      triggeredRef.current = true;

      void (async () => {
        try {
          await context.activatePlugin();
        } catch (err) {
          // ActivationManager swallows plugin-side failures, so this only fires for
          // infrastructure faults (e.g. a dead plugin host connection). Either way the
          // placeholder must reach a terminal state instead of spinning forever.
          console.error(`[PlaceholderEditorDocumentRenderer] Activation of '${context.pluginName}' threw:`, err);
          setState('failed');
          return;
        }

        if (!context.isStillPlaceholder()) {
          // Replaced by the plugin's real registration — force the tab to re-resolve
          // against the current document type registry (same idiom as forceReopenBpmnEditors).
          // The placeholder never has unsaved changes, so the public 1-arg overload
          // (no skip-unsaved-changes-dialog option) is safe to use here.
          await studio.editors.closeEditorDocument(editorDocument);
          studio.editors.focusOrOpenEditorDocument(uri);
          return;
        }

        const pluginInfo = studio.plugins.getPluginList().find((plugin) => plugin.name === context.pluginName);
        if (pluginInfo?.status === 'disabled') {
          setState('denied');
          return;
        }
        setState(pluginInfo?.status === 'error' || pluginInfo?.status === 'quarantined' ? 'failed' : 'mismatch');
      })();
      // Intentionally runs once per mounted placeholder instance (one activation attempt per tab).
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (state === 'activating') {
      return (
        <div className="placeholder-editor-document" data-test--editor-doctype-placeholder="activating">
          <span className="ph ph-clock placeholder-editor-document__icon" />
          <span className="placeholder-editor-document__text">
            Activating plugin &ldquo;{context.pluginDisplayName}&rdquo;…
          </span>
        </div>
      );
    }

    if (state === 'denied') {
      return (
        <div
          className="placeholder-editor-document placeholder-editor-document--error"
          data-test--editor-doctype-placeholder="denied"
        >
          <span className="ph ph-warning placeholder-editor-document__icon" />
          <span className="placeholder-editor-document__text">
            Activation of plugin &ldquo;{context.pluginDisplayName}&rdquo; was denied. Re-enable it in the Plugins pane
            to open this file.
          </span>
        </div>
      );
    }

    if (state === 'failed') {
      return (
        <div
          className="placeholder-editor-document placeholder-editor-document--error"
          data-test--editor-doctype-placeholder="failed"
        >
          <span className="ph ph-warning placeholder-editor-document__icon" />
          <span className="placeholder-editor-document__text">
            Plugin &ldquo;{context.pluginDisplayName}&rdquo; failed to activate. See the Plugins pane for details.
          </span>
        </div>
      );
    }

    return (
      <div
        className="placeholder-editor-document placeholder-editor-document--error"
        data-test--editor-doctype-placeholder="mismatch"
      >
        <span className="ph ph-warning placeholder-editor-document__icon" />
        <span className="placeholder-editor-document__text">
          Plugin &ldquo;{context.pluginDisplayName}&rdquo; activated but did not register an editor for this file. This
          is a bug in the plugin.
        </span>
      </div>
    );
  };
}
