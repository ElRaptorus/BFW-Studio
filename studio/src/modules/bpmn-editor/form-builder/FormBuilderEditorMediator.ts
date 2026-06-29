import type { FormAction, FormFieldDefinition } from '@evil/bifrost_fw_sdk/types/bpmn/BpmnElementTypes';

export type FormBuilderSelection =
  { type: 'field'; fieldId: string } | { type: 'action'; actionId: string } | { type: 'none' };

export type FormBuilderEditorSnapshot = {
  fields: FormFieldDefinition[];
  actions: FormAction[];
  selection: FormBuilderSelection;
  fragmentId: string;
  fragmentName: string;
  setFields: (fields: FormFieldDefinition[]) => void;
  setActions: (actions: FormAction[]) => void;
  selectField: (fieldId: string | null) => void;
  selectAction: (actionId: string | null) => void;
};

type Listener = () => void;

class FormBuilderEditorMediatorInstance {
  private snapshot: FormBuilderEditorSnapshot | null = null;
  private listeners: Set<Listener> = new Set();

  getSnapshot(): FormBuilderEditorSnapshot | null {
    return this.snapshot;
  }

  setSnapshot(snapshot: FormBuilderEditorSnapshot | null): void {
    this.snapshot = snapshot;
    this.notify();
  }

  subscribe(listener: Listener): { dispose(): void } {
    this.listeners.add(listener);
    return {
      dispose: () => {
        this.listeners.delete(listener);
      },
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const FormBuilderEditorMediator = new FormBuilderEditorMediatorInstance();
