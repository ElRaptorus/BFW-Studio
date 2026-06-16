import * as assert from 'node:assert';
import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from 'vitest';

import type { StudioAgentDmnExtension } from '../../StudioAgentDmnExtension';
import { createAndStartStudioAgentDmnExtension } from '../../StudioAgentDmnExtension';

const ASSERT_VISIBLE_TIMEOUT = 30000;

const DEFINITIONS_PANE = '[data-test--pane="dmn/panes/properties/PropertiesDefinitions"]';
const DECISION_PANE = '[data-test--pane="dmn/panes/properties/PropertiesDecision"]';
const INPUT_DATA_PANE = '[data-test--pane="dmn/panes/properties/PropertiesInputData"]';
const BKM_PANE = '[data-test--pane="dmn/panes/properties/PropertiesBKM"]';
const KNOWLEDGE_SOURCE_PANE = '[data-test--pane="dmn/panes/properties/PropertiesKnowledgeSource"]';
const REQUIREMENTS_PANE = '[data-test--pane="dmn/panes/properties/PropertiesRequirements"]';

const DOCUMENTATION_PANE = 'dmn/panes/properties/PropertiesDocumentation';

const DECISION_TABLE_PANE = 'dmn/panes/properties/PropertiesDecisionTable';
const TABLE_INPUTS_PANE = 'dmn/panes/properties/PropertiesTableInputs';
const TABLE_OUTPUTS_PANE = 'dmn/panes/properties/PropertiesTableOutputs';
const LITERAL_EXPRESSION_PANE = 'dmn/panes/properties/PropertiesLiteralExpression';
const BOXED_EXPRESSION_PANE = 'dmn/panes/properties/PropertiesBoxedExpression';
const ITEM_DEFINITIONS_PANE = 'dmn/panes/properties/PropertiesItemDefinitions';
const IMPORTS_PANE = 'dmn/panes/properties/PropertiesImports';
const VALIDATION_PANE = 'dmn/panes/properties/PropertiesValidation';

describe('dmn/elements', { timeout: 40_000 }, () => {
  let studioAgent: StudioAgentDmnExtension;

  beforeAll(async () => {
    const context = { testName: 'setup', testFile: __filename };
    studioAgent = await createAndStartStudioAgentDmnExtension(context);
    await studioAgent.openFixturesDirectoryAsSolution('test-solution-dmn');
    await studioAgent.maximize();
  });

  beforeEach(({ task }) => {
    studioAgent.updateTestContext({ testName: task.name, testFile: __filename });
  });

  afterEach(async ({ task }) => {
    studioAgent.updateTestContext({
      testName: task.name,
      testFile: __filename,
      state: task.result?.state === 'fail' ? 'failed' : 'passed',
    });
    await studioAgent.recordErrors();
    await studioAgent.closeOpenEditors('dmn');
  });

  afterAll(async () => {
    await studioAgent?.stop();
  });

  // ─── Definitions Pane (no selection) ─────────────────────────────────

  it('dmn/elements/definitions: should show Definitions pane when canvas is clicked (no selection)', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.selectDmnElementByIdAndWaitForElement('Decision_Discount', DECISION_PANE, ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOnDrdCanvas();

    await studioAgent.assertPaneVisible('dmn/panes/properties/PropertiesDefinitions');
    await studioAgent.assertPaneNotVisible('dmn/panes/properties/PropertiesDecision');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/elements/definitions: should display correct Definitions name and ID', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.clickOnDrdCanvas();

    await studioAgent.assertVisible(DEFINITIONS_PANE, ASSERT_VISIBLE_TIMEOUT);

    const name = await studioAgent.getDmnPropertyValue('data-test--dmn-definitions-name');
    assert.strictEqual(name, 'Kitchen Sink DMN');

    const id = await studioAgent.getDmnPropertyValue('data-test--dmn-definitions-id');
    assert.strictEqual(id, 'KitchenSink_Definitions');

    const namespace = await studioAgent.getDmnPropertyValue('data-test--dmn-definitions-namespace');
    assert.strictEqual(namespace, 'https://evilengine.dev/test/kitchen-sink');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/elements/definitions: should update Definitions name', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.clickOnDrdCanvas();
    await studioAgent.assertVisible(DEFINITIONS_PANE, ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.setDmnPropertyValue('data-test--dmn-definitions-name', 'Renamed Definitions');

    await studioAgent.selectDmnElementByIdAndWaitForElement('Decision_Discount');
    await studioAgent.clickOnDrdCanvas();
    await studioAgent.assertVisible(DEFINITIONS_PANE, ASSERT_VISIBLE_TIMEOUT);

    const name = await studioAgent.getDmnPropertyValue('data-test--dmn-definitions-name');
    assert.strictEqual(name, 'Renamed Definitions');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/elements/definitions: should show element count summary', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.clickOnDrdCanvas();
    await studioAgent.assertVisible(DEFINITIONS_PANE, ASSERT_VISIBLE_TIMEOUT);

    const summary = await studioAgent.getDmnPropertyText('data-test--dmn-definitions-summary');
    assert.ok(summary.includes('2 Decisions'), `Expected summary to include "2 Decisions", got: "${summary}"`);
    assert.ok(summary.includes('2 Inputs'), `Expected summary to include "2 Inputs", got: "${summary}"`);
    assert.ok(summary.includes('2 BKMs'), `Expected summary to include "2 BKMs", got: "${summary}"`);
    assert.ok(
      summary.includes('1 Knowledge Sources'),
      `Expected summary to include "1 Knowledge Sources", got: "${summary}"`,
    );

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  // ─── Decision Properties Pane ────────────────────────────────────────

  it('dmn/elements/decision: should show Decision pane when a Decision is selected', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.clickOnDrdCanvas();

    await studioAgent.selectDmnElementByIdAndWaitForElement('Decision_Discount', DECISION_PANE, ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.assertPaneVisible('dmn/panes/properties/PropertiesDecision');
    await studioAgent.assertPaneNotVisible('dmn/panes/properties/PropertiesDefinitions');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/elements/decision: should display correct Decision properties', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.clickOnDrdCanvas();

    await studioAgent.selectDmnElementByIdAndWaitForElement('Decision_Discount', DECISION_PANE, ASSERT_VISIBLE_TIMEOUT);

    const name = await studioAgent.getDmnPropertyValue('data-test--dmn-decision-name');
    assert.strictEqual(name, 'Discount');

    const id = await studioAgent.getDmnPropertyValue('data-test--dmn-decision-id');
    assert.strictEqual(id, 'Decision_Discount');

    const variableName = await studioAgent.getDmnPropertyValue('data-test--dmn-decision-variable-name');
    assert.strictEqual(variableName, 'Discount');

    const variableType = await studioAgent.getDmnPropertyValue('data-test--dmn-decision-variable-type');
    assert.strictEqual(variableType, 'number');

    const expressionType = await studioAgent.getDmnPropertyText('data-test--dmn-decision-expression-type');
    assert.strictEqual(expressionType, 'Decision Table');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/elements/decision: should update Decision name and persist across re-selection', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.clickOnDrdCanvas();

    await studioAgent.selectDmnElementByIdAndWaitForElement('Decision_Discount', DECISION_PANE, ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.setDmnPropertyValue('data-test--dmn-decision-name', 'RenamedDiscount');

    await studioAgent.selectDmnElementByIdAndWaitForElement(
      'InputData_CustomerAge',
      INPUT_DATA_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.selectDmnElementByIdAndWaitForElement('Decision_Discount', DECISION_PANE, ASSERT_VISIBLE_TIMEOUT);

    const name = await studioAgent.getDmnPropertyValue('data-test--dmn-decision-name');
    assert.strictEqual(name, 'RenamedDiscount');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/elements/decision: should show literal expression type for FinalPrice', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.clickOnDrdCanvas();

    await studioAgent.selectDmnElementByIdAndWaitForElement(
      'Decision_FinalPrice',
      DECISION_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    const expressionType = await studioAgent.getDmnPropertyText('data-test--dmn-decision-expression-type');
    assert.strictEqual(expressionType, 'Literal Expression');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/elements/decision: should update output variable name', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.clickOnDrdCanvas();

    await studioAgent.selectDmnElementByIdAndWaitForElement('Decision_Discount', DECISION_PANE, ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.setDmnPropertyValue('data-test--dmn-decision-variable-name', 'DiscountRate');

    await studioAgent.clickOnDrdCanvas();
    await studioAgent.selectDmnElementByIdAndWaitForElement('Decision_Discount', DECISION_PANE, ASSERT_VISIBLE_TIMEOUT);

    const variableName = await studioAgent.getDmnPropertyValue('data-test--dmn-decision-variable-name');
    assert.strictEqual(variableName, 'DiscountRate');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  // ─── InputData Properties Pane ───────────────────────────────────────

  it('dmn/elements/inputdata: should show InputData pane when an InputData is selected', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.clickOnDrdCanvas();

    await studioAgent.selectDmnElementByIdAndWaitForElement(
      'InputData_CustomerAge',
      INPUT_DATA_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.assertPaneVisible('dmn/panes/properties/PropertiesInputData');
    await studioAgent.assertPaneNotVisible('dmn/panes/properties/PropertiesDecision');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/elements/inputdata: should display correct InputData properties', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.clickOnDrdCanvas();

    await studioAgent.selectDmnElementByIdAndWaitForElement(
      'InputData_CustomerAge',
      INPUT_DATA_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    const name = await studioAgent.getDmnPropertyValue('data-test--dmn-inputdata-name');
    assert.strictEqual(name, 'Customer Age');

    const id = await studioAgent.getDmnPropertyValue('data-test--dmn-inputdata-id');
    assert.strictEqual(id, 'InputData_CustomerAge');

    const variableName = await studioAgent.getDmnPropertyValue('data-test--dmn-inputdata-variable-name');
    assert.strictEqual(variableName, 'CustomerAge');

    const variableType = await studioAgent.getDmnPropertyValue('data-test--dmn-inputdata-variable-type');
    assert.strictEqual(variableType, 'number');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/elements/inputdata: should update InputData name and persist', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.clickOnDrdCanvas();

    await studioAgent.selectDmnElementByIdAndWaitForElement(
      'InputData_CustomerAge',
      INPUT_DATA_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.setDmnPropertyValue('data-test--dmn-inputdata-name', 'Buyer Age');

    await studioAgent.selectDmnElementByIdAndWaitForElement('Decision_Discount');
    await studioAgent.selectDmnElementByIdAndWaitForElement(
      'InputData_CustomerAge',
      INPUT_DATA_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    const name = await studioAgent.getDmnPropertyValue('data-test--dmn-inputdata-name');
    assert.strictEqual(name, 'Buyer Age');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/elements/inputdata: should update variable type', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.clickOnDrdCanvas();

    await studioAgent.selectDmnElementByIdAndWaitForElement(
      'InputData_OrderTotal',
      INPUT_DATA_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.setDmnPropertyValue('data-test--dmn-inputdata-variable-type', 'string');

    await studioAgent.clickOnDrdCanvas();
    await studioAgent.selectDmnElementByIdAndWaitForElement(
      'InputData_OrderTotal',
      INPUT_DATA_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    const variableType = await studioAgent.getDmnPropertyValue('data-test--dmn-inputdata-variable-type');
    assert.strictEqual(variableType, 'string');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  // ─── BKM Properties Pane ─────────────────────────────────────────────

  it('dmn/elements/bkm: should show BKM pane when a BKM is selected', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.clickOnDrdCanvas();

    await studioAgent.selectDmnElementByIdAndWaitForElement('BKM_PricingFormula', BKM_PANE, ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.assertPaneVisible('dmn/panes/properties/PropertiesBKM');
    await studioAgent.assertPaneNotVisible('dmn/panes/properties/PropertiesDecision');
    await studioAgent.assertPaneNotVisible('dmn/panes/properties/PropertiesDefinitions');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/elements/bkm: should display correct BKM properties', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.clickOnDrdCanvas();

    await studioAgent.selectDmnElementByIdAndWaitForElement('BKM_PricingFormula', BKM_PANE, ASSERT_VISIBLE_TIMEOUT);

    const name = await studioAgent.getDmnPropertyValue('data-test--dmn-bkm-name');
    assert.strictEqual(name, 'Pricing Formula');

    const id = await studioAgent.getDmnPropertyValue('data-test--dmn-bkm-id');
    assert.strictEqual(id, 'BKM_PricingFormula');

    const variableName = await studioAgent.getDmnPropertyValue('data-test--dmn-bkm-variable-name');
    assert.strictEqual(variableName, 'PricingFormula');

    const variableType = await studioAgent.getDmnPropertyValue('data-test--dmn-bkm-variable-type');
    assert.strictEqual(variableType, 'number');

    const logicKind = await studioAgent.getDmnPropertyText('data-test--dmn-bkm-logic-kind');
    assert.strictEqual(logicKind, 'FEEL');

    const formalParameters = await studioAgent.getDmnPropertyText('data-test--dmn-bkm-formal-parameters');
    assert.ok(
      formalParameters.includes('basePrice'),
      `Expected formal parameters to include "basePrice", got: "${formalParameters}"`,
    );
    assert.ok(
      formalParameters.includes('discountRate'),
      `Expected formal parameters to include "discountRate", got: "${formalParameters}"`,
    );

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/elements/bkm: should update BKM name and persist', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.clickOnDrdCanvas();

    await studioAgent.selectDmnElementByIdAndWaitForElement('BKM_PricingFormula', BKM_PANE, ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.setDmnPropertyValue('data-test--dmn-bkm-name', 'Updated Pricing');

    await studioAgent.clickOnDrdCanvas();
    await studioAgent.selectDmnElementByIdAndWaitForElement('BKM_PricingFormula', BKM_PANE, ASSERT_VISIBLE_TIMEOUT);

    const name = await studioAgent.getDmnPropertyValue('data-test--dmn-bkm-name');
    assert.strictEqual(name, 'Updated Pricing');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  // ─── KnowledgeSource Properties Pane ─────────────────────────────────

  it('dmn/elements/knowledge-source: should show KnowledgeSource pane when a KS is selected', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.clickOnDrdCanvas();

    await studioAgent.selectDmnElementByIdAndWaitForElement(
      'KS_Regulations',
      KNOWLEDGE_SOURCE_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.assertPaneVisible('dmn/panes/properties/PropertiesKnowledgeSource');
    await studioAgent.assertPaneNotVisible('dmn/panes/properties/PropertiesDecision');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/elements/knowledge-source: should display correct KnowledgeSource properties', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.clickOnDrdCanvas();

    await studioAgent.selectDmnElementByIdAndWaitForElement(
      'KS_Regulations',
      KNOWLEDGE_SOURCE_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    const name = await studioAgent.getDmnPropertyValue('data-test--dmn-knowledge-source-name');
    assert.strictEqual(name, 'Pricing Regulations');

    const id = await studioAgent.getDmnPropertyValue('data-test--dmn-knowledge-source-id');
    assert.strictEqual(id, 'KS_Regulations');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/elements/knowledge-source: should update KnowledgeSource name and persist', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.clickOnDrdCanvas();

    await studioAgent.selectDmnElementByIdAndWaitForElement(
      'KS_Regulations',
      KNOWLEDGE_SOURCE_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.setDmnPropertyValue('data-test--dmn-knowledge-source-name', 'Updated Regulations');

    await studioAgent.clickOnDrdCanvas();
    await studioAgent.selectDmnElementByIdAndWaitForElement(
      'KS_Regulations',
      KNOWLEDGE_SOURCE_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    const name = await studioAgent.getDmnPropertyValue('data-test--dmn-knowledge-source-name');
    assert.strictEqual(name, 'Updated Regulations');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  // ─── Requirements Pane ───────────────────────────────────────────────

  it('dmn/elements/requirements: should show Requirements pane when a Decision with requirements is selected', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.clickOnDrdCanvas();

    await studioAgent.selectDmnElementByIdAndWaitForElement(
      'Decision_Discount',
      REQUIREMENTS_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.assertPaneVisible('dmn/panes/properties/PropertiesRequirements');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/elements/requirements: should display information requirements for Discount decision', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.clickOnDrdCanvas();

    await studioAgent.selectDmnElementByIdAndWaitForElement(
      'Decision_Discount',
      REQUIREMENTS_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    const informationRequirements = await studioAgent.getDmnPropertyText('data-test--dmn-info-requirements');
    assert.ok(
      informationRequirements.includes('Customer Age') || informationRequirements.includes('InputData_CustomerAge'),
      `Expected information requirements to reference Customer Age, got: "${informationRequirements}"`,
    );

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/elements/requirements: should display knowledge requirements for FinalPrice decision', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.clickOnDrdCanvas();

    await studioAgent.selectDmnElementByIdAndWaitForElement(
      'Decision_FinalPrice',
      REQUIREMENTS_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    const knowledgeRequirements = await studioAgent.getDmnPropertyText('data-test--dmn-knowledge-requirements');
    assert.ok(
      knowledgeRequirements.includes('Pricing Formula') || knowledgeRequirements.includes('BKM_PricingFormula'),
      `Expected knowledge requirements to reference Pricing Formula, got: "${knowledgeRequirements}"`,
    );

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/elements/requirements: should also show Requirements pane for BKM elements', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.clickOnDrdCanvas();

    await studioAgent.selectDmnElementByIdAndWaitForElement('BKM_PricingFormula', BKM_PANE, ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.assertPaneVisible('dmn/panes/properties/PropertiesRequirements');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/elements/requirements: should NOT show Requirements pane for InputData elements', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.clickOnDrdCanvas();

    await studioAgent.selectDmnElementByIdAndWaitForElement(
      'InputData_CustomerAge',
      INPUT_DATA_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.assertPaneNotVisible('dmn/panes/properties/PropertiesRequirements');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  // ─── Pane Switching on Selection Change ──────────────────────────────

  it('dmn/elements/pane-switching: should switch panes when selection changes between element types', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.selectDmnElementByIdAndWaitForElement('Decision_Discount', DECISION_PANE, ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.assertPaneVisible('dmn/panes/properties/PropertiesDecision');
    await studioAgent.assertPaneNotVisible('dmn/panes/properties/PropertiesInputData');

    await studioAgent.selectDmnElementByIdAndWaitForElement(
      'InputData_CustomerAge',
      INPUT_DATA_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.assertPaneVisible('dmn/panes/properties/PropertiesInputData');
    await studioAgent.assertPaneNotVisible('dmn/panes/properties/PropertiesDecision');

    await studioAgent.selectDmnElementByIdAndWaitForElement('BKM_PricingFormula', BKM_PANE, ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.assertPaneVisible('dmn/panes/properties/PropertiesBKM');
    await studioAgent.assertPaneNotVisible('dmn/panes/properties/PropertiesInputData');

    await studioAgent.selectDmnElementByIdAndWaitForElement(
      'KS_Regulations',
      KNOWLEDGE_SOURCE_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.assertPaneVisible('dmn/panes/properties/PropertiesKnowledgeSource');
    await studioAgent.assertPaneNotVisible('dmn/panes/properties/PropertiesBKM');

    await studioAgent.clickOnDrdCanvas();
    await studioAgent.assertPaneVisible('dmn/panes/properties/PropertiesDefinitions');
    await studioAgent.assertPaneNotVisible('dmn/panes/properties/PropertiesKnowledgeSource');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  // ─── Drill-Down and Navigate Back ────────────────────────────────────

  it('dmn/elements/drilldown: should drill down into a Decision Table and show Back to DRD', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.drillDownIntoDecisionTable('Decision_Discount');

    await studioAgent.assertBackToDrdButtonVisible();

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/elements/drilldown: should hide DRD property panes when drilled into a Decision Table', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.selectDmnElementByIdAndWaitForElement('Decision_Discount', DECISION_PANE, ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.assertPaneVisible('dmn/panes/properties/PropertiesDecision');

    await studioAgent.drillDownIntoDecisionTable('Decision_Discount');

    await studioAgent.assertPaneNotVisible('dmn/panes/properties/PropertiesDecision');
    await studioAgent.assertPaneNotVisible('dmn/panes/properties/PropertiesDefinitions');
    await studioAgent.assertPaneNotVisible('dmn/panes/properties/PropertiesInputData');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/elements/drilldown: should restore DRD panes after navigating back from Decision Table', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.drillDownIntoDecisionTable('Decision_Discount');
    await studioAgent.assertBackToDrdButtonVisible();

    await studioAgent.assertPaneNotVisible('dmn/panes/properties/PropertiesDecision');

    await studioAgent.navigateBackToDrd();

    await studioAgent.assertBackToDrdButtonNotPresent();

    await studioAgent.clickOnDrdCanvas();
    await studioAgent.assertPaneVisible('dmn/panes/properties/PropertiesDefinitions');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/elements/drilldown: should drill into literal expression and back to DRD', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.drillDownIntoDecisionTable('Decision_FinalPrice');
    await studioAgent.assertBackToDrdButtonVisible();

    await studioAgent.navigateBackToDrd();
    await studioAgent.assertBackToDrdButtonNotPresent();

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/elements/drilldown: should switch between views using the view switcher', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.assertViewSwitcherVisible();
    const viewCount = await studioAgent.getViewSwitcherItemCount();
    assert.ok(viewCount >= 3, `Expected at least 3 views (DRD + 2 decisions), got ${viewCount}`);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  // ─── Phase 3: Expression View Panes ──────────────────────────────────

  it('dmn/elements/expression: should show Decision Table pane when drilled into a decision table', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.drillDownIntoDecisionTable('Decision_Discount');
    await studioAgent.waitForPaneVisible(DECISION_TABLE_PANE);

    await studioAgent.assertPaneNotVisible('dmn/panes/properties/PropertiesDecision');
    await studioAgent.assertPaneNotVisible('dmn/panes/properties/PropertiesDefinitions');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/elements/expression: should show Hit Policy in Decision Table pane', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.drillDownIntoDecisionTable('Decision_Discount');
    await studioAgent.waitForPaneVisible(DECISION_TABLE_PANE);

    const inputCount = await studioAgent.getDmnPropertyText('data-test--dmn-dt-input-count');
    assert.strictEqual(inputCount, '2');

    const outputCount = await studioAgent.getDmnPropertyText('data-test--dmn-dt-output-count');
    assert.strictEqual(outputCount, '1');

    const ruleCount = await studioAgent.getDmnPropertyText('data-test--dmn-dt-rule-count');
    assert.strictEqual(ruleCount, '3');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/elements/expression: should show Table Inputs pane when drilled into a decision table', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.drillDownIntoDecisionTable('Decision_Discount');
    await studioAgent.waitForPaneVisible(TABLE_INPUTS_PANE);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/elements/expression: should show Table Outputs pane when drilled into a decision table', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.drillDownIntoDecisionTable('Decision_Discount');
    await studioAgent.waitForPaneVisible(TABLE_OUTPUTS_PANE);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/elements/expression: should show Literal Expression pane when drilled into a literal expression', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.drillDownIntoDecisionTable('Decision_FinalPrice');
    await studioAgent.waitForPaneVisible(LITERAL_EXPRESSION_PANE);

    await studioAgent.assertPaneNotVisible('dmn/panes/properties/PropertiesDecision');
    await studioAgent.assertPaneNotVisible('dmn/panes/properties/PropertiesDefinitions');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/elements/expression: should show expression language and editable FEEL editor in Literal Expression pane', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.drillDownIntoDecisionTable('Decision_FinalPrice');
    await studioAgent.waitForPaneVisible(LITERAL_EXPRESSION_PANE);

    const language = await studioAgent.getDmnPropertyText('data-test--dmn-le-language');
    assert.strictEqual(language, 'FEEL');

    await studioAgent.assertVisible('[data-test--dmn-le-expression-text]', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.assertVisible('[data-test--dmn-le-expression-text] .cm-content', ASSERT_VISIBLE_TIMEOUT);

    const expressionText = await studioAgent.getText('[data-test--dmn-le-expression-text] .cm-content');
    assert.ok(
      expressionText.includes('OrderTotal'),
      `Expected FEEL editor to contain "OrderTotal", got: "${expressionText}"`,
    );

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/elements/expression: should hide expression panes when navigating back to DRD', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.drillDownIntoDecisionTable('Decision_Discount');
    await studioAgent.waitForPaneVisible(DECISION_TABLE_PANE);

    await studioAgent.navigateBackToDrd();

    await studioAgent.waitForPaneNotVisible(DECISION_TABLE_PANE);
    await studioAgent.waitForPaneNotVisible(TABLE_INPUTS_PANE);
    await studioAgent.waitForPaneNotVisible(TABLE_OUTPUTS_PANE);

    await studioAgent.clickOnDrdCanvas();
    await studioAgent.assertPaneVisible('dmn/panes/properties/PropertiesDefinitions');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/elements/expression: should change Hit Policy via dropdown', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.drillDownIntoDecisionTable('Decision_Discount');
    await studioAgent.waitForPaneVisible(DECISION_TABLE_PANE);

    const initialPolicy = await studioAgent.getDmnSelectValue('dmn-dt-hit-policy');
    assert.strictEqual(initialPolicy, 'UNIQUE');

    await studioAgent.selectDmnDropdownOption('dmn-dt-hit-policy', 'COLLECT');

    const updatedPolicy = await studioAgent.getDmnSelectValue('dmn-dt-hit-policy');
    assert.strictEqual(updatedPolicy, 'COLLECT');

    await studioAgent.assertVisible('[data-test--dmn-dt-aggregation]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/elements/expression: should show Boxed Expression pane when drilled into a BKM with context body', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.drillDownIntoDecisionTable('BKM_OrderSummary');
    await studioAgent.waitForPaneVisible(BOXED_EXPRESSION_PANE);

    await studioAgent.assertPaneNotVisible('dmn/panes/properties/PropertiesDecision');
    await studioAgent.assertPaneNotVisible('dmn/panes/properties/PropertiesDefinitions');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/elements/expression: should display context entry count in Boxed Expression pane', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.drillDownIntoDecisionTable('BKM_OrderSummary');
    await studioAgent.waitForPaneVisible(BOXED_EXPRESSION_PANE);

    const expressionType = await studioAgent.getDmnPropertyText('data-test--dmn-be-expression-type');
    assert.strictEqual(expressionType, 'Boxed Context');

    const entryCount = await studioAgent.getDmnPropertyText('data-test--dmn-be-context-entry-count');
    assert.strictEqual(entryCount, '2');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  // ─── Phase 4: Item Definitions Pane ──────────────────────────────────

  it('dmn/elements/item-definitions: should show Item Definitions pane when no element is selected', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.clickOnDrdCanvas();
    await studioAgent.waitForPaneVisible(ITEM_DEFINITIONS_PANE);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/elements/item-definitions: should list item definitions from fixture', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.clickOnDrdCanvas();
    await studioAgent.waitForPaneVisible(ITEM_DEFINITIONS_PANE);

    const firstEntry = await studioAgent.assertVisible(
      '[data-test--dmn-item-definition-entry="tAge"]',
      ASSERT_VISIBLE_TIMEOUT,
    );
    assert.ok(firstEntry, 'Expected tAge item definition entry to be visible');

    const secondEntry = await studioAgent.assertVisible(
      '[data-test--dmn-item-definition-entry="tSummary"]',
      ASSERT_VISIBLE_TIMEOUT,
    );
    assert.ok(secondEntry, 'Expected tSummary item definition entry to be visible');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/elements/item-definitions: should display simple type with typeRef', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.clickOnDrdCanvas();
    await studioAgent.waitForPaneVisible(ITEM_DEFINITIONS_PANE);

    const typeSelector = '[data-test--dmn-item-definition-entry="tAge"] [data-test--dmn-item-definition-type]';
    await studioAgent.assertVisible(typeSelector, ASSERT_VISIBLE_TIMEOUT);

    const tAgeType = await studioAgent.getValue(typeSelector);
    assert.strictEqual(tAgeType, 'number');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/elements/item-definitions: should display composite type with component count', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.clickOnDrdCanvas();
    await studioAgent.waitForPaneVisible(ITEM_DEFINITIONS_PANE);

    await studioAgent.assertVisible('[data-test--dmn-item-definition-entry="tSummary"]', ASSERT_VISIBLE_TIMEOUT);

    const componentsSection = await studioAgent.assertVisible(
      '[data-test--dmn-item-definition-entry="tSummary"] [data-test--dmn-item-definition-components]',
      ASSERT_VISIBLE_TIMEOUT,
    );
    assert.ok(componentsSection, 'Expected tSummary to show components section');

    const componentsText = await studioAgent.getText(
      '[data-test--dmn-item-definition-entry="tSummary"] [data-test--dmn-item-definition-components]',
    );
    assert.ok(componentsText.includes('total'), `Expected components to include "total", got: "${componentsText}"`);
    assert.ok(componentsText.includes('label'), `Expected components to include "label", got: "${componentsText}"`);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/elements/item-definitions: should add a new item definition', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.clickOnDrdCanvas();
    await studioAgent.waitForPaneVisible(ITEM_DEFINITIONS_PANE);

    const initialCount = await studioAgent.getElementCount('[data-test--dmn-item-definition-entry]');
    assert.strictEqual(initialCount, 2, 'Expected 2 initial item definitions');

    await studioAgent.clickOn('[data-test--dmn-item-definitions-add]');
    await studioAgent.pause(300);

    const updatedCount = await studioAgent.getElementCount('[data-test--dmn-item-definition-entry]');
    assert.strictEqual(updatedCount, 3, 'Expected 3 item definitions after adding one');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/elements/item-definitions: should remove an item definition', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.clickOnDrdCanvas();
    await studioAgent.waitForPaneVisible(ITEM_DEFINITIONS_PANE);

    await studioAgent.clickOn('[data-test--dmn-item-definitions-add]');
    await studioAgent.pause(300);

    const countBeforeRemove = await studioAgent.getElementCount('[data-test--dmn-item-definition-entry]');

    const removeButtons = await studioAgent.$$('[data-test--dmn-item-definition-remove]').getElements();
    const lastRemoveButton = removeButtons[removeButtons.length - 1];
    await lastRemoveButton.click();
    await studioAgent.pause(300);

    const countAfterRemove = await studioAgent.getElementCount('[data-test--dmn-item-definition-entry]');
    assert.strictEqual(countAfterRemove, countBeforeRemove - 1, 'Expected one fewer item definition after removal');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/elements/item-definitions: should hide pane when a DRG element is selected', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.clickOnDrdCanvas();
    await studioAgent.waitForPaneVisible(ITEM_DEFINITIONS_PANE);

    await studioAgent.selectDmnElementByIdAndWaitForElement('Decision_Discount', DECISION_PANE, ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.assertPaneNotVisible('dmn/panes/properties/PropertiesItemDefinitions');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  // ─── Phase 4: Imports Pane ──────────────────────────────────────────

  it('dmn/elements/imports: should show Imports pane when no element is selected', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.clickOnDrdCanvas();
    await studioAgent.waitForPaneVisible(IMPORTS_PANE);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/elements/imports: should display import entry content from fixture', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.clickOnDrdCanvas();
    await studioAgent.waitForPaneVisible(IMPORTS_PANE);

    const namespace = await studioAgent.getDmnPropertyValue('data-test--dmn-import-namespace');
    assert.strictEqual(namespace, 'https://evilengine.dev/test/shared');

    const locationUri = await studioAgent.getDmnPropertyValue('data-test--dmn-import-location');
    assert.strictEqual(locationUri, 'shared-decisions.dmn');

    const importType = await studioAgent.getDmnPropertyValue('data-test--dmn-import-type');
    assert.strictEqual(importType, 'https://www.omg.org/spec/DMN/20191111/MODEL/');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/elements/imports: should add a new import', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.clickOnDrdCanvas();
    await studioAgent.waitForPaneVisible(IMPORTS_PANE);

    const initialCount = await studioAgent.getElementCount('[data-test--dmn-import-entry]');
    assert.strictEqual(initialCount, 1, 'Expected 1 initial import');

    await studioAgent.clickOn('[data-test--dmn-imports-add]');
    await studioAgent.pause(300);

    const updatedCount = await studioAgent.getElementCount('[data-test--dmn-import-entry]');
    assert.strictEqual(updatedCount, 2, 'Expected 2 imports after adding one');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/elements/imports: should remove an import', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.clickOnDrdCanvas();
    await studioAgent.waitForPaneVisible(IMPORTS_PANE);

    await studioAgent.clickOn('[data-test--dmn-imports-add]');
    await studioAgent.pause(300);

    const countBeforeRemove = await studioAgent.getElementCount('[data-test--dmn-import-entry]');

    const removeButtons = await studioAgent.$$('[data-test--dmn-import-remove]').getElements();
    const lastRemoveButton = removeButtons[removeButtons.length - 1];
    await lastRemoveButton.click();
    await studioAgent.pause(300);

    const countAfterRemove = await studioAgent.getElementCount('[data-test--dmn-import-entry]');
    assert.strictEqual(countAfterRemove, countBeforeRemove - 1, 'Expected one fewer import after removal');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/elements/imports: should NOT show Imports pane for model without imports', async () => {
    await studioAgent.jumpToFileInSolution('simple-decision.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.clickOnDrdCanvas();

    await studioAgent.assertPaneNotVisible('dmn/panes/properties/PropertiesImports');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  // ─── Phase 4: Validation Pane ───────────────────────────────────────

  it('dmn/elements/validation: should show Validation pane for DMN document', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.waitForPaneVisible(VALIDATION_PANE);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/elements/validation: should show "no issues" for a clean model', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.waitForPaneVisible(VALIDATION_PANE);
    await studioAgent.pause(800);

    const cleanMessage = await studioAgent.assertVisible('[data-test--dmn-validation-clean]', ASSERT_VISIBLE_TIMEOUT);
    assert.ok(cleanMessage, 'Expected "no validation issues" message for clean model');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/elements/validation: should show violations for model with errors', async () => {
    await studioAgent.jumpToFileInSolution('validation-errors.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.waitForPaneVisible(VALIDATION_PANE);
    await studioAgent.pause(800);

    await studioAgent.assertVisible('[data-test--dmn-validation-summary]', ASSERT_VISIBLE_TIMEOUT);

    const summary = await studioAgent.getText('[data-test--dmn-validation-summary]');
    assert.ok(summary.includes('error'), `Expected summary to mention errors, got: "${summary}"`);

    await studioAgent.assertVisible('[data-test--dmn-validation-list]', ASSERT_VISIBLE_TIMEOUT);

    const violationCount = await studioAgent.getElementCount('[data-test--dmn-validation-violation]');
    assert.ok(violationCount >= 1, `Expected at least 1 violation, got ${violationCount}`);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/elements/validation: should group violations by element', async () => {
    await studioAgent.jumpToFileInSolution('validation-errors.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.waitForPaneVisible(VALIDATION_PANE);
    await studioAgent.pause(800);

    const groupCount = await studioAgent.getElementCount('[data-test--dmn-validation-group]');
    assert.ok(groupCount >= 1, `Expected at least 1 violation group, got ${groupCount}`);

    const groupText = await studioAgent.getText('[data-test--dmn-validation-group="Missing Expression"]');
    assert.ok(
      groupText.includes('expression'),
      `Expected group for "Missing Expression" to mention expression, got: "${groupText}"`,
    );

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/elements/validation: should navigate to element when clicking a violation', async () => {
    await studioAgent.jumpToFileInSolution('validation-errors.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.waitForPaneVisible(VALIDATION_PANE);
    await studioAgent.pause(800);

    await studioAgent.assertVisible('[data-test--dmn-validation-violation]', ASSERT_VISIBLE_TIMEOUT);

    const violationElements = await studioAgent.$$('[data-test--dmn-validation-violation]');
    await violationElements[0].click();
    await studioAgent.pause(500);

    await studioAgent.assertPaneVisible('dmn/panes/properties/PropertiesDecision');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/elements/validation: should show validation badge count in pane header', async () => {
    await studioAgent.jumpToFileInSolution('validation-errors.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.waitForPaneVisible(VALIDATION_PANE);
    await studioAgent.pause(800);

    const paneSelector = `[data-test--pane="${VALIDATION_PANE}"]`;
    const paneHeaderText = await studioAgent.getText(paneSelector);
    assert.ok(
      /validation\s*\(\d+\)/i.test(paneHeaderText),
      `Expected pane header to include violation count, got: "${paneHeaderText}"`,
    );

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  // ─── Documentation Pane ─────────────────────────────────────────────

  it('dmn/elements/documentation: should show the Documentation pane when a single element is selected', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.selectDmnElementByIdAndWaitForElement('Decision_Discount', DECISION_PANE, ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.waitForPaneVisible(DOCUMENTATION_PANE);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('dmn/elements/documentation: should hide the Documentation pane when nothing is selected', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.clickOnDrdCanvas();
    await studioAgent.pause(500);
    await studioAgent.waitForPaneNotVisible(DOCUMENTATION_PANE);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  // ─── Delete via Keyboard ────────────────────────────────────────────

  it('dmn/elements/delete: should delete a selected element via keyboard', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    const initialIds = (await studioAgent.testDriver.client!.execute(() => {
      const editorDocument = (window as any).bifrost?.editors?.getFocusedEditorDocument?.();
      const model = (window as any).bifrost?.editors?.getEditorDocumentModelSync?.(editorDocument);
      return model?.elements?.getAllIds?.() ?? [];
    })) as string[];

    await studioAgent.selectDmnElementByIdAndWaitForElement(
      'KnowledgeSource_Regulations',
      KNOWLEDGE_SOURCE_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.sendKeyboardInput(['Backspace']);
    await studioAgent.pause(500);

    const afterIds = (await studioAgent.testDriver.client!.execute(() => {
      const editorDocument = (window as any).bifrost?.editors?.getFocusedEditorDocument?.();
      const model = (window as any).bifrost?.editors?.getEditorDocumentModelSync?.(editorDocument);
      return model?.elements?.getAllIds?.() ?? [];
    })) as string[];

    assert.ok(afterIds.length < initialIds.length, 'Expected element count to decrease after deletion');
    assert.ok(!afterIds.includes('KnowledgeSource_Regulations'), 'Deleted element should no longer be in registry');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  // ─── Multiple Selection ─────────────────────────────────────────────

  it('dmn/elements/multi-select: should deselect all and show Definitions pane when clicking canvas after multi-select', async () => {
    await studioAgent.jumpToFileInSolution('kitchen-sink.dmn', 'dmn');
    await studioAgent.waitForInteractiveDmnDocument();

    await studioAgent.selectDmnElementByIdAndWaitForElement('Decision_Discount', DECISION_PANE, ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.clickOnDrdCanvas();
    await studioAgent.pause(500);
    await studioAgent.assertVisible(DEFINITIONS_PANE, ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });
});
