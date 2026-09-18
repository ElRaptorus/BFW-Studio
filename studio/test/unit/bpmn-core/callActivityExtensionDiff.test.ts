import { describe, expect, it } from 'vitest';

import { parseBpmnDefinitionsFromXml } from '../../../src/modules/bpmn-core/diff/bpmnModdleForDiff';
import {
  collectCallActivityExtensionsByElementId,
  diffCallActivityExtensionMaps,
} from '../../../src/modules/bpmn-core/diff/callActivityExtensionDiff';
import {
  buildChangeSummary,
  getCallActivityExtensionChangesForElement,
} from '../../../src/modules/bpmn-core/diff/changeSummaryBuilder';

function callActivityXml(options: { calledProcessVersion?: string; startEventId?: string }): string {
  const extensions: string[] = [];
  if (options.calledProcessVersion != null) {
    extensions.push(`<evil:calledProcessVersion>${options.calledProcessVersion}</evil:calledProcessVersion>`);
  }
  if (options.startEventId != null) {
    extensions.push(`<evil:startEventId>${options.startEventId}</evil:startEventId>`);
  }
  const extensionBlock =
    extensions.length > 0 ? `<bpmn:extensionElements>${extensions.join('')}</bpmn:extensionElements>` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:evil="https://evilengine.dev/schema/bpmn" id="Definitions_1" targetNamespace="https://evilengine.dev/schema/bpmn">
  <bpmn:process id="P" isExecutable="true">
    <bpmn:callActivity id="CA_1" name="Fulfill" calledElement="Child">${extensionBlock}</bpmn:callActivity>
  </bpmn:process>
</bpmn:definitions>`;
}

describe('callActivityExtensionDiff', () => {
  it('diffs Called Process Version between two diagrams as a named attribute change', async () => {
    const beforeDefinitions = await parseBpmnDefinitionsFromXml(callActivityXml({ calledProcessVersion: '1.0.0' }));
    const afterDefinitions = await parseBpmnDefinitionsFromXml(callActivityXml({ calledProcessVersion: '2.0.0' }));

    const deltas = diffCallActivityExtensionMaps(
      collectCallActivityExtensionsByElementId(beforeDefinitions),
      collectCallActivityExtensionsByElementId(afterDefinitions),
    );

    expect(deltas).toHaveLength(1);
    expect(deltas[0]?.elementId).toBe('CA_1');
    expect(deltas[0]?.changes).toEqual([
      {
        propertyName: 'calledProcessVersion',
        oldValue: '1.0.0',
        newValue: '2.0.0',
        kind: 'changed',
      },
    ]);

    const summary = buildChangeSummary(
      {
        _changed: {
          CA_1: {
            model: { id: 'CA_1', $type: 'bpmn:CallActivity', name: 'Fulfill' },
            attrs: { extensionElements: { oldValue: {}, newValue: {} } },
          },
        },
      },
      { callActivityExtensions: deltas },
    );

    expect(getCallActivityExtensionChangesForElement(summary, 'CA_1')).toEqual([
      { attribute: 'Called Process Version', oldValue: '1.0.0', newValue: '2.0.0' },
    ]);
    expect(summary.modified[0]?.attributeChanges.some((change) => change.attribute === 'Extension Elements')).toBe(
      false,
    );
  });

  it('treats whitespace-only pins as absent', async () => {
    const beforeDefinitions = await parseBpmnDefinitionsFromXml(callActivityXml({ calledProcessVersion: '   ' }));
    const afterDefinitions = await parseBpmnDefinitionsFromXml(callActivityXml({ calledProcessVersion: '1.2.0' }));

    const deltas = diffCallActivityExtensionMaps(
      collectCallActivityExtensionsByElementId(beforeDefinitions),
      collectCallActivityExtensionsByElementId(afterDefinitions),
    );

    expect(deltas[0]?.changes).toEqual([
      {
        propertyName: 'calledProcessVersion',
        oldValue: undefined,
        newValue: '1.2.0',
        kind: 'added',
      },
    ]);
  });
});
