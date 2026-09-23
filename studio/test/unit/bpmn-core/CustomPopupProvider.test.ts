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

describe('CustomPopupProvider — start events', () => {
  it('keeps the None start entry so a typed top-level start can become a None start again', () => {
    const startElement = { type: 'bpmn:StartEvent', businessObject: { get: () => undefined } };
    const entries: PopupEntries = {
      'replace-with-none-start': { label: 'Start Event' },
      'replace-with-timer-start': { label: 'Timer Start Event' },
    };
    const result = runEntries(startElement, entries);

    assert.deepEqual(Object.keys(result).sort(), ['replace-with-none-start', 'replace-with-timer-start']);
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

describe('CustomPopupProvider — boundary events', () => {
  it('keeps escalation boundary entries on a plain task host', () => {
    const boundaryElement = {
      type: 'bpmn:BoundaryEvent',
      host: { type: 'bpmn:Task' },
      businessObject: { get: () => undefined },
    };
    const entries: PopupEntries = {
      'replace-with-escalation-boundary': { label: 'Escalation Boundary Event' },
      'replace-with-non-interrupting-escalation-boundary': { label: 'Escalation Boundary Event (non-interrupting)' },
    };
    const result = runEntries(boundaryElement, entries);

    assert.equal(Object.hasOwn(result, 'replace-with-escalation-boundary'), true);
    assert.equal(Object.hasOwn(result, 'replace-with-non-interrupting-escalation-boundary'), true);
  });
});

describe('CustomPopupProvider — event subprocess one-way trip', () => {
  it('removes downgrade entries and keeps the event-subprocess option', () => {
    const entries: PopupEntries = {
      'replace-with-task': { label: 'Task' },
      'replace-with-collapsed-subprocess': { label: 'Sub-process (collapsed)' },
      'replace-with-expanded-subprocess': { label: 'Sub-process' },
      'replace-with-event-subprocess': { label: 'Event Sub-process' },
    };
    const result = runEntries(eventSubProcessElement(), entries);

    assert.equal(Object.hasOwn(result, 'replace-with-task'), false);
    assert.equal(Object.hasOwn(result, 'replace-with-collapsed-subprocess'), false);
    assert.equal(Object.hasOwn(result, 'replace-with-expanded-subprocess'), false);
    assert.equal(Object.hasOwn(result, 'replace-with-event-subprocess'), true);
  });

  it('keeps the transaction morph entry because bpmn:Transaction is a supported element', () => {
    const entries: PopupEntries = {
      'replace-with-transaction': { label: 'Transaction' },
      'replace-with-event-subprocess': { label: 'Event Sub-process' },
    };
    const result = runEntries(eventSubProcessElement(), entries);

    assert.equal(Object.hasOwn(result, 'replace-with-transaction'), true);
    assert.equal(Object.hasOwn(result, 'replace-with-event-subprocess'), true);
  });
});
