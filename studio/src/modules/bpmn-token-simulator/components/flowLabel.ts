export function getFlowLabel(flow: any): string {
  if (flow.businessObject?.name) {
    return flow.businessObject.name;
  }
  if (flow.target?.businessObject?.name) {
    return `→ ${flow.target.businessObject.name}`;
  }
  return `→ ${flow.target?.id ?? 'unknown'}`;
}
