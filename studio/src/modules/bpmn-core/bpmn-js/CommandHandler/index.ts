import { CustomPropertyHandler } from './CustomPropertyHandler';
import { MultiCommandHandler } from './MultiCommandHandler';
import { UpdateAdHocSubprocessHandler } from './UpdateAdHocSubprocessHandler';
import {
  BFW_LINTER_RULESET_SCORE_COMMAND,
  UpdateBfwLinterRulesetScoreHandler,
} from './UpdateBfwLinterRulesetScoreHandler';
import { UpdateBusinessObjectHandler } from './UpdateBusinessObject';
import { UpdateBusinessObjectListHandler } from './UpdateBusinessObjectList';
import { UpdateBusinessRuleTaskHandler } from './UpdateBusinessRuleTaskHandler';
import { UpdateCallActivityHandler } from './UpdateCallActivityHandler';
import { UpdateConditionHandler } from './UpdateConditionHandler';
import { UpdateConditionalEventHandler } from './UpdateConditionalEventHandler';
import { UpdateCorrelationRetrievalExpressionHandler } from './UpdateCorrelationRetrievalExpressionHandler';
import { UpdateDataPipelineHandler } from './UpdateDataPipelineHandler';
import { UpdateDefinitionHandler } from './UpdateDefinitionHandler';
import { UpdateErrorHandler } from './UpdateErrorHandler';
import { UpdateEscalationHandler } from './UpdateEscalationHandler';
import { UpdateLinkHandler } from './UpdateLinkHandler';
import { UpdateLoopCharacteristicsHandler } from './UpdateLoopCharacteristicsHandler';
import { UpdateMessageHandler } from './UpdateMessageHandler';
import { UpdateProcessHandler } from './UpdateProcessHandler';
import { UpdateScriptHandler } from './UpdateScriptHandler';
import { UpdateServiceTaskHandler } from './UpdateServiceTaskHandler';
import { UpdateSignalHandler } from './UpdateSignalHandler';
import { UpdateTimerHandler } from './UpdateTimerHandler';
import { UpdateUserTaskHandler } from './UpdateUserTaskHandler';
import { UpdateUserTaskResourcesHandler } from './UpdateUserTaskResourcesHandler';

export const CommandHandler = {
  [BFW_LINTER_RULESET_SCORE_COMMAND]: UpdateBfwLinterRulesetScoreHandler,
  UpdateAdHocSubprocessHandler: UpdateAdHocSubprocessHandler,
  CustomPropertyHandler: CustomPropertyHandler,
  MultiCommandHandler: MultiCommandHandler,
  UpdateBusinessObjectHandler: UpdateBusinessObjectHandler,
  UpdateBusinessObjectListHandler: UpdateBusinessObjectListHandler,
  UpdateCallActivityHandler: UpdateCallActivityHandler,
  UpdateConditionHandler: UpdateConditionHandler,
  UpdateCorrelationRetrievalExpressionHandler: UpdateCorrelationRetrievalExpressionHandler,
  UpdateDataPipelineHandler: UpdateDataPipelineHandler,
  UpdateErrorHandler: UpdateErrorHandler,
  UpdateLinkHandler: UpdateLinkHandler,
  UpdateMessageHandler: UpdateMessageHandler,
  UpdateScriptHandler: UpdateScriptHandler,
  UpdateSignalHandler: UpdateSignalHandler,
  UpdateTimerHandler: UpdateTimerHandler,
  UpdateProcessHandler: UpdateProcessHandler,
  UpdateConditionalEventHandler: UpdateConditionalEventHandler,
  UpdateEscalationHandler: UpdateEscalationHandler,
  UpdateServiceTaskHandler: UpdateServiceTaskHandler,
  UpdateUserTaskHandler: UpdateUserTaskHandler,
  UpdateDefinitionHandler: UpdateDefinitionHandler,
  UpdateBusinessRuleTaskHandler: UpdateBusinessRuleTaskHandler,
  UpdateLoopCharacteristicsHandler: UpdateLoopCharacteristicsHandler,
  UpdateUserTaskResourcesHandler: UpdateUserTaskResourcesHandler,
};
