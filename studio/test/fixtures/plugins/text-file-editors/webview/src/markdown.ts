import { markdown } from '@codemirror/lang-markdown';
import { Annotation, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

import type { HostToWebviewMessage, WebviewToHostMessage } from './types';
import { installSaveShortcut, requireElement } from './types';

const editorContainer = requireElement('editor');
const previewContainer = requireElement('preview');

const studioApi = window.acquireStudioApi?.();
if (studioApi == null) {
  console.error('[text-file-editors] acquireStudioApi not available');
} else {
  installSaveShortcut(studioApi);
}

function renderPreview(content: string): void {
  const html = marked.parse(content, { async: false }) as string;
  previewContainer.innerHTML = DOMPurify.sanitize(html);
}

let previewDebounceHandle: ReturnType<typeof setTimeout> | null = null;
function schedulePreviewRender(content: string): void {
  if (previewDebounceHandle != null) {
    clearTimeout(previewDebounceHandle);
  }
  previewDebounceHandle = setTimeout(() => renderPreview(content), 150);
}

// Tags the transaction that loads the document's initial content so the update listener
// below can tell it apart from a real user edit — both set `update.docChanged`.
const programmaticLoad = Annotation.define<boolean>();

// `change` messages are sent to the plugin backend on every edit — undebounced. A
// postMessage of a text string is cheap, and the backend's cached content must always be
// fresh enough to answer either save path (host-triggered `onSaveRequest`, or the in-iframe
// Ctrl+S relay below) immediately, without waiting on a debounce window.
const updateListener = EditorView.updateListener.of((update) => {
  if (!update.docChanged) {
    return;
  }
  if (update.transactions.some((tr) => tr.annotation(programmaticLoad))) {
    return;
  }
  const content = update.state.doc.toString();
  studioApi?.postMessage({ type: 'change', payload: content } satisfies WebviewToHostMessage);
  schedulePreviewRender(content);
});

const view = new EditorView({
  state: EditorState.create({
    doc: '',
    extensions: [basicSetup, markdown(), updateListener],
  }),
  parent: editorContainer,
});

studioApi?.onMessage((data: unknown) => {
  const message = data as HostToWebviewMessage;
  if (message.type === 'load') {
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: message.payload },
      annotations: programmaticLoad.of(true),
    });
    renderPreview(message.payload);
  }
});

studioApi?.postMessage({ type: 'ready' } satisfies WebviewToHostMessage);
