import type { FlowNode, SelectableElement } from './SelectableElement';

export function assertIsFlowNode(
  flowNode: SelectableElement,
): asserts flowNode is FlowNode & { flowNodeModel: FlowNode['flowNodeModel'] } {
  if (flowNode.type !== 'FlowNode') {
    throw new Error('Expected a FlowNode.');
  }
}
