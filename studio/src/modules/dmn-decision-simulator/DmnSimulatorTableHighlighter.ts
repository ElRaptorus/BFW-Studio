import type { AbstractSubscription } from '#bifrost/common/AbstractEmitter';
import type DmnModelerComponentAdapter from '#modules/dmn-core/DmnModelerComponentAdapter';
import { EVENT_DMN_ADAPTER_VIEW_CHANGED } from '#modules/dmn-core/DmnModelerComponentAdapter';

import type { DmnSimulatorSession } from './DmnSimulatorSession';

const MATCHED_CLASS = 'dmn-sim-rule-matched';
const UNMATCHED_CLASS = 'dmn-sim-rule-unmatched';
const LEGEND_CLASS = 'dmn-sim-table-legend';

/**
 * Marks the matched and unmatched rule rows of the decision table the user navigated into.
 * dmn-js re-renders table rows, so a MutationObserver reapplies the classes after every render.
 */
export class DmnSimulatorTableHighlighter {
  private observer: MutationObserver | null = null;
  private observedContainer: HTMLElement | null = null;
  private readonly viewSubscription: AbstractSubscription;
  private readonly unsubscribeFromSession: () => void;

  constructor(
    private readonly adapter: DmnModelerComponentAdapter,
    private readonly session: DmnSimulatorSession,
  ) {
    this.viewSubscription = this.adapter.on(EVENT_DMN_ADAPTER_VIEW_CHANGED, this.handleViewChanged);
    this.unsubscribeFromSession = this.session.subscribe(this.handleViewChanged);
  }

  dispose(): void {
    this.viewSubscription.dispose();
    this.unsubscribeFromSession();
    this.observer?.disconnect();
    this.observer = null;
    this.observedContainer?.querySelector(`.${LEGEND_CLASS}`)?.remove();
  }

  private readonly handleViewChanged = (): void => {
    this.observer?.disconnect();
    this.observer = null;
    const container: HTMLElement | undefined = this.adapter.getActiveViewer()?._container;
    if (this.adapter.getActiveViewType() !== 'decisionTable' || container == null) {
      return;
    }
    this.observedContainer = container;
    this.apply();
    this.observer = new MutationObserver(() => this.apply());
    this.observer.observe(container, { childList: true, subtree: true });
  };

  private apply(): void {
    const container = this.observedContainer;
    if (container == null) {
      return;
    }
    const decisionId = this.adapter.getActiveView()?.element?.id;
    // Rule ids may have changed with the model, so a stale result highlights nothing.
    const rules =
      decisionId == null || this.session.getSnapshot().stale
        ? undefined
        : this.session.findDecisionStep(decisionId)?.rules;
    const matchedByRowId = new Map(rules?.map((rule) => [rule.ruleId, rule.matched]));
    let highlightedRowCount = 0;
    container.querySelectorAll<HTMLElement>('tr[data-row-id], td[data-row-id]').forEach((element) => {
      const matched = matchedByRowId.get(element.dataset.rowId ?? '');
      element.classList.toggle(MATCHED_CLASS, matched === true);
      element.classList.toggle(UNMATCHED_CLASS, matched === false);
      if (matched != null) {
        highlightedRowCount++;
      }
    });
    this.syncLegend(container, highlightedRowCount > 0);
  }

  /** Adds or removes the legend only when its presence changes, so the observer does not loop on its own insert. */
  private syncLegend(container: HTMLElement, visible: boolean): void {
    const existing = container.querySelector(`.${LEGEND_CLASS}`);
    if (visible && existing == null) {
      const legend = document.createElement('div');
      legend.className = LEGEND_CLASS;
      legend.textContent = 'Highlighted: matched rules of the last simulator run';
      container.appendChild(legend);
    } else if (!visible && existing != null) {
      existing.remove();
    }
  }
}
