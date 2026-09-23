import type { ElementLike } from 'diagram-js/lib/model/Types';

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

class CustomPopupProvider {
  static $inject: string[];

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
      return this.filterEventSubProcessDowngrades(element, entriesWithEventSubProcess);
    };
  }

  getPopupMenuHeaderEntries(element: ElementLike) {
    return (entries) => {
      const filteredEntries = this.filterReceiveTaskOnEventBasedGateway(element, entries);
      return {
        ...filteredEntries,
      };
    };
  }

  private filterReceiveTaskOnEventBasedGateway(element: ElementLike, entries: object): object {
    const isReceiveTask = element.type === 'bpmn:ReceiveTask';
    const isConnectedToEventBasedGateway = element.incoming?.some(
      (flow) => flow.source?.type === 'bpmn:EventBasedGateway',
    );

    if (isReceiveTask && isConnectedToEventBasedGateway) {
      return {};
    }

    return entries;
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

  private isEventSubProcess(element: ElementLike): boolean {
    return element.type === 'bpmn:SubProcess' && element.businessObject?.get('triggeredByEvent') === true;
  }
}

CustomPopupProvider.$inject = ['config', 'popupMenu', 'translate', 'bpmnReplace'];

export default {
  __init__: ['customPopupProvider'],
  customPopupProvider: ['type', CustomPopupProvider],
};
