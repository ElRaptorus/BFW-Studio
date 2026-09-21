import { BpmnModdle } from 'bpmn-moddle';

import bfwPlatformModdleDescriptor from '../bpmn-js/moddle/bfw-platform.json';

/**
 * BPMN moddle stack aligned with {@link BpmnViewerWithSync} so diffing and XML parsing
 * see the bfw platform extension element tree.
 */
export function createBpmnModdleForDiff(): InstanceType<typeof BpmnModdle> {
  return new BpmnModdle({ bfw: bfwPlatformModdleDescriptor });
}

export async function parseBpmnDefinitionsFromXml(xml: string): Promise<any> {
  const moddle = createBpmnModdleForDiff();
  const { rootElement } = await moddle.fromXML(xml);
  return rootElement;
}
