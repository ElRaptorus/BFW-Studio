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

import boundaryEventNoIncoming from './bpmn-spec/boundary-event-no-incoming';
import cancelEventTransactionScope from './bpmn-spec/cancel-event-transaction-scope';
import compensationBoundaryNoOutgoing from './bpmn-spec/compensation-boundary-no-outgoing';
import defaultFlowNoCondition from './bpmn-spec/default-flow-no-condition';
import escalationBoundaryHost from './bpmn-spec/escalation-boundary-host';
import eventGatewayMinOutgoing from './bpmn-spec/event-gateway-min-outgoing';
import eventGatewayTargetTypes from './bpmn-spec/event-gateway-target-types';
import eventGatewayTargetsNoExtraIncoming from './bpmn-spec/event-gateway-targets-no-extra-incoming';
import eventSubprocessNoFlows from './bpmn-spec/event-subprocess-no-flows';
import eventSubprocessSingleStartEvent from './bpmn-spec/event-subprocess-single-start-event';
import eventSubprocessStartEventType from './bpmn-spec/event-subprocess-start-event-type';
import gatewayDirectionConsistency from './bpmn-spec/gateway-direction-consistency';
import noCrossBoundaryFlows from './bpmn-spec/no-cross-boundary-flows';
import startEventNoConditions from './bpmn-spec/start-event-no-conditions';
import topLevelStartEventType from './bpmn-spec/top-level-start-event-type';
import transactionCancelNoBoundary from './bpmn-spec/transaction-cancel-no-boundary';
import transactionCancelNoCompensable from './bpmn-spec/transaction-cancel-no-compensable';
// --- Custom: Execution Readiness ---

import callActivityTarget from './execution-readiness/call-activity-target';
import errorEventConfig from './execution-readiness/error-event-config';
import messageEventReference from './execution-readiness/message-event-reference';
import multiInstanceConfig from './execution-readiness/multi-instance-config';
import processExecutable from './execution-readiness/process-executable';
import processVersion from './execution-readiness/process-version';
import scriptTaskConfig from './execution-readiness/script-task-config';
import serviceTaskImplementation from './execution-readiness/service-task-implementation';
import standardLoopConfig from './execution-readiness/standard-loop-config';
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
  // Structure
  'service-task-error-boundary': serviceTaskErrorBoundary,
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
  'xor-gateway-conditions': xorGatewayConditions,
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
      'no-implicit-split': 'error',
      'no-disconnected': 'off',
      'no-gateway-join-fork': 'off',
      'single-blank-start-event': 'warn',
      'superfluous-gateway': 'warn',
      'conditional-flows': 'off',
      'label-required': 'warn',
      'sub-process-blank-start-event': 'warn',
      'event-sub-process-typed-start-event': 'warn',
      'no-complex-gateway': 'error',
      'no-inclusive-gateway': 'off',
      // BPMN Spec (BSC)
      'default-flow-no-condition': 'error',
      'start-event-no-conditions': 'off',
      'event-subprocess-no-flows': 'warn',
      'event-subprocess-single-start-event': 'warn',
      'event-subprocess-start-event-type': 'warn',
      'event-gateway-min-outgoing': 'error',
      'event-gateway-target-types': 'error',
      'event-gateway-targets-no-extra-incoming': 'error',
      'boundary-event-no-incoming': 'error',
      'no-cross-boundary-flows': 'error',
      'compensation-boundary-no-outgoing': 'error',
      'gateway-direction-consistency': 'warn',
      'escalation-boundary-host': 'warn',
      'cancel-event-transaction-scope': 'warn',
      'transaction-cancel-no-boundary': 'warn',
      'transaction-cancel-no-compensable': 'info',
      'top-level-start-event-type': 'warn',
      // Structure (AST)
      'service-task-error-boundary': 'warn',
      'timer-definition': 'error',
      'process-error-events': 'off',
      'unreachable-elements': 'error',
      'orphan-end-event': 'off',
      'multiple-event-definitions': 'warn',
      'conditional-flows-no-gateway': 'info',
      'gateway-type-mismatch': 'info',
      // Execution Readiness (all off for bpmn-development, except process-version)
      'process-executable': 'off',
      'process-version': 'error',
      'valid-process-id': 'off',
      'service-task-implementation': 'off',
      'user-task-assignment': 'off',
      'timer-format': 'off',
      'error-event-config': 'off',
      'message-event-reference': 'off',
      'script-task-config': 'off',
      'call-activity-target': 'off',
      'multi-instance-config': 'off',
      'standard-loop-config': 'off',
      'xor-gateway-conditions': 'off',
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
      'no-complex-gateway': 'error',
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
      'escalation-boundary-host': 'error',
      'cancel-event-transaction-scope': 'error',
      'transaction-cancel-no-boundary': 'error',
      'transaction-cancel-no-compensable': 'warn',
      'top-level-start-event-type': 'error',
      // Structure (AST)
      'service-task-error-boundary': 'error',
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
      'service-task-implementation': 'warn',
      'user-task-assignment': 'warn',
      'timer-format': 'error',
      'error-event-config': 'error',
      'message-event-reference': 'error',
      'script-task-config': 'warn',
      'call-activity-target': 'error',
      'multi-instance-config': 'error',
      'standard-loop-config': 'error',
      'xor-gateway-conditions': 'error',
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
    why: 'When a task has multiple outgoing sequence flows without an explicit gateway, the branching semantics are ambiguous.',
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
    why: 'Complex gateways are rarely supported by execution engines and difficult to understand.',
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
    why: 'The engine only executes event sub-processes triggered by Message, Timer, Signal, Conditional, Error, or Escalation start events, and an Error start must be interrupting.',
    suggestion:
      'Use a supported start-event trigger (Message, Timer, Signal, Conditional, Error, or Escalation). Make Error starts interrupting via the modeler.',
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
    why: 'A converging gateway should have at most one outgoing flow, and a diverging gateway at most one incoming.',
    suggestion: 'Separate the gateway into distinct converging and diverging gateways.',
  },
  'escalation-boundary-host': {
    category: 'bpmn-spec',
    why: 'Escalations bubble up from an inner scope, so an escalation boundary event only makes sense on a call activity or sub-process.',
    suggestion:
      'Attach the escalation boundary event to a call activity or sub-process, or use a different boundary event type.',
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
      'Use a None, Message, Timer, or Signal start event at the process level, or move the trigger into an event sub-process.',
  },

  // Structure
  'service-task-error-boundary': {
    category: 'structure',
    why: 'Service tasks can fail at runtime. Without a boundary error event, failures are unhandled.',
    suggestion: 'Add a boundary error event to the service task.',
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
    why: 'Events with multiple event definitions are rarely intended and often unsupported by engines.',
    suggestion: 'Split the event into separate events, each with a single event definition.',
  },
  'conditional-flows-no-gateway': {
    category: 'structure',
    why: 'Conditions on flows directly from tasks make the branching logic implicit and harder to read.',
    suggestion: 'Use an explicit gateway after the task to control the branching.',
  },
  'gateway-type-mismatch': {
    category: 'structure',
    why: 'Fork/join gateway pairs should use matching types (e.g., parallel fork with parallel join).',
    suggestion: 'Ensure the converging gateway type matches its corresponding diverging gateway.',
  },

  // Execution Readiness
  'process-executable': {
    category: 'execution-readiness',
    why: 'The process must be marked as executable for the engine to run it.',
    suggestion: 'Set isExecutable="true" on the process element.',
  },
  'process-version': {
    category: 'execution-readiness',
    why: 'The engine requires every process to carry an evil:version before deployment. Without it, deployment will be rejected.',
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
    why: 'A service task without an implementation type cannot be executed by the engine.',
    suggestion: 'Set the implementation type (e.g., external, delegate, expression).',
  },
  'user-task-assignment': {
    category: 'execution-readiness',
    why: 'A user task without assignment will not appear in any task list.',
    suggestion: 'Set an assignee, candidate users, or candidate group.',
  },
  'timer-format': {
    category: 'execution-readiness',
    why: 'Timer definitions must be valid for the engine to schedule them correctly.',
    suggestion: 'Use ISO 8601 format for timer definitions (e.g., PT1H, R3/PT10M, 2025-01-01T00:00:00Z).',
  },
  'error-event-config': {
    category: 'execution-readiness',
    why: 'Error events need an error reference for the engine to match thrown errors to catch events.',
    suggestion: 'Set the errorRef on the error event definition.',
  },
  'message-event-reference': {
    category: 'execution-readiness',
    why: 'Message events need a message reference for the engine to correlate messages.',
    suggestion: 'Set the messageRef on the message event definition.',
  },
  'script-task-config': {
    category: 'execution-readiness',
    why: 'A script task needs both a script format and script body to execute.',
    suggestion: 'Set the scriptFormat and provide the script content.',
  },
  'call-activity-target': {
    category: 'execution-readiness',
    why: 'A call activity without a called element reference cannot invoke another process.',
    suggestion: 'Set the calledElement attribute to reference the target process.',
  },
  'multi-instance-config': {
    category: 'execution-readiness',
    why: 'Multi-instance activities need an input collection to determine iteration count and input data. The engine does not support loopCardinality.',
    suggestion:
      'Set an Input Collection (evil:InputCollection) on the multi-instance configuration. Optionally set maxIterations as a safety cap.',
  },
  'standard-loop-config': {
    category: 'execution-readiness',
    why: 'Standard loops need a loop condition to control iteration and should have a maximum iteration limit as a safety guard.',
    suggestion:
      'Set a loop condition (FEEL expression that returns true to continue). Add loopMaximum to prevent runaway loops.',
  },
  'xor-gateway-conditions': {
    category: 'execution-readiness',
    why: 'An exclusive gateway without a default flow or complete conditions may fail at runtime.',
    suggestion: 'Add conditions to all outgoing flows, or designate one as the default flow.',
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
      'Add a conditional exit via an exclusive gateway with a termination condition. Alternatively, add a timer boundary event for automatic abort after a timeout.',
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
    why: 'BPMN-level retry loops duplicate engine retry capabilities (e.g., job retries) and clutter the diagram.',
    suggestion:
      "Use the engine's built-in job retry mechanism with configurable retry count and backoff. Reserve BPMN retry loops for business-level retries.",
  },
  'parallel-end-without-join': {
    category: 'logic-patterns',
    why: "When parallel branches each reach their own end event without synchronization, the engine's behavior depends on token semantics. Explicit synchronization removes ambiguity.",
    suggestion: 'Add a parallel join gateway to synchronize all branches before a single end event.',
  },
  'terminate-end-event-warning': {
    category: 'logic-patterns',
    why: 'A terminate end event kills all tokens in the current scope immediately — no compensation, no cleanup, no graceful shutdown.',
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
