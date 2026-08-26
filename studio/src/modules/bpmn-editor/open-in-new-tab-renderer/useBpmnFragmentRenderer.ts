import type { Bifrost } from '#bifrost/Bifrost';
import type { AbstractSubscription } from '#bifrost/common/AbstractEmitter';
import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import { parseOpenInNewTabUrl } from '#bifrost/common/OpenInNewTabUrl';
import type { EditorDocument, EditorDocumentRendererProps } from '#bifrost/contracts/EditorTypes';
import { EVENT_DATA_UPDATED } from '#bifrost/contracts/internal/EditorEvents';

import { useEffect, useRef, useState } from 'react';

import type { FeelEditorVariable } from '@evil/bifrost_fw_sdk';

import BpmnDocumentModel from '../BpmnDocumentModel';

export type FragmentEditorRef = {
  getCurrentValue(): string | undefined;
};

export type BpmnFragmentRendererConfig = {
  label: string;
  language: 'feel' | string;
  editorHtmlId?: string;
  editorHtmlAttributes?: Record<string, boolean>;
  linkProps?: Record<string, any>;
};

type BpmnFragmentRendererState = {
  loading: boolean;
  fragmentId: string;
  fragmentName: string | null;
  fragmentValue: string | null;
  feelVariables: FeelEditorVariable[] | null;
  parentEditorDocument: EditorDocument;
  bpmnDocumentModel: BpmnDocumentModel | null;
};

type GetFragmentValueFn = (model: BpmnDocumentModel, fragmentId: string) => string;
type SetFragmentValueFn = (model: BpmnDocumentModel, fragmentId: string, value: string) => void;

export function useBpmnFragmentRenderer(
  props: EditorDocumentRendererProps,
  config: BpmnFragmentRendererConfig,
  getFragmentValue: GetFragmentValueFn,
  setFragmentValue: SetFragmentValueFn,
): BpmnFragmentRendererState & {
  bifrost: Bifrost;
  handleChange: (value: string) => void;
} {
  const bifrost = props.studio;
  const bpmnDocumentModelRef = useRef<BpmnDocumentModel | null>(null);

  const parsedFragmentUri = parseOpenInNewTabUrl(props.editorDocument.uri);
  const parentUri = parsedFragmentUri.parentUri;
  const fragmentId = parsedFragmentUri.fragmentId;

  const parentEditorDocument = bifrost.editors.getEditorDocumentByUri(parentUri);
  if (parentEditorDocument == null) {
    throw new Error(`Could not get EditorDocument for uri: ${parentUri}`);
  }

  const [loading, setLoading] = useState(true);
  const [fragmentName, setFragmentName] = useState<string | null>(null);
  const [fragmentValue, setFragmentValue_] = useState<string | null>(null);
  const [feelVariables, setFeelVariables] = useState<FeelEditorVariable[] | null>(null);
  const [bpmnDocumentModel, setBpmnDocumentModel] = useState<BpmnDocumentModel | null>(null);

  const getFragmentValueRef = useRef(getFragmentValue);
  const setFragmentValueRef = useRef(setFragmentValue);
  const latestValueRef = useRef<string | null>(null);
  useEffect(() => {
    getFragmentValueRef.current = getFragmentValue;
    setFragmentValueRef.current = setFragmentValue;
  });

  function handleChange(value: string): void {
    latestValueRef.current = value;
    const model = bpmnDocumentModelRef.current;
    assertNotNull(model, 'bpmnDocumentModel');
    setFragmentValueRef.current(model, fragmentId, value);
    model.selection.updateSelectionIfIsCurrentlySelected(fragmentId, fragmentId);
  }

  const isFeelEditor = config.language === 'feel';

  useEffect(() => {
    let subscriptionRef: AbstractSubscription | null = null;
    let mounted = true;

    function onParentDataUpdated(): void {
      if (!mounted) {
        return;
      }
      const model = bpmnDocumentModelRef.current;
      if (model == null) {
        return;
      }
      setLoading(false);
      setFragmentValue_(getFragmentValueRef.current(model, fragmentId));
    }

    async function onDocumentModelPresentAndMounted(model: BpmnDocumentModel): Promise<void> {
      const element = model.elements.getById(fragmentId);

      if (isFeelEditor) {
        const variables = await bifrost.commands.executeCommand<Promise<FeelEditorVariable[]>>(
          'bpmn.feel.getExpressionContext',
          [parentEditorDocument, fragmentId],
        );
        if (mounted) {
          setFragmentName(element?.name ?? null);
          setFeelVariables(variables);
        }
      } else if (mounted) {
        setFragmentName(element?.name ?? null);
      }

      onParentDataUpdated();
    }

    bifrost.editors
      .getEditorDocumentModel<BpmnDocumentModel>(parentEditorDocument, BpmnDocumentModel)
      .then((model: BpmnDocumentModel) => {
        if (!mounted) {
          return;
        }
        bpmnDocumentModelRef.current = model;
        setBpmnDocumentModel(model);

        model.onceInteractive(() => onParentDataUpdated());
        onDocumentModelPresentAndMounted(model);

        subscriptionRef = model.on(EVENT_DATA_UPDATED, () => onParentDataUpdated());
      });

    return () => {
      mounted = false;

      if (subscriptionRef != null) {
        subscriptionRef.dispose();
      }

      if (latestValueRef.current != null && bpmnDocumentModelRef.current != null) {
        setFragmentValueRef.current(bpmnDocumentModelRef.current, fragmentId, latestValueRef.current);
      }
    };
  }, [bifrost.commands, bifrost.editors, config, fragmentId, isFeelEditor, parentEditorDocument]);

  return {
    loading,
    fragmentId,
    fragmentName,
    fragmentValue,
    feelVariables,
    parentEditorDocument,
    bpmnDocumentModel,
    bifrost,
    handleChange,
  };
}
