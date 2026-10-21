import type { BpmnModelScanRequest, BpmnModelScanResponse } from './parseSolutionBpmnModel';
import { parseSolutionBpmnModel } from './parseSolutionBpmnModel';

self.onmessage = (event: MessageEvent<BpmnModelScanRequest>): void => {
  const response: BpmnModelScanResponse = {
    requestId: event.data.requestId,
    entries: event.data.files.map(parseSolutionBpmnModel),
  };
  self.postMessage(response);
};
