import type { Scope } from '../Scope';
import type { SimulationEngine } from '../SimulationEngine';
import { EndEventBehavior } from './EndEventBehavior';
import { EventBasedGatewayBehavior } from './EventBasedGatewayBehavior';
import { ExclusiveGatewayBehavior } from './ExclusiveGatewayBehavior';
import { InclusiveGatewayBehavior } from './InclusiveGatewayBehavior';
import { IntermediateCatchEventBehavior } from './IntermediateCatchEventBehavior';
import { IntermediateThrowEventBehavior } from './IntermediateThrowEventBehavior';
import { ParallelGatewayBehavior } from './ParallelGatewayBehavior';
import { StartEventBehavior } from './StartEventBehavior';
import { SubProcessBehavior } from './SubProcessBehavior';
import { TaskBehavior } from './TaskBehavior';

export interface Behavior {
  enter(element: any, scope: Scope, engine: SimulationEngine, viaFlow?: any): void;
  exit?(element: any, scope: Scope, engine: SimulationEngine): void;
  signal?(element: any, scope: Scope, engine: SimulationEngine, data?: any): void;
}

export {
  StartEventBehavior,
  EndEventBehavior,
  TaskBehavior,
  ExclusiveGatewayBehavior,
  ParallelGatewayBehavior,
  IntermediateThrowEventBehavior,
  IntermediateCatchEventBehavior,
  InclusiveGatewayBehavior,
  SubProcessBehavior,
  EventBasedGatewayBehavior,
};

export function registerAllBehaviors(engine: SimulationEngine): void {
  engine.registerBehavior('bpmn:StartEvent', new StartEventBehavior());
  engine.registerBehavior('bpmn:EndEvent', new EndEventBehavior());
  engine.registerBehavior('bpmn:Task', new TaskBehavior());
  engine.registerBehavior('bpmn:ExclusiveGateway', new ExclusiveGatewayBehavior());
  engine.registerBehavior('bpmn:ParallelGateway', new ParallelGatewayBehavior());
  engine.registerBehavior('bpmn:IntermediateThrowEvent', new IntermediateThrowEventBehavior());
  engine.registerBehavior('bpmn:IntermediateCatchEvent', new IntermediateCatchEventBehavior());
  engine.registerBehavior('bpmn:InclusiveGateway', new InclusiveGatewayBehavior());
  engine.registerBehavior('bpmn:SubProcess', new SubProcessBehavior());
  engine.registerBehavior('bpmn:EventBasedGateway', new EventBasedGatewayBehavior());
  engine.registerBehavior('bpmn:ComplexGateway', new ExclusiveGatewayBehavior());
}
