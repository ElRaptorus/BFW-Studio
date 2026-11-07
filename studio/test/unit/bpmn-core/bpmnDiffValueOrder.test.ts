import { diff } from 'bpmn-js-differ';
import { describe, expect, it } from 'vitest';

import { createBpmnModdleForDiff } from '../../../src/modules/bpmn-core/diff/bpmnModdleForDiff';
import { buildChangeSummary, type RawDiffResult } from '../../../src/modules/bpmn-core/diff/changeSummaryBuilder';

function taskXml(nameAttribute?: string): string {
  const nameAttributeFragment = nameAttribute != null ? ` name="${nameAttribute}"` : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="Definitions_1" targetNamespace="https://bifrostforge.world/schema/bpmn">
  <bpmn:process id="P" isExecutable="true">
    <bpmn:task id="Task_1"${nameAttributeFragment} />
  </bpmn:process>
</bpmn:definitions>`;
}

async function buildSummaryFromXmlPair(beforeXml: string, afterXml: string) {
  const moddle = createBpmnModdleForDiff();
  const { rootElement: definitionsBefore } = await moddle.fromXML(beforeXml);
  const { rootElement: definitionsAfter } = await moddle.fromXML(afterXml);
  const rawDiff = JSON.parse(JSON.stringify(diff(definitionsBefore, definitionsAfter))) as RawDiffResult;
  return buildChangeSummary(rawDiff);
}

function nameAttributeChange(summary: Awaited<ReturnType<typeof buildSummaryFromXmlPair>>) {
  return summary.modified[0]?.attributeChanges.find((change) => change.attribute === 'Element Name');
}

describe('bpmn-js-differ attribute oldValue / newValue order', () => {
  it('reports a changed property with before in oldValue and after in newValue', async () => {
    const summary = await buildSummaryFromXmlPair(taskXml('Before'), taskXml('After'));
    expect(summary.modified).toHaveLength(1);
    expect(nameAttributeChange(summary)).toEqual({
      attribute: 'Element Name',
      oldValue: 'Before',
      newValue: 'After',
    });
  });

  it('reports a removed property with the removed value in oldValue and undefined in newValue', async () => {
    const summary = await buildSummaryFromXmlPair(taskXml('Before'), taskXml());
    expect(nameAttributeChange(summary)).toEqual({
      attribute: 'Element Name',
      oldValue: 'Before',
      newValue: undefined,
    });
  });

  it('reports an added property with undefined in oldValue and the new value in newValue', async () => {
    const summary = await buildSummaryFromXmlPair(taskXml(), taskXml('After'));
    expect(nameAttributeChange(summary)).toEqual({
      attribute: 'Element Name',
      oldValue: undefined,
      newValue: 'After',
    });
  });
});
