import * as assert from 'node:assert';
import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from 'vitest';

import { OsSpecificKeystroke } from '../../OsSpecificKeystroke';
import type { StudioAgentBpmnExtension } from '../../StudioAgentBpmnExtension';
import { createAndStartStudioAgentBpmnExtension } from '../../StudioAgentBpmnExtension';

const ASSERT_VISIBLE_TIMEOUT = 30000;
const CREATE_NEW_DOCUMENT = OsSpecificKeystroke('cmd-n', 'ctrl-n');

const ELEMENT_INFO_PANE = '[data-test--pane="bpmn/panes/properties/PropertiesElementInfo"]';
const START_EVENT_CONDITION_PANE = '[data-test--conditional-start-event-condition]';
const USER_TASK_FORM_SUMMARY_PANE = '[data-test--pane="bpmn/panes/properties/PropertiesUserTaskFormSummary"]';
const RECEIVE_TASK_PANE = '[data-test--pane="bpmn/panes/properties/PropertiesReceiveTask"]';
const MESSAGE_END_EVENT_PANE = '[data-test--pane="bpmn/panes/properties/PropertiesMessageEndEvent"]';
const SIGNAL_INTERMEDIATE_CATCH_EVENT_PANE =
  '[data-test--pane="bpmn/panes/properties/PropertiesSignalIntermediateCatchEvent"]';
const MESSAGE_INTERMEDIATE_THROW_EVENT_PANE =
  '[data-test--pane="bpmn/panes/properties/PropertiesMessageIntermediateThrowEvent"]';
const SIGNAL_INTERMEDIATE_THROW_EVENT_PANE =
  '[data-test--pane="bpmn/panes/properties/PropertiesSignalIntermediateThrowEvent"]';
const SIGNAL_END_EVENT_PANE = '[data-test--pane="bpmn/panes/properties/PropertiesSignalEndEvent"]';
const ESCALATION_END_EVENT_PANE = '[data-test--pane="bpmn/panes/properties/PropertiesEscalationEndEvent"]';
const ERROR_END_EVENT_PANE = '[data-test--pane="bpmn/panes/properties/PropertiesErrorEndEvent"]';
const ERROR_BOUNDARY_EVENT_PANE = '[data-test--pane="bpmn/panes/properties/PropertiesErrorBoundaryEvent"]';
const SIGNAL_BOUNDARY_EVENT_PANE = '[data-test--pane="bpmn/panes/properties/PropertiesSignalBoundaryEvent"]';
const MESSAGE_BOUNDARY_EVENT_PANE = '[data-test--pane="bpmn/panes/properties/PropertiesMessageBoundaryEvent"]';
const ERROR_START_EVENT_PANE = '[data-test--pane="bpmn/panes/properties/PropertiesErrorStartEvent"]';
const SIGNAL_START_EVENT_PANE = '[data-test--pane="bpmn/panes/properties/PropertiesSignalStartEvent"]';
const TIMER_START_EVENT_PANE = '[data-test--pane="bpmn/panes/properties/PropertiesTimerStartEvent"]';
const CONDITIONAL_FLOW_PANE = '[data-test--pane="bpmn/panes/properties/PropertiesConditionalFlow"]';
const TIMER_INTERMEDIATE_EVENT_PANE = '[data-test--pane="bpmn/panes/properties/PropertiesTimerIntermediateEvent"]';
const SCRIPT_TASK_PANE = '[data-test--pane="bpmn/panes/properties/PropertiesScriptTask"]';
const CALL_ACTIVITY_PANE = '[data-test--pane="bpmn/panes/properties/PropertiesCallActivity"]';
const ESCALATION_START_EVENT_PANE = '[data-test--pane="bpmn/panes/properties/PropertiesEscalationStartEvent"]';
const TEXT_ANNOTATION_PANE = '[data-test--pane="bpmn/panes/properties/PropertiesTextAnnotation"]';
const BUSINESS_RULE_TASK_PANE = '[data-test--pane="bpmn/panes/properties/PropertiesBusinessRuleTask"]';
const ESCALATION_BOUNDARY_EVENT_PANE = '[data-test--pane="bpmn/panes/properties/PropertiesEscalationBoundaryEvent"]';
const ESCALATION_INTERMEDIATE_THROW_EVENT_PANE =
  '[data-test--pane="bpmn/panes/properties/PropertiesEscalationIntermediateThrowEvent"]';
const CONDITIONAL_INTERMEDIATE_CATCH_EVENT_PANE =
  '[data-test--pane="bpmn/panes/properties/PropertiesConditionalIntermediateCatchEvent"]';
const LINK_INTERMEDIATE_CATCH_EVENT_PANE =
  '[data-test--pane="bpmn/panes/properties/PropertiesLinkIntermediateCatchEvent"]';
const LINK_INTERMEDIATE_THROW_EVENT_PANE =
  '[data-test--pane="bpmn/panes/properties/PropertiesLinkIntermediateThrowEvent"]';
const MESSAGE_START_EVENT_PANE = '[data-test--pane="bpmn/panes/properties/PropertiesMessageStartEvent"]';
const TIMER_BOUNDARY_EVENT_PANE = '[data-test--pane="bpmn/panes/properties/PropertiesTimerBoundaryEvent"]';
const SERVICE_TASK_PANE = '[data-test--pane="bpmn/panes/properties/PropertiesServiceTask"]';
const HTTP_TASK_PANE = '[data-test--pane="bpmn/panes/properties/PropertiesHttpTask"]';
const SEND_TASK_PANE = '[data-test--pane="bpmn/panes/properties/PropertiesSendTask"]';
const USER_TASK_PANE = '[data-test--pane="bpmn/panes/properties/PropertiesUserTask"]';
const DATA_OBJECT_PANE = '[data-test--pane="bpmn/panes/properties/PropertiesDataObject"]';
const GATEWAY_OUTGOING_FLOWS_PANE = '[data-test--pane="bpmn/panes/properties/PropertiesGatewayOutgoingFlows"]';
const PARALLEL_MI_SETTINGS_PANE = '[data-test--pane="bpmn/panes/properties/PropertiesParallelMiSettings"]';
const SEQUENTIAL_MI_SETTINGS_PANE = '[data-test--pane="bpmn/panes/properties/PropertiesSequentialMiSettings"]';
const INPUT_COLLECTION_PANE = '[data-test--pane="bpmn/panes/properties/PropertiesInputCollection"]';
const OUTPUT_COLLECTION_PANE = '[data-test--pane="bpmn/panes/properties/PropertiesOutputCollection"]';
const COMPLETION_CONDITION_PANE = '[data-test--pane="bpmn/panes/properties/PropertiesCompletionCondition"]';
const MESSAGE_INTERMEDIATE_CATCH_EVENT_PANE =
  '[data-test--pane="bpmn/panes/properties/PropertiesMessageIntermediateCatchEvent"]';
const LOOP_CONFIGURATION_PANE = '[data-test--pane="bpmn/panes/properties/PropertiesLoop"]';
const AD_HOC_SUBPROCESS_PANE = '[data-test--pane="bpmn/panes/properties/PropertiesAdHocSubprocess"]';

describe('bpmn/elements', () => {
  let studioAgent: StudioAgentBpmnExtension;

  beforeAll(async () => {
    const ctx = { testName: 'setup', testFile: __filename };
    studioAgent = await createAndStartStudioAgentBpmnExtension(ctx);
    await studioAgent.openFixturesDirectoryAsSolution('test-solution-bpmn');
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
    await studioAgent.closeOpenEditors();
  });

  afterAll(async () => {
    await studioAgent?.stop();
  });

  it('bpmn/elements/property-panel/ReceiveTask: should change the selected message name and select it by second task', async () => {
    const newMessageName = 'newMessage';
    const receiveTask1 = 'ReceiveTask_1';
    const receiveTask2 = 'ReceiveTask_2';

    await studioAgent.jumpToFileInSolution('message-autocomplete.bpmn');

    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(receiveTask2);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(receiveTask1, RECEIVE_TASK_PANE, ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.assertVisible('#receive-task-message-property', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clearSuggestionSelect('#receive-task-message-property');
    await studioAgent.clickOn('#receive-task-message-property');
    await studioAgent.sendKeyboardInput([...newMessageName.split('')]);
    await studioAgent.commitSuggestionCreateOption('#receive-task-message-property', newMessageName);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(receiveTask2, RECEIVE_TASK_PANE, ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.assertVisible('#receive-task-message-property', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('#receive-task-message-property');

    await studioAgent.clickOn(`#receive-task-message-property [data-test-option-value="${newMessageName}"]`);

    const selectedMessage = await studioAgent.getSuggestionSelectValue('#receive-task-message-property');

    assert.strictEqual(selectedMessage, newMessageName);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/MessageBoundary: should change the selected message name and select it by second message boundary', async () => {
    const newMessageName = 'new Message';
    const boundaryEvent1 = 'MessageBoundary_1';
    const boundaryEvent2 = 'MessageBoundary_2';

    await studioAgent.jumpToFileInSolution('message-autocomplete.bpmn');

    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(boundaryEvent2);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      boundaryEvent1,
      MESSAGE_BOUNDARY_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.assertVisible('#message-boundary-event-message-property', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clearSuggestionSelect('#message-boundary-event-message-property');
    await studioAgent.clickOn('#message-boundary-event-message-property');
    await studioAgent.sendKeyboardInput([...newMessageName.split('')]);
    await studioAgent.commitSuggestionCreateOption('#message-boundary-event-message-property', newMessageName);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      boundaryEvent2,
      MESSAGE_BOUNDARY_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.assertVisible('#message-boundary-event-message-property', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('#message-boundary-event-message-property');

    await studioAgent.clickOn(`#message-boundary-event-message-property [data-test-option-value="${newMessageName}"]`);

    const selectedMessage = await studioAgent.getSuggestionSelectValue('#message-boundary-event-message-property');

    assert.strictEqual(selectedMessage, newMessageName);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/MessageStartEvent: should change the selected message name of startevent and select it by second startevent', async () => {
    const newMessageName = 'newMessage';
    const startEvent1 = 'StartEvent_1';
    const startEvent2 = 'StartEvent_2';

    await studioAgent.jumpToFileInSolution('message-autocomplete.bpmn');

    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent2);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      startEvent1,
      MESSAGE_START_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.assertVisible('#message-start-event-message-property', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clearSuggestionSelect('#message-start-event-message-property');
    await studioAgent.clickOn('#message-start-event-message-property');
    await studioAgent.sendKeyboardInput([...newMessageName.split('')]);
    await studioAgent.commitSuggestionCreateOption('#message-start-event-message-property', newMessageName);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      startEvent2,
      MESSAGE_START_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.assertVisible('#message-start-event-message-property', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('#message-start-event-message-property');

    await studioAgent.clickOn(`#message-start-event-message-property [data-test-option-value="${newMessageName}"]`);
    const selectedMessage = await studioAgent.getSuggestionSelectValue('#message-start-event-message-property');

    assert.strictEqual(newMessageName, selectedMessage);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/MessageEndEvent: should show input mappings, payload contract, and correlation retrieval expression panes', async () => {
    const messageEndEvent = 'EndEvent_1';

    await studioAgent.jumpToFileInSolution('message-autocomplete.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(messageEndEvent);
    await studioAgent.switchToPaneGroup('scripting');

    await studioAgent.assertPaneVisible('bpmn/panes/properties/PropertiesInputMappings');
    await studioAgent.assertPaneVisible('bpmn/panes/properties/PropertiesPayloadContract');
    await studioAgent.assertPaneVisible('bpmn/panes/properties/PropertiesCorrelationRetrievalExpression');
    await studioAgent.assertPaneNotVisible('bpmn/panes/properties/PropertiesThrowEventPayload');
    await studioAgent.assertPaneNotVisible('bpmn/panes/properties/PropertiesOutputMappings');
    await studioAgent.assertPaneNotVisible('bpmn/panes/properties/PropertiesResultContract');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/MessageEndEvent: should change the selected message name of endevent and select it by second endevent', async () => {
    const newMessageName = 'newMessage';
    const endEvent1 = 'EndEvent_1';
    const endEvent2 = 'EndEvent_2';

    await studioAgent.jumpToFileInSolution('message-autocomplete.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(endEvent2);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(endEvent1, MESSAGE_END_EVENT_PANE, ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.assertVisible('#message-end-event-message-property', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clearSuggestionSelect('#message-end-event-message-property');
    await studioAgent.clickOn('#message-end-event-message-property');
    await studioAgent.sendKeyboardInput([...newMessageName.split('')]);
    await studioAgent.commitSuggestionCreateOption('#message-end-event-message-property', newMessageName);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(endEvent2, MESSAGE_END_EVENT_PANE, ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.assertVisible('#message-end-event-message-property', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('#message-end-event-message-property');

    await studioAgent.clickOn(`#message-end-event-message-property [data-test-option-value="${newMessageName}"]`);
    const selectedMessage = await studioAgent.getSuggestionSelectValue('#message-end-event-message-property');

    assert.strictEqual(newMessageName, selectedMessage);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/MessageIntermediateThrowEvent: should show input mappings, payload contract, and correlation retrieval expression panes', async () => {
    const messageIntermediateThrowEvent = 'IntermediateThrowEvent_1';

    await studioAgent.jumpToFileInSolution('message-autocomplete.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(messageIntermediateThrowEvent);
    await studioAgent.switchToPaneGroup('scripting');

    await studioAgent.assertPaneVisible('bpmn/panes/properties/PropertiesInputMappings');
    await studioAgent.assertPaneVisible('bpmn/panes/properties/PropertiesPayloadContract');
    await studioAgent.assertPaneVisible('bpmn/panes/properties/PropertiesCorrelationRetrievalExpression');
    await studioAgent.assertPaneNotVisible('bpmn/panes/properties/PropertiesThrowEventPayload');
    await studioAgent.assertPaneNotVisible('bpmn/panes/properties/PropertiesOutputMappings');
    await studioAgent.assertPaneNotVisible('bpmn/panes/properties/PropertiesResultContract');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/MessageIntermediateCatchEvent: should show output mappings and result contract panes but not correlation retrieval expression', async () => {
    const intermediateCatchEvent = 'IntermediateCatchEvent_1';

    await studioAgent.jumpToFileInSolution('message-autocomplete.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(intermediateCatchEvent);
    await studioAgent.switchToPaneGroup('scripting');

    await studioAgent.assertPaneVisible('bpmn/panes/properties/PropertiesOutputMappings');
    await studioAgent.assertPaneVisible('bpmn/panes/properties/PropertiesResultContract');
    await studioAgent.assertPaneNotVisible('bpmn/panes/properties/PropertiesCorrelationRetrievalExpression');
    await studioAgent.assertPaneNotVisible('bpmn/panes/properties/PropertiesInputMappings');
    await studioAgent.assertPaneNotVisible('bpmn/panes/properties/PropertiesPayloadContract');
    await studioAgent.assertPaneNotVisible('bpmn/panes/properties/PropertiesThrowEventPayload');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/MessageBoundaryEvent: should show output mappings and result contract panes but not correlation retrieval expression', async () => {
    const boundaryEvent = 'MessageBoundary_1';

    await studioAgent.jumpToFileInSolution('message-autocomplete.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(boundaryEvent);
    await studioAgent.switchToPaneGroup('scripting');

    await studioAgent.assertPaneVisible('bpmn/panes/properties/PropertiesOutputMappings');
    await studioAgent.assertPaneVisible('bpmn/panes/properties/PropertiesResultContract');
    await studioAgent.assertPaneNotVisible('bpmn/panes/properties/PropertiesCorrelationRetrievalExpression');
    await studioAgent.assertPaneNotVisible('bpmn/panes/properties/PropertiesInputMappings');
    await studioAgent.assertPaneNotVisible('bpmn/panes/properties/PropertiesPayloadContract');
    await studioAgent.assertPaneNotVisible('bpmn/panes/properties/PropertiesThrowEventPayload');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/MessageStartEvent: should show result contract but not output mappings or correlation retrieval expression', async () => {
    const startEvent = 'StartEvent_1';

    await studioAgent.jumpToFileInSolution('message-autocomplete.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('scripting');

    await studioAgent.assertPaneVisible('bpmn/panes/properties/PropertiesResultContract');
    await studioAgent.assertPaneNotVisible('bpmn/panes/properties/PropertiesOutputMappings');
    await studioAgent.assertPaneNotVisible('bpmn/panes/properties/PropertiesInputMappings');
    await studioAgent.assertPaneNotVisible('bpmn/panes/properties/PropertiesPayloadContract');
    await studioAgent.assertPaneNotVisible('bpmn/panes/properties/PropertiesThrowEventPayload');
    await studioAgent.assertPaneNotVisible('bpmn/panes/properties/PropertiesCorrelationRetrievalExpression');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/ReceiveTask: should show output mappings and result contract panes but not correlation retrieval expression', async () => {
    const receiveTask = 'ReceiveTask_1';

    await studioAgent.jumpToFileInSolution('message-autocomplete.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(receiveTask);
    await studioAgent.switchToPaneGroup('scripting');

    await studioAgent.assertPaneVisible('bpmn/panes/properties/PropertiesOutputMappings');
    await studioAgent.assertPaneVisible('bpmn/panes/properties/PropertiesResultContract');
    await studioAgent.assertPaneNotVisible('bpmn/panes/properties/PropertiesCorrelationRetrievalExpression');
    await studioAgent.assertPaneNotVisible('bpmn/panes/properties/PropertiesInputMappings');
    await studioAgent.assertPaneNotVisible('bpmn/panes/properties/PropertiesThrowEventPayload');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/SendTask: should show input mappings, payload contract, and correlation retrieval expression panes', async () => {
    const sendTask = 'SendTask_1';

    await studioAgent.jumpToFileInSolution('message-autocomplete.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(sendTask);
    await studioAgent.switchToPaneGroup('scripting');

    await studioAgent.assertPaneVisible('bpmn/panes/properties/PropertiesInputMappings');
    await studioAgent.assertPaneVisible('bpmn/panes/properties/PropertiesPayloadContract');
    await studioAgent.assertPaneVisible('bpmn/panes/properties/PropertiesCorrelationRetrievalExpression');
    await studioAgent.assertPaneNotVisible('bpmn/panes/properties/PropertiesThrowEventPayload');
    await studioAgent.assertPaneNotVisible('bpmn/panes/properties/PropertiesOutputMappings');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/MessageIntermediateThrowEvent: should change the selected message name of an intermediate throw event and select it by second throw event', async () => {
    const newMessageName = 'newMessage';
    const intermediateThrowEvent1 = 'IntermediateThrowEvent_1';
    const intermediateThrowEvent2 = 'IntermediateThrowEvent_2';

    await studioAgent.jumpToFileInSolution('message-autocomplete.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(intermediateThrowEvent2);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      intermediateThrowEvent1,
      MESSAGE_INTERMEDIATE_THROW_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.assertVisible('#message-intermediate-throw-event-message-property', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clearSuggestionSelect('#message-intermediate-throw-event-message-property');
    await studioAgent.clickOn('#message-intermediate-throw-event-message-property');
    await studioAgent.sendKeyboardInput([...newMessageName.split('')]);
    await studioAgent.commitSuggestionCreateOption(
      '#message-intermediate-throw-event-message-property',
      newMessageName,
    );

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      intermediateThrowEvent2,
      MESSAGE_INTERMEDIATE_THROW_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.assertVisible('#message-intermediate-throw-event-message-property', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.clickOn('#message-intermediate-throw-event-message-property');
    await studioAgent.clickOn(
      `#message-intermediate-throw-event-message-property [data-test-option-value="${newMessageName}"]`,
    );
    const selectedMessage = await studioAgent.getSuggestionSelectValue(
      '#message-intermediate-throw-event-message-property',
    );

    assert.strictEqual(newMessageName, selectedMessage);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/SignalBoundary: should change the selected signal name and select it by second signal boundary', async () => {
    const newSignalName = 'new signal';
    const boundaryEvent1 = 'SignalBoundary_1';
    const boundaryEvent2 = 'SignalBoundary_2';

    await studioAgent.jumpToFileInSolution('signal-autocomplete.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(boundaryEvent2);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      boundaryEvent1,
      SIGNAL_BOUNDARY_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.assertVisible('#signal-boundary-event-signal-property', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clearSuggestionSelect('#signal-boundary-event-signal-property');
    await studioAgent.clickOn('#signal-boundary-event-signal-property');
    await studioAgent.sendKeyboardInput([...newSignalName.split('')]);
    await studioAgent.commitSuggestionCreateOption('#signal-boundary-event-signal-property', newSignalName);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      boundaryEvent2,
      SIGNAL_BOUNDARY_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.assertVisible('#signal-boundary-event-signal-property', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.clickOn('#signal-boundary-event-signal-property');
    await studioAgent.clickOn(`#signal-boundary-event-signal-property [data-test-option-value="${newSignalName}"]`);

    const selectedSignal = await studioAgent.getSuggestionSelectValue('#signal-boundary-event-signal-property');

    assert.strictEqual(selectedSignal, newSignalName);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/SignalStartEvent: should change the selected signal name and select it by second signal start event', async () => {
    const newSignalName = 'new signal';
    const startEvent1 = 'SignalStartEvent_1';
    const startEvent2 = 'SignalStartEvent_2';

    await studioAgent.jumpToFileInSolution('signal-autocomplete.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent2);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      startEvent1,
      SIGNAL_START_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.assertVisible('#signal-start-event-signal-property', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clearSuggestionSelect('#signal-start-event-signal-property');
    await studioAgent.clickOn('#signal-start-event-signal-property');
    await studioAgent.sendKeyboardInput([...newSignalName.split('')]);
    await studioAgent.commitSuggestionCreateOption('#signal-start-event-signal-property', newSignalName);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      startEvent2,
      SIGNAL_START_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.assertVisible('#signal-start-event-signal-property', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.clickOn('#signal-start-event-signal-property');
    await studioAgent.clickOn(`#signal-start-event-signal-property [data-test-option-value="${newSignalName}"]`);
    const selectedSignal = await studioAgent.getSuggestionSelectValue('#signal-start-event-signal-property');

    assert.strictEqual(selectedSignal, newSignalName);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/SignalEndEvent: should change the selected signal name and select it by second signal end event', async () => {
    const newSignalName = 'new signal';
    const endEvent1 = 'SignalEndEvent_1';
    const endEvent2 = 'SignalEndEvent_2';

    await studioAgent.jumpToFileInSolution('signal-autocomplete.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(endEvent2);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(endEvent1, SIGNAL_END_EVENT_PANE, ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.assertVisible('#signal-end-event-signal-property', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clearSuggestionSelect('#signal-end-event-signal-property');
    await studioAgent.clickOn('#signal-end-event-signal-property');
    await studioAgent.sendKeyboardInput([...newSignalName.split('')]);
    await studioAgent.commitSuggestionCreateOption('#signal-end-event-signal-property', newSignalName);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(endEvent2, SIGNAL_END_EVENT_PANE, ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.assertVisible('#signal-end-event-signal-property', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.clickOn('#signal-end-event-signal-property');
    await studioAgent.clickOn(`#signal-end-event-signal-property [data-test-option-value="${newSignalName}"]`);
    const selectedSignal = await studioAgent.getSuggestionSelectValue('#signal-end-event-signal-property');

    assert.strictEqual(selectedSignal, newSignalName);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/SignalIntermediateThrowEvent: should change the selected signal name of an intermediate throw event and select it by second throw event', async () => {
    const newSignalName = 'new signal';
    const intermediateThrowEvent1 = 'SignalIntermediateThrowEvent_1';
    const intermediateThrowEvent2 = 'SignalIntermediateThrowEvent_2';

    await studioAgent.jumpToFileInSolution('signal-autocomplete.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(intermediateThrowEvent2);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      intermediateThrowEvent1,
      SIGNAL_INTERMEDIATE_THROW_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.assertVisible('#signal-intermediate-throw-event-signal-property', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clearSuggestionSelect('#signal-intermediate-throw-event-signal-property');
    await studioAgent.clickOn('#signal-intermediate-throw-event-signal-property');
    await studioAgent.sendKeyboardInput([...newSignalName.split('')]);
    await studioAgent.commitSuggestionCreateOption('#signal-intermediate-throw-event-signal-property', newSignalName);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      intermediateThrowEvent2,
      SIGNAL_INTERMEDIATE_THROW_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.assertVisible('#signal-intermediate-throw-event-signal-property', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.clickOn('#signal-intermediate-throw-event-signal-property');
    await studioAgent.clickOn(
      `#signal-intermediate-throw-event-signal-property [data-test-option-value="${newSignalName}"]`,
    );
    const selectedSignal = await studioAgent.getSuggestionSelectValue(
      '#signal-intermediate-throw-event-signal-property',
    );

    assert.strictEqual(selectedSignal, newSignalName);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/SignalIntermediateCatchEvent: should change the selected signal name of an intermediate catch event and select it by second catch event', async () => {
    const newSignalName = 'new signal';
    const intermediateCatchEvent1 = 'SignalIntermediateCatchEvent_1';
    const intermediateCatchEvent2 = 'SignalIntermediateCatchEvent_2';

    await studioAgent.jumpToFileInSolution('signal-autocomplete.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(intermediateCatchEvent2);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      intermediateCatchEvent1,
      SIGNAL_INTERMEDIATE_CATCH_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.assertVisible('#signal-intermediate-catch-event-signal-property', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clearSuggestionSelect('#signal-intermediate-catch-event-signal-property');
    await studioAgent.clickOn('#signal-intermediate-catch-event-signal-property');
    await studioAgent.sendKeyboardInput([...newSignalName.split('')]);
    await studioAgent.commitSuggestionCreateOption('#signal-intermediate-catch-event-signal-property', newSignalName);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      intermediateCatchEvent2,
      SIGNAL_INTERMEDIATE_CATCH_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.assertVisible('#signal-intermediate-catch-event-signal-property', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.clickOn('#signal-intermediate-catch-event-signal-property');
    await studioAgent.clickOn(
      `#signal-intermediate-catch-event-signal-property [data-test-option-value="${newSignalName}"]`,
    );
    const selectedSignal = await studioAgent.getSuggestionSelectValue(
      '#signal-intermediate-catch-event-signal-property',
    );

    assert.strictEqual(selectedSignal, newSignalName);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/SignalEndEvent: should show input mappings but not payload, example payload, or output mappings', async () => {
    const endEvent = 'SignalEndEvent_1';

    await studioAgent.jumpToFileInSolution('signal-autocomplete.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();
    await studioAgent.selectBpmnElementByIdAndWaitForElement(endEvent);
    await studioAgent.switchToPaneGroup('scripting');

    await studioAgent.assertPaneVisible('bpmn/panes/properties/PropertiesInputMappings');
    await studioAgent.assertPaneNotVisible('bpmn/panes/properties/PropertiesThrowEventPayload');
    await studioAgent.assertPaneNotVisible('bpmn/panes/properties/PropertiesExamplePayload');
    await studioAgent.assertPaneNotVisible('bpmn/panes/properties/PropertiesOutputMappings');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/SignalIntermediateThrowEvent: should show input mappings but not payload, example payload, or output mappings', async () => {
    const throwEvent = 'SignalIntermediateThrowEvent_1';

    await studioAgent.jumpToFileInSolution('signal-autocomplete.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(throwEvent);
    await studioAgent.switchToPaneGroup('scripting');

    await studioAgent.assertPaneVisible('bpmn/panes/properties/PropertiesInputMappings');
    await studioAgent.assertPaneNotVisible('bpmn/panes/properties/PropertiesThrowEventPayload');
    await studioAgent.assertPaneNotVisible('bpmn/panes/properties/PropertiesExamplePayload');
    await studioAgent.assertPaneNotVisible('bpmn/panes/properties/PropertiesOutputMappings');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/SignalIntermediateCatchEvent: should show output mappings but not payload, example payload, or input mappings', async () => {
    const catchEvent = 'SignalIntermediateCatchEvent_1';

    await studioAgent.jumpToFileInSolution('signal-autocomplete.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(catchEvent);
    await studioAgent.switchToPaneGroup('scripting');

    await studioAgent.assertPaneVisible('bpmn/panes/properties/PropertiesOutputMappings');
    await studioAgent.assertPaneNotVisible('bpmn/panes/properties/PropertiesThrowEventPayload');
    await studioAgent.assertPaneNotVisible('bpmn/panes/properties/PropertiesExamplePayload');
    await studioAgent.assertPaneNotVisible('bpmn/panes/properties/PropertiesInputMappings');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/SignalBoundaryEvent: should show output mappings but not payload, example payload, or input mappings', async () => {
    const boundaryEvent = 'SignalBoundary_1';

    await studioAgent.jumpToFileInSolution('signal-autocomplete.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(boundaryEvent);
    await studioAgent.switchToPaneGroup('scripting');

    await studioAgent.assertPaneVisible('bpmn/panes/properties/PropertiesOutputMappings');
    await studioAgent.assertPaneNotVisible('bpmn/panes/properties/PropertiesThrowEventPayload');
    await studioAgent.assertPaneNotVisible('bpmn/panes/properties/PropertiesExamplePayload');
    await studioAgent.assertPaneNotVisible('bpmn/panes/properties/PropertiesInputMappings');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/SignalStartEvent: should not show output mappings, payload, example payload, or input mappings', async () => {
    const startEvent = 'SignalStartEvent_1';

    await studioAgent.jumpToFileInSolution('signal-autocomplete.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('scripting');

    await studioAgent.assertPaneNotVisible('bpmn/panes/properties/PropertiesOutputMappings');
    await studioAgent.assertPaneNotVisible('bpmn/panes/properties/PropertiesThrowEventPayload');
    await studioAgent.assertPaneNotVisible('bpmn/panes/properties/PropertiesExamplePayload');
    await studioAgent.assertPaneNotVisible('bpmn/panes/properties/PropertiesInputMappings');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/EscalationEndEvent: should change an escalation end event name', async () => {
    const escalationEndEvent = 'EndEvent_1';
    const startEvent = 'StartEvent_1';
    const newName = 'new-escalation-name';

    await studioAgent.jumpToFileInSolution('escalation-event.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      escalationEndEvent,
      ESCALATION_END_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.assertVisible('#escalation-end-event-name', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clearSuggestionSelect('#escalation-end-event-name');
    await studioAgent.clickOn('#escalation-end-event-name');
    await studioAgent.sendKeyboardInput([...newName.split('')]);
    await studioAgent.commitSuggestionCreateOption('#escalation-end-event-name', newName);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      escalationEndEvent,
      ESCALATION_END_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    const name = await studioAgent.getSuggestionSelectValue('#escalation-end-event-name');

    assert.strictEqual(name, newName);
    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/EscalationEndEvent: should change an escalation end event code', async () => {
    const escalationEndEvent = 'EndEvent_1';
    const startEvent = 'StartEvent_1';
    const newEscalationCode = 'new-escalation-code';

    await studioAgent.jumpToFileInSolution('escalation-event.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      escalationEndEvent,
      ESCALATION_END_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.assertVisible('#escalation-end-event-code', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('#escalation-end-event-code');
    await studioAgent.sendKeyboardInput([...newEscalationCode.split('')]);
    await studioAgent.commitSuggestionCreateOption('#escalation-end-event-code', newEscalationCode);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      escalationEndEvent,
      ESCALATION_END_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    const code = await studioAgent.getSuggestionSelectValue('#escalation-end-event-code');

    assert.strictEqual(code, newEscalationCode);
    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/ErrorEndEvent: should change the selected error code of an error end event and select it by second error end event', async () => {
    const newErrorCode = 'new error code';
    const errorEndEvent1 = 'ErrorEndEvent_1';
    const errorEndEvent2 = 'ErrorEndEvent_2';

    await studioAgent.jumpToFileInSolution('error-autocomplete.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(errorEndEvent2);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      errorEndEvent1,
      ERROR_END_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.assertVisible('#error-end-event-code-property', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clearSuggestionSelect('#error-end-event-code-property');
    await studioAgent.clickOn('#error-end-event-code-property');
    await studioAgent.sendKeyboardInput([...newErrorCode.split('')]);
    await studioAgent.commitSuggestionCreateOption('#error-end-event-code-property', newErrorCode);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      errorEndEvent2,
      ERROR_END_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.assertVisible('#error-end-event-code-property', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.clickOn('#error-end-event-code-property');
    await studioAgent.clickOn(`#error-end-event-code-property [data-test-option-value="${newErrorCode}"]`);
    const selectedErrorCode = await studioAgent.getSuggestionSelectValue('#error-end-event-code-property');

    assert.strictEqual(selectedErrorCode, newErrorCode);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/ErrorEndEvent: should change the selected error message of an error end event', async () => {
    const newErrorMessage = 'new error message';
    const errorEndEvent1 = 'ErrorEndEvent_1';
    const errorEndEvent2 = 'ErrorEndEvent_2';

    await studioAgent.jumpToFileInSolution('error-autocomplete.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(errorEndEvent2);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      errorEndEvent1,
      ERROR_END_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.assertVisible('#error-end-event-message-property', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clearSuggestionSelect('#error-end-event-message-property');
    await studioAgent.clickOn('#error-end-event-message-property');
    await studioAgent.sendKeyboardInput([...newErrorMessage.split('')]);
    await studioAgent.commitSuggestionCreateOption('#error-end-event-message-property', newErrorMessage);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      errorEndEvent2,
      ERROR_END_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.assertVisible('#error-end-event-message-property', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.clickOn('#error-end-event-message-property');

    await studioAgent.clickOn(`#error-end-event-message-property [data-test-option-value="${newErrorMessage}"]`);
    const selectedErrorMessage = await studioAgent.getSuggestionSelectValue('#error-end-event-message-property');

    assert.strictEqual(selectedErrorMessage, newErrorMessage);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/ErrorBoundaryEvent: should change the selected error code of an error boundary event and select it by second error boundary event', async () => {
    const newErrorCode = 'new error code';
    const errorBoundaryEvent1 = 'ErrorBoundaryEvent_1';
    const errorBoundaryEvent2 = 'ErrorBoundaryEvent_2';

    await studioAgent.jumpToFileInSolution('error-autocomplete.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(errorBoundaryEvent2);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      errorBoundaryEvent1,
      ERROR_BOUNDARY_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.assertVisible('#error-boundary-event-code-property', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clearSuggestionSelect('#error-boundary-event-code-property');
    await studioAgent.clickOn('#error-boundary-event-code-property');
    await studioAgent.sendKeyboardInput([...newErrorCode.split('')]);
    await studioAgent.commitSuggestionCreateOption('#error-boundary-event-code-property', newErrorCode);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      errorBoundaryEvent2,
      ERROR_BOUNDARY_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.clickOn('[data-test--error-boundary-event-specific-error-radio]');
    await studioAgent.assertVisible('#error-boundary-event-code-property', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.clickOn('#error-boundary-event-code-property');

    await studioAgent.clickOn(`#error-boundary-event-code-property [data-test-option-value="${newErrorCode}"]`);
    const selectedErrorCode = await studioAgent.getSuggestionSelectValue('#error-boundary-event-code-property');

    assert.strictEqual(selectedErrorCode, newErrorCode);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/ErrorBoundaryEvent: should change the selected error message of an error boundary event and select it by second error boundary event', async () => {
    const newErrorMessage = 'new error message';
    const errorBoundaryEvent1 = 'ErrorBoundaryEvent_1';
    const errorBoundaryEvent2 = 'ErrorBoundaryEvent_2';

    await studioAgent.jumpToFileInSolution('error-autocomplete.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(errorBoundaryEvent2);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      errorBoundaryEvent1,
      ERROR_BOUNDARY_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.assertVisible('#error-boundary-event-message-property', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clearSuggestionSelect('#error-boundary-event-message-property');
    await studioAgent.clickOn('#error-boundary-event-message-property');
    await studioAgent.sendKeyboardInput([...newErrorMessage.split('')]);
    await studioAgent.commitSuggestionCreateOption('#error-boundary-event-message-property', newErrorMessage);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      errorBoundaryEvent2,
      ERROR_BOUNDARY_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.clickOn('[data-test--error-boundary-event-specific-error-radio]');
    await studioAgent.assertVisible('#error-boundary-event-message-property', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.clickOn('#error-boundary-event-message-property');

    await studioAgent.clickOn(`#error-boundary-event-message-property [data-test-option-value="${newErrorMessage}"]`);
    const selectedErrorMessage = await studioAgent.getSuggestionSelectValue('#error-boundary-event-message-property');

    assert.strictEqual(selectedErrorMessage, newErrorMessage);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/ErrorStartEvent: should change the selected error code of an error start event and select it by second error start event', async () => {
    const newErrorCode = 'new error code';
    const errorStartEvent1 = 'ErrorStartEvent_1';
    const errorStartEvent2 = 'ErrorStartEvent_2';

    await studioAgent.jumpToFileInSolution('error-autocomplete.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(errorStartEvent2);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      errorStartEvent1,
      ERROR_START_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.assertVisible('#error-start-event-code-property', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clearSuggestionSelect('#error-start-event-code-property');
    await studioAgent.clickOn('#error-start-event-code-property');
    await studioAgent.sendKeyboardInput([...newErrorCode.split('')]);
    await studioAgent.commitSuggestionCreateOption('#error-start-event-code-property', newErrorCode);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      errorStartEvent2,
      ERROR_START_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.clickOn('[data-test--error-start-event-specific-error-radio]');
    await studioAgent.assertVisible('#error-start-event-code-property', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.clickOn('#error-start-event-code-property');

    await studioAgent.clickOn(`#error-start-event-code-property [data-test-option-value="${newErrorCode}"]`);
    const selectedErrorCode = await studioAgent.getSuggestionSelectValue('#error-start-event-code-property');

    assert.strictEqual(selectedErrorCode, newErrorCode);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/ErrorStartEvent: should change the selected error message of an error start event and select it by second error start event', async () => {
    const newErrorMessage = 'new error message';
    const errorStartEvent1 = 'ErrorStartEvent_1';
    const errorStartEvent2 = 'ErrorStartEvent_2';

    await studioAgent.jumpToFileInSolution('error-autocomplete.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(errorStartEvent2);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      errorStartEvent1,
      ERROR_START_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.assertVisible('#error-start-event-message-property', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clearSuggestionSelect('#error-start-event-message-property');
    await studioAgent.clickOn('#error-start-event-message-property');
    await studioAgent.sendKeyboardInput([...newErrorMessage.split('')]);
    await studioAgent.commitSuggestionCreateOption('#error-start-event-message-property', newErrorMessage);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      errorStartEvent2,
      ERROR_START_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.clickOn('[data-test--error-start-event-specific-error-radio]');
    await studioAgent.assertVisible('#error-start-event-message-property', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.clickOn('#error-start-event-message-property');

    await studioAgent.clickOn(`#error-start-event-message-property [data-test-option-value="${newErrorMessage}"]`);
    const selectedErrorMessage = await studioAgent.getSuggestionSelectValue('#error-start-event-message-property');

    assert.strictEqual(selectedErrorMessage, newErrorMessage);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/CycleTimerStartEvent: should change a timer start event definition', async () => {
    const newTimerDefinition = 'new timer definition';
    const cycleTimerStartEvent = 'CycleTimerStartEvent_1';
    const timerStartEvent = 'TimerStartEvent_1';

    await studioAgent.jumpToFileInSolution('timer-event.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(timerStartEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      cycleTimerStartEvent,
      TIMER_START_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.assertVisible('#timer-start-event-definition-input', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clearTextInput('#timer-start-event-definition-input');
    await studioAgent.clickOn('#timer-start-event-definition-input');
    await studioAgent.sendKeyboardInput([...newTimerDefinition.split(''), 'enter']);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      timerStartEvent,
      TIMER_START_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      cycleTimerStartEvent,
      TIMER_START_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    const timerEventDefinition = await studioAgent.getValue('#timer-start-event-definition-input');

    assert.strictEqual(timerEventDefinition, newTimerDefinition);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/CycleTimerStartEvent: should change a cycle timer start event enabled value', async () => {
    const cycleTimerStartEvent = 'CycleTimerStartEvent_1';
    const timerStartEvent = 'TimerStartEvent_1';

    await studioAgent.jumpToFileInSolution('timer-event.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(timerStartEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      cycleTimerStartEvent,
      TIMER_START_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.assertVisible('#timer-start-event-enabled-checkbox', ASSERT_VISIBLE_TIMEOUT);

    const initialEnabled = await studioAgent.getAttribute('#timer-start-event-enabled-checkbox', 'checked');
    assert.strictEqual(initialEnabled, 'true');

    await studioAgent.clickOn('#timer-start-event-enabled-checkbox');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(timerStartEvent);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      cycleTimerStartEvent,
      TIMER_START_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    const updatedEnabled = await studioAgent.getAttribute('#timer-start-event-enabled-checkbox', 'checked');
    assert.strictEqual(updatedEnabled, null);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/CycleTimerStartEvent: should change a timer start event type', async () => {
    const cycleTimerStartEvent = 'CycleTimerStartEvent_1';
    const timerStartEvent = 'TimerStartEvent_1';
    const newType = 'timeDate';

    await studioAgent.jumpToFileInSolution('timer-event.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(timerStartEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      cycleTimerStartEvent,
      TIMER_START_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.assertVisible('#timer-start-event-select', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('#timer-start-event-select');
    await studioAgent.clickOn(`#timer-start-event-select [data-test-option-value="${newType}"]`);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      timerStartEvent,
      TIMER_START_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      cycleTimerStartEvent,
      TIMER_START_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    const timerType = await studioAgent.getText('#timer-start-event-select .react-select__single-value');

    assert.strictEqual(timerType, 'Date');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/ConditionalFlow: should change the condition of a sequence flow', async () => {
    const newCondition = 'new_condition';
    const conditionalFlow1 = 'ConditionalFlow1';
    const conditionalFlow2 = 'ConditionalFlow2';

    await studioAgent.jumpToFileInSolution('condition-test.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(conditionalFlow1);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      conditionalFlow2,
      CONDITIONAL_FLOW_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.assertVisible('[data-test--conditional-flow-condition]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOnCodeEditor('[data-test--conditional-flow-condition]');
    await studioAgent.sendKeyboardInput([...newCondition.split('')]);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      conditionalFlow1,
      CONDITIONAL_FLOW_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      conditionalFlow2,
      CONDITIONAL_FLOW_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.pause(300);

    const sequenceFlowCondition = await studioAgent.getCodeEditorText('[data-test--conditional-flow-condition]');

    assert.strictEqual(sequenceFlowCondition, newCondition);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/ConditionalFlow: should change a conditional flow condition from condition tab', async () => {
    const conditionalFlow = 'ConditionalFlow1';
    const conditionalFlow2 = 'ConditionalFlow2';
    const newCondition = 'my new condition';

    await studioAgent.jumpToFileInSolution('condition-test.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(conditionalFlow2);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      conditionalFlow,
      CONDITIONAL_FLOW_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.assertVisible('[data-test--conditional-flow-condition]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('[data-test--open-sequence-flow-condition-in-new-tab]');

    await studioAgent.assertVisible('#bpmn-sequence-flow-condition-fragment-editor', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.clickOnCodeEditor('#bpmn-sequence-flow-condition-fragment-editor');

    await studioAgent.clearCodeEditor('#bpmn-sequence-flow-condition-fragment-editor');
    await studioAgent.sendKeyboardInput([...newCondition.split('')]);

    await studioAgent.clickOn('#bpmn-sequence-flow-condition-fragment-link-to-editor-document');
    await studioAgent.assertVisible('[data-test--conditional-flow-condition]', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.waitForText('[data-test--conditional-flow-condition]');
    const condition = await studioAgent.getCodeEditorText('[data-test--conditional-flow-condition]');

    assert.strictEqual(condition, newCondition);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/DateTimerBoundaryEvent: should change a timer boundary event type', async () => {
    const dateTimerBoundaryEvent = 'DateTimerBoundaryEvent_1';
    const timerStartEvent = 'TimerStartEvent_1';
    const newType = 'timeDuration';

    await studioAgent.jumpToFileInSolution('timer-event.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(timerStartEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      dateTimerBoundaryEvent,
      TIMER_BOUNDARY_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.assertVisible('#timer-boundary-event-select', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('#timer-boundary-event-select');
    await studioAgent.clickOn(`#timer-boundary-event-select [data-test-option-value="${newType}"]`);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(timerStartEvent);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      dateTimerBoundaryEvent,
      TIMER_BOUNDARY_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    const timerType = await studioAgent.getText('#timer-boundary-event-select .react-select__single-value');

    assert.strictEqual(timerType, 'Duration');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/DurationTimerBoundaryEvent: should change a timer boundary definition', async () => {
    const durationTimerBoundaryEvent = 'DurationTimerBoundaryEvent_1';
    const timerStartEvent = 'TimerStartEvent_1';
    const newTimerDefinition = 'new timer definition';

    await studioAgent.jumpToFileInSolution('timer-event.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(timerStartEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      durationTimerBoundaryEvent,
      TIMER_BOUNDARY_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.assertVisible('#timer-boundary-event-select', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('#timer-boundary-event-definition-input');
    await studioAgent.clearTextInput('#timer-boundary-event-definition-input');

    await studioAgent.sendKeyboardInput([...newTimerDefinition.split(''), 'enter']);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(timerStartEvent);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      durationTimerBoundaryEvent,
      TIMER_BOUNDARY_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    const timerEventDefinition = await studioAgent.getValue('#timer-boundary-event-definition-input');

    assert.strictEqual(timerEventDefinition, newTimerDefinition);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/TimerIntermediateEvent: should change a timer intermediate event type', async () => {
    const dateTimerIntermediateEvent = 'TimerIntermediateEvent_1';
    const timerStartEvent = 'TimerStartEvent_1';
    const newType = 'timeDuration';

    await studioAgent.jumpToFileInSolution('timer-event.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(timerStartEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      dateTimerIntermediateEvent,
      TIMER_INTERMEDIATE_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.assertVisible('#timer-intermediate-event-select', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('#timer-intermediate-event-select');
    await studioAgent.clickOn(`#timer-intermediate-event-select [data-test-option-value="${newType}"]`);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(timerStartEvent);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      dateTimerIntermediateEvent,
      TIMER_INTERMEDIATE_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    const timerType = await studioAgent.getText('#timer-intermediate-event-select .react-select__single-value');

    assert.strictEqual(timerType, 'Duration');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/TimerIntermediateEvent: should change a timer intermediate definition', async () => {
    const durationTimerIntermediateEvent = 'TimerIntermediateEvent_2';
    const timerStartEvent = 'TimerStartEvent_1';
    const newTimerDefinition = 'new timer definition';

    await studioAgent.jumpToFileInSolution('timer-event.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(timerStartEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      durationTimerIntermediateEvent,
      TIMER_INTERMEDIATE_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.assertVisible('#timer-intermediate-event-select', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clearTextInput('#timer-intermediate-event-definition-input');
    await studioAgent.clickOn('#timer-intermediate-event-definition-input');
    await studioAgent.sendKeyboardInput([...newTimerDefinition.split(''), 'enter']);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(timerStartEvent);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      durationTimerIntermediateEvent,
      TIMER_INTERMEDIATE_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    const timerEventDefinition = await studioAgent.getValue('#timer-intermediate-event-definition-input');

    assert.strictEqual(timerEventDefinition, newTimerDefinition);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/LinkIntermediateCatchEvent: should change a link intermediate catch event name', async () => {
    const linkIntermediateCatchEvent = 'LinkIntermediateCatchEvent1';
    const startEvent = 'StartEvent_1';
    const newLinkName = 'LinkName1';

    await studioAgent.jumpToFileInSolution('link-event.bpmn');

    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      linkIntermediateCatchEvent,
      LINK_INTERMEDIATE_CATCH_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.switchToPaneGroup('property');
    await studioAgent.assertVisible('#link-intermediate-catch-event-link-property', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clearSuggestionSelect('#link-intermediate-catch-event-link-property');
    await studioAgent.clickOn('#link-intermediate-catch-event-link-property');
    await studioAgent.clickOn(`#link-intermediate-catch-event-link-property [data-test-option-value="${newLinkName}"]`);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      linkIntermediateCatchEvent,
      LINK_INTERMEDIATE_CATCH_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    const linkName = await studioAgent.getSuggestionSelectValue('#link-intermediate-catch-event-link-property');

    assert.strictEqual(linkName, newLinkName);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/LinkIntermediateThrowEvent: should change a link intermediate throw event name', async () => {
    const linkIntermediateThrowEvent = 'LinkIntermediateThrowEvent1';
    const startEvent = 'StartEvent_1';
    const newLinkName = 'LinkName1';

    await studioAgent.jumpToFileInSolution('link-event.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      linkIntermediateThrowEvent,
      LINK_INTERMEDIATE_THROW_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.assertVisible('#link-intermediate-throw-event-link-property', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clearSuggestionSelect('#link-intermediate-throw-event-link-property');
    await studioAgent.clickOn('#link-intermediate-throw-event-link-property');
    await studioAgent.clickOn(`#link-intermediate-throw-event-link-property [data-test-option-value="${newLinkName}"]`);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent, ELEMENT_INFO_PANE, ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      linkIntermediateThrowEvent,
      LINK_INTERMEDIATE_THROW_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    const linkName = await studioAgent.getSuggestionSelectValue('#link-intermediate-throw-event-link-property');

    assert.strictEqual(linkName, newLinkName);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/ScriptTask: should change a script task script from property panel', async () => {
    const scriptTask = 'ScriptTask_1';
    const startEvent = 'StartEvent_1';
    const newScript = 'my new script';

    await studioAgent.jumpToFileInSolution('script-task.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(scriptTask, SCRIPT_TASK_PANE, ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.assertVisible('#script-task-input', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOnCodeEditor('#script-task-input');
    await studioAgent.sendKeyboardInput([...newScript.split('')]);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(scriptTask, SCRIPT_TASK_PANE, ASSERT_VISIBLE_TIMEOUT);

    const script = await studioAgent.getCodeEditorText('#script-task-input');

    assert.strictEqual(script, newScript);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/ScriptTask: should change a script task script from script editor tab', async () => {
    const scriptTask = 'ScriptTask_1';
    const startEvent = 'StartEvent_1';
    const newScript = 'my new script';

    await studioAgent.jumpToFileInSolution('script-task.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(scriptTask, SCRIPT_TASK_PANE, ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.assertVisible('#script-task-input', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('#script-task-open-script-tab');

    await studioAgent.assertVisible('#bpmn-script-fragment-editor', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.clickOnCodeEditor('#bpmn-script-fragment-editor');

    await studioAgent.sendKeyboardInput([...newScript.split('')]);

    await studioAgent.clickOn('#bpmn-script-fragment-link-to-editor-document');
    await studioAgent.assertVisible('#script-task-input', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.waitForText('#script-task-input');
    const script = await studioAgent.getCodeEditorText('#script-task-input');

    assert.strictEqual(script, newScript);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/CallActivity: should change a call activity start event id', async () => {
    const callActivity = 'CallActivity_1';
    const startEvent = 'StartEvent_1';
    const newStartEventId = 'my new start event id';

    await studioAgent.jumpToFileInSolution('callactivity-test.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(callActivity, CALL_ACTIVITY_PANE, ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.assertVisible('#call-activity-start-event-id-property', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clearSuggestionSelect('#call-activity-start-event-id-property');
    await studioAgent.clickOn('#call-activity-start-event-id-property');
    await studioAgent.sendKeyboardInput([...newStartEventId.split(''), 'enter']);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(callActivity, CALL_ACTIVITY_PANE, ASSERT_VISIBLE_TIMEOUT);

    const startEventId = await studioAgent.getSuggestionSelectValue('#call-activity-start-event-id-property');

    assert.strictEqual(startEventId, newStartEventId);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/CallActivity: should change a call activity called process id', async () => {
    const callActivity = 'CallActivity_1';
    const startEvent = 'StartEvent_1';
    const newProcessId = 'new-process-id';

    await studioAgent.jumpToFileInSolution('callactivity-test.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(callActivity, CALL_ACTIVITY_PANE, ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.assertVisible('#call-activity-process-id-property', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clearTextInput('#call-activity-process-id-property');
    await studioAgent.clickOn('#call-activity-process-id-property');
    await studioAgent.sendKeyboardInput([...newProcessId.split('')]);
    await studioAgent.commitSuggestionCreateOption('#call-activity-process-id-property', newProcessId);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(callActivity, CALL_ACTIVITY_PANE, ASSERT_VISIBLE_TIMEOUT);

    const processId = await studioAgent.getSuggestionSelectValue('#call-activity-process-id-property');

    assert.strictEqual(processId, newProcessId);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/ManualTask: should change requires confirmation checkbox of manual task', async () => {
    const startEvent = 'StartEvent_1';
    const manualTask = 'ManualTask_1';

    await studioAgent.jumpToFileInSolution('manual-task.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(manualTask, ELEMENT_INFO_PANE, ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.assertPaneVisible('bpmn/panes/properties/PropertiesManualTask');

    await studioAgent.assertVisible('#bpmn-manual-task-require-confirmation-checkbox', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('#bpmn-manual-task-require-confirmation-checkbox');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(manualTask, ELEMENT_INFO_PANE, ASSERT_VISIBLE_TIMEOUT);

    const enabled = await studioAgent.getAttribute('#bpmn-manual-task-require-confirmation-checkbox', 'checked');

    assert.strictEqual(enabled, 'true');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/ConditionalStartEvent: should change a conditional start event condition', async () => {
    const startEvent = 'StartEvent_1';
    const endEvent = 'EndEvent_1';
    const newCondition = 'my new condition';

    await studioAgent.jumpToFileInSolution('conditional-event.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(endEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      startEvent,
      START_EVENT_CONDITION_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.clearCodeEditor(START_EVENT_CONDITION_PANE);
    await studioAgent.sendKeyboardInput([...newCondition.split('')]);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(endEvent);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      startEvent,
      START_EVENT_CONDITION_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    const condition = await studioAgent.getCodeEditorText(START_EVENT_CONDITION_PANE);
    assert.strictEqual(condition, newCondition);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/ConditionalStartEvent: should change a conditional start event condition from condition tab', async () => {
    const conditionalStartEvent = 'StartEvent_1';
    const endEvent = 'EndEvent_1';
    const newCondition = 'my new condition';

    await studioAgent.jumpToFileInSolution('conditional-event.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(endEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      conditionalStartEvent,
      START_EVENT_CONDITION_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.clickOn('[data-test--open-conditional-start-event-condition-new-tab]');

    await studioAgent.assertVisible('#bpmn-conditional-event-fragment-editor', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.clickOnCodeEditor('#bpmn-conditional-event-fragment-editor');

    await studioAgent.clearCodeEditor('#bpmn-conditional-event-fragment-editor');
    await studioAgent.sendKeyboardInput([...newCondition.split('')]);

    await studioAgent.clickOn('#bpmn-conditional-event-fragment-link-to-editor-document');
    await studioAgent.assertVisible(START_EVENT_CONDITION_PANE, ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.waitForText(START_EVENT_CONDITION_PANE);
    const condition = await studioAgent.getCodeEditorText(START_EVENT_CONDITION_PANE);

    assert.strictEqual(condition, newCondition);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/ConditionalBoundaryEvent: should change a conditional boundary event condition', async () => {
    const boundaryEvent = 'ConditionalBoundaryEvent_1';
    const endEvent = 'EndEvent_1';
    const newCondition = 'my new condition';
    const boundaryEventConditionPane = '[data-test--conditional-boundary-event-condition]';

    await studioAgent.jumpToFileInSolution('conditional-event.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(endEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      boundaryEvent,
      boundaryEventConditionPane,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.clearCodeEditor(boundaryEventConditionPane);
    await studioAgent.sendKeyboardInput([...newCondition.split('')]);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(endEvent);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      boundaryEvent,
      boundaryEventConditionPane,
      ASSERT_VISIBLE_TIMEOUT,
    );

    const condition = await studioAgent.getCodeEditorText(boundaryEventConditionPane);

    assert.strictEqual(condition, newCondition);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/ConditionalBoundaryEvent: should change a conditional boundary event condition from condition tab', async () => {
    const endEvent = 'EndEvent_1';
    const conditionalBoundaryEvent = 'ConditionalBoundaryEvent_1';
    const newCondition = 'my new condition';
    const boundaryEventConditionPane = '[data-test--conditional-boundary-event-condition]';

    await studioAgent.jumpToFileInSolution('conditional-event.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(endEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      conditionalBoundaryEvent,
      boundaryEventConditionPane,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.clickOn('[data-test--open-conditional-boundary-event-condition-new-tab]');

    await studioAgent.assertVisible('#bpmn-conditional-event-fragment-editor', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.clickOnCodeEditor('#bpmn-conditional-event-fragment-editor');

    await studioAgent.clearCodeEditor('#bpmn-conditional-event-fragment-editor');
    await studioAgent.sendKeyboardInput([...newCondition.split('')]);

    await studioAgent.clickOn('#bpmn-conditional-event-fragment-link-to-editor-document');
    await studioAgent.assertVisible(boundaryEventConditionPane, ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.waitForText(boundaryEventConditionPane);
    const condition = await studioAgent.getCodeEditorText(boundaryEventConditionPane);

    assert.strictEqual(condition, newCondition);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/ConditionalIntermediateCatchEvent: should change a conditional intermediate catch event condition', async () => {
    const intermediateCatchEvent = 'ConditionalIntermediateCatchEvent_1';
    const endEvent = 'EndEvent_1';
    const newCondition = 'my new condition';

    await studioAgent.jumpToFileInSolution('conditional-event.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(endEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      intermediateCatchEvent,
      CONDITIONAL_INTERMEDIATE_CATCH_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.assertVisible(
      '[data-test--conditional-intermediate-catch-event-condition]',
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.clearCodeEditor('[data-test--conditional-intermediate-catch-event-condition]');
    await studioAgent.sendKeyboardInput([...newCondition.split('')]);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(endEvent, ELEMENT_INFO_PANE, ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      intermediateCatchEvent,
      CONDITIONAL_INTERMEDIATE_CATCH_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.assertVisible(
      '[data-test--conditional-intermediate-catch-event-condition]',
      ASSERT_VISIBLE_TIMEOUT,
    );
    const condition = await studioAgent.getCodeEditorText(
      '[data-test--conditional-intermediate-catch-event-condition]',
    );

    assert.strictEqual(condition, newCondition);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/ConditionalIntermediateCatchEvent: should change a conditional intermediate catch event condition from condition tab', async () => {
    const startEvent = 'StartEvent_1';
    const conditionalIntermediateCatchEvent = 'ConditionalIntermediateCatchEvent_1';
    const newCondition = 'my new condition';

    await studioAgent.jumpToFileInSolution('conditional-event.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      conditionalIntermediateCatchEvent,
      CONDITIONAL_INTERMEDIATE_CATCH_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.assertVisible(
      '[data-test--conditional-intermediate-catch-event-condition]',
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.clickOn('[data-test--open-conditional-intermediate-catch-event-condition-new-tab]');

    await studioAgent.assertVisible('#bpmn-conditional-event-fragment-editor', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.clickOnCodeEditor('#bpmn-conditional-event-fragment-editor');

    await studioAgent.clearCodeEditor('#bpmn-conditional-event-fragment-editor');
    await studioAgent.sendKeyboardInput([...newCondition.split('')]);

    await studioAgent.clickOn('#bpmn-conditional-event-fragment-link-to-editor-document');
    await studioAgent.assertVisible(
      '[data-test--conditional-intermediate-catch-event-condition]',
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.waitForText('[data-test--conditional-intermediate-catch-event-condition]');
    const condition = await studioAgent.getCodeEditorText(
      '[data-test--conditional-intermediate-catch-event-condition]',
    );

    assert.strictEqual(condition, newCondition);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/EscalationBoundaryEvent: should change an escalation boundary event name', async () => {
    const escalationBoundary = 'EscalationBoundaryEvent_1';
    const startEvent = 'StartEvent_1';
    const newName = 'new-escalation-name';

    await studioAgent.jumpToFileInSolution('escalation-event.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      escalationBoundary,
      ESCALATION_BOUNDARY_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.sendKeyboardInput(['Escape']);
    await studioAgent.assertVisible(
      '[data-test--escalation-boundary-event-specific-escalation-radio]',
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.clickOn('[data-test--escalation-boundary-event-specific-escalation-radio]');
    await studioAgent.assertVisible('#escalation-boundary-event-name', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clearSuggestionSelect('#escalation-boundary-event-name');
    await studioAgent.assertVisible('#escalation-boundary-event-name', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.clickOn('#escalation-boundary-event-name');
    await studioAgent.sendKeyboardInput([...newName.split('')]);
    await studioAgent.commitSuggestionCreateOption('#escalation-boundary-event-name', newName);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      escalationBoundary,
      ESCALATION_BOUNDARY_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    const name = await studioAgent.getSuggestionSelectValue('#escalation-boundary-event-name');

    assert.strictEqual(name, newName);
    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/EscalationBoundaryEvent: should change an escalation boundary event code', async () => {
    const escalationBoundary = 'EscalationBoundaryEvent_1';
    const startEvent = 'StartEvent_1';
    const newEscalationCode = 'new-escalation-code';

    await studioAgent.jumpToFileInSolution('escalation-event.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      escalationBoundary,
      ESCALATION_BOUNDARY_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.sendKeyboardInput(['Escape']);
    await studioAgent.assertVisible(
      '[data-test--escalation-boundary-event-specific-escalation-radio]',
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.clickOn('[data-test--escalation-boundary-event-specific-escalation-radio]');

    await studioAgent.assertVisible('#escalation-boundary-event-code', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('#escalation-boundary-event-code');
    await studioAgent.sendKeyboardInput([...newEscalationCode.split('')]);
    await studioAgent.commitSuggestionCreateOption('#escalation-boundary-event-code', newEscalationCode);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      escalationBoundary,
      ESCALATION_BOUNDARY_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    const code = await studioAgent.getSuggestionSelectValue('#escalation-boundary-event-code');

    assert.strictEqual(code, newEscalationCode);
    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/EscalationStartEvent: should change an escalation start event name', async () => {
    const escalationStartEvent = 'EscalationStartEvent_1';
    const startEvent = 'StartEvent_1';
    const newName = 'new-escalation-name';

    await studioAgent.jumpToFileInSolution('escalation-event.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      escalationStartEvent,
      ESCALATION_START_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.assertVisible('#escalation-start-event-name', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('#escalation-start-event-name');
    await studioAgent.sendKeyboardInput([...newName.split('')]);
    await studioAgent.commitSuggestionCreateOption('#escalation-start-event-name', newName);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      escalationStartEvent,
      ESCALATION_START_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    const name = await studioAgent.getSuggestionSelectValue('#escalation-start-event-name');

    assert.strictEqual(name, newName);
    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/EscalationStartEvent: should change an escalation start event code', async () => {
    const escalationStartEvent = 'EscalationStartEvent_1';
    const startEvent = 'StartEvent_1';
    const newEscalationCode = 'new-escalation-code';

    await studioAgent.jumpToFileInSolution('escalation-event.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      escalationStartEvent,
      ESCALATION_START_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.assertVisible('#escalation-start-event-code', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('#escalation-start-event-code');
    await studioAgent.sendKeyboardInput([...newEscalationCode.split('')]);
    await studioAgent.commitSuggestionCreateOption('#escalation-start-event-code', newEscalationCode);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      escalationStartEvent,
      ESCALATION_START_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    const code = await studioAgent.getSuggestionSelectValue('#escalation-start-event-code');

    assert.strictEqual(code, newEscalationCode);
    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/EscalationIntermediateThrowEvent: should change an escalation intermediate throw event name', async () => {
    const escalationIntermediateThrow = 'EscalationIntermediateThrowEvent_1';
    const startEvent = 'StartEvent_1';
    const newName = 'new-escalation-name';

    await studioAgent.jumpToFileInSolution('escalation-event.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      escalationIntermediateThrow,
      ESCALATION_INTERMEDIATE_THROW_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.assertVisible('#escalation-intermediate-throw-event-name', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clearSuggestionSelect('#escalation-intermediate-throw-event-name');
    await studioAgent.clickOn('#escalation-intermediate-throw-event-name');
    await studioAgent.sendKeyboardInput([...newName.split('')]);
    await studioAgent.commitSuggestionCreateOption('#escalation-intermediate-throw-event-name', newName);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      escalationIntermediateThrow,
      ESCALATION_INTERMEDIATE_THROW_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    const name = await studioAgent.getSuggestionSelectValue('#escalation-intermediate-throw-event-name');

    assert.strictEqual(name, newName);
    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/EscalationIntermediateThrowEvent: should change an escalation intermediate throw event code', async () => {
    const escalationIntermediateThrow = 'EscalationIntermediateThrowEvent_1';
    const startEvent = 'StartEvent_1';
    const newEscalationCode = 'new-escalation-code';

    await studioAgent.jumpToFileInSolution('escalation-event.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      escalationIntermediateThrow,
      ESCALATION_INTERMEDIATE_THROW_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.assertVisible('#escalation-intermediate-throw-event-code', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('#escalation-intermediate-throw-event-code');
    await studioAgent.sendKeyboardInput([...newEscalationCode.split('')]);
    await studioAgent.commitSuggestionCreateOption('#escalation-intermediate-throw-event-code', newEscalationCode);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      escalationIntermediateThrow,
      ESCALATION_INTERMEDIATE_THROW_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    const code = await studioAgent.getSuggestionSelectValue('#escalation-intermediate-throw-event-code');

    assert.strictEqual(code, newEscalationCode);
    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/TextAnnotation: should change a text annotation text', async () => {
    const textAnnotation = 'TextAnnotation_1';
    const startEvent = 'StartEvent_1';
    const newText = 'my new text';

    await studioAgent.jumpToFileInSolution('text-annotation.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      textAnnotation,
      TEXT_ANNOTATION_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.assertVisible('#text-annotation-text-property', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clearTextInput('#text-annotation-text-property');
    await studioAgent.clickOn('#text-annotation-text-property');
    await studioAgent.sendKeyboardInput([...newText.split('')]);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      textAnnotation,
      TEXT_ANNOTATION_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    const text = await studioAgent.getValue('#text-annotation-text-property');
    assert.strictEqual(text, newText);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/TextAnnotation: should change a text annotation text from text editor tab', async () => {
    const textAnnotation = 'TextAnnotation_1';
    const newText = 'my new text';

    await studioAgent.jumpToFileInSolution('text-annotation.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(textAnnotation);
    await studioAgent.switchToPaneGroup('property');
    await studioAgent.assertVisible('#text-annotation-text-property', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('[data-test--text-annotation-open-text-tab]');

    await studioAgent.assertVisible('#bpmn-text-fragment-editor', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clearCodeEditor('#bpmn-text-fragment-editor');
    await studioAgent.sendKeyboardInput([...newText.split('')]);

    await studioAgent.clickOn('#bpmn-text-fragment-link-to-editor-document');
    await studioAgent.assertVisible('#text-annotation-text-property', ASSERT_VISIBLE_TIMEOUT);

    const text = await studioAgent.getValue('#text-annotation-text-property');

    assert.strictEqual(text, newText);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/DataOutputAssociation: should change the transformation of a data output association', async () => {
    const dataOutputAssociation = 'DataOutputAssociation_1';
    const startEvent = 'StartEvent_1';
    const newTransformation = 'my new transformation';

    await studioAgent.jumpToFileInSolution('data-object.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(dataOutputAssociation);
    await studioAgent.switchToPaneGroup('scripting');

    await studioAgent.assertVisible('#data-output-association-data-source-input', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clearCodeEditor('#data-output-association-data-source-input');
    await studioAgent.clickOnCodeEditor('#data-output-association-data-source-input');

    await studioAgent.sendKeyboardInput([...newTransformation.split('')]);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      dataOutputAssociation,
      '#data-output-association-data-source-input',
      ASSERT_VISIBLE_TIMEOUT,
    );

    const transformation = await studioAgent.getCodeEditorText('#data-output-association-data-source-input');

    assert.strictEqual(transformation, newTransformation);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/DataOutputAssociation: should change the transformation from the transformation tab', async () => {
    const dataOutputAssociation = 'DataOutputAssociation_1';
    const newTransformation = 'my new transformation';

    await studioAgent.jumpToFileInSolution('data-object.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(dataOutputAssociation);
    await studioAgent.switchToPaneGroup('scripting');
    await studioAgent.assertVisible('#data-output-association-data-source-input', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('[data-test--open-transformation-in-new-tab]');

    await studioAgent.assertVisible(
      '#bpmn-data-output-association-transformation-fragment-editor',
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.clickOnCodeEditor('#bpmn-data-output-association-transformation-fragment-editor');

    await studioAgent.clearCodeEditor('#bpmn-data-output-association-transformation-fragment-editor');
    await studioAgent.sendKeyboardInput([...newTransformation.split('')]);

    await studioAgent.clickOn('#bpmn-data-output-association-transformation-fragment-link-to-editor-document');
    await studioAgent.assertVisible('#data-output-association-data-source-input', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.waitForText('#data-output-association-data-source-input');
    const transformation = await studioAgent.getCodeEditorText('#data-output-association-data-source-input');

    assert.strictEqual(transformation, newTransformation);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/UserTask: should change the assigned users list', async () => {
    const userTask = 'UserTask_1';
    const startEvent = 'StartEvent_1';
    const newAssignedUsersScript = 'token.current';

    await studioAgent.jumpToFileInSolution('user-task.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      userTask,
      USER_TASK_FORM_SUMMARY_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.assertVisible('[data-test--user-task-assignees-input]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOnCodeEditor('[data-test--user-task-assignees-input]');

    await studioAgent.sendKeyboardInput([...newAssignedUsersScript.split('')]);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      userTask,
      USER_TASK_FORM_SUMMARY_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.assertVisible('[data-test--user-task-assignees-input]', ASSERT_VISIBLE_TIMEOUT);

    const assignedUsersScript = await studioAgent.getCodeEditorText('[data-test--user-task-assignees-input]');

    assert.strictEqual(assignedUsersScript, newAssignedUsersScript);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/UserTask: should change the assigned users list through assigned users script tab', async () => {
    const userTask = 'UserTask_1';
    const startEvent = 'StartEvent_1';
    const newAssignedUsersScript = 'token.current';

    await studioAgent.jumpToFileInSolution('user-task.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      userTask,
      USER_TASK_FORM_SUMMARY_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.assertVisible('[data-test--user-task-assignees-input]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('[data-test--open-user-task-assignees-in-new-tab]');

    await studioAgent.assertVisible('[data-test--bpmn-user-task-assignees-fragment-editor]', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.clickOnCodeEditor('[data-test--bpmn-user-task-assignees-fragment-editor]');

    await studioAgent.clearCodeEditor('[data-test--bpmn-user-task-assignees-fragment-editor]');
    await studioAgent.sendKeyboardInput([...newAssignedUsersScript.split('')]);

    await studioAgent.clickOn('[data-test--bpmn-user-task-assignees-fragment-link-to-editor-document]');
    await studioAgent.assertVisible('[data-test--user-task-assignees-input]', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.waitForText('[data-test--user-task-assignees-input]');
    const assignedUsersScript = await studioAgent.getCodeEditorText('[data-test--user-task-assignees-input]');

    assert.strictEqual(assignedUsersScript, newAssignedUsersScript);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/BusinessRuleTask: should toggle the implementation mode', async () => {
    const businessRuleTask = 'BusinessRuleTask_1';
    const startEvent = 'StartEvent_1';

    await studioAgent.jumpToFileInSolution('business-rule-task.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      businessRuleTask,
      BUSINESS_RULE_TASK_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.assertVisible('#business-rule-task-implementation-property', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.assertVisible('#business-rule-task-decision-ref-property', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('#business-rule-task-implementation-property');
    await studioAgent.clickOn('#business-rule-task-implementation-property [data-test-option-value="feel"]');
    await studioAgent.assertVisible('#business-rule-task-script-property', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.waitForNotVisible('#business-rule-task-decision-ref-property');

    await studioAgent.clickOn('#business-rule-task-implementation-property');
    await studioAgent.clickOn('#business-rule-task-implementation-property [data-test-option-value="dmn"]');
    await studioAgent.assertVisible('#business-rule-task-decision-ref-property', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/BusinessRuleTask: should change the FEEL script when implementation is feel', async () => {
    const businessRuleTask = 'BusinessRuleTask_1';
    const startEvent = 'StartEvent_1';
    const newScript = 'if x > 10 then "high" else "low"';

    await studioAgent.jumpToFileInSolution('business-rule-task.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      businessRuleTask,
      BUSINESS_RULE_TASK_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.clickOn('#business-rule-task-implementation-property');
    await studioAgent.clickOn('#business-rule-task-implementation-property [data-test-option-value="feel"]');

    await studioAgent.assertVisible('#business-rule-task-script-property', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOnCodeEditor('#business-rule-task-script-property');
    await studioAgent.sendKeyboardInput([...newScript.split('')]);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      businessRuleTask,
      BUSINESS_RULE_TASK_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    const script = await studioAgent.getCodeEditorText('#business-rule-task-script-property');
    assert.strictEqual(script, newScript);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/BusinessRuleTask: should change the DMN decision ref when implementation is dmn', async () => {
    const businessRuleTask = 'BusinessRuleTask_1';
    const startEvent = 'StartEvent_1';
    const newDecisionRef = 'my-decision-table';

    await studioAgent.jumpToFileInSolution('business-rule-task.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      businessRuleTask,
      BUSINESS_RULE_TASK_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.assertVisible('#business-rule-task-decision-ref-property', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clearSuggestionSelect('#business-rule-task-decision-ref-property');
    await studioAgent.clickOn('#business-rule-task-decision-ref-property');
    await studioAgent.sendKeyboardInput([...newDecisionRef.split('')]);
    await studioAgent.commitSuggestionCreateOption('#business-rule-task-decision-ref-property', newDecisionRef);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      businessRuleTask,
      BUSINESS_RULE_TASK_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    const decisionRef = await studioAgent.getSuggestionSelectValue('#business-rule-task-decision-ref-property');
    assert.strictEqual(decisionRef, newDecisionRef);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/BusinessRuleTask: should show DMN model suggestions in Decision Reference dropdown', async () => {
    const businessRuleTask = 'BusinessRuleTask_1';
    const startEvent = 'StartEvent_1';

    await studioAgent.jumpToFileInSolution('business-rule-task.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      businessRuleTask,
      BUSINESS_RULE_TASK_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.assertVisible('#business-rule-task-decision-ref-property', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('#business-rule-task-decision-ref-property');
    await studioAgent.assertVisible(
      '#business-rule-task-decision-ref-property [data-test-option-value="discount-rules"]',
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.sendKeyboardInput(['Escape']);
    await studioAgent.waitForNotVisible('.react-select__control--menu-is-open');

    const decisionRef = await studioAgent.getSuggestionSelectValue('#business-rule-task-decision-ref-property');
    assert.strictEqual(decisionRef, 'discount-rules');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/BusinessRuleTask: should populate Decision Element ID suggestions from selected DMN model', async () => {
    const businessRuleTask = 'BusinessRuleTask_1';
    const startEvent = 'StartEvent_1';

    await studioAgent.jumpToFileInSolution('business-rule-task.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      businessRuleTask,
      BUSINESS_RULE_TASK_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.assertVisible('#business-rule-task-decision-element-id-property', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('#business-rule-task-decision-element-id-property');
    await studioAgent.assertVisible(
      '#business-rule-task-decision-element-id-property [data-test-option-value="Decision_Discount"]',
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.sendKeyboardInput(['Escape']);
    await studioAgent.waitForNotVisible('.react-select__control--menu-is-open');

    const decisionElementId = await studioAgent.getSuggestionSelectValue(
      '#business-rule-task-decision-element-id-property',
    );
    assert.strictEqual(decisionElementId, 'Decision_Discount');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/BusinessRuleTask: should clear Decision Element ID when Decision Reference changes', async () => {
    const businessRuleTask = 'BusinessRuleTask_1';
    const startEvent = 'StartEvent_1';

    await studioAgent.jumpToFileInSolution('business-rule-task.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      businessRuleTask,
      BUSINESS_RULE_TASK_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.assertVisible('#business-rule-task-decision-ref-property', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.clearSuggestionSelect('#business-rule-task-decision-ref-property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      businessRuleTask,
      BUSINESS_RULE_TASK_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    const decisionRef = await studioAgent.getValue(
      '#business-rule-task-decision-ref-property .react-select__input-container input',
    );
    const decisionElementId = await studioAgent.getValue(
      '#business-rule-task-decision-element-id-property .react-select__input-container input',
    );

    assert.strictEqual(decisionRef, '');
    assert.strictEqual(decisionElementId, '');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/BusinessRuleTask: should show Open in new tab link for valid Decision Reference', async () => {
    const businessRuleTask = 'BusinessRuleTask_1';
    const startEvent = 'StartEvent_1';

    await studioAgent.jumpToFileInSolution('business-rule-task.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      businessRuleTask,
      BUSINESS_RULE_TASK_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.assertVisible('#business-rule-task-decision-ref-property', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.assertVisible(
      `${BUSINESS_RULE_TASK_PANE} [data-test--jump-to-symbol-in-solution]`,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/ServiceTask: should change the service task type to HTTP', async () => {
    const serviceTask = 'ServiceTask_3';
    const startEvent = 'StartEvent_1';

    await studioAgent.jumpToFileInSolution('service-task.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(serviceTask, SERVICE_TASK_PANE, ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.assertVisible('#service-task-type', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.clickOn('#service-task-type');
    await studioAgent.clickOn('#service-task-type [data-test-option-value="http"]');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(serviceTask, HTTP_TASK_PANE, ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.assertPaneVisible('bpmn/panes/properties/PropertiesHttpTask');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/HttpServiceTask: should change the HTTP method', async () => {
    const serviceTask = 'ServiceTask_2';
    const startEvent = 'StartEvent_1';

    await studioAgent.jumpToFileInSolution('service-task.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(serviceTask, HTTP_TASK_PANE, ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.assertVisible('#http-task-method-property', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.clickOn('#http-task-method-property');
    await studioAgent.clickOn('#http-task-method-property [data-test-option-value="put"]');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(serviceTask, HTTP_TASK_PANE, ASSERT_VISIBLE_TIMEOUT);

    const method = await studioAgent.getText('#http-task-method-property .react-select__single-value');
    assert.strictEqual(method, 'PUT');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/HttpServiceTask: should change the HTTP URL', async () => {
    const serviceTask = 'ServiceTask_2';
    const startEvent = 'StartEvent_1';
    const newUrl = 'https://example.com/api';

    await studioAgent.jumpToFileInSolution('service-task.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(serviceTask, HTTP_TASK_PANE, ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.assertVisible('#http-task-url-property', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.clearTextInput('#http-task-url-property');
    await studioAgent.clickOn('#http-task-url-property');
    await studioAgent.sendKeyboardInput([...newUrl.split(''), 'enter']);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(serviceTask, HTTP_TASK_PANE, ASSERT_VISIBLE_TIMEOUT);

    const url = await studioAgent.getValue('#http-task-url-property');
    assert.strictEqual(url, newUrl);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/HttpServiceTask: should change the auth header', async () => {
    const serviceTask = 'ServiceTask_2';
    const startEvent = 'StartEvent_1';
    const newAuthHeader = 'Bearer my-token';

    await studioAgent.jumpToFileInSolution('service-task.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(serviceTask, HTTP_TASK_PANE, ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.assertVisible('#http-task-auth-header-property', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.clearCodeEditor('#http-task-auth-header-property');
    await studioAgent.clickOnCodeEditor('#http-task-auth-header-property');
    await studioAgent.sendKeyboardInput([...newAuthHeader.split('')]);
    await studioAgent.sendKeyboardInput(['Escape']);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(serviceTask, HTTP_TASK_PANE, ASSERT_VISIBLE_TIMEOUT);

    const authHeader = await studioAgent.getCodeEditorText('#http-task-auth-header-property');
    assert.strictEqual(authHeader, newAuthHeader);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/HttpServiceTask: should change the HTTP body', async () => {
    const serviceTask = 'ServiceTask_2';
    const startEvent = 'StartEvent_1';
    const newBody = '{"key": "value"}';

    await studioAgent.jumpToFileInSolution('service-task.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(serviceTask, HTTP_TASK_PANE, ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.assertVisible('#http-task-body-property', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.clearCodeEditor('#http-task-body-property');
    await studioAgent.clickOnCodeEditor('#http-task-body-property');
    await studioAgent.sendKeyboardInput([...newBody.split('')]);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(serviceTask, HTTP_TASK_PANE, ASSERT_VISIBLE_TIMEOUT);

    const body = await studioAgent.getCodeEditorText('#http-task-body-property');
    assert.strictEqual(body, newBody);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/CallActivity: should add an input mapping', async () => {
    const callActivity = 'CallActivity_1';
    const startEvent = 'StartEvent_1';

    await studioAgent.jumpToFileInSolution('callactivity-test.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('scripting');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      callActivity,
      '[data-test--data-pipeline-add-mapping="input"]',
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.clickOn('[data-test--data-pipeline-add-mapping="input"]');

    await studioAgent.assertVisible('#data-pipeline-input-source-0', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.assertVisible('#data-pipeline-input-target-0', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/CallActivity: should add an output mapping', async () => {
    const callActivity = 'CallActivity_1';
    const startEvent = 'StartEvent_1';

    await studioAgent.jumpToFileInSolution('callactivity-test.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('scripting');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      callActivity,
      '[data-test--data-pipeline-add-mapping="output"]',
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.clickOn('[data-test--data-pipeline-add-mapping="output"]');

    await studioAgent.assertVisible('#data-pipeline-output-source-0', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.assertVisible('#data-pipeline-output-target-0', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/CallActivity: should remove an input mapping', async () => {
    const callActivity = 'CallActivity_1';
    const startEvent = 'StartEvent_1';

    await studioAgent.jumpToFileInSolution('callactivity-test.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('scripting');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      callActivity,
      '[data-test--data-pipeline-add-mapping="input"]',
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.clickOn('[data-test--data-pipeline-add-mapping="input"]');
    await studioAgent.assertVisible('[data-test--data-pipeline-remove-mapping="0"]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('[data-test--data-pipeline-remove-mapping="0"]');
    await studioAgent.assertNotVisible('[data-test--data-pipeline-remove-mapping="0"]');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/BusinessRuleTask: should toggle trace unmatched rules checkbox', async () => {
    const businessRuleTask = 'BusinessRuleTask_1';
    const startEvent = 'StartEvent_1';

    await studioAgent.jumpToFileInSolution('business-rule-task.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      businessRuleTask,
      BUSINESS_RULE_TASK_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.clickOn('#business-rule-task-implementation-property');
    await studioAgent.clickOn('#business-rule-task-implementation-property [data-test-option-value="dmn"]');

    await studioAgent.assertVisible('#business-rule-task-trace-unmatched-rules-checkbox', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('#business-rule-task-trace-unmatched-rules-checkbox');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      businessRuleTask,
      BUSINESS_RULE_TASK_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    const checked = await studioAgent.getAttribute('#business-rule-task-trace-unmatched-rules-checkbox', 'checked');
    assert.strictEqual(checked, 'true');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/Process: should change a process correlation key', async () => {
    const startEvent = 'StartEvent_1';
    const process = 'Process_1';
    const newCorrelationKey = 'my-correlation-key';

    await studioAgent.jumpToFileInSolution('process-root.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');
    await studioAgent.selectProcessRootById(process);

    await studioAgent.assertVisible('#process-correlation-key-property', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOnCodeEditor('#process-correlation-key-property');
    await studioAgent.sendKeyboardInput([...newCorrelationKey.split('')]);
    // Escape closes autocomplete without accepting a suggestion. Enter blurs
    // OneLineFeelEditor (Escape does not). Canvas select then remounts the pane.
    await studioAgent.sendKeyboardInput(['Escape', 'enter']);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent, ELEMENT_INFO_PANE, ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.switchToPaneGroup('property');
    await studioAgent.selectProcessRootById(process);

    await studioAgent.assertVisible('#process-correlation-key-property', ASSERT_VISIBLE_TIMEOUT);

    const correlationKey = await studioAgent.getCodeEditorText('#process-correlation-key-property');
    assert.strictEqual(correlationKey, newCorrelationKey);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/MultiInstance: should change the element variable', async () => {
    const parallelMultiInstance = 'ParallelMultiInstanceTask';
    const startEvent = 'StartEvent_1';
    const newElementVariable = 'currentItem';

    await studioAgent.jumpToFileInSolution('multi-instance.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      parallelMultiInstance,
      INPUT_COLLECTION_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.assertVisible('[data-test--mi-element-variable-input]', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.clearTextInput('[data-test--mi-element-variable-input]');
    await studioAgent.clickOn('[data-test--mi-element-variable-input]');
    await studioAgent.sendKeyboardInput([...newElementVariable.split(''), 'enter']);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      parallelMultiInstance,
      INPUT_COLLECTION_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    const value = await studioAgent.getValue('[data-test--mi-element-variable-input]');
    assert.strictEqual(value, newElementVariable);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/MultiInstance: should change the output element variable', async () => {
    const parallelMultiInstance = 'ParallelMultiInstanceTask';
    const startEvent = 'StartEvent_1';
    const newOutputElementVariable = 'processedItem';

    await studioAgent.jumpToFileInSolution('multi-instance.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      parallelMultiInstance,
      OUTPUT_COLLECTION_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.assertVisible('[data-test--mi-output-element-variable-input]', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.clearTextInput('[data-test--mi-output-element-variable-input]');
    await studioAgent.clickOn('[data-test--mi-output-element-variable-input]');
    await studioAgent.sendKeyboardInput([...newOutputElementVariable.split(''), 'enter']);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      parallelMultiInstance,
      OUTPUT_COLLECTION_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    const value = await studioAgent.getValue('[data-test--mi-output-element-variable-input]');
    assert.strictEqual(value, newOutputElementVariable);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/MultiInstance: should change the completion condition', async () => {
    const parallelMultiInstance = 'ParallelMultiInstanceTask';
    const startEvent = 'StartEvent_1';
    const newCondition = 'nrOfCompletedInstances >= 3';

    await studioAgent.jumpToFileInSolution('multi-instance.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      parallelMultiInstance,
      COMPLETION_CONDITION_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.assertVisible('[data-test--mi-completion-condition-input]', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.clickOnCodeEditor('[data-test--mi-completion-condition-input]');
    await studioAgent.sendKeyboardInput([...newCondition.split('')]);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      parallelMultiInstance,
      COMPLETION_CONDITION_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    const condition = await studioAgent.getCodeEditorText('[data-test--mi-completion-condition-input]');
    assert.strictEqual(condition, newCondition);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/MultiInstance: should change the input collection', async () => {
    const parallelMultiInstance = 'ParallelMultiInstanceTask';
    const startEvent = 'StartEvent_1';
    const newInputCollection = 'token.current.items';

    await studioAgent.jumpToFileInSolution('multi-instance.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      parallelMultiInstance,
      INPUT_COLLECTION_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.assertVisible('[data-test--mi-evil-input-collection-input]', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.clickOnCodeEditor('[data-test--mi-evil-input-collection-input]');
    await studioAgent.sendKeyboardInput([...newInputCollection.split('')]);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      parallelMultiInstance,
      INPUT_COLLECTION_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    const inputCollection = await studioAgent.getCodeEditorText('[data-test--mi-evil-input-collection-input]');
    assert.strictEqual(inputCollection, newInputCollection);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/MultiInstance: should change the output collection', async () => {
    const parallelMultiInstance = 'ParallelMultiInstanceTask';
    const startEvent = 'StartEvent_1';
    const newOutputCollection = 'token.current.results';

    await studioAgent.jumpToFileInSolution('multi-instance.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      parallelMultiInstance,
      OUTPUT_COLLECTION_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.assertVisible('[data-test--mi-evil-output-collection-input]', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.clickOnCodeEditor('[data-test--mi-evil-output-collection-input]');
    await studioAgent.sendKeyboardInput([...newOutputCollection.split('')]);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      parallelMultiInstance,
      OUTPUT_COLLECTION_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    const outputCollection = await studioAgent.getCodeEditorText('[data-test--mi-evil-output-collection-input]');
    assert.strictEqual(outputCollection, newOutputCollection);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/SequentialMiSettings: should change the loop break condition', async () => {
    const sequentialMultiInstance = 'SequentialMultiInstanceTask';
    const startEvent = 'StartEvent_1';
    const newBreakCondition = 'token.current.error != null';

    await studioAgent.jumpToFileInSolution('multi-instance.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      sequentialMultiInstance,
      SEQUENTIAL_MI_SETTINGS_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.assertVisible('[data-test--seq-mi-loop-break-condition-input]', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.clickOnCodeEditor('[data-test--seq-mi-loop-break-condition-input]');
    await studioAgent.sendKeyboardInput([...newBreakCondition.split('')]);
    await studioAgent.sendKeyboardInput(['Escape']);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      sequentialMultiInstance,
      SEQUENTIAL_MI_SETTINGS_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    const breakCondition = await studioAgent.getCodeEditorText('[data-test--seq-mi-loop-break-condition-input]');
    assert.strictEqual(breakCondition, newBreakCondition);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/SequentialMiSettings: should change the loop interval', async () => {
    const sequentialMultiInstance = 'SequentialMultiInstanceTask';
    const startEvent = 'StartEvent_1';
    const newLoopInterval = 'PT5S';

    await studioAgent.jumpToFileInSolution('multi-instance.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      sequentialMultiInstance,
      SEQUENTIAL_MI_SETTINGS_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.assertVisible('[data-test--seq-mi-loop-interval-input]', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.clearTextInput('[data-test--seq-mi-loop-interval-input]');
    await studioAgent.clickOn('[data-test--seq-mi-loop-interval-input]');
    await studioAgent.sendKeyboardInput([...newLoopInterval.split(''), 'enter']);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      sequentialMultiInstance,
      SEQUENTIAL_MI_SETTINGS_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    const loopInterval = await studioAgent.getValue('[data-test--seq-mi-loop-interval-input]');
    assert.strictEqual(loopInterval, newLoopInterval);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/ParallelMiSettings: should change the max iterations', async () => {
    const parallelMultiInstance = 'ParallelMultiInstanceTask';
    const startEvent = 'StartEvent_1';
    const newMaxIterations = '50';

    await studioAgent.jumpToFileInSolution('multi-instance.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      parallelMultiInstance,
      PARALLEL_MI_SETTINGS_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.assertVisible('[data-test--par-mi-max-iterations-input]', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.clearTextInput('[data-test--par-mi-max-iterations-input]');
    await studioAgent.clickOn('[data-test--par-mi-max-iterations-input]');
    await studioAgent.sendKeyboardInput([...newMaxIterations.split(''), 'enter']);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      parallelMultiInstance,
      PARALLEL_MI_SETTINGS_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    const maxIterations = await studioAgent.getValue('[data-test--par-mi-max-iterations-input]');
    assert.strictEqual(maxIterations, newMaxIterations);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/ParallelMiSettings: parallel MI shows parallel pane, not sequential pane', async () => {
    const parallelMultiInstance = 'ParallelMultiInstanceTask';
    const startEvent = 'StartEvent_1';

    await studioAgent.jumpToFileInSolution('multi-instance.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      parallelMultiInstance,
      PARALLEL_MI_SETTINGS_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.assertVisible(PARALLEL_MI_SETTINGS_PANE, ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.assertNotVisible(SEQUENTIAL_MI_SETTINGS_PANE);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/SequentialMiSettings: sequential MI shows sequential pane, not parallel pane', async () => {
    const sequentialMultiInstance = 'SequentialMultiInstanceTask';
    const startEvent = 'StartEvent_1';

    await studioAgent.jumpToFileInSolution('multi-instance.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      sequentialMultiInstance,
      SEQUENTIAL_MI_SETTINGS_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.assertVisible(SEQUENTIAL_MI_SETTINGS_PANE, ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.assertNotVisible(PARALLEL_MI_SETTINGS_PANE);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/UserTask: should change the due date', async () => {
    const userTask = 'UserTask_1';
    const startEvent = 'StartEvent_1';
    const newDueDate = '2026-12-31';

    await studioAgent.jumpToFileInSolution('user-task.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(userTask, USER_TASK_PANE, ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.assertVisible('[data-test--user-task-due-date-input]', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.clickOnCodeEditor('[data-test--user-task-due-date-input]');
    await studioAgent.sendKeyboardInput([...newDueDate.split('')]);
    await studioAgent.sendKeyboardInput(['Escape']);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(userTask, USER_TASK_PANE, ASSERT_VISIBLE_TIMEOUT);

    const dueDate = await studioAgent.getCodeEditorText('[data-test--user-task-due-date-input]');
    assert.strictEqual(dueDate, newDueDate);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/UserTask: should change the priority', async () => {
    const userTask = 'UserTask_1';
    const startEvent = 'StartEvent_1';
    const newPriority = '50';

    await studioAgent.jumpToFileInSolution('user-task.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(userTask, USER_TASK_PANE, ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.assertVisible('[data-test--user-task-priority-input]', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.clearTextInput('[data-test--user-task-priority-input]');
    await studioAgent.clickOn('[data-test--user-task-priority-input]');
    await studioAgent.sendKeyboardInput([...newPriority.split(''), 'enter']);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(userTask, USER_TASK_PANE, ASSERT_VISIBLE_TIMEOUT);

    const priority = await studioAgent.getValue('[data-test--user-task-priority-input]');
    assert.strictEqual(priority, newPriority);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/SendTask: should change the selected message name', async () => {
    const newMessageName = 'newSendMessage';
    const sendTask1 = 'SendTask_1';
    const sendTask2 = 'SendTask_2';

    await studioAgent.jumpToFileInSolution('message-autocomplete.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(sendTask2);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(sendTask1, SEND_TASK_PANE, ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.assertVisible('#send-task-message-property', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clearSuggestionSelect('#send-task-message-property');
    await studioAgent.clickOn('#send-task-message-property');
    await studioAgent.sendKeyboardInput([...newMessageName.split('')]);
    await studioAgent.commitSuggestionCreateOption('#send-task-message-property', newMessageName);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(sendTask2, SEND_TASK_PANE, ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.assertVisible('#send-task-message-property', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('#send-task-message-property');

    await studioAgent.clickOn(`#send-task-message-property [data-test-option-value="${newMessageName}"]`);

    const selectedMessage = await studioAgent.getSuggestionSelectValue('#send-task-message-property');

    assert.strictEqual(selectedMessage, newMessageName);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/GatewayOutgoingFlows: should display outgoing flows pane', async () => {
    const gateway = 'Gateway_1hgnf7q';
    const startEvent = 'StartEvent_1mox3jl';

    await studioAgent.jumpToFileInSolution('condition-test.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      gateway,
      GATEWAY_OUTGOING_FLOWS_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.assertPaneVisible('bpmn/panes/properties/PropertiesGatewayOutgoingFlows');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/DataObject: should change the value contract', async () => {
    const dataObjectRef = 'DataObjectReference_07tf8p7';
    const startEvent = 'StartEvent_1';
    const newValueContract = '{"type":"object"}';

    await studioAgent.jumpToFileInSolution('data-object.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(dataObjectRef, DATA_OBJECT_PANE, ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.assertVisible('#data-object-value-contract', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.clickOnCodeEditor('#data-object-value-contract');
    await studioAgent.sendKeyboardInput([...newValueContract.split('')]);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(dataObjectRef, DATA_OBJECT_PANE, ASSERT_VISIBLE_TIMEOUT);

    const valueContract = await studioAgent.getCodeEditorText('#data-object-value-contract');
    assert.strictEqual(valueContract, newValueContract);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/Documentation: should open documentation in new tab', async () => {
    const startEvent = 'StartEvent_1';

    await studioAgent.jumpToFileInSolution('service-task.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('documentation');

    await studioAgent.assertVisible('[data-test--documentation-open-in-new-tab]', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.clickOn('[data-test--documentation-open-in-new-tab]');

    await studioAgent.pause(1000);
    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  // --- Multi-Selection, Palette, Replace Popup ---

  it('bpmn/elements/property-panel: should select two bpmn elements', async () => {
    await studioAgent.jumpToFileInSolution('link-event.bpmn');

    const linkEvent = 'LinkIntermediateThrowEvent1';
    const startEvent = 'StartEvent_1';
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectMultipleBpmnElementsByIds([startEvent, linkEvent]);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/palette: should display the data store entry at the palette', async () => {
    await studioAgent.sendKeyboardInput([CREATE_NEW_DOCUMENT]);
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.assertVisible('.entry.bpmn-icon-data-store', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/popup/replace: should display the conditional start event entry at the replace popup', async () => {
    const startEventId = 'StartEvent_1';
    await studioAgent.sendKeyboardInput([CREATE_NEW_DOCUMENT]);
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEventId);
    await studioAgent.switchToPaneGroup('property');
    await studioAgent.clickOn('.entry.bpmn-icon-screw-wrench');

    await studioAgent.assertVisible('.djs-popup.bpmn-replace', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.assertVisible('[data-id=replace-with-conditional-start]');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  // --- Without Selection ---

  it('bpmn/elements/property-panel/WithoutSelection: should select first participant from processes pane', async () => {
    await studioAgent.jumpToFileInSolution('participants.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.assertVisible('[data-test--process-pane-item="0"]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.pause(400);
    await studioAgent.clickOn('[data-test--process-pane-item="0"]');
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.assertPaneVisible('bpmn/panes/properties_process');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/WithoutSelection: should select second participant from processes pane', async () => {
    await studioAgent.jumpToFileInSolution('participants.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.assertVisible('[data-test--process-pane-item="1"]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.pause(400);
    await studioAgent.clickOn('[data-test--process-pane-item="1"]');
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.assertPaneVisible('bpmn/panes/properties_process');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  // --- Process Root ---

  it('bpmn/elements/property-panel/Process: should change a process id if process is root element', async () => {
    const startEvent = 'StartEvent_1';
    const newProcessId = 'RenamedProcessId';

    await studioAgent.jumpToFileInSolution('process-root.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.assertVisible('#process-id-property', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clearTextInput('#process-id-property');
    await studioAgent.clickOn('#process-id-property');
    await studioAgent.sendKeyboardInput([...newProcessId.split('')]);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');
    await studioAgent.selectProcessRootById(newProcessId);

    await studioAgent.assertVisible('#process-id-property', ASSERT_VISIBLE_TIMEOUT);

    const processId = await studioAgent.getValue('#process-id-property');

    assert.strictEqual(processId, newProcessId);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/Process: should change a process version if process is root element', async () => {
    const startEvent = 'StartEvent_1';
    const process = 'Process_1';
    const newProcessVersion = 'new-process-version';

    await studioAgent.jumpToFileInSolution('process-root.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.assertVisible('#process-version-property', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clearTextInput('#process-version-property');
    await studioAgent.clickOn('#process-version-property');
    await studioAgent.sendKeyboardInput([...newProcessVersion.split('')]);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');
    await studioAgent.selectProcessRootById(process);

    await studioAgent.assertVisible('#process-version-property', ASSERT_VISIBLE_TIMEOUT);

    const processVersion = await studioAgent.getValue('#process-version-property');

    assert.strictEqual(processVersion, newProcessVersion);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/Process: should change a process name if process is root element', async () => {
    const startEvent = 'StartEvent_1';
    const process = 'Process_1';
    const newProcessName = 'new-process-name';

    await studioAgent.jumpToFileInSolution('process-root.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.assertVisible('#process-name-property', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clearTextInput('#process-name-property');
    await studioAgent.clickOn('#process-name-property');
    await studioAgent.sendKeyboardInput([...newProcessName.split('')]);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');
    await studioAgent.selectProcessRootById(process);
    await studioAgent.assertVisible('#process-name-property', ASSERT_VISIBLE_TIMEOUT);

    const processName = await studioAgent.getValue('#process-name-property');

    assert.strictEqual(processName, newProcessName);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/Process: should change a process executable if process is root element', async () => {
    const startEvent = 'StartEvent_1';
    const process = 'Process_1';

    await studioAgent.jumpToFileInSolution('process-root.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.assertVisible('#process-executable-checkbox', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('#process-executable-checkbox');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');
    await studioAgent.selectProcessRootById(process);
    await studioAgent.assertVisible('#process-executable-checkbox', ASSERT_VISIBLE_TIMEOUT);

    const executable = await studioAgent.getAttribute('#process-executable-checkbox', 'checked');

    assert.strictEqual(executable, null);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  // --- Participant ---

  it('bpmn/elements/property-panel/Participant: should change a process id if process is participant element', async () => {
    const participant = 'Participant_1';
    const startEvent = 'StartEvent_1';
    const newProcessId = 'new-process-id';

    await studioAgent.jumpToFileInSolution('process-participant.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');
    await studioAgent.selectParticipantById(participant);

    await studioAgent.assertVisible('#process-id-property', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clearTextInput('#process-id-property');
    await studioAgent.clickOn('#process-id-property');
    await studioAgent.sendKeyboardInput([...newProcessId.split(''), 'enter']);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);

    await studioAgent.selectParticipantById(participant);
    await studioAgent.assertVisible('#process-id-property', ASSERT_VISIBLE_TIMEOUT);

    const processId = await studioAgent.getValue('#process-id-property');

    assert.strictEqual(processId, newProcessId);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/Participant: should change a process version if process is participant element', async () => {
    const participant = 'Participant_1';
    const startEvent = 'StartEvent_1';
    const newProcessVersion = 'new-process-version';

    await studioAgent.jumpToFileInSolution('process-participant.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');
    await studioAgent.selectParticipantById(participant);

    await studioAgent.assertVisible('#process-version-property', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clearTextInput('#process-version-property');
    await studioAgent.clickOn('#process-version-property');
    await studioAgent.sendKeyboardInput([...newProcessVersion.split('')]);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.selectParticipantById(participant);

    await studioAgent.assertVisible('#process-version-property', ASSERT_VISIBLE_TIMEOUT);

    const processVersion = await studioAgent.getValue('#process-version-property');

    assert.strictEqual(processVersion, newProcessVersion);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/Participant: should change a process executable if process is participant element', async () => {
    const participant = 'Participant_1';
    const startEvent = 'StartEvent_1';

    await studioAgent.jumpToFileInSolution('process-participant.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');
    await studioAgent.selectParticipantById(participant);

    await studioAgent.assertVisible('#process-executable-checkbox', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('#process-executable-checkbox');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.selectParticipantById(participant);

    await studioAgent.assertVisible('#process-executable-checkbox', ASSERT_VISIBLE_TIMEOUT);

    const executable = await studioAgent.getAttribute('#process-executable-checkbox', 'checked');

    assert.strictEqual(executable, null);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/Participant: should change an element id if process is collapsed pool', async () => {
    const participant = 'collapsed_pool_1';
    const startEvent = 'StartEvent_1';
    const newParticipantId = 'new-participant-id';

    await studioAgent.jumpToFileInSolution('collapsed-pool.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');
    await studioAgent.selectParticipantById(participant);

    await studioAgent.assertVisible('#element-id-property', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clearTextInput('#element-id-property');
    await studioAgent.clickOn('#element-id-property');
    await studioAgent.sendKeyboardInput([...newParticipantId.split(''), 'enter']);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);

    await studioAgent.selectParticipantById(newParticipantId);
    await studioAgent.assertVisible('#element-id-property', ASSERT_VISIBLE_TIMEOUT);

    const participantId = await studioAgent.getValue('#element-id-property');

    assert.strictEqual(participantId, newParticipantId);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  // --- Loop Instance ---

  it('bpmn/elements/property-panel/LoopInstance: should change the loop condition of a Loop Task', async () => {
    const loopTask = 'LoopTask';
    const newCondition = 'token.current > 5';

    await studioAgent.jumpToFileInSolution('multi-instance.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement('StartEvent_1');
    await studioAgent.switchToPaneGroup('property');
    await studioAgent.selectBpmnElementByIdAndWaitForElement(loopTask, LOOP_CONFIGURATION_PANE, ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.assertPaneVisible('bpmn/panes/properties/PropertiesLoop');

    await studioAgent.clickOnCodeEditor('[data-test--loop-condition-input]');
    await studioAgent.sendKeyboardInput([...newCondition.split('')]);

    await studioAgent.assertVisible('[data-test--loop-condition-input]', ASSERT_VISIBLE_TIMEOUT);

    const condition = await studioAgent.getCodeEditorText('[data-test--loop-condition-input]');

    assert.strictEqual(condition, newCondition);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/LoopInstance: should change the max iterations of a Loop Task', async () => {
    const loopTask = 'LoopTask';
    const newMaxIterations = '100';

    await studioAgent.jumpToFileInSolution('multi-instance.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement('StartEvent_1');
    await studioAgent.switchToPaneGroup('property');
    await studioAgent.selectBpmnElementByIdAndWaitForElement(loopTask, LOOP_CONFIGURATION_PANE, ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.assertPaneVisible('bpmn/panes/properties/PropertiesLoop');

    await studioAgent.assertVisible('[data-test--loop-max-iterations-input]', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.clearTextInput('[data-test--loop-max-iterations-input]');
    await studioAgent.clickOn('[data-test--loop-max-iterations-input]');
    await studioAgent.sendKeyboardInput([...newMaxIterations.split(''), 'enter']);

    await studioAgent.assertVisible('[data-test--loop-max-iterations-input]', ASSERT_VISIBLE_TIMEOUT);

    const maxIterations = await studioAgent.getValue('[data-test--loop-max-iterations-input]');

    assert.strictEqual(maxIterations, newMaxIterations);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/LoopInstance: should display the testBefore select of a Loop Task', async () => {
    const loopTask = 'LoopTask';

    await studioAgent.jumpToFileInSolution('multi-instance.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement('StartEvent_1');
    await studioAgent.switchToPaneGroup('property');
    await studioAgent.selectBpmnElementByIdAndWaitForElement(loopTask, LOOP_CONFIGURATION_PANE, ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.assertPaneVisible('bpmn/panes/properties/PropertiesLoop');

    await studioAgent.assertVisible('#loop-test-before-property', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/LoopInstance: should change the loop interval of a Loop Task', async () => {
    const loopTask = 'LoopTask';
    const newInterval = 'PT5S';

    await studioAgent.jumpToFileInSolution('multi-instance.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement('StartEvent_1');
    await studioAgent.switchToPaneGroup('property');
    await studioAgent.selectBpmnElementByIdAndWaitForElement(loopTask, LOOP_CONFIGURATION_PANE, ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.assertPaneVisible('bpmn/panes/properties/PropertiesLoop');

    await studioAgent.assertVisible('[data-test--loop-interval-input]', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.clearTextInput('[data-test--loop-interval-input]');
    await studioAgent.clickOn('[data-test--loop-interval-input]');
    await studioAgent.sendKeyboardInput([...newInterval.split(''), 'enter']);

    await studioAgent.assertVisible('[data-test--loop-interval-input]', ASSERT_VISIBLE_TIMEOUT);

    const interval = await studioAgent.getValue('[data-test--loop-interval-input]');
    assert.strictEqual(interval, newInterval);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  // --- Parallel Multi Instance Info ---

  it('bpmn/elements/property-panel/ParallelMultiInstance: should show the info pane for a Parallel Multi Instance', async () => {
    const parallelMultiInstance = 'ParallelMultiInstanceTask';

    await studioAgent.jumpToFileInSolution('multi-instance.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement('StartEvent_1');
    await studioAgent.switchToPaneGroup('property');
    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      parallelMultiInstance,
      ELEMENT_INFO_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.assertPaneVisible('bpmn/panes/properties/PropertiesElementInfo');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  // --- Default Custom Start Token ---

  it('bpmn/elements/property-panel/DefaultCustomStartToken: should change a default custom start token of an element', async () => {
    const untypedTask = 'UntypedTask_1';
    const startEvent = 'StartEvent_1';
    const payloadKey = 'orderId';
    const payloadValue = 'alpha';

    await studioAgent.jumpToFileInSolution('untyped-task.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(untypedTask);
    await studioAgent.switchToPaneGroup('scripting');
    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      startEvent,
      '[data-test--default-custom-start-token-input]',
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.clickOn('[data-test--default-custom-start-token-input] [data-test--kv-builder-add-button]');
    await studioAgent.assertVisible('[data-test--kv-builder-key-input="0"]', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.clickOn('[data-test--kv-builder-key-input="0"]');
    await studioAgent.sendKeyboardInput([...payloadKey.split('')]);
    await studioAgent.clickOn('[data-test--kv-builder-value-input="0"]');
    await studioAgent.sendKeyboardInput([...payloadValue.split('')]);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(untypedTask);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      startEvent,
      '[data-test--default-custom-start-token-input]',
      ASSERT_VISIBLE_TIMEOUT,
    );

    assert.strictEqual(await studioAgent.getValue('[data-test--kv-builder-key-input="0"]'), payloadKey);
    assert.strictEqual(await studioAgent.getValue('[data-test--kv-builder-value-input="0"]'), payloadValue);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/DefaultCustomStartToken: should change a default custom start token from default custom start token tab', async () => {
    const startEvent = 'StartEvent_1';
    const payloadKey = 'orderId';
    const payloadValue = 'alpha';
    const payloadJson = `{"${payloadKey}":"${payloadValue}"}`;

    await studioAgent.jumpToFileInSolution('untyped-task.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('scripting');
    await studioAgent.assertVisible('[data-test--default-custom-start-token-input]', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('[data-test--open-default-custom-start-token-in-new-tab]');

    await studioAgent.assertVisible(
      '[data-test--bpmn-default-custom-start-token-fragment-editor]',
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.clickOnCodeEditor('[data-test--bpmn-default-custom-start-token-fragment-editor]');

    await studioAgent.clearCodeEditor('[data-test--bpmn-default-custom-start-token-fragment-editor]');
    await studioAgent.sendKeyboardInput([...payloadJson.split('')]);

    await studioAgent.clickOn('[data-test--bpmn-default-custom-start-token-fragment-link-to-editor-document]');
    await studioAgent.assertVisible('[data-test--default-custom-start-token-input]', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.assertVisible('[data-test--kv-builder-key-input="0"]', ASSERT_VISIBLE_TIMEOUT);

    assert.strictEqual(await studioAgent.getValue('[data-test--kv-builder-key-input="0"]'), payloadKey);
    assert.strictEqual(await studioAgent.getValue('[data-test--kv-builder-value-input="0"]'), payloadValue);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  // --- Custom Attributes ---

  it('bpmn/elements/property-panel/CustomAttributes: should change a custom property name', async () => {
    const startEvent = 'StartEvent_1';
    const endEvent = 'EndEvent_1';
    const newPropertyName = 'new-name';

    await studioAgent.jumpToFileInSolution('custom-properties.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('scripting');
    await studioAgent.assertPaneVisible('bpmn/panes/PropertiesCustomAttributes');

    await studioAgent.clearTextInput('#custom-property-0-name');

    await studioAgent.clickOn('#custom-property-0-name');
    await studioAgent.sendKeyboardInput([...newPropertyName.split(''), 'enter']);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(endEvent);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      startEvent,
      '#custom-property-0-name',
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.assertVisible('#custom-property-0-name', ASSERT_VISIBLE_TIMEOUT);

    const name = await studioAgent.getValue('#custom-property-0-name');

    assert.strictEqual(name, newPropertyName);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/CustomAttributes: should change a custom property value', async () => {
    const startEvent = 'StartEvent_1';
    const endEvent = 'EndEvent_1';
    const newPropertyValue = 'new-value';

    await studioAgent.jumpToFileInSolution('custom-properties.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('scripting');
    await studioAgent.assertPaneVisible('bpmn/panes/PropertiesCustomAttributes');

    await studioAgent.clearTextInput('#custom-property-0-value');

    await studioAgent.sendKeyboardInput([...newPropertyValue.split(''), 'enter']);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(endEvent);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      startEvent,
      '#custom-property-0-value',
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.assertVisible('#custom-property-0-value', ASSERT_VISIBLE_TIMEOUT);

    const value = await studioAgent.getValue('#custom-property-0-value');

    assert.strictEqual(value, newPropertyValue);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/CustomAttributes: should add a custom property', async () => {
    const startEvent = 'StartEvent_1';
    const endEvent = 'EndEvent_1';
    const newPropertyName = 'new-name';
    const newPropertyValue = 'new-value';

    await studioAgent.jumpToFileInSolution('custom-properties.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('scripting');
    await studioAgent.assertPaneVisible('bpmn/panes/PropertiesCustomAttributes');

    await studioAgent.clickOn('#custom-property-5-name');
    await studioAgent.sendKeyboardInput([...newPropertyName.split(''), 'enter']);
    await studioAgent.clickOn('#custom-property-5-value');
    await studioAgent.sendKeyboardInput([...newPropertyValue.split(''), 'enter']);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(endEvent);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      startEvent,
      '#custom-property-5-name',
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.assertVisible('#custom-property-5-value', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.assertVisible('#custom-property-5-name', ASSERT_VISIBLE_TIMEOUT);

    const name = await studioAgent.getValue('#custom-property-5-name');
    const value = await studioAgent.getValue('#custom-property-5-value');

    assert.strictEqual(name, newPropertyName);
    assert.strictEqual(value, newPropertyValue);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/CustomAttributes: should delete a custom property', async () => {
    const startEvent = 'StartEvent_1';

    await studioAgent.jumpToFileInSolution('custom-properties.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('scripting');
    await studioAgent.assertPaneVisible('bpmn/panes/PropertiesCustomAttributes');

    await studioAgent.assertVisible('#custom-property-1-value', ASSERT_VISIBLE_TIMEOUT);

    const name = await studioAgent.getValue('#custom-property-1-name');
    const value = await studioAgent.getValue('#custom-property-1-value');

    await studioAgent.clearTextInput('#custom-property-1-name');
    await studioAgent.sendKeyboardInput(['enter']);
    await studioAgent.clearTextInput('#custom-property-1-value');
    await studioAgent.sendKeyboardInput(['enter']);

    await studioAgent.clickOn('#custom-property-2-name');

    await studioAgent.assertVisible('#custom-property-1-value', ASSERT_VISIBLE_TIMEOUT);

    const otherName = await studioAgent.getValue('#custom-property-1-name');
    const otherValue = await studioAgent.getValue('#custom-property-1-value');

    assert.notStrictEqual(name, otherName);
    assert.notStrictEqual(value, otherValue);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  // --- Group ---

  it('bpmn/elements/property-panel/Group: should change a group category value', async () => {
    const group = 'Group_1';
    const startEvent = 'StartEvent_1';
    const newCategoryValue = 'my new category value';

    await studioAgent.jumpToFileInSolution('group.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');
    await studioAgent.selectLeakyBpmnElementById(group);
    await studioAgent.assertVisible('#group-category-value-property', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('#group-category-value-property');
    await studioAgent.clearTextInput('#group-category-value-property');
    await studioAgent.sendKeyboardInput([...newCategoryValue.split(''), 'enter']);

    await studioAgent.switchToPaneGroup('property');
    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent, ELEMENT_INFO_PANE, ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.selectLeakyBpmnElementById(group);

    await studioAgent.assertVisible('#group-category-value-property', ASSERT_VISIBLE_TIMEOUT);

    const categoryValue = await studioAgent.getValue('#group-category-value-property');
    assert.strictEqual(categoryValue, newCategoryValue);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  // --- Message Intermediate Catch Event ---

  it('bpmn/elements/property-panel/MessageIntermediateCatchEvent: should change the selected message name of an intermediate catch event and select it by second catch event', async () => {
    const newMessageName = 'newMessage';
    const intermediateCatchEvent1 = 'IntermediateCatchEvent_1';
    const intermediateCatchEvent2 = 'IntermediateCatchEvent_2';

    await studioAgent.jumpToFileInSolution('message-autocomplete.bpmn');

    await studioAgent.waitForInteractiveBpmnDocument();
    await studioAgent.selectBpmnElementByIdAndWaitForElement(intermediateCatchEvent2);
    await studioAgent.switchToPaneGroup('property');
    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      intermediateCatchEvent1,
      MESSAGE_INTERMEDIATE_CATCH_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.assertVisible('#message-intermediate-catch-event-message-property', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clearSuggestionSelect('#message-intermediate-catch-event-message-property');
    await studioAgent.clickOn('#message-intermediate-catch-event-message-property');
    await studioAgent.sendKeyboardInput([...newMessageName.split('')]);
    await studioAgent.commitSuggestionCreateOption(
      '#message-intermediate-catch-event-message-property',
      newMessageName,
    );

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      intermediateCatchEvent2,
      MESSAGE_INTERMEDIATE_CATCH_EVENT_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.assertVisible('#message-intermediate-catch-event-message-property', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('#message-intermediate-catch-event-message-property');

    await studioAgent.clickOn(
      `#message-intermediate-catch-event-message-property [data-test-option-value="${newMessageName}"]`,
    );
    const selectedMessage = await studioAgent.getSuggestionSelectValue(
      '#message-intermediate-catch-event-message-property',
    );

    assert.strictEqual(newMessageName, selectedMessage);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/AdHocSubprocess: should change the ordering', async () => {
    const startEvent = 'StartEvent_1';
    const adHocSubProcess = 'AdHocSubProcess_1';

    await studioAgent.jumpToFileInSolution('adhoc-subprocess.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      adHocSubProcess,
      AD_HOC_SUBPROCESS_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.assertVisible('#adhoc-subprocess-ordering-property', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('#adhoc-subprocess-ordering-property');
    await studioAgent.clickOn('#adhoc-subprocess-ordering-property [data-test-option-value="Sequential"]');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      adHocSubProcess,
      AD_HOC_SUBPROCESS_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    const ordering = await studioAgent.getText('#adhoc-subprocess-ordering-property .react-select__single-value');
    assert.strictEqual(ordering, 'Sequential');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/AdHocSubprocess: should change cancel remaining instances', async () => {
    const startEvent = 'StartEvent_1';
    const adHocSubProcess = 'AdHocSubProcess_1';

    await studioAgent.jumpToFileInSolution('adhoc-subprocess.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      adHocSubProcess,
      AD_HOC_SUBPROCESS_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.assertVisible('#adhoc-subprocess-cancel-remaining-property', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clickOn('#adhoc-subprocess-cancel-remaining-property');
    await studioAgent.clickOn('#adhoc-subprocess-cancel-remaining-property [data-test-option-value="false"]');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      adHocSubProcess,
      AD_HOC_SUBPROCESS_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    const label = await studioAgent.getText('#adhoc-subprocess-cancel-remaining-property .react-select__single-value');
    assert.strictEqual(label, 'No (drain naturally)');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/AdHocSubprocess: should change the implementation', async () => {
    const startEvent = 'StartEvent_1';
    const adHocSubProcess = 'AdHocSubProcess_1';
    const newImplementation = 'my-adhoc-plugin';

    await studioAgent.jumpToFileInSolution('adhoc-subprocess.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      adHocSubProcess,
      AD_HOC_SUBPROCESS_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.assertVisible('#adhoc-subprocess-implementation-property', ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.clearTextInput('#adhoc-subprocess-implementation-property');
    await studioAgent.clickOn('#adhoc-subprocess-implementation-property');
    await studioAgent.sendKeyboardInput([...newImplementation.split(''), 'enter']);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      adHocSubProcess,
      AD_HOC_SUBPROCESS_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    const implementation = await studioAgent.getValue('#adhoc-subprocess-implementation-property');
    assert.strictEqual(implementation, newImplementation);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/AdHocSubprocess: should change the completion condition', async () => {
    const startEvent = 'StartEvent_1';
    const adHocSubProcess = 'AdHocSubProcess_1';
    const newCondition = 'performedActivities >= 1';

    await studioAgent.jumpToFileInSolution('adhoc-subprocess.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      adHocSubProcess,
      AD_HOC_SUBPROCESS_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.assertVisible('[data-test--adhoc-subprocess-completion-condition-input]', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.clickOnCodeEditor('[data-test--adhoc-subprocess-completion-condition-input]');
    await studioAgent.sendKeyboardInput([...newCondition.split('')]);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      adHocSubProcess,
      AD_HOC_SUBPROCESS_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    const condition = await studioAgent.getCodeEditorText('[data-test--adhoc-subprocess-completion-condition-input]');
    assert.strictEqual(condition, newCondition);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/AdHocSubprocess: should change the active elements expression', async () => {
    const startEvent = 'StartEvent_1';
    const adHocSubProcess = 'AdHocSubProcess_1';
    const newExpression = 'context.activeTaskIds';

    await studioAgent.jumpToFileInSolution('adhoc-subprocess.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      adHocSubProcess,
      AD_HOC_SUBPROCESS_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    await studioAgent.assertVisible('[data-test--adhoc-subprocess-active-elements-input]', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.clickOnCodeEditor('[data-test--adhoc-subprocess-active-elements-input]');
    await studioAgent.sendKeyboardInput([...newExpression.split('')]);

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      adHocSubProcess,
      AD_HOC_SUBPROCESS_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );

    const expression = await studioAgent.getCodeEditorText('[data-test--adhoc-subprocess-active-elements-input]');
    assert.strictEqual(expression, newExpression);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/elements/property-panel/AdHocSubprocess: should only show the ad-hoc pane for ad-hoc sub-processes', async () => {
    const startEvent = 'StartEvent_1';
    const adHocSubProcess = 'AdHocSubProcess_1';
    const endEvent = 'EndEvent_1';

    await studioAgent.jumpToFileInSolution('adhoc-subprocess.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.switchToPaneGroup('property');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(
      adHocSubProcess,
      AD_HOC_SUBPROCESS_PANE,
      ASSERT_VISIBLE_TIMEOUT,
    );
    await studioAgent.assertPaneVisible('bpmn/panes/properties/PropertiesAdHocSubprocess');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(startEvent);
    await studioAgent.assertPaneNotVisible('bpmn/panes/properties/PropertiesAdHocSubprocess');

    await studioAgent.selectBpmnElementByIdAndWaitForElement(endEvent);
    await studioAgent.assertPaneNotVisible('bpmn/panes/properties/PropertiesAdHocSubprocess');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });
});
