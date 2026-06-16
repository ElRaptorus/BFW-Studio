import type { ElementLike } from 'diagram-js/lib/model/Types';

import { SupportedBpmnElements, SupportedPopupMenuHeaderEntries } from '../SupportedBpmnElements';

class CustomPopupProvider {
  static $inject: string[];

  private supportedEventSubProcessStartEvents: Set<string> = new Set([
    'replace-with-error-start',
    'replace-with-signal-start',
    'replace-with-message-start',
    'replace-with-timer-start',
    'replace-with-non-interrupting-signal-start',
    'replace-with-non-interrupting-message-start',
    'replace-with-non-interrupting-timer-start',
  ]);

  private showUnsupportedElements: boolean = false;
  private popupMenu;

  constructor(config, popupMenu) {
    this.popupMenu = popupMenu;
    popupMenu.registerProvider('bpmn-replace', this);
  }

  getPopupMenuEntries(element: ElementLike) {
    return (entries) => {
      const filteredEntries = this.filterEntriesBySupportedBpmnElements(entries);
      return {
        ...filteredEntries,
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

CustomPopupProvider.$inject = ['config', 'popupMenu', 'translate'];

export default {
  __init__: ['customPopupProvider'],
  customPopupProvider: ['type', CustomPopupProvider],
};
