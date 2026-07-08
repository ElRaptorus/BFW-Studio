import type { ElementLike } from 'diagram-js/lib/model/Types';

import { SupportedBpmnElements, SupportedPopupMenuHeaderEntries } from '../SupportedBpmnElements';

const EVENT_SUB_PROCESS_ENTRY_ID = 'replace-with-event-subprocess';

const EVENT_SUB_PROCESS_SOURCE_ACTIVITY_TYPES: ReadonlySet<string> = new Set([
  'bpmn:Task',
  'bpmn:UserTask',
  'bpmn:ManualTask',
  'bpmn:ServiceTask',
  'bpmn:ScriptTask',
  'bpmn:SendTask',
  'bpmn:ReceiveTask',
  'bpmn:BusinessRuleTask',
  'bpmn:CallActivity',
  'bpmn:SubProcess',
]);

const EVENT_SUB_PROCESS_DOWNGRADE_ENTRY_IDS: ReadonlySet<string> = new Set([
  'replace-with-task',
  'replace-with-collapsed-subprocess',
  'replace-with-expanded-subprocess',
  'replace-with-subprocess',
]);

const ESCALATION_BOUNDARY_ENTRY_IDS: ReadonlySet<string> = new Set([
  'replace-with-escalation-boundary',
  'replace-with-non-interrupting-escalation-boundary',
]);

// Escalation boundary events are only meaningful on activities that can raise an
// escalation from an inner scope. Transaction / AdHoc are omitted because they
// are unsupported by the engine; add 'bpmn:Transaction' here if that changes.
const ESCALATION_BOUNDARY_ALLOWED_HOST_TYPES: ReadonlySet<string> = new Set(['bpmn:CallActivity', 'bpmn:SubProcess']);

class CustomPopupProvider {
  static $inject: string[];

  private supportedEventSubProcessStartEvents: Set<string> = new Set([
    'replace-with-message-start',
    'replace-with-timer-start',
    'replace-with-conditional-start',
    'replace-with-signal-start',
    'replace-with-error-start',
    'replace-with-escalation-start',
    'replace-with-non-interrupting-message-start',
    'replace-with-non-interrupting-timer-start',
    'replace-with-non-interrupting-conditional-start',
    'replace-with-non-interrupting-signal-start',
    'replace-with-non-interrupting-escalation-start',
  ]);

  private showUnsupportedElements: boolean = false;
  private popupMenu;
  private bpmnReplace;
  private translate;

  constructor(config, popupMenu, translate, bpmnReplace) {
    this.popupMenu = popupMenu;
    this.translate = translate;
    this.bpmnReplace = bpmnReplace;
    popupMenu.registerProvider('bpmn-replace', this);
  }

  getPopupMenuEntries(element: ElementLike) {
    return (entries) => {
      const entriesWithEventSubProcess = this.injectEventSubProcessEntry(element, entries);
      const supportedEntries = this.filterEntriesBySupportedBpmnElements(entriesWithEventSubProcess);
      const oneWayEnforcedEntries = this.filterEventSubProcessDowngrades(element, supportedEntries);
      const hostRestrictedEntries = this.filterBoundaryEventHostRestrictions(element, oneWayEnforcedEntries);
      return {
        ...hostRestrictedEntries,
      };
    };
  }

  getPopupMenuHeaderEntries(element: ElementLike) {
    return (entries) => {
      const filteredEntries = this.filterEntriesBySupportedMenuHeaderEntries(element, entries);
      return {
        ...filteredEntries,
      };
    };
  }

  setShowUnsupportedElements(value: boolean): void {
    this.showUnsupportedElements = value;
    if (this.popupMenu.isOpen()) {
      this.popupMenu.refresh();
    }
  }

  private filterEntriesBySupportedMenuHeaderEntries(element: ElementLike, entries: object): object {
    const filteredEntries = Object.entries(entries).filter((entry) => {
      if (this.showUnsupportedElements) {
        return true;
      }

      const entryTitle = entry[1].title.toLowerCase();

      const isSupported = SupportedPopupMenuHeaderEntries.some((supportedLoopCharacteristic) => {
        return entryTitle === supportedLoopCharacteristic.title.toLowerCase();
      });

      // Note that the element will use the raw bpmn-js format, thus we can't use our own types here.
      const isReceiveTask = element.type === 'bpmn:ReceiveTask';
      const isConnectedToEventBasedGateway = element.incoming.some(
        (flow) => flow.source?.type === 'bpmn:EventBasedGateway',
      );

      return isSupported && !(isReceiveTask && isConnectedToEventBasedGateway);
    });

    const newEntries = Object.fromEntries(filteredEntries);

    return newEntries;
  }

  private injectEventSubProcessEntry(element: ElementLike, entries: object): object {
    if (Object.hasOwn(entries, EVENT_SUB_PROCESS_ENTRY_ID)) {
      return entries;
    }
    if (!EVENT_SUB_PROCESS_SOURCE_ACTIVITY_TYPES.has(element.type)) {
      return entries;
    }
    if (this.isEventSubProcess(element)) {
      return entries;
    }

    const injectedEntry = {
      label: this.translate('Event Sub-Process'),
      className: 'bpmn-icon-event-subprocess-expanded',
      action: () => {
        this.bpmnReplace.replaceElement(element, {
          type: 'bpmn:SubProcess',
          triggeredByEvent: true,
          isExpanded: true,
        });
      },
    };

    return {
      ...entries,
      [EVENT_SUB_PROCESS_ENTRY_ID]: injectedEntry,
    };
  }

  private filterEventSubProcessDowngrades(element: ElementLike, entries: object): object {
    if (!this.isEventSubProcess(element)) {
      return entries;
    }

    const filteredEntries = Object.entries(entries).filter(
      (entry) => !EVENT_SUB_PROCESS_DOWNGRADE_ENTRY_IDS.has(entry[0]),
    );

    return Object.fromEntries(filteredEntries);
  }

  private filterBoundaryEventHostRestrictions(element: ElementLike, entries: object): object {
    if (this.showUnsupportedElements) {
      return entries;
    }

    if (element.type !== 'bpmn:BoundaryEvent') {
      return entries;
    }

    const hostType = element.host?.type ?? element.businessObject?.get?.('attachedToRef')?.$type;
    if (hostType != null && ESCALATION_BOUNDARY_ALLOWED_HOST_TYPES.has(hostType)) {
      return entries;
    }

    const filteredEntries = Object.entries(entries).filter((entry) => !ESCALATION_BOUNDARY_ENTRY_IDS.has(entry[0]));

    return Object.fromEntries(filteredEntries);
  }

  private isEventSubProcess(element: ElementLike): boolean {
    return element.type === 'bpmn:SubProcess' && element.businessObject?.get('triggeredByEvent') === true;
  }

  private filterEntriesBySupportedBpmnElements(entries: object): object {
    const filteredEntries = Object.entries(entries).filter((entry) => {
      if (this.showUnsupportedElements) {
        return true;
      }

      if (
        Object.hasOwn(entries, 'replace-with-compensation-start') &&
        !this.supportedEventSubProcessStartEvents.has(entry[0])
      ) {
        return false;
      }

      const entryLabel: string = entry[1].label.toLowerCase();

      const isSupported = SupportedBpmnElements.some((supportedElement) => {
        const supportedElementType =
          supportedElement.label?.toLowerCase() ?? this.humanizeElementType(supportedElement.type).toLowerCase();

        if (entryLabel === supportedElementType) {
          return true;
        }

        const eventDefinitionSupport = supportedElement.supportedEventDefinitions.some((eventDefinitionType) => {
          const eventType = this.humanizeElementType(eventDefinitionType).toLowerCase();
          const shortType = eventType.substring(0, eventType.search(/\s/));

          const supportsSpecificElementType = entryLabel === `${shortType} ${supportedElementType}`;

          if (supportsSpecificElementType) {
            return true;
          }

          return entryLabel === `${shortType} ${supportedElementType} (non-interrupting)`;
        });

        if (eventDefinitionSupport) {
          return true;
        }

        // return true for the flow entries because they are not an own BpmnType
        // return true for Sub Process because there are two entries (collapsed/expanded)
        // return true for Pool/Participant because there are two entries (empty/expanded)
        if (
          entryLabel.includes('Pool/Participant'.toLowerCase()) ||
          entryLabel.match(/^Sub-Process/gi) ||
          entryLabel.match(/^Event sub-process/gi) ||
          entryLabel.includes('Conditional Flow'.toLowerCase()) ||
          entryLabel.includes('Default Flow'.toLowerCase())
        ) {
          return true;
        }

        return false;
      });

      return isSupported;
    });

    const newEntries = Object.fromEntries(filteredEntries);

    return newEntries;
  }

  private humanizeElementType(type: string): string {
    const rawType: string = type.replace(/^bpmn:/, '');
    const humanizedType: string = rawType.replace(/([a-z])([A-Z])/g, '$1 $2');

    return humanizedType;
  }
}

CustomPopupProvider.$inject = ['config', 'popupMenu', 'translate', 'bpmnReplace'];

export default {
  __init__: ['customPopupProvider'],
  customPopupProvider: ['type', CustomPopupProvider],
};
