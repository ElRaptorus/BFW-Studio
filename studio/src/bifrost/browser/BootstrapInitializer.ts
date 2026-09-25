import { Tooltip } from 'bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';

// ─── Bootstrap 5 Tooltip Delegation ──────────────────────────────────
// Bootstrap 5 removed jQuery-based delegated tooltips. This MutationObserver
// replicates that behavior: any element with [data-bs-toggle="tooltip"] that
// enters the DOM gets a Tooltip instance; when removed, the instance is disposed.

const TOOLTIP_SELECTOR = '[data-bs-toggle="tooltip"]';
const TREE_ENTRY_CLASS = 'treeview__entry';
const TREE_ENTRY_TOOLTIP_CLASS = 'tooltip--tree-entry';
const TREE_ENTRY_SHOW_DELAY_MILLISECONDS = 1500;
const HORIZONTAL_OFFSET_PX = 12;
const VERTICAL_GAP_PX = 2;
const VIEWPORT_MARGIN_PX = 8;

const tooltipInstances = new WeakMap<Element, Tooltip>();
const treeEntryPointerPositions = new WeakMap<Element, { x: number }>();
const treeEntryPointerCleanups = new WeakMap<Element, () => void>();

type PopperTooltipState = {
  elements: { reference: Element | { contextElement?: Element } };
  rects: { popper: { width: number; height: number } };
  styles: { popper: Record<string, string> };
};

type PopperConfig = {
  modifiers?: unknown[];
  strategy?: string;
};

type TreeEntryTooltipAnchor = {
  pointerX: number;
  top: number;
  bottom: number;
};

type TreeEntryTooltipSize = {
  width: number;
  height: number;
};

function isTreeEntry(element: Element): boolean {
  return element.classList.contains(TREE_ENTRY_CLASS);
}

function trackTreeEntryPointer(element: Element): void {
  if (treeEntryPointerCleanups.has(element)) {
    return;
  }

  const updatePosition = (event: Event): void => {
    if (!(event instanceof MouseEvent)) {
      return;
    }
    treeEntryPointerPositions.set(element, { x: event.clientX });
  };

  element.addEventListener('mouseenter', updatePosition);
  element.addEventListener('mousemove', updatePosition);
  treeEntryPointerCleanups.set(element, () => {
    element.removeEventListener('mouseenter', updatePosition);
    element.removeEventListener('mousemove', updatePosition);
    treeEntryPointerPositions.delete(element);
  });
}

function referenceElement(reference: Element | { contextElement?: Element }): Element | undefined {
  if (reference instanceof Element) {
    return reference;
  }
  return reference.contextElement;
}

// Normally the tooltips would be placed center-above the pointer.
// In the File explorer that effectively blocks the row above.
// So instead, the file hover tooltip is placed to the lower-right of the pointer.
function treeEntryTooltipPosition(
  anchor: TreeEntryTooltipAnchor,
  tooltipSize: TreeEntryTooltipSize,
  viewportSize: TreeEntryTooltipSize,
): { x: number; y: number } {
  let x = anchor.pointerX + HORIZONTAL_OFFSET_PX;
  let y = anchor.bottom + VERTICAL_GAP_PX;

  const fitsBelow = y + tooltipSize.height <= viewportSize.height - VIEWPORT_MARGIN_PX;
  if (!fitsBelow) {
    y = anchor.top - tooltipSize.height - VERTICAL_GAP_PX;
  }

  const availableWidth = viewportSize.width - VIEWPORT_MARGIN_PX * 2;
  if (tooltipSize.width > availableWidth) {
    x = viewportSize.width - VIEWPORT_MARGIN_PX - tooltipSize.width;
  } else {
    const maxX = viewportSize.width - VIEWPORT_MARGIN_PX - tooltipSize.width;
    if (x > maxX) {
      x = maxX;
    }
    if (x < VIEWPORT_MARGIN_PX) {
      x = VIEWPORT_MARGIN_PX;
    }
  }

  return { x: Math.round(x), y: Math.round(y) };
}

function placeTreeEntryTooltip(state: PopperTooltipState): void {
  const element = referenceElement(state.elements.reference);
  if (element == null) {
    return;
  }
  const pointer = treeEntryPointerPositions.get(element);
  if (pointer == null) {
    return;
  }

  const anchor = element.getBoundingClientRect();
  const position = treeEntryTooltipPosition(
    { pointerX: pointer.x, top: anchor.top, bottom: anchor.bottom },
    state.rects.popper,
    { width: window.innerWidth, height: window.innerHeight },
  );
  state.styles.popper.transform = `translate3d(${position.x}px, ${position.y}px, 0)`;
}

function treeEntryPopperConfig(defaultPopperConfig: PopperConfig | undefined): PopperConfig {
  const baseConfig = defaultPopperConfig ?? { modifiers: [] };
  return {
    ...baseConfig,
    strategy: 'fixed',
    modifiers: [
      ...(baseConfig.modifiers ?? []),
      {
        name: 'treeEntryCursor',
        enabled: true,
        phase: 'beforeWrite',
        requires: ['computeStyles'],
        fn: ({ state }: { state: PopperTooltipState }) => {
          placeTreeEntryTooltip(state);
        },
      },
    ],
  };
}

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

  const treeEntry = isTreeEntry(el);
  if (treeEntry) {
    trackTreeEntryPointer(el);
  }

  const instance = new Tooltip(
    el,
    treeEntry
      ? {
          placement: 'bottom',
          fallbackPlacements: ['bottom'],
          delay: { show: TREE_ENTRY_SHOW_DELAY_MILLISECONDS, hide: 0 },
          animation: false,
          trigger: 'hover',
          customClass: TREE_ENTRY_TOOLTIP_CLASS,
          popperConfig: treeEntryPopperConfig,
        }
      : {
          placement: 'top',
          delay: { show: 800, hide: 500 },
          animation: false,
          trigger: 'hover',
        },
  );
  tooltipInstances.set(el, instance);
}

function disposeTooltip(el: Element): void {
  const instance = tooltipInstances.get(el);
  if (instance) {
    instance.dispose();
    tooltipInstances.delete(el);
  }
  treeEntryPointerCleanups.get(el)?.();
  treeEntryPointerCleanups.delete(el);
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
