// --- Built-in bpmnlint rule factories (manual bundling for browser) ---
import conditionalFlows from 'bpmnlint/rules/conditional-flows';
import endEventRequired from 'bpmnlint/rules/end-event-required';
import eventSubProcessTypedStartEvent from 'bpmnlint/rules/event-sub-process-typed-start-event';
import fakeJoin from 'bpmnlint/rules/fake-join';
import labelRequired from 'bpmnlint/rules/label-required';
import noComplexGateway from 'bpmnlint/rules/no-complex-gateway';
import noDisconnected from 'bpmnlint/rules/no-disconnected';
import noGatewayJoinFork from 'bpmnlint/rules/no-gateway-join-fork';
import noImplicitSplit from 'bpmnlint/rules/no-implicit-split';
import noInclusiveGateway from 'bpmnlint/rules/no-inclusive-gateway';
import singleBlankStartEvent from 'bpmnlint/rules/single-blank-start-event';
import startEventRequired from 'bpmnlint/rules/start-event-required';
import subProcessBlankStartEvent from 'bpmnlint/rules/sub-process-blank-start-event';
import superfluousGateway from 'bpmnlint/rules/superfluous-gateway';

import type {
  BpmnlintRuleFactory,
  LintFinding,
  LintProfileConfig,
  RuleMetadata,
  RuleSeverityConfig,
  ScorePolicy,
} from '../types';
import type { ProcessModelAnalyzer } from './ProcessModelAnalyzer';
// --- Custom: BPMN Spec ---

import {
  adhocSubprocessActivities,
  adhocSubprocessEventScope,
  adhocSubprocessFlowEvents,
  adhocSubprocessNesting,
} from './bpmn-spec/adhoc-subprocess-structure';
import boundaryEventNoIncoming from './bpmn-spec/boundary-event-no-incoming';
import cancelEventTransactionScope from './bpmn-spec/cancel-event-transaction-scope';
import compensationBoundaryNoOutgoing from './bpmn-spec/compensation-boundary-no-outgoing';
import defaultFlowNoCondition from './bpmn-spec/default-flow-no-condition';
import escalationBoundaryHost from './bpmn-spec/escalation-boundary-host';
import eventGatewayMinOutgoing from './bpmn-spec/event-gateway-min-outgoing';
import eventGatewayReceiveTaskBoundary from './bpmn-spec/event-gateway-receive-task-boundary';
import eventGatewayTargetTypes from './bpmn-spec/event-gateway-target-types';
import eventGatewayTargetsNoExtraIncoming from './bpmn-spec/event-gateway-targets-no-extra-incoming';
import eventSubprocessNoFlows from './bpmn-spec/event-subprocess-no-flows';
import eventSubprocessSingleStartEvent from './bpmn-spec/event-subprocess-single-start-event';
import eventSubprocessStartEventType from './bpmn-spec/event-subprocess-start-event-type';
import gatewayDirectionConsistency from './bpmn-spec/gateway-direction-consistency';
import nestedTransaction from './bpmn-spec/nested-transaction';
import noCrossBoundaryFlows from './bpmn-spec/no-cross-boundary-flows';
import startEventNoConditions from './bpmn-spec/start-event-no-conditions';
import topLevelStartEventType from './bpmn-spec/top-level-start-event-type';
import transactionCancelNoBoundary from './bpmn-spec/transaction-cancel-no-boundary';
import transactionCancelNoCompensable from './bpmn-spec/transaction-cancel-no-compensable';
// --- Custom: Execution Readiness ---

import {
  adhocSubprocessCompletion,
  adhocSubprocessDefaultOrdering,
  adhocSubprocessOrdering,
} from './execution-readiness/adhoc-subprocess-config';
import businessRuleTaskConfig from './execution-readiness/business-rule-task-config';
import callActivityTarget from './execution-readiness/call-activity-target';
import { complexGatewayJoinCondition, complexGatewayRegion } from './execution-readiness/complex-gateway-join';
import complexGatewaySplitConditions from './execution-readiness/complex-gateway-split-conditions';
import errorEventConfig from './execution-readiness/error-event-config';
import {
  conditionalEventCondition,
  intermediateTimerCycle,
  linkEventName,
  linkEventPairing,
  signalEventReference,
} from './execution-readiness/event-definition-config';
import messageEventReference from './execution-readiness/message-event-reference';
import multiInstanceConfig from './execution-readiness/multi-instance-config';
import processExecutable from './execution-readiness/process-executable';
import processVersion from './execution-readiness/process-version';
import scriptTaskConfig from './execution-readiness/script-task-config';
import serviceTaskImplementation from './execution-readiness/service-task-implementation';
import standardLoopConfig, { standardLoopMaximum } from './execution-readiness/standard-loop-config';
import timerFormat from './execution-readiness/timer-format';
import userTaskAssignment from './execution-readiness/user-task-assignment';
import validProcessId from './execution-readiness/valid-process-id';
import xorGatewayConditions from './execution-readiness/xor-gateway-conditions';
// --- Custom: Logic Patterns (post-processing) ---

import checkAsyncWaitState from './logic-patterns/async-wait-state';
import checkGatewayComplexity from './logic-patterns/gateway-complexity';
import checkGodProcess from './logic-patterns/god-process';
import checkInfiniteLoop from './logic-patterns/infinite-loop';
import checkMissingCompensation from './logic-patterns/missing-compensation';
import checkNestingDepth from './logic-patterns/nesting-depth';
import checkParallelEndWithoutJoin from './logic-patterns/parallel-end-without-join';
import checkParallelizationPotential from './logic-patterns/parallelization-potential';
import checkProcessComplexity from './logic-patterns/process-complexity';
import checkProcessSize from './logic-patterns/process-size';
import checkReceiveWithoutTimeout from './logic-patterns/receive-without-timeout';
import checkRetryAntiPattern from './logic-patterns/retry-anti-pattern';
import checkSubprocessErrorHandling from './logic-patterns/subprocess-error-handling';
import checkTerminateEndEventWarning from './logic-patterns/terminate-end-event-warning';
import checkTimeoutEscalation from './logic-patterns/timeout-escalation';
import checkTransactionWithoutCompensation from './logic-patterns/transaction-without-compensation';
import checkUserTaskWithoutTimer from './logic-patterns/user-task-without-timer';
// --- Custom: Naming Quality ---

import endEventGenericLabel from './naming-quality/end-event-generic-label';
import flowLabelRequired from './naming-quality/flow-label-required';
import gatewayQuestionFormat from './naming-quality/gateway-question-format';
import inconsistentFlowLabels from './naming-quality/inconsistent-flow-labels';
import mixedLanguage from './naming-quality/mixed-language';
import taskNameVerbPattern from './naming-quality/task-name-verb-pattern';
// --- Custom: PDA Compliance (post-processing) ---

import checkCanonicalDataFlow from './pda-compliance/canonical-data-flow';
import checkCanonicalDataNaming from './pda-compliance/canonical-data-naming';
import checkDmnExternalization from './pda-compliance/dmn-externalization';
import checkLayerSeparation from './pda-compliance/layer-separation';
import checkSystemIndependentNaming from './pda-compliance/system-independent-naming';
import checkTechnicalConditions from './pda-compliance/technical-conditions';
// --- Custom: Structure ---

import conditionalFlowsNoGateway from './structure/conditional-flows-no-gateway';
import gatewayTypeMismatch from './structure/gateway-type-mismatch';
import multipleEventDefinitions from './structure/multiple-event-definitions';
import noDeadEnd from './structure/no-dead-end';
import orphanEndEvent from './structure/orphan-end-event';
import processErrorEvents from './structure/process-error-events';
import serviceTaskErrorBoundary from './structure/service-task-error-boundary';
import timerDefinition from './structure/timer-definition';
import unreachableElements from './structure/unreachable-elements';

// --- Rule factory maps ---

export const builtinRuleFactories: Record<string, BpmnlintRuleFactory> = {
  'conditional-flows': conditionalFlows,
  'end-event-required': endEventRequired,
  'event-sub-process-typed-start-event': eventSubProcessTypedStartEvent,
  'fake-join': fakeJoin,
  'label-required': labelRequired,
  'no-complex-gateway': noComplexGateway,
  'no-disconnected': noDisconnected,
  'no-gateway-join-fork': noGatewayJoinFork,
  'no-implicit-split': noImplicitSplit,
  'no-inclusive-gateway': noInclusiveGateway,
  'single-blank-start-event': singleBlankStartEvent,
  'start-event-required': startEventRequired,
  'sub-process-blank-start-event': subProcessBlankStartEvent,
  'superfluous-gateway': superfluousGateway,
};

export const customRuleFactories: Record<string, BpmnlintRuleFactory> = {
  // BPMN Spec
  'default-flow-no-condition': defaultFlowNoCondition,
  'start-event-no-conditions': startEventNoConditions,
  'event-subprocess-no-flows': eventSubprocessNoFlows,
  'event-subprocess-single-start-event': eventSubprocessSingleStartEvent,
  'event-subprocess-start-event-type': eventSubprocessStartEventType,
  'event-gateway-min-outgoing': eventGatewayMinOutgoing,
  'event-gateway-target-types': eventGatewayTargetTypes,
  'event-gateway-targets-no-extra-incoming': eventGatewayTargetsNoExtraIncoming,
  'boundary-event-no-incoming': boundaryEventNoIncoming,
  'no-cross-boundary-flows': noCrossBoundaryFlows,
  'compensation-boundary-no-outgoing': compensationBoundaryNoOutgoing,
  'gateway-direction-consistency': gatewayDirectionConsistency,
  'escalation-boundary-host': escalationBoundaryHost,
  'cancel-event-transaction-scope': cancelEventTransactionScope,
  'transaction-cancel-no-boundary': transactionCancelNoBoundary,
  'transaction-cancel-no-compensable': transactionCancelNoCompensable,
  'top-level-start-event-type': topLevelStartEventType,
  'adhoc-subprocess-flow-events': adhocSubprocessFlowEvents,
  'adhoc-subprocess-activities': adhocSubprocessActivities,
  'adhoc-subprocess-nesting': adhocSubprocessNesting,
  'adhoc-subprocess-event-scope': adhocSubprocessEventScope,
  'nested-transaction': nestedTransaction,
  'event-gateway-receive-task-boundary': eventGatewayReceiveTaskBoundary,
  // Structure
  'service-task-error-boundary': serviceTaskErrorBoundary,
  'no-dead-end': noDeadEnd,
  'timer-definition': timerDefinition,
  'process-error-events': processErrorEvents,
  'unreachable-elements': unreachableElements,
  'orphan-end-event': orphanEndEvent,
  'multiple-event-definitions': multipleEventDefinitions,
  'conditional-flows-no-gateway': conditionalFlowsNoGateway,
  'gateway-type-mismatch': gatewayTypeMismatch,
  // Execution Readiness
  'process-executable': processExecutable,
  'process-version': processVersion,
  'valid-process-id': validProcessId,
  'service-task-implementation': serviceTaskImplementation,
  'user-task-assignment': userTaskAssignment,
  'timer-format': timerFormat,
  'error-event-config': errorEventConfig,
  'message-event-reference': messageEventReference,
  'script-task-config': scriptTaskConfig,
  'call-activity-target': callActivityTarget,
  'multi-instance-config': multiInstanceConfig,
  'standard-loop-config': standardLoopConfig,
  'standard-loop-maximum': standardLoopMaximum,
  'xor-gateway-conditions': xorGatewayConditions,
  'complex-gateway-split-conditions': complexGatewaySplitConditions,
  'complex-gateway-join-condition': complexGatewayJoinCondition,
  'complex-gateway-region': complexGatewayRegion,
  'adhoc-subprocess-completion': adhocSubprocessCompletion,
  'adhoc-subprocess-ordering': adhocSubprocessOrdering,
  'adhoc-subprocess-default-ordering': adhocSubprocessDefaultOrdering,
  'signal-event-reference': signalEventReference,
  'conditional-event-condition': conditionalEventCondition,
  'link-event-name': linkEventName,
  'link-event-pairing': linkEventPairing,
  'intermediate-timer-cycle': intermediateTimerCycle,
  'business-rule-task-config': businessRuleTaskConfig,
  // Naming Quality
  'task-name-verb-pattern': taskNameVerbPattern,
  'end-event-generic-label': endEventGenericLabel,
  'mixed-language': mixedLanguage,
  'gateway-question-format': gatewayQuestionFormat,
  'flow-label-required': flowLabelRequired,
  'inconsistent-flow-labels': inconsistentFlowLabels,
};

// --- Post-processing rule factories (analyzer-based rules) ---

export type PostProcessingRuleFn = (analyzer: ProcessModelAnalyzer, severity: RuleSeverityConfig) => LintFinding[];

export const postProcessingRuleFactories: Record<string, PostProcessingRuleFn> = {
  // Logic Patterns (AST-2xx)
  'god-process': checkGodProcess,
  'missing-compensation': checkMissingCompensation,
  'timeout-escalation': checkTimeoutEscalation,
  'parallelization-potential': checkParallelizationPotential,
  'async-wait-state': checkAsyncWaitState,
  'gateway-complexity': checkGatewayComplexity,
  'subprocess-error-handling': checkSubprocessErrorHandling,
  'infinite-loop': checkInfiniteLoop,
  'process-complexity': checkProcessComplexity,
  'process-size': checkProcessSize,
  'nesting-depth': checkNestingDepth,
  'user-task-without-timer': checkUserTaskWithoutTimer,
  'receive-without-timeout': checkReceiveWithoutTimeout,
  'transaction-without-compensation': checkTransactionWithoutCompensation,
  'retry-anti-pattern': checkRetryAntiPattern,
  'parallel-end-without-join': checkParallelEndWithoutJoin,
  'terminate-end-event-warning': checkTerminateEndEventWarning,
  // PDA Compliance (AST-1xx)
  'system-independent-naming': checkSystemIndependentNaming,
  'technical-conditions': checkTechnicalConditions,
  'canonical-data-naming': checkCanonicalDataNaming,
  'dmn-externalization': checkDmnExternalization,
  'layer-separation': checkLayerSeparation,
  'canonical-data-flow': checkCanonicalDataFlow,
};

// --- Profiles ---

const developmentScorePolicy: ScorePolicy = {
  validMinPercent: 85,
  riskyMinPercent: 60,
  instantFailOnAnyError: false,
  instantRiskOnAnyWarning: false,
};

const productionScorePolicy: ScorePolicy = {
  validMinPercent: 95,
  riskyMinPercent: 80,
  instantFailOnAnyError: true,
  instantRiskOnAnyWarning: true,
};

export const profiles: Record<string, LintProfileConfig> = {
  'bpmn-development': {
    scorePolicy: developmentScorePolicy,
    rules: {
      // Built-in bpmnlint rules
      'start-event-required': 'error',
      'end-event-required': 'error',
      'fake-join': 'warn',
      'no-implicit-split': 'warn',
      'no-disconnected': 'off',
      'no-gateway-join-fork': 'off',
      'single-blank-start-event': 'warn',
      'superfluous-gateway': 'warn',
      'conditional-flows': 'off',
      'label-required': 'warn',
      'sub-process-blank-start-event': 'warn',
      'event-sub-process-typed-start-event': 'warn',
      'no-complex-gateway': 'off',
      'no-inclusive-gateway': 'off',
      // BPMN Spec (BSC)
      'default-flow-no-condition': 'error',
      'start-event-no-conditions': 'off',
      'event-subprocess-no-flows': 'error',
      'event-subprocess-single-start-event': 'error',
      'event-subprocess-start-event-type': 'error',
      'event-gateway-min-outgoing': 'error',
      'event-gateway-target-types': 'error',
      'event-gateway-targets-no-extra-incoming': 'error',
      'boundary-event-no-incoming': 'error',
      'no-cross-boundary-flows': 'error',
      'compensation-boundary-no-outgoing': 'error',
      'gateway-direction-consistency': 'warn',
      'escalation-boundary-host': 'info',
      'cancel-event-transaction-scope': 'error',
      'transaction-cancel-no-boundary': 'warn',
      'transaction-cancel-no-compensable': 'info',
      'top-level-start-event-type': 'error',
      'adhoc-subprocess-flow-events': 'error',
      'adhoc-subprocess-activities': 'error',
      'adhoc-subprocess-nesting': 'error',
      'adhoc-subprocess-event-scope': 'error',
      'nested-transaction': 'error',
      'event-gateway-receive-task-boundary': 'error',
      // Structure (AST)
      'service-task-error-boundary': 'warn',
      'no-dead-end': 'warn',
      'timer-definition': 'error',
      'process-error-events': 'off',
      'unreachable-elements': 'error',
      'orphan-end-event': 'off',
      'multiple-event-definitions': 'warn',
      'conditional-flows-no-gateway': 'info',
      'gateway-type-mismatch': 'info',
      // Execution Readiness (off for bpmn-development unless the Engine rejects the deployment)
      'process-executable': 'off',
      'process-version': 'error',
      'valid-process-id': 'off',
      'service-task-implementation': 'error',
      'user-task-assignment': 'off',
      'timer-format': 'off',
      'error-event-config': 'info',
      'message-event-reference': 'error',
      'script-task-config': 'error',
      'call-activity-target': 'error',
      'multi-instance-config': 'error',
      'standard-loop-config': 'error',
      'standard-loop-maximum': 'off',
      'xor-gateway-conditions': 'warn',
      'complex-gateway-split-conditions': 'warn',
      'complex-gateway-join-condition': 'error',
      'complex-gateway-region': 'error',
      'adhoc-subprocess-completion': 'off',
      'adhoc-subprocess-ordering': 'error',
      'adhoc-subprocess-default-ordering': 'off',
      'signal-event-reference': 'error',
      'conditional-event-condition': 'error',
      'link-event-name': 'error',
      'link-event-pairing': 'warn',
      'intermediate-timer-cycle': 'warn',
      'business-rule-task-config': 'error',
      // Naming Quality
      'task-name-verb-pattern': 'info',
      'end-event-generic-label': 'info',
      'mixed-language': 'off',
      'gateway-question-format': 'info',
      'flow-label-required': 'warn',
      'inconsistent-flow-labels': 'off',
      // Logic Patterns (AST-2xx)
      'god-process': 'warn',
      'missing-compensation': 'off',
      'timeout-escalation': 'info',
      'parallelization-potential': 'info',
      'async-wait-state': 'info',
      'gateway-complexity': 'info',
      'subprocess-error-handling': 'info',
      'infinite-loop': 'error',
      'process-complexity': 'info',
      'process-size': 'info',
      'nesting-depth': 'info',
      'user-task-without-timer': 'info',
      'receive-without-timeout': 'warn',
      'transaction-without-compensation': 'info',
      'retry-anti-pattern': 'info',
      'parallel-end-without-join': 'info',
      'terminate-end-event-warning': 'off',
      // PDA Compliance (AST-1xx)
      'system-independent-naming': 'warn',
      'technical-conditions': 'off',
      'canonical-data-naming': 'warn',
      'dmn-externalization': 'off',
      'layer-separation': 'info',
      'canonical-data-flow': 'info',
    },
  },
  'bpmn-production-ready': {
    scorePolicy: productionScorePolicy,
    rules: {
      // Built-in bpmnlint rules
      'start-event-required': 'error',
      'end-event-required': 'error',
      'fake-join': 'error',
      'no-implicit-split': 'error',
      'no-disconnected': 'off',
      'no-gateway-join-fork': 'off',
      'single-blank-start-event': 'error',
      'superfluous-gateway': 'warn',
      'conditional-flows': 'off',
      'label-required': 'warn',
      'sub-process-blank-start-event': 'error',
      'event-sub-process-typed-start-event': 'error',
      'no-complex-gateway': 'off',
      'no-inclusive-gateway': 'off',
      // BPMN Spec (BSC)
      'default-flow-no-condition': 'error',
      'start-event-no-conditions': 'off',
      'event-subprocess-no-flows': 'error',
      'event-subprocess-single-start-event': 'error',
      'event-subprocess-start-event-type': 'error',
      'event-gateway-min-outgoing': 'error',
      'event-gateway-target-types': 'error',
      'event-gateway-targets-no-extra-incoming': 'error',
      'boundary-event-no-incoming': 'error',
      'no-cross-boundary-flows': 'error',
      'compensation-boundary-no-outgoing': 'error',
      'gateway-direction-consistency': 'error',
      'escalation-boundary-host': 'warn',
      'cancel-event-transaction-scope': 'error',
      'transaction-cancel-no-boundary': 'error',
      'transaction-cancel-no-compensable': 'warn',
      'top-level-start-event-type': 'error',
      'adhoc-subprocess-flow-events': 'error',
      'adhoc-subprocess-activities': 'error',
      'adhoc-subprocess-nesting': 'error',
      'adhoc-subprocess-event-scope': 'error',
      'nested-transaction': 'error',
      'event-gateway-receive-task-boundary': 'error',
      // Structure (AST)
      'service-task-error-boundary': 'error',
      'no-dead-end': 'error',
      'timer-definition': 'error',
      'process-error-events': 'off',
      'unreachable-elements': 'error',
      'orphan-end-event': 'off',
      'multiple-event-definitions': 'error',
      'conditional-flows-no-gateway': 'error',
      'gateway-type-mismatch': 'error',
      // Execution Readiness
      'process-executable': 'error',
      'process-version': 'error',
      'valid-process-id': 'error',
      'service-task-implementation': 'error',
      'user-task-assignment': 'warn',
      'timer-format': 'error',
      'error-event-config': 'warn',
      'message-event-reference': 'error',
      'script-task-config': 'error',
      'call-activity-target': 'error',
      'multi-instance-config': 'error',
      'standard-loop-config': 'error',
      'standard-loop-maximum': 'error',
      'xor-gateway-conditions': 'error',
      'complex-gateway-split-conditions': 'error',
      'complex-gateway-join-condition': 'error',
      'complex-gateway-region': 'error',
      'adhoc-subprocess-completion': 'error',
      'adhoc-subprocess-ordering': 'error',
      'adhoc-subprocess-default-ordering': 'error',
      'signal-event-reference': 'error',
      'conditional-event-condition': 'error',
      'link-event-name': 'error',
      'link-event-pairing': 'error',
      'intermediate-timer-cycle': 'error',
      'business-rule-task-config': 'error',
      // Naming Quality
      'task-name-verb-pattern': 'warn',
      'end-event-generic-label': 'warn',
      'mixed-language': 'off',
      'gateway-question-format': 'warn',
      'flow-label-required': 'warn',
      'inconsistent-flow-labels': 'off',
      // Logic Patterns (AST-2xx)
      'god-process': 'warn',
      'missing-compensation': 'info',
      'timeout-escalation': 'warn',
      'parallelization-potential': 'warn',
      'async-wait-state': 'warn',
      'gateway-complexity': 'warn',
      'subprocess-error-handling': 'warn',
      'infinite-loop': 'error',
      'process-complexity': 'warn',
      'process-size': 'info',
      'nesting-depth': 'warn',
      'user-task-without-timer': 'warn',
      'receive-without-timeout': 'error',
      'transaction-without-compensation': 'warn',
      'retry-anti-pattern': 'warn',
      'parallel-end-without-join': 'warn',
      'terminate-end-event-warning': 'off',
      // PDA Compliance (AST-1xx)
      'system-independent-naming': 'error',
      'technical-conditions': 'info',
      'canonical-data-naming': 'error',
      'dmn-externalization': 'off',
      'layer-separation': 'warn',
      'canonical-data-flow': 'warn',
    },
  },
};

// --- Three-tier metadata ---

export const builtinRuleMetadata: Record<string, RuleMetadata> = {
  // Built-in bpmnlint
  'start-event-required': {
    category: 'bpmn-spec',
    why: 'Every process must have at least one start event so the engine knows where to begin execution.',
    suggestion: 'Add a start event to the process.',
  },
  'end-event-required': {
    category: 'bpmn-spec',
    why: 'A process without an end event will never terminate cleanly.',
    suggestion: 'Add an end event to the process.',
  },
  'fake-join': {
    category: 'structure',
    why: 'A non-gateway element (task or event) with multiple incoming sequence flows creates an implicit merge. This places gateway-logic on non-gateway elements.',
    suggestion:
      'Add an explicit merge gateway (e.g., exclusive gateway) before the element to make the merge semantics clear.',
  },
  'no-implicit-split': {
    category: 'structure',
    why: 'When an element other than a gateway has multiple outgoing sequence flows, the Engine fails the instance with implicit_split.',
    suggestion: 'Add an explicit gateway (exclusive, parallel, or inclusive) after the element.',
  },
  'no-disconnected': {
    category: 'structure',
    why: 'Disconnected elements are unreachable during execution and indicate an incomplete model.',
    suggestion: 'Connect the element to the process flow or remove it.',
  },
  'no-gateway-join-fork': {
    category: 'structure',
    why: 'A gateway that both joins and forks makes the flow harder to understand and can cause subtle execution bugs.',
    suggestion: 'Split it into two gateways: one for joining, one for forking.',
  },
  'single-blank-start-event': {
    category: 'structure',
    why: 'Multiple blank (untyped) start events create ambiguity about how the process begins.',
    suggestion: 'Keep one blank start event and type the others (message, timer, signal, etc.).',
  },
  'superfluous-gateway': {
    category: 'structure',
    why: 'A gateway with only one incoming and one outgoing flow serves no purpose.',
    suggestion: 'Remove the gateway and connect the flows directly.',
  },
  'conditional-flows': {
    category: 'structure',
    why: 'Outgoing flows from a conditional gateway should have conditions so the engine can evaluate them.',
    suggestion: 'Add a condition expression to each outgoing sequence flow, or mark one as the default flow.',
  },
  'label-required': {
    category: 'naming-quality',
    why: 'Unlabeled elements make the diagram hard to read and maintain.',
    suggestion: 'Add a descriptive label to the element.',
  },
  'sub-process-blank-start-event': {
    category: 'structure',
    why: 'A sub-process should start with a blank (none) start event.',
    suggestion: 'Change the sub-process start event to a blank (none) type.',
  },
  'event-sub-process-typed-start-event': {
    category: 'structure',
    why: 'An event sub-process must have a typed start event that defines its trigger.',
    suggestion: 'Replace the blank start event with an appropriate typed event.',
  },
  'no-complex-gateway': {
    category: 'structure',
    why: 'The Engine executes Complex gateways; enable this rule only when the diagram must also run on engines without Complex gateway support.',
    suggestion: 'Replace with a combination of exclusive, parallel, or inclusive gateways.',
  },
  'no-inclusive-gateway': {
    category: 'structure',
    why: 'Inclusive gateways have complex merge semantics that some engines do not fully support.',
    suggestion: 'Consider using exclusive or parallel gateways if your engine does not support inclusive gateways.',
  },

  // BPMN Spec (BSC)
  'default-flow-no-condition': {
    category: 'bpmn-spec',
    why: 'The BPMN spec requires that a default sequence flow must not have a condition expression.',
    suggestion: 'Remove the condition expression from the default flow.',
  },
  'start-event-no-conditions': {
    category: 'bpmn-spec',
    why: 'Start events must not encode branching logic via conditions on their outgoing flows.',
    suggestion: 'Remove condition expressions from outgoing flows of the start event.',
  },
  'event-subprocess-no-flows': {
    category: 'bpmn-spec',
    why: 'Event sub-processes are triggered by their start event, not by incoming sequence flows.',
    suggestion: 'Remove sequence flows connecting to or from the event sub-process.',
  },
  'event-subprocess-single-start-event': {
    category: 'bpmn-spec',
    why: 'An event sub-process is triggered by exactly one start event. Zero start events make it unreachable; more than one is ambiguous and rejected by the engine.',
    suggestion: 'Ensure the event sub-process contains exactly one typed start event.',
  },
  'event-subprocess-start-event-type': {
    category: 'bpmn-spec',
    why: 'The engine only executes event sub-processes triggered by Message, Timer, Signal, Conditional, Error, Escalation, or Compensation start events, and an Error start must be interrupting.',
    suggestion:
      'Use a supported start-event trigger (Message, Timer, Signal, Conditional, Error, Escalation, or Compensation). Make Error starts interrupting via the modeler.',
  },
  'event-gateway-min-outgoing': {
    category: 'bpmn-spec',
    why: 'An event-based gateway must offer at least two alternative event paths.',
    suggestion: 'Add at least one more outgoing sequence flow to the event-based gateway.',
  },
  'event-gateway-target-types': {
    category: 'bpmn-spec',
    why: 'Event-based gateway targets must be intermediate catch events or receive tasks per the BPMN spec.',
    suggestion: 'Replace the invalid target with an intermediate catch event or receive task.',
  },
  'event-gateway-targets-no-extra-incoming': {
    category: 'bpmn-spec',
    why: 'Targets of an event-based gateway must be exclusively reached from that gateway.',
    suggestion: 'Remove additional incoming sequence flows from the event gateway target.',
  },
  'boundary-event-no-incoming': {
    category: 'bpmn-spec',
    why: 'Boundary events are attached to activities and cannot be targeted by sequence flows.',
    suggestion: 'Remove incoming sequence flows from the boundary event.',
  },
  'no-cross-boundary-flows': {
    category: 'bpmn-spec',
    why: 'Sequence flows must not cross sub-process boundaries per the BPMN spec.',
    suggestion: 'Route the flow through the sub-process boundary using start/end events or message flows.',
  },
  'compensation-boundary-no-outgoing': {
    category: 'bpmn-spec',
    why: 'Compensation boundary events use associations to reference compensation handlers, not sequence flows.',
    suggestion: 'Remove outgoing sequence flows and use an association to the compensation activity instead.',
  },
  'gateway-direction-consistency': {
    category: 'bpmn-spec',
    why: 'A gateway that both joins and forks fails the instance at runtime, and the Engine rejects the deployment of a mixed complex gateway.',
    suggestion: 'Separate the gateway into distinct converging and diverging gateways.',
  },
  'escalation-boundary-host': {
    category: 'bpmn-spec',
    why: 'Escalations raised inside the model reach a boundary only through a call activity or sub-process. On other hosts the boundary fires only on an external escalation injection.',
    suggestion: 'Keep it if external injection is intended; otherwise attach it to a call activity or sub-process.',
  },
  'cancel-event-transaction-scope': {
    category: 'bpmn-spec',
    why: 'Cancel End Events are only valid inside a Transaction subprocess, and Cancel Boundary Events may only be attached to one.',
    suggestion:
      'Move the Cancel End Event inside a Transaction subprocess, or attach the Cancel Boundary Event to a Transaction subprocess.',
  },
  'transaction-cancel-no-boundary': {
    category: 'bpmn-spec',
    why: 'A Transaction with a Cancel End Event but no Cancel Boundary Event on the shell will fatal when the cancel fires, because there is no boundary outgoing flow to route the parent process.',
    suggestion:
      'Add a Cancel Boundary Event to the Transaction subprocess shell and connect it to the continuation of the parent process.',
  },
  'transaction-cancel-no-compensable': {
    category: 'bpmn-spec',
    why: 'A Cancel End Event triggers automatic LIFO compensation for completed activities. If no activities inside the transaction have compensation boundary events, the cancel produces no rollback effect.',
    suggestion:
      'Add compensation boundary events and compensation handlers to the activities inside the transaction that change external state.',
  },
  'top-level-start-event-type': {
    category: 'bpmn-spec',
    why: 'Error, Escalation, and Compensation start events require a surrounding scope instance and are only valid inside an event sub-process.',
    suggestion:
      'Use a None, Message, Timer, Signal, or Conditional start event at the process level, or move the trigger into an event sub-process.',
  },
  'adhoc-subprocess-flow-events': {
    category: 'bpmn-spec',
    why: 'Activities inside an ad-hoc subprocess are not connected by sequence flows, so a Start or End Event inside it has nothing to anchor.',
    suggestion: 'Remove Start and End Events from the ad-hoc subprocess.',
  },
  'nested-transaction': {
    category: 'bpmn-spec',
    why: 'The Engine rejects the deployment of a transaction nested directly inside another transaction.',
    suggestion: 'Move the inner transaction out, or turn it into an embedded sub-process.',
  },
  'event-gateway-receive-task-boundary': {
    category: 'bpmn-spec',
    why: 'The Engine rejects the deployment of a receive task after an event-based gateway that has boundary events, because cancelling the losing branch would be ambiguous.',
    suggestion: 'Remove the boundary events, or replace the receive task with a message intermediate catch event.',
  },
  'adhoc-subprocess-activities': {
    category: 'bpmn-spec',
    why: 'An ad-hoc subprocess with no activities has nothing for the engine to activate.',
    suggestion: 'Add at least one activity inside the ad-hoc subprocess.',
  },
  'adhoc-subprocess-nesting': {
    category: 'bpmn-spec',
    why: 'An ad-hoc subprocess cannot contain another ad-hoc subprocess.',
    suggestion: 'Move the inner activities into the outer ad-hoc subprocess.',
  },
  'adhoc-subprocess-event-scope': {
    category: 'bpmn-spec',
    why: 'An ad-hoc subprocess is not supported inside an event subprocess.',
    suggestion: 'Move the ad-hoc subprocess out of the event subprocess.',
  },

  // Structure
  'service-task-error-boundary': {
    category: 'structure',
    why: 'Service tasks can fail at runtime. Without a boundary error event, failures are unhandled.',
    suggestion: 'Add a boundary error event to the service task.',
  },
  'no-dead-end': {
    category: 'structure',
    why: 'When an element other than an end event completes without an outgoing sequence flow, the Engine fails the instance.',
    suggestion: 'Connect the element to the next step, or end the path with an end event.',
  },
  'timer-definition': {
    category: 'structure',
    why: 'A timer event without a time definition (date, duration, or cycle) will not trigger.',
    suggestion: 'Set a timeDate, timeDuration, or timeCycle on the timer event definition.',
  },
  'process-error-events': {
    category: 'structure',
    why: 'Processes with service tasks should have error handling to catch runtime failures.',
    suggestion: 'Add error boundary events to service tasks or an error event sub-process.',
  },
  'unreachable-elements': {
    category: 'structure',
    why: 'Elements that cannot be reached from any start event will never execute.',
    suggestion: 'Connect the element to the process flow or remove it.',
  },
  'orphan-end-event': {
    category: 'structure',
    why: 'An end event without incoming flows can never be reached.',
    suggestion: 'Connect the end event to the process flow or remove it.',
  },
  'multiple-event-definitions': {
    category: 'structure',
    why: 'The Engine keeps only the last event definition of an event and ignores the others.',
    suggestion: 'Split the event into separate events, each with a single event definition.',
  },
  'conditional-flows-no-gateway': {
    category: 'structure',
    why: 'The Engine ignores conditions on flows that do not leave a split gateway and always follows them, so the condition has no effect.',
    suggestion: 'Move the condition to a flow leaving a split gateway, or remove it.',
  },
  'gateway-type-mismatch': {
    category: 'structure',
    why: 'Fork/join gateway pairs should use matching types (e.g., parallel fork with parallel join).',
    suggestion: 'Ensure the converging gateway type matches its corresponding diverging gateway.',
  },

  // Execution Readiness
  'process-executable': {
    category: 'execution-readiness',
    why: 'The Engine skips processes with isExecutable="false"; a missing attribute counts as executable.',
    suggestion: 'Remove isExecutable="false" or set it to true.',
  },
  'process-version': {
    category: 'execution-readiness',
    why: 'The engine requires every process to carry an bfw:version before deployment. Without it, deployment will be rejected.',
    suggestion:
      'Set a version on the process (e.g., "1.0.0"). Use the "Bump Version" command or the process properties pane.',
  },
  'valid-process-id': {
    category: 'execution-readiness',
    why: 'A generic or empty process ID makes deployment and management difficult.',
    suggestion:
      'Give the process a descriptive identifier with at least two recognizable words (e.g., "OrderFulfillment", "handle-invoice", "calculate_interest_rate").',
  },
  'service-task-implementation': {
    category: 'execution-readiness',
    why: 'The Engine rejects the deployment of a service task without an implementation attribute; its value selects the service task handler plugin.',
    suggestion: 'Set implementation to the key of a registered service task handler (e.g. http).',
  },
  'user-task-assignment': {
    category: 'execution-readiness',
    why: 'A user task without bfw:assignees gets an empty assignee list at runtime, so no one is named as responsible for it. The Engine ignores humanPerformer, potentialOwner, and vendor assignment attributes.',
    suggestion: 'Set bfw:assignees to a FEEL expression that resolves the responsible users or groups.',
  },
  'timer-format': {
    category: 'execution-readiness',
    why: 'Timer definitions must be valid for the engine to schedule them correctly.',
    suggestion: 'Use ISO 8601 format for timer definitions (e.g., PT1H, R3/PT10M, 2025-01-01T00:00:00Z).',
  },
  'error-event-config': {
    category: 'execution-readiness',
    why: 'An error end event without an inline bfw:errorCode, and without an errorRef to a global error that has an errorCode, throws an error without a code, which only catch-all boundary events and event sub-processes catch.',
    suggestion: 'Set an errorRef to a global error with an errorCode, or an inline bfw:errorCode.',
  },
  'message-event-reference': {
    category: 'execution-readiness',
    why: 'The Engine rejects the deployment of a message event, send task, or receive task without a message reference; the message name routes the message.',
    suggestion: 'Set the messageRef to a global message.',
  },
  'script-task-config': {
    category: 'execution-readiness',
    why: 'A script task needs an inline script or a named script plugin (bfw:scriptRef) to execute.',
    suggestion: 'Provide the script content, or set bfw:scriptRef to a registered named script.',
  },
  'call-activity-target': {
    category: 'execution-readiness',
    why: 'A call activity without a called element reference cannot invoke another process.',
    suggestion: 'Set the calledElement attribute to reference the target process.',
  },
  'multi-instance-config': {
    category: 'execution-readiness',
    why: 'Multi-instance activities need an input collection to determine iteration count and input data. The engine does not support loopCardinality. Data items only name the element variable; without bfw:InputCollection (or a FEEL expression as the loopDataInput body, which the modeler cannot author) the Engine rejects the deployment, as it does for an empty completionCondition or bfw:loopBreakCondition.',
    suggestion:
      'Set an Input Collection (bfw:InputCollection) on the multi-instance configuration. Optionally set maxIterations as a safety cap.',
  },
  'standard-loop-config': {
    category: 'execution-readiness',
    why: 'The Engine rejects the deployment of a standard loop without a loop condition, or with a loopMaximum that is not a positive integer.',
    suggestion:
      'Set a loop condition (FEEL expression that returns true to continue) and a positive integer loopMaximum.',
  },
  'standard-loop-maximum': {
    category: 'execution-readiness',
    why: 'A standard loop without loopMaximum has no safety cap and can run indefinitely if its condition never turns false.',
    suggestion: 'Add loopMaximum to prevent runaway loops.',
  },
  'xor-gateway-conditions': {
    category: 'execution-readiness',
    why: 'An exclusive gateway split with an unmarked non-default outgoing flow fatals at runtime when the gateway is entered.',
    suggestion:
      'Add a FEEL condition to every non-default outgoing flow, or mark one unmarked flow as the default. A default does not excuse other unmarked flows.',
  },
  'complex-gateway-split-conditions': {
    category: 'execution-readiness',
    why: 'A complex gateway split with an unmarked non-default outgoing flow fatals at runtime when the gateway is entered.',
    suggestion:
      'Add a FEEL condition to every non-default outgoing flow, or mark one unmarked flow as the default. A default does not excuse other unmarked flows.',
  },
  'complex-gateway-join-condition': {
    category: 'execution-readiness',
    why: 'The Engine rejects the deployment of a complex join without an activationCondition; the condition decides when the join fires.',
    suggestion: 'Set an activationCondition, e.g. activatedCount >= 2 or activatedCount = incomingCount.',
  },
  'complex-gateway-region': {
    category: 'execution-readiness',
    why: 'The Engine rejects the deployment unless every complex join pairs with a dominating complex split and the elements between them form a single-entry, single-exit region that is disjoint from or nested in other regions. The join cancels the rest of that region when it fires.',
    suggestion:
      'Open the branches with a complex split, route every branch back into the join, and do not let flows enter or leave the region in between.',
  },
  'adhoc-subprocess-completion': {
    category: 'execution-readiness',
    why: 'Without a completion condition or an implementation, the engine completes the ad-hoc subprocess only after every inner activity has been performed.',
    suggestion: 'Set a completion condition, or set an implementation for plugin-managed completion.',
  },
  'adhoc-subprocess-ordering': {
    category: 'execution-readiness',
    why: 'The Engine rejects the deployment of an ad-hoc subprocess with an empty implementation attribute, or with Sequential engine-managed ordering and no bfw:ActiveElements to pick the first activity.',
    suggestion:
      'Remove the empty implementation attribute or fill it in. For Sequential without an implementation, set a bfw:ActiveElements expression.',
  },
  'adhoc-subprocess-default-ordering': {
    category: 'execution-readiness',
    why: 'An omitted ordering defaults to Parallel, so every inner activity may run at once.',
    suggestion: 'Set ordering to Parallel or Sequential explicitly.',
  },
  'signal-event-reference': {
    category: 'execution-readiness',
    why: 'The Engine rejects the deployment of a signal event without a signal reference; the signal name routes the broadcast.',
    suggestion: 'Set the signalRef to a global signal with a name.',
  },
  'conditional-event-condition': {
    category: 'execution-readiness',
    why: 'The Engine rejects the deployment of a conditional event without a condition.',
    suggestion: 'Set a FEEL condition on the conditional event definition.',
  },
  'link-event-name': {
    category: 'execution-readiness',
    why: 'The Engine rejects the deployment of a link event without a name; the name pairs a link throw with its link catch.',
    suggestion: 'Give the link event a name that matches its counterpart.',
  },
  'link-event-pairing': {
    category: 'execution-readiness',
    why: 'When a link throw is reached, the Engine fails the instance unless exactly one link catch with the same name exists in the same scope.',
    suggestion: 'Add one link catch with the same name in the same process or sub-process, or rename duplicates.',
  },
  'intermediate-timer-cycle': {
    category: 'execution-readiness',
    why: 'The Engine fails the instance when an intermediate timer catch event with a timeCycle is reached; cycles are only supported on start and boundary events.',
    suggestion:
      'Use timeDuration or timeDate, or model the repetition with a loop or a non-interrupting timer boundary.',
  },
  'business-rule-task-config': {
    category: 'execution-readiness',
    why: 'The Engine rejects the deployment of a business rule task unless implementation is "feel" with a script, or "dmn" with a bfw:decisionRef.',
    suggestion: 'Set implementation to "feel" and provide a script, or to "dmn" and set bfw:decisionRef.',
  },

  // Naming Quality
  'task-name-verb-pattern': {
    category: 'naming-quality',
    why: 'Task names following a "verb + object" pattern (e.g., "Review invoice") are clearer.',
    suggestion: 'Rename the task to include a verb and an object describing the action.',
  },
  'end-event-generic-label': {
    category: 'naming-quality',
    why: 'Generic end event labels like "End" or "Done" do not communicate the outcome.',
    suggestion: 'Use a descriptive label that explains the process outcome (e.g., "Order fulfilled").',
  },
  'mixed-language': {
    category: 'naming-quality',
    why: 'Mixing languages in a diagram reduces readability for all audiences.',
    suggestion: 'Use a consistent language throughout the diagram.',
  },
  'gateway-question-format': {
    category: 'naming-quality',
    why: 'Decision gateway labels phrased as questions make the branching logic immediately clear.',
    suggestion: 'Rephrase the gateway label as a yes/no question (e.g., "Invoice approved?").',
  },
  'flow-label-required': {
    category: 'naming-quality',
    why: 'Unlabeled outgoing flows from decision gateways leave the branching criteria unclear.',
    suggestion: 'Add visible labels to outgoing flows (e.g., "Yes", "No", condition description).',
  },
  'inconsistent-flow-labels': {
    category: 'naming-quality',
    why: 'Inconsistent spelling of flow labels (e.g., "Ja" vs "ja") reduces diagram quality.',
    suggestion: 'Standardize the spelling and casing of flow labels.',
  },

  // Logic Patterns (AST-2xx)
  'god-process': {
    category: 'logic-patterns',
    why: 'Long linear task chains suggest a monolithic process that is hard to maintain, test, and reuse. Hidden decisions, error paths, or parallel branches may be buried inside.',
    suggestion:
      'Check whether the chain contains hidden decisions (missing gateways), parallelizable steps, error scenarios, or logically grouped tasks that could be extracted into subprocesses.',
  },
  'missing-compensation': {
    category: 'logic-patterns',
    why: 'Without compensation, partial side effects remain when a successor step fails. The process may leave data in an inconsistent state.',
    suggestion:
      'Add a compensation boundary event handler that reverses the action. Alternatively, use error boundary events with manual recovery or implement a saga pattern at the engine level.',
  },
  'timeout-escalation': {
    category: 'logic-patterns',
    why: 'A timeout that leads straight to process termination rarely matches real business needs. Typically, timeouts should trigger escalation (reminders, reassignment, manager notification).',
    suggestion:
      'Implement a multi-step escalation chain instead of an immediate end. Consider non-interrupting reminders followed by an interrupting escalation timer.',
  },
  'parallelization-potential': {
    category: 'logic-patterns',
    why: 'Unnecessary sequential execution of independent tasks increases process latency. Explicit parallelism via parallel gateways makes independence visible.',
    suggestion:
      'If the tasks are truly independent, wrap them in a parallel gateway. If there are dependencies, make them explicit with data associations.',
  },
  'async-wait-state': {
    category: 'logic-patterns',
    why: 'An async send without a wait state may be fire-and-forget or indicate a missing catch. If a response is expected, the absent catch creates a modelling gap.',
    suggestion:
      'If a response is expected, add a message intermediate catch event or receive task after the send. If fire-and-forget is intentional, no action is needed.',
  },
  'gateway-complexity': {
    category: 'logic-patterns',
    why: 'A gateway with many branches is difficult to test exhaustively. Complex branching logic often belongs in a DMN decision table.',
    suggestion:
      'Extract complex decision logic into a Business Rule Task (DMN). Alternatively, cascade gateways to reduce individual complexity.',
  },
  'subprocess-error-handling': {
    category: 'logic-patterns',
    why: 'Service task errors inside a subprocess may propagate to the parent process unhandled. Local error handling within the subprocess provides better control.',
    suggestion:
      'Add an error boundary event to the subprocess, an error end event inside, or an error event subprocess for specific error types.',
  },
  'infinite-loop': {
    category: 'logic-patterns',
    why: 'A cycle without an exit condition can loop indefinitely, consuming engine resources and blocking process completion.',
    suggestion:
      'Add a conditional exit via an exclusive, inclusive, or complex gateway, or a boundary event (e.g. a timer or error boundary) that leaves the cycle.',
  },
  'process-complexity': {
    category: 'logic-patterns',
    why: 'High control flow complexity correlates with error-prone, hard-to-maintain processes. Each additional gateway branch increases the number of execution paths exponentially.',
    suggestion:
      'Decompose complex processes into subprocesses or call activities. Replace multi-branch gateways with DMN decision tables. Target CFC < 30.',
  },
  'process-size': {
    category: 'logic-patterns',
    why: 'The "7 Process Modelling Guidelines" recommend processes with approximately 30 elements. Larger processes are harder to understand and maintain.',
    suggestion:
      'Extract related groups of activities into subprocesses or call activities. Aim for ~30 elements per diagram level.',
  },
  'nesting-depth': {
    category: 'logic-patterns',
    why: 'Deep nesting hurts readability and makes error handling, compensation, and transaction reasoning complex.',
    suggestion:
      'Extract deeply nested subprocesses into separate processes called via call activities. Aim for 2–3 nesting levels maximum.',
  },
  'user-task-without-timer': {
    category: 'logic-patterns',
    why: 'User tasks without timers have no SLA enforcement. A human task could remain unhandled indefinitely.',
    suggestion:
      'Add a non-interrupting timer boundary for reminders and an interrupting timer for escalation (e.g., reassignment after timeout).',
  },
  'receive-without-timeout': {
    category: 'logic-patterns',
    why: 'If the external sender fails or the message is lost, the process waits indefinitely without a timeout.',
    suggestion:
      'Add a timer boundary event with a retry or escalation path. Define appropriate timeout values based on the expected response time.',
  },
  'transaction-without-compensation': {
    category: 'logic-patterns',
    why: 'Multiple state-changing steps without rollback capability risk data inconsistency on failure.',
    suggestion:
      'Add compensation boundary events and handlers for critical state changes. Consider using a transaction subprocess or saga pattern.',
  },
  'retry-anti-pattern': {
    category: 'logic-patterns',
    why: 'BPMN-level loops for technical retries clutter the diagram. The Engine has no automatic task retries: a failed task makes the process instance fatal, and a retry is a manual process-instance retry.',
    suggestion:
      'Retry technical failures inside the service task handler. Reserve BPMN retry loops for business-level retries.',
  },
  'parallel-end-without-join': {
    category: 'logic-patterns',
    why: 'When parallel branches each reach their own end event, the process finishes only after the last one, which is easy to misread. Explicit synchronization makes that visible.',
    suggestion: 'Add a parallel join gateway to synchronize all branches before a single end event.',
  },
  'terminate-end-event-warning': {
    category: 'logic-patterns',
    why: 'A terminate end event interrupts every other token in the current scope immediately; running activities are cancelled without compensation.',
    suggestion:
      'Prefer normal end events or error end events for controlled shutdown. Use terminate end events only for deliberate hard-abort scenarios.',
  },

  // PDA Compliance (AST-1xx)
  'system-independent-naming': {
    category: 'pda-compliance',
    why: 'PDA Layer 1 processes must be system-independent. A task name that references a specific backend system couples the business process to that system.',
    suggestion:
      'Rename the task to describe the business action (e.g., "Create Order", "Notify Customer"). The concrete target system is resolved in the Service Contract Interface (Layer 2).',
  },
  'technical-conditions': {
    category: 'pda-compliance',
    why: 'Gateway conditions in PDA Layer 1 must be expressed in business language. Technical conditions cannot be validated by business stakeholders.',
    suggestion:
      'Rephrase conditions in business terms (e.g., "Order approved?" instead of "statusCode == 200"). For complex rules, use a Business Rule Task (DMN).',
  },
  'canonical-data-naming': {
    category: 'pda-compliance',
    why: 'The PDA canonical data model uses business vocabulary. System-specific data names couple the process to backend data structures.',
    suggestion:
      'Rename using business terms (e.g., "Customer Order" instead of "SAP_SO_Response"). The mapping to system-specific data formats happens in the Mapper (Layer 3).',
  },
  'dmn-externalization': {
    category: 'pda-compliance',
    why: 'Business rules hardcoded as gateway conditions can only be changed by modifying the process model. PDA recommends externalizing business rules into DMN decision tables.',
    suggestion:
      'Create a Business Rule Task (DMN) before the gateway. The DMN decision table evaluates the rule and stores the result as a process variable.',
  },
  'layer-separation': {
    category: 'pda-compliance',
    why: 'PDA separates Layer 1 (business logic) from Layer 2 (integration logic). A process containing both is not system-independent and mixes concerns.',
    suggestion:
      'Move integration tasks into a separate integration process (Layer 2) or into the Service Contract Implementation.',
  },
  'canonical-data-flow': {
    category: 'pda-compliance',
    why: "Without explicit data flow, it's unclear what data the service task consumes and produces. This information is essential for the PDA canonical data model.",
    suggestion:
      'Define Data Input/Output Associations for the service task using Data Objects with canonical business terms (e.g., "Customer Order", "Invoice").',
  },
};
