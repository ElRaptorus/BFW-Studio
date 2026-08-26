import { Tooltip } from 'bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';

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

  const title = el.getAttribute('data-bs-title') ?? el.getAttribute('title');
  if (title == null || title === '') {
    return;
  }

  if (!el.hasAttribute('data-bs-title')) {
    el.setAttribute('data-bs-title', title);
    el.removeAttribute('title');
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
