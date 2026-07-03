import assert from 'node:assert';
import { describe, it } from 'vitest';

import providerModule from '../../../src/modules/bpmn-core/bpmn-js/Provider/CustomPopupProvider';

type PopupEntry = { label: string; className?: string; action?: () => void; title?: string };
type PopupEntries = Record<string, PopupEntry>;

const CustomPopupProvider = providerModule.customPopupProvider[1] as new (
  config: unknown,
  popupMenu: unknown,
  translate: (value: string) => string,
  bpmnReplace: unknown,
) => {
  getPopupMenuEntries(element: unknown): (entries: PopupEntries) => PopupEntries;
};

function createProvider(bpmnReplace: { replaceElement: (...args: unknown[]) => void } = { replaceElement: () => {} }) {
  const popupMenu = {
    registerProvider: () => {},
    isOpen: () => false,
    refresh: () => {},
  };
  return new CustomPopupProvider({}, popupMenu, (value: string) => value, bpmnReplace);
}

function taskElement(): unknown {
  return { type: 'bpmn:Task', businessObject: { get: () => undefined } };
}

function eventSubProcessElement(): unknown {
  return {
    type: 'bpmn:SubProcess',
    businessObject: { get: (key: string) => (key === 'triggeredByEvent' ? true : undefined) },
  };
}

function runEntries(element: unknown, entries: PopupEntries, bpmnReplace?): PopupEntries {
  const provider = createProvider(bpmnReplace);
  return provider.getPopupMenuEntries(element)(entries);
}

describe('CustomPopupProvider — event subprocess start whitelist', () => {
  const startMenuEntries: PopupEntries = {
    'replace-with-none-start': { label: 'Start Event' },
    'replace-with-message-start': { label: 'Message Start Event' },
    'replace-with-timer-start': { label: 'Timer Start Event' },
    'replace-with-conditional-start': { label: 'Conditional Start Event' },
    'replace-with-signal-start': { label: 'Signal Start Event' },
    'replace-with-error-start': { label: 'Error Start Event' },
    'replace-with-escalation-start': { label: 'Escalation Start Event' },
    'replace-with-compensation-start': { label: 'Compensation Start Event' },
    'replace-with-non-interrupting-message-start': { label: 'Message Start Event (non-interrupting)' },
    'replace-with-non-interrupting-timer-start': { label: 'Timer Start Event (non-interrupting)' },
    'replace-with-non-interrupting-conditional-start': { label: 'Conditional Start Event (non-interrupting)' },
    'replace-with-non-interrupting-signal-start': { label: 'Signal Start Event (non-interrupting)' },
    'replace-with-non-interrupting-escalation-start': { label: 'Escalation Start Event (non-interrupting)' },
    'replace-with-non-interrupting-error-start': { label: 'Error Start Event (non-interrupting)' },
  };

  it('shows exactly the decision-B interrupting + non-interrupting start events', () => {
    // The start-event replace menu targets the ESP's start event, not the ESP shell.
    const startElement = { type: 'bpmn:StartEvent', businessObject: { get: () => undefined } };
    const result = runEntries(startElement, { ...startMenuEntries });
    const keys = Object.keys(result).sort();

    assert.deepEqual(keys, [
      'replace-with-conditional-start',
      'replace-with-error-start',
      'replace-with-escalation-start',
      'replace-with-message-start',
      'replace-with-non-interrupting-conditional-start',
      'replace-with-non-interrupting-escalation-start',
      'replace-with-non-interrupting-message-start',
      'replace-with-non-interrupting-signal-start',
      'replace-with-non-interrupting-timer-start',
      'replace-with-signal-start',
      'replace-with-timer-start',
    ]);
  });

  it('hides compensation, blank/none, and non-interrupting error starts', () => {
    const startElement = { type: 'bpmn:StartEvent', businessObject: { get: () => undefined } };
    const result = runEntries(startElement, { ...startMenuEntries });
    assert.equal(Object.hasOwn(result, 'replace-with-compensation-start'), false);
    assert.equal(Object.hasOwn(result, 'replace-with-none-start'), false);
    assert.equal(Object.hasOwn(result, 'replace-with-non-interrupting-error-start'), false);
  });
});

describe('CustomPopupProvider — direct activity→ESP entry', () => {
  it('injects an "Event Sub-Process" entry for a plain task', () => {
    const entries: PopupEntries = { 'replace-with-user-task': { label: 'User Task' } };
    const result = runEntries(taskElement(), entries);
    assert.equal(Object.hasOwn(result, 'replace-with-event-subprocess'), true);
    assert.equal(result['replace-with-event-subprocess'].label, 'Event Sub-Process');
  });

  it('the injected entry replaces the element with a triggeredByEvent expanded subprocess', () => {
    const calls: unknown[][] = [];
    const bpmnReplace = { replaceElement: (...args: unknown[]) => calls.push(args) };
    const element = taskElement();
    const entries: PopupEntries = { 'replace-with-user-task': { label: 'User Task' } };
    const result = runEntries(element, entries, bpmnReplace);

    result['replace-with-event-subprocess'].action?.();
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], element);
    assert.deepEqual(calls[0][1], { type: 'bpmn:SubProcess', triggeredByEvent: true, isExpanded: true });
  });

  it('does not inject when the element is already an event subprocess', () => {
    const entries: PopupEntries = { 'replace-with-transaction': { label: 'Transaction' } };
    const result = runEntries(eventSubProcessElement(), entries);
    assert.equal(Object.hasOwn(result, 'replace-with-event-subprocess'), false);
  });
});

describe('CustomPopupProvider — event subprocess one-way trip', () => {
  it('removes downgrade entries but keeps transaction / event-subprocess options', () => {
    const entries: PopupEntries = {
      'replace-with-task': { label: 'Task' },
      'replace-with-collapsed-subprocess': { label: 'Sub-process (collapsed)' },
      'replace-with-expanded-subprocess': { label: 'Sub-process' },
      'replace-with-transaction': { label: 'Transaction' },
      'replace-with-event-subprocess': { label: 'Event Sub-process' },
    };
    const result = runEntries(eventSubProcessElement(), entries);

    assert.equal(Object.hasOwn(result, 'replace-with-task'), false);
    assert.equal(Object.hasOwn(result, 'replace-with-collapsed-subprocess'), false);
    assert.equal(Object.hasOwn(result, 'replace-with-expanded-subprocess'), false);
    assert.equal(Object.hasOwn(result, 'replace-with-transaction'), true);
    assert.equal(Object.hasOwn(result, 'replace-with-event-subprocess'), true);
  });
});
