import AlignElementsModule from 'bpmn-js/lib/features/align-elements';
import DistributeElementsMenuProvider from 'bpmn-js/lib/features/distribute-elements/DistributeElementsMenuProvider';
import type EventBus from 'diagram-js/lib/core/EventBus';
import DistributeElementsModule from 'diagram-js/lib/features/distribute-elements';
import RuleProvider from 'diagram-js/lib/features/rules/RuleProvider';
import TranslateModule from 'diagram-js/lib/i18n/translate';
import { getParents } from 'diagram-js/lib/util/Elements';

const MIN_DISTRIBUTED = 3;

/**
 * Lines are never distributed, nor the children of a selected group. bpmn-js's own rule checks BPMN types, which
 * landscape elements do not have, so only its menu is reused.
 */
class LandscapeDistributeRules extends RuleProvider {
  static $inject = ['eventBus'];

  constructor(eventBus: EventBus) {
    super(eventBus);
  }

  init(): void {
    this.addRule('elements.distribute', ({ elements }: { elements: any[] }) => {
      const shapes = getParents(elements.filter((element) => element.waypoints == null));
      return shapes.length < MIN_DISTRIBUTED ? false : shapes;
    });
  }
}

/** The multi-selection context pad entry "Align elements" and its popup, which also distributes. */
export default {
  __depends__: [TranslateModule, AlignElementsModule, DistributeElementsModule],
  __init__: ['landscapeDistributeRules', 'distributeElementsMenuProvider'],
  landscapeDistributeRules: ['type', LandscapeDistributeRules],
  distributeElementsMenuProvider: ['type', DistributeElementsMenuProvider],
};
