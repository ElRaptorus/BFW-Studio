import type { Bifrost } from '#bifrost/Bifrost';
import { parseOpenInNewTabUrl } from '#bifrost/common/OpenInNewTabUrl';
import type { EditorDocumentRendererProps } from '#bifrost/contracts/EditorTypes';
import { EVENT_DATA_UPDATED } from '#bifrost/contracts/internal/EditorEvents';
import type { FormAction, FormFieldDefinition } from '#modules/bpmn-editor/BpmnElementTypes';

import { useCallback, useEffect, useMemo, useState } from 'react';

import BpmnDocumentModel from '../BpmnDocumentModel';
import { FormBuilderEditorMediator } from './FormBuilderEditorMediator';
import type { FormBuilderSelection } from './FormBuilderEditorMediator';

export type FormBuilderState = {
  loading: boolean;
  bifrost: Bifrost | null;
  fragmentId: string;
  fragmentName: string;
  parentDocumentLabel: string;
  fields: FormFieldDefinition[];
  actions: FormAction[];
  selectedFieldId: string | null;
  selectedActionId: string | null;
  setFields: (fields: FormFieldDefinition[]) => void;
  setActions: (actions: FormAction[]) => void;
  selectField: (fieldId: string | null) => void;
  selectAction: (actionId: string | null) => void;
  navigateToParent: () => void;
};

export function useBpmnFormBuilderState(props: EditorDocumentRendererProps): FormBuilderState {
  const bifrost = props.studio as Bifrost;
  const [loading, setLoading] = useState(true);
  const [fields, setFields] = useState<FormFieldDefinition[]>([]);
  const [actions, setActions] = useState<FormAction[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [fragmentName, setFragmentName] = useState<string>('');
  const [parentDocumentLabel, setParentDocumentLabel] = useState<string>('');
  const [model, setModel] = useState<BpmnDocumentModel | null>(null);

  const parsedUri = useMemo(() => parseOpenInNewTabUrl(props.editorDocument.uri), [props.editorDocument.uri]);
  const parentUri = parsedUri.parentUri;
  const fragmentId = parsedUri.fragmentId;

  useEffect(() => {
    let mounted = true;
    let subscription: { dispose(): void } | null = null;

    const parentEditorDocument = bifrost.editors.getEditorDocumentByUri(parentUri);
    if (parentEditorDocument == null) {
      queueMicrotask(() => {
        if (mounted) {
          setLoading(false);
        }
      });
      return undefined;
    }

    bifrost.editors
      .getEditorDocumentModel<BpmnDocumentModel>(parentEditorDocument, BpmnDocumentModel as any)
      .then((loadedModel: BpmnDocumentModel) => {
        if (!mounted) {
          return;
        }

        setParentDocumentLabel(parentEditorDocument.label ?? '');
        setModel(loadedModel);

        const readFromModel = (): void => {
          const currentFields = loadedModel.elements.getFormFieldDefinitions(fragmentId);
          const currentActions = loadedModel.elements.getFormActions(fragmentId);
          const element = loadedModel.elements.getById(fragmentId);
          setFragmentName(element?.name ?? fragmentId);
          setFields(currentFields);
          setActions(currentActions);
        };

        readFromModel();
        setLoading(false);

        subscription = loadedModel.on(EVENT_DATA_UPDATED, () => {
          if (mounted) {
            readFromModel();
          }
        });
      });

    return () => {
      mounted = false;
      if (subscription != null) {
        subscription.dispose();
      }
    };
  }, [bifrost, parentUri, fragmentId]);

  const commitFields = useCallback(
    (newFields: FormFieldDefinition[]) => {
      if (model == null) {
        return;
      }
      setFields(newFields);
      model.elements.setFormFieldDefinitions(fragmentId, newFields);
    },
    [model, fragmentId],
  );

  const commitActions = useCallback(
    (newActions: FormAction[]) => {
      if (model == null) {
        return;
      }
      setActions(newActions);
      model.elements.setFormActions(fragmentId, newActions);
    },
    [model, fragmentId],
  );

  const selectField = useCallback((fieldId: string | null) => {
    setSelectedFieldId(fieldId);
    setSelectedActionId(null);
  }, []);

  const selectAction = useCallback((actionId: string | null) => {
    setSelectedActionId(actionId);
    setSelectedFieldId(null);
  }, []);

  const navigateToParent = useCallback(() => {
    const parentEditorDocument = bifrost.editors.getEditorDocumentByUri(parentUri);
    if (parentEditorDocument != null) {
      bifrost.editors.focusOrOpenEditorDocument(parentEditorDocument);
    }
  }, [bifrost, parentUri]);

  useEffect(() => {
    let selection: FormBuilderSelection;
    if (selectedFieldId != null) {
      selection = { type: 'field', fieldId: selectedFieldId };
    } else if (selectedActionId != null) {
      selection = { type: 'action', actionId: selectedActionId };
    } else {
      selection = { type: 'none' };
    }

    FormBuilderEditorMediator.setSnapshot({
      fields,
      actions,
      selection,
      fragmentId,
      fragmentName,
      setFields: commitFields,
      setActions: commitActions,
      selectField,
      selectAction,
    });

    bifrost.panes.requestPaneLayoutUpdate();

    return () => {
      FormBuilderEditorMediator.setSnapshot(null);
    };
  }, [
    bifrost,
    fields,
    actions,
    selectedFieldId,
    selectedActionId,
    fragmentId,
    fragmentName,
    commitFields,
    commitActions,
    selectField,
    selectAction,
  ]);

  return {
    loading,
    bifrost,
    fragmentId,
    fragmentName,
    parentDocumentLabel,
    fields,
    actions,
    selectedFieldId,
    selectedActionId,
    setFields: commitFields,
    setActions: commitActions,
    selectField,
    selectAction,
    navigateToParent,
  };
}
