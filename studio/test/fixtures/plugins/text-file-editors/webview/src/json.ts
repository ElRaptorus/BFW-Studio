import { json } from '@codemirror/lang-json';
import { Annotation, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { basicSetup } from 'codemirror';

import type { HostToWebviewMessage, WebviewToHostMessage } from './types';
import { installSaveShortcut, requireElement } from './types';

const editorContainer = requireElement('editor');
const errorBanner = requireElement('error-banner');
const formatButton = requireElement('format-button');

const studioApi = window.acquireStudioApi?.();
if (studioApi == null) {
  console.error('[text-file-editors] acquireStudioApi not available');
} else {
  installSaveShortcut(studioApi);
}

function setError(message: string | null): void {
  errorBanner.textContent = message ?? '';
  errorBanner.style.display = message ? 'block' : 'none';
}

// Tags the transaction that loads the document's initial content so the update listener
// below can tell it apart from a real user edit — both set `update.docChanged`.
const programmaticLoad = Annotation.define<boolean>();

// `change` messages are sent to the plugin backend on every edit — undebounced (see
// markdown.ts for the rationale: the backend's cached content must always be fresh enough
// to answer either save path immediately).
const updateListener = EditorView.updateListener.of((update) => {
  if (!update.docChanged) {
    return;
  }
  if (update.transactions.some((tr) => tr.annotation(programmaticLoad))) {
    return;
  }
  const content = update.state.doc.toString();
  studioApi?.postMessage({ type: 'change', payload: content } satisfies WebviewToHostMessage);
  try {
    JSON.parse(content);
    setError(null);
  } catch (error) {
    setError(error instanceof Error ? error.message : 'Invalid JSON');
  }
});

const view = new EditorView({
  state: EditorState.create({
    doc: '',
    extensions: [basicSetup, json(), updateListener],
  }),
  parent: editorContainer,
});

formatButton.addEventListener('click', () => {
  const content = view.state.doc.toString();
  try {
    const formatted = JSON.stringify(JSON.parse(content), null, 2);
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: formatted },
    });
    setError(null);
  } catch (error) {
    setError(error instanceof Error ? error.message : 'Invalid JSON — cannot format');
  }
});

studioApi?.onMessage((data: unknown) => {
  const message = data as HostToWebviewMessage;
  if (message.type === 'load') {
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: message.payload },
      annotations: programmaticLoad.of(true),
    });
    setError(null);
  }
});

studioApi?.postMessage({ type: 'ready' } satisfies WebviewToHostMessage);
