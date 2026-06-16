declare module 'bpmn-js-differ' {
  export interface DiffChanges {
    _added: Record<string, unknown>;
    _removed: Record<string, unknown>;
    _changed: Record<string, unknown>;
    _layoutChanged: Record<string, unknown>;
  }

  export class ChangeHandler {
    _added: Record<string, unknown>;
    _removed: Record<string, unknown>;
    _changed: Record<string, { model: unknown; attrs: Record<string, unknown> }>;
    _layoutChanged: Record<string, unknown>;
  }

  export class Differ {
    diff(a: unknown, b: unknown, handler?: ChangeHandler): ChangeHandler;
  }

  export function diff(a: unknown, b: unknown, handler?: ChangeHandler): ChangeHandler;
}
