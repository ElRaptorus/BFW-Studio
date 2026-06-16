import { DmnModdle } from 'dmn-moddle';

export function createDmnModdleForDiff(): InstanceType<typeof DmnModdle> {
  return new DmnModdle();
}

export async function parseDmnDefinitionsFromXml(xml: string): Promise<any> {
  const moddle = createDmnModdleForDiff();
  const { rootElement } = await moddle.fromXML(xml);
  return rootElement;
}
