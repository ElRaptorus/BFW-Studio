/**
 * Minimal diagram-js / bpmn-js shape typing for debugger selection mappers.
 * Replaces legacy `IShape` / `IProcessRef` from the removed engine-core SDK.
 */
export interface BpmnProcessRef {
  id?: string;
  name?: string;
}

export interface BpmnBusinessObject {
  id?: string;
  name?: string;
  documentation?: { text?: string }[];
  processRef?: BpmnProcessRef;
}

export interface BpmnDiagramShape {
  id: string;
  type: string;
  businessObject: BpmnBusinessObject;
}
