import { loader } from '@monaco-editor/react';
import { Tooltip } from 'bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import * as monaco from 'monaco-editor';

(self as any).MonacoEnvironment = {
  getWorker(_: string, label: string) {
    if (label === 'json') {
      return new Worker(new URL('monaco-editor/esm/vs/language/json/json.worker.js', import.meta.url));
    }
    if (label === 'typescript' || label === 'javascript') {
      return new Worker(new URL('monaco-editor/esm/vs/language/typescript/ts.worker.js', import.meta.url));
    }
    if (label === 'html' || label === 'handlebars' || label === 'razor') {
      return new Worker(new URL('monaco-editor/esm/vs/language/html/html.worker.js', import.meta.url));
    }
    if (label === 'css' || label === 'scss' || label === 'less') {
      return new Worker(new URL('monaco-editor/esm/vs/language/css/css.worker.js', import.meta.url));
    }
    return new Worker(new URL('monaco-editor/esm/vs/editor/editor.worker.js', import.meta.url));
  },
};

// Monaco's internal Delayer rejects a promise with "Canceled" when editors are
// disposed (e.g. WordHighlighter cleanup). Has no actual impact and can be ignored.
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason instanceof Error && event.reason.message === 'Canceled') {
    event.preventDefault();
  }
});

loader.config({ monaco });

(window as any).__internal_monaco__ = monaco;

// ─── Bootstrap 5 Tooltip Delegation ──────────────────────────────────
// Bootstrap 5 removed jQuery-based delegated tooltips. This MutationObserver
// replicates that behavior: any element with [data-bs-toggle="tooltip"] that
// enters the DOM gets a Tooltip instance; when removed, the instance is disposed.

const TOOLTIP_SELECTOR = '[data-bs-toggle="tooltip"]';
const tooltipInstances = new WeakMap<Element, Tooltip>();

function initTooltip(el: Element): void {
  if (tooltipInstances.has(el)) {
    return;
  }

  const title = el.getAttribute('title');
  if (title == null || title === '') {
    return;
  }

  const instance = new Tooltip(el, {
    placement: 'top',
    delay: { show: 800, hide: 500 },
    animation: false,
    trigger: 'hover focus',
  });
  tooltipInstances.set(el, instance);
}

function disposeTooltip(el: Element): void {
  const instance = tooltipInstances.get(el);
  if (instance) {
    instance.dispose();
    tooltipInstances.delete(el);
  }
}

function initAllTooltipsIn(root: Element | Document): void {
  root.querySelectorAll(TOOLTIP_SELECTOR).forEach(initTooltip);
}

// Periodically clean up tooltip instances whose trigger elements were removed
// from the DOM without a MutationObserver "removedNodes" event (e.g. React
// reconciliation that replaces an entire subtree).
setInterval(() => {
  document
    .querySelectorAll(
      '.tooltip.bs-tooltip-auto, .tooltip.bs-tooltip-top, .tooltip.bs-tooltip-bottom, .tooltip.bs-tooltip-start, .tooltip.bs-tooltip-end',
    )
    .forEach((tooltipEl) => {
      const id = tooltipEl.getAttribute('id');
      if (!id) {
        return;
      }
      const trigger = document.querySelector(`[aria-describedby="${id}"]`);
      if (!trigger || !document.body.contains(trigger)) {
        tooltipEl.remove();
      }
    });
}, 2000);

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) {
        continue;
      }
      const el = node as Element;
      if (el.matches(TOOLTIP_SELECTOR)) {
        initTooltip(el);
      }
      initAllTooltipsIn(el);
    }
    for (const node of mutation.removedNodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) {
        continue;
      }
      const el = node as Element;
      if (el.matches(TOOLTIP_SELECTOR)) {
        disposeTooltip(el);
      }
      el.querySelectorAll(TOOLTIP_SELECTOR).forEach(disposeTooltip);
    }
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});

initAllTooltipsIn(document);
