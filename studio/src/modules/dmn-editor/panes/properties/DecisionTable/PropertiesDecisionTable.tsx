import type { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';

import React, { useCallback, useState } from 'react';

import type { SelectOption } from '@evil/bifrost_fw_sdk';
import { PaneProperty } from '@evil/bifrost_fw_sdk';

import type DmnDocumentModel from '../../../DmnDocumentModel';
import { DMN_AGGREGATIONS, DMN_HIT_POLICIES, type DmnAggregation, type DmnHitPolicy } from '../../../DmnElementTypes';
import { getActiveViewElementKey, getDmnModel, shouldBeDisplayedForDmnViewType } from '../../PropertiesPaneFunctions';

export const paneProvider: PaneProvider = {
  getPaneTitle,
  shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent,
};

function getPaneTitle(): string {
  return 'Decision Table';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel): boolean {
  return shouldBeDisplayedForDmnViewType(editorDocument, editorDocumentModel, 'decisionTable');
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="dmn/decision-tables" />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const model = getDmnModel(props.editorDocumentModel);
  if (!model || !model.isReadyForInteraction()) {
    return null;
  }

  return <DecisionTableProperties key={getActiveViewElementKey(model)} {...props} />;
}

const HIT_POLICY_OPTIONS: SelectOption[] = DMN_HIT_POLICIES.map((policy) => ({ value: policy, label: policy }));

const AGGREGATION_OPTIONS: SelectOption[] = [
  { value: '', label: '(none — list collect)' },
  ...DMN_AGGREGATIONS.filter((aggregation) => aggregation !== '').map((aggregation) => ({
    value: aggregation,
    label: aggregation,
  })),
];

function findOption(options: SelectOption[], value: string): SelectOption | undefined {
  return options.find((option) => option.value === value);
}

function DecisionTableProperties(props: PaneComponentProps): React.JSX.Element | null {
  const model = props.editorDocumentModel as DmnDocumentModel;
  const decisionTable = model.elements.getActiveViewDecisionTable();

  const [currentHitPolicy, setCurrentHitPolicy] = useState<DmnHitPolicy>(
    (decisionTable?.hitPolicy as DmnHitPolicy) ?? 'UNIQUE',
  );

  const changeHitPolicy = useCallback(
    (selected: any): void => {
      const value = (selected?.value ?? selected) as DmnHitPolicy;
      model.elements.setExpressionViewProperty('hitPolicy', value);
      if (value !== 'COLLECT') {
        model.elements.setExpressionViewProperty('aggregation', undefined);
      }
      setCurrentHitPolicy(value);
    },
    [model],
  );

  const changeAggregation = useCallback(
    (selected: any): void => {
      const value = selected?.value ?? selected;
      model.elements.setExpressionViewProperty('aggregation', value === '' ? undefined : value);
    },
    [model],
  );

  if (!decisionTable) {
    return null;
  }

  const aggregation: DmnAggregation = decisionTable.aggregation ?? '';
  const inputCount = model.elements.getDecisionTableInputs(decisionTable).length;
  const outputCount = model.elements.getDecisionTableOutputs(decisionTable).length;
  const ruleCount = model.elements.getDecisionTableRuleCount(decisionTable);

  return (
    <PaneBody>
      <PaneProperty
        label="Hit Policy"
        type="select"
        value={findOption(HIT_POLICY_OPTIONS, currentHitPolicy)}
        options={HIT_POLICY_OPTIONS}
        onChange={changeHitPolicy}
        htmlId="dmn-dt-hit-policy"
      />
      {currentHitPolicy === 'COLLECT' && (
        <div data-test--dmn-dt-aggregation={true}>
          <PaneProperty
            label="Aggregation"
            type="select"
            value={findOption(AGGREGATION_OPTIONS, aggregation)}
            options={AGGREGATION_OPTIONS}
            onChange={changeAggregation}
            htmlId="dmn-dt-aggregation"
          />
        </div>
      )}
      <PaneProperty
        label="Inputs"
        type="text"
        value={String(inputCount)}
        disabled={true}
        htmlAttributes={{ 'data-test--dmn-dt-input-count': true }}
      />
      <PaneProperty
        label="Outputs"
        type="text"
        value={String(outputCount)}
        disabled={true}
        htmlAttributes={{ 'data-test--dmn-dt-output-count': true }}
      />
      <PaneProperty
        label="Rules"
        type="text"
        value={String(ruleCount)}
        disabled={true}
        htmlAttributes={{ 'data-test--dmn-dt-rule-count': true }}
      />
    </PaneBody>
  );
}
