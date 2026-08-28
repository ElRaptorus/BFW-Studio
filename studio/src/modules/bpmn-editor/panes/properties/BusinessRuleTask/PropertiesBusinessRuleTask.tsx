import type { Bifrost } from '#bifrost/Bifrost';
import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Checkbox } from '#components/Checkbox';
import { FeelExpressionHint } from '#components/FeelExpressionHint';
import { OpenInNewTabButton } from '#components/OpenInNewTabButton';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';
import type BpmnDocumentModel from '#modules/bpmn-editor/BpmnDocumentModel';
import { BpmnElementType } from '#modules/bpmn-editor/BpmnElementTypes';
import type { ProjectDmnDecision, ProjectDmnModel } from '#modules/dmn-editor/initializers/initializeDmnCommands';

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  FeelEditor,
  type FeelEditorVariable,
  PaneProperty,
  type SelectOption,
  type Suggestion,
} from '@evil/bifrost_fw_sdk';

import { assertBpmnElementIsBusinessRuleTask } from '../../BpmnElementTypeAssertionFunctions';
import {
  getBpmnSelectionForPropertiesPane,
  getKeyForPropertiesPane,
  shouldBeDisplayedForBpmnElementOfType,
} from '../../PropertiesPaneFunctions';
import { JumpToSymbolInSolutionLink } from '../../components/JumpToSymbolInSolutionLink';

const BUSINESS_RULE_TASK_HELP_ID = 'bpmn/properties/business_rule_task';

const implementationOptions: SelectOption[] = [
  { label: 'FEEL Expression', dataTestOptionValue: 'feel', value: { implementation: 'feel' } },
  { label: 'DMN Decision', dataTestOptionValue: 'dmn', value: { implementation: 'dmn' } },
];

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Business Rule Task';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id={BUSINESS_RULE_TASK_HELP_ID} />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  return shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.BusinessRuleTask);
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const selection = getBpmnSelectionForPropertiesPane(props);
  if (selection == null) {
    return null;
  }
  return <PropertiesBusinessRuleTask key={getKeyForPropertiesPane(selection)} {...props} />;
}

function PropertiesBusinessRuleTask(props: PaneComponentProps): React.JSX.Element {
  const bpmnDocumentModel: BpmnDocumentModel | null = props.editorDocumentModel;
  assertNotNull(bpmnDocumentModel, 'bpmnDocumentModel');

  const element = bpmnDocumentModel.selection.getOnlyElementOrNull();
  assertBpmnElementIsBusinessRuleTask(element);

  const [feelVariables, setFeelVariables] = useState<FeelEditorVariable[]>([]);
  const { editorDocument } = props;
  const { commands } = props.studio;

  useEffect(() => {
    commands
      .executeCommand<Promise<FeelEditorVariable[]>>('bpmn.feel.getExpressionContext', [editorDocument])
      .then(setFeelVariables);
  }, [editorDocument, commands]);

  const currentImplementation = element.implementation ?? '';
  const initialImplementationOption = implementationOptions.find((option) => {
    return option.value.implementation === currentImplementation;
  });

  const updateImplementation = (newValue: SelectOption): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'businessRule', {
      command: 'updateImplementation',
      newImplementation: newValue.value.implementation,
    });
  };

  const updateFeelScript = (script: string): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'businessRule', {
      command: 'updateFeelScript',
      newScript: script,
    });
  };

  const updateDecisionRef = (newDecisionRef: string): void => {
    const currentElementId = element.decisionElementId;

    if (newDecisionRef.trim() === '') {
      bpmnDocumentModel.elements.setElementProperty(element.id, 'businessRule', {
        command: 'updateDmnConfig',
        newDecisionRef: '',
        newDecisionElementId: '',
      });
      return;
    }

    bpmnDocumentModel.elements.setElementProperty(element.id, 'businessRule', {
      command: 'updateDmnConfig',
      newDecisionRef: newDecisionRef,
    });

    if (!currentElementId || !props.studio.commands.isRegistered('dmn.project.getAllDecisionsForDmnModel')) {
      return;
    }

    void (async () => {
      const validDecisions = await props.studio.commands.executeCommand<ProjectDmnDecision[]>(
        'dmn.project.getAllDecisionsForDmnModel',
        [newDecisionRef],
      );

      if (!validDecisions.some((decision) => decision.decisionId === currentElementId)) {
        bpmnDocumentModel.elements.setElementProperty(element.id, 'businessRule', {
          command: 'updateDmnConfig',
          newDecisionElementId: '',
        });
      }
    })();
  };

  const updateDecisionElementId = (decisionElementId: string): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'businessRule', {
      command: 'updateDmnConfig',
      newDecisionElementId: decisionElementId,
    });
  };

  const getDecisionRefSuggestions = useCallback(async (): Promise<Suggestion[]> => {
    if (!props.studio.commands.isRegistered('dmn.project.getAllReachableDmnModels')) {
      return [];
    }
    const models = await props.studio.commands.executeCommand<ProjectDmnModel[]>(
      'dmn.project.getAllReachableDmnModels',
      [],
    );
    return models.map((model) => ({
      label: model.definitionsId,
      sublabel: `${model.name} — ${model.filename}`,
      value: model.definitionsId,
    }));
  }, [props.studio]);

  const getDecisionElementIdSuggestions = useCallback(async (): Promise<Suggestion[]> => {
    const currentRef = element.decisionRef;
    if (!currentRef || !props.studio.commands.isRegistered('dmn.project.getAllDecisionsForDmnModel')) {
      return [];
    }
    const decisions = await props.studio.commands.executeCommand<ProjectDmnDecision[]>(
      'dmn.project.getAllDecisionsForDmnModel',
      [currentRef],
    );
    return decisions.map((decision) => ({
      label: decision.decisionId,
      sublabel: decision.name !== decision.decisionId ? decision.name : undefined,
      value: decision.decisionId,
    }));
  }, [element.decisionRef, props.studio]);

  const decisionRefSuggestions = useMemo(() => getDecisionRefSuggestions(), [getDecisionRefSuggestions]);
  const decisionElementIdSuggestions = useMemo(
    () => getDecisionElementIdSuggestions(),
    [getDecisionElementIdSuggestions],
  );

  const updateResultVariable = (resultVariable: string): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'businessRule', {
      command: 'updateDmnConfig',
      newResultVariable: resultVariable,
    });
  };

  const traceUnmatchedRules = element.traceUnmatchedRules ?? false;

  const changeTraceUnmatchedRules = (event: React.ChangeEvent<HTMLInputElement>): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'businessRule', {
      command: 'updateDmnConfig',
      newTraceUnmatchedRules: event.target.checked,
    });
  };

  return (
    <PaneBody>
      <PaneProperty
        key={`element_business_rule_task_impl_${currentImplementation}`}
        htmlId="business-rule-task-implementation-property"
        label="Implementation"
        type="select"
        options={implementationOptions}
        value={initialImplementationOption}
        onChange={(newValue: SelectOption) => updateImplementation(newValue)}
      />

      {element.implementation === 'feel' && (
        <div className="form-group">
          <label className="d-block" style={{ width: '100%' }}>
            FEEL Script
            <span className="float-right">
              <FeelExpressionHint studio={props.studio} />
              <OpenInNewTabButton
                studio={props.studio}
                type="bpmn.script"
                parentUri={editorDocument.uri}
                fragmentId={element.id}
                id="business-rule-task-open-script-tab"
              />
            </span>
          </label>
          <FeelEditor
            htmlId="business-rule-task-script-property"
            size="tall"
            fontSize={12}
            initialValue={element.script ?? ''}
            onChange={(script: string) => updateFeelScript(script)}
            variables={feelVariables}
          />
        </div>
      )}

      {element.implementation === 'dmn' && (
        <>
          <PaneProperty
            htmlId="business-rule-task-decision-ref-property"
            label={
              <DecisionRefLinkWithLabel
                decisionRef={element.decisionRef ?? ''}
                decisionElementId={element.decisionElementId ?? ''}
                studio={props.studio}
              />
            }
            type="text-with-suggestions"
            placeholder="Type or select a DMN model ID..."
            value={element.decisionRef ?? ''}
            onCommit={(newValue: any) => updateDecisionRef(newValue?.value ?? newValue ?? '')}
            suggestions={decisionRefSuggestions}
            isClearable={true}
          />
          <React.Fragment key={`element_decision_ref_${element.decisionRef ?? ''}`}>
            <PaneProperty
              htmlId="business-rule-task-decision-element-id-property"
              label="Decision Element ID"
              type="text-with-suggestions"
              placeholder="Type or select a decision ID..."
              value={element.decisionElementId ?? ''}
              onCommit={(newValue: any) => updateDecisionElementId(newValue?.value ?? newValue ?? '')}
              suggestions={decisionElementIdSuggestions}
              isClearable={true}
            />
            <PaneProperty
              htmlId="business-rule-task-result-variable-property"
              label="Result Variable"
              type="text"
              value={element.resultVariable ?? ''}
              onCommit={(resultVariable: string) => updateResultVariable(resultVariable)}
              htmlAttributes={{ 'data-test--business-rule-task-result-variable-input': true }}
            />
            <div className="form-group">
              <Checkbox
                htmlId="business-rule-task-trace-unmatched-rules-checkbox"
                key={traceUnmatchedRules.toString()}
                checked={traceUnmatchedRules}
                onChange={changeTraceUnmatchedRules}
                label="Trace Unmatched Rules"
              />
            </div>
          </React.Fragment>
        </>
      )}
    </PaneBody>
  );
}

function DecisionRefLinkWithLabel(props: {
  decisionRef: string;
  decisionElementId: string;
  studio: Bifrost;
}): React.JSX.Element {
  const { decisionRef, decisionElementId, studio } = props;

  const getSymbolPromise = useMemo(() => {
    if (!decisionRef.trim()) {
      return Promise.resolve(null);
    }

    return (async () => {
      if (decisionElementId.trim()) {
        const decisionSymbols = await studio.symbolIndex.getAll({
          type: 'dmn:Decision',
          id: decisionElementId,
          definitionId: decisionRef,
        });
        if (decisionSymbols.length > 0) {
          return decisionSymbols[0];
        }
      }

      const definitionsSymbols = await studio.symbolIndex.getAll({
        type: 'dmn:Definitions',
        id: decisionRef,
      });
      return definitionsSymbols[0] ?? null;
    })();
  }, [decisionRef, decisionElementId, studio]);

  if (!decisionRef.trim()) {
    return <>Decision Reference</>;
  }

  return (
    <>
      Decision Reference <JumpToSymbolInSolutionLink studio={studio} promise={getSymbolPromise} />
    </>
  );
}
