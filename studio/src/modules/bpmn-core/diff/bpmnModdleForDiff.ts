import { BpmnModdle } from 'bpmn-moddle';

import evilPlatformModdleDescriptor from '../bpmn-js/moddle/evil-platform.json';

/**
 * BPMN moddle stack aligned with {@link BpmnViewerWithSync} so diffing and XML parsing
 * see the evil platform extension element tree.
 */
export function createBpmnModdleForDiff(): InstanceType<typeof BpmnModdle> {
  return new BpmnModdle({ evil: evilPlatformModdleDescriptor });
}

export async function parseBpmnDefinitionsFromXml(xml: string): Promise<any> {
  const moddle = createBpmnModdleForDiff();
  const { rootElement } = await moddle.fromXML(xml);
  return rootElement;
}
