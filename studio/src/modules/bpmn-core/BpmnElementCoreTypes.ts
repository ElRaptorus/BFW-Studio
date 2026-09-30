/**
 * Element types the bpmn-core module needs itself. `bpmn-editor/BpmnElementTypes.ts`
 * re-exports them, so bpmn-core never imports from bpmn-editor.
 */

export type BpmnElementColor = {
  label?: string;
  backgroundColor?: string;
  borderColor?: string;
};

export enum BpmnTimerType {
  Cycle = 'timeCycle',
  Date = 'timeDate',
  Duration = 'timeDuration',
}

export type BpmnElementCustomProperty = {
  readonly name: string;
  readonly value: string;
  /** Stable React list identity from the live moddle object. Not serialized to BPMN. */
  readonly rowId?: string;
};
