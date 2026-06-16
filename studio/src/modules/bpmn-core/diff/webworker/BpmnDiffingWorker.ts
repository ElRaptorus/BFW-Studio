import { diff } from 'bpmn-js-differ';

import { createBpmnModdleForDiff } from '../bpmnModdleForDiff';

self.onmessage = (event: any) => {
  const message = event.data.__message;
  const messageId = event.data.__messageId;

  switch (message.methodName) {
    case 'diff': {
      const args = [messageId, ...message.methodArgs] as any;
      return execDiff.apply(self, args);
    }
    default:
      throw new Error(`Could not find method '${message.methodName}' on 'Symbol Indexer Worker'`);
  }
};

async function execDiff(messageId: string, xmlBefore: string, xmlAfter: string): Promise<any> {
  try {
    const definitionsBefore = await getDefinitionsFromXml(xmlBefore);
    const definitionsAfter = await getDefinitionsFromXml(xmlAfter);

    const changes = diff(definitionsBefore, definitionsAfter);
    const convertedChanges = JSON.parse(JSON.stringify(changes));

    self.postMessage({ __message: { success: true, ...convertedChanges }, __messageId: messageId });
  } catch (error) {
    console.warn(error);
    self.postMessage({ __message: { success: true }, __messageId: messageId });
  }
}

async function getDefinitionsFromXml(xml: string): Promise<any> {
  const moddle = createBpmnModdleForDiff();
  try {
    const { rootElement: definitions } = await moddle.fromXML(xml);
    return Promise.resolve(definitions);
  } catch (error) {
    return Promise.reject(error);
  }
}
