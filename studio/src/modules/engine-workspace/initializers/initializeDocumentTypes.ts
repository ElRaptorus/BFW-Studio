import type { Bifrost } from '#bifrost/Bifrost';
import { checkEngineConnectivity } from '#modules/engine-core';

import { DashboardDocumentModel } from '../models/DashboardDocumentModel';
import { DecisionCatalogDocumentModel } from '../models/DecisionCatalogDocumentModel';
import { InstanceSearchDocumentModel } from '../models/InstanceSearchDocumentModel';
import { ProcessExplorerDocumentModel } from '../models/ProcessExplorerDocumentModel';
import { TaskInboxDocumentModel } from '../models/TaskInboxDocumentModel';
import { TimerSchedulesDocumentModel } from '../models/TimerSchedulesDocumentModel';
import DashboardRenderer from '../renderers/DashboardRenderer';
import DecisionCatalogRenderer from '../renderers/DecisionCatalogRenderer';
import InstanceSearchRenderer from '../renderers/InstanceSearchRenderer';
import ProcessExplorerRenderer from '../renderers/ProcessExplorerRenderer';
import TaskInboxRenderer from '../renderers/TaskInboxRenderer';
import TimerSchedulesRenderer from '../renderers/TimerSchedulesRenderer';

export default function initializeDocumentTypes(bifrost: Bifrost): void {
  bifrost.icons.registerIcons({
    'engine-workspace/dashboard': 'ph-duotone ph-gauge',
    'engine-workspace/processes': 'ph-duotone ph-tree-structure',
    'engine-workspace/instances': 'ph-duotone ph-magnifying-glass',
    'engine-workspace/task-inbox': 'ph-duotone ph-tray',
    'engine-workspace/decisions': 'ph-duotone ph-scales',
    'engine-workspace/timers': 'ph-duotone ph-timer',
    'engine-workspace/sidebar-icon': 'ph-duotone ph-engine',
  });

  const canOpen = (uri: string) => checkEngineConnectivity(bifrost, uri);

  bifrost.editors.registerDocumentType('engine-dashboard', {
    uriMatch: /^engine:\/\/dashboard\/.+$/,
    modelKey: 'EngineDashboardModel',
    modelConstructor: DashboardDocumentModel,
    rendererKey: 'EngineDashboardRenderer',
    rendererConstructor: DashboardRenderer,
    icon: 'engine-workspace/dashboard',
    canOpen,
  });

  bifrost.editors.registerDocumentType('engine-process-explorer', {
    uriMatch: /^engine:\/\/processes\/.+$/,
    modelKey: 'EngineProcessExplorerModel',
    modelConstructor: ProcessExplorerDocumentModel,
    rendererKey: 'EngineProcessExplorerRenderer',
    rendererConstructor: ProcessExplorerRenderer,
    icon: 'engine-workspace/processes',
    canOpen,
  });

  bifrost.editors.registerDocumentType('engine-instance-search', {
    uriMatch: /^engine:\/\/instances\/.+$/,
    modelKey: 'EngineInstanceSearchModel',
    modelConstructor: InstanceSearchDocumentModel,
    rendererKey: 'EngineInstanceSearchRenderer',
    rendererConstructor: InstanceSearchRenderer,
    icon: 'engine-workspace/instances',
    canOpen,
  });

  bifrost.editors.registerDocumentType('engine-task-inbox', {
    uriMatch: /^engine-task-inbox:\/\/.+$/,
    modelKey: 'EngineTaskInboxModel',
    modelConstructor: TaskInboxDocumentModel,
    rendererKey: 'EngineTaskInboxRenderer',
    rendererConstructor: TaskInboxRenderer,
    icon: 'engine-workspace/task-inbox',
    canOpen,
  });

  bifrost.editors.registerDocumentType('engine-decision-catalog', {
    uriMatch: /^engine:\/\/decisions\/.+$/,
    modelKey: 'EngineDecisionCatalogModel',
    modelConstructor: DecisionCatalogDocumentModel,
    rendererKey: 'EngineDecisionCatalogRenderer',
    rendererConstructor: DecisionCatalogRenderer,
    icon: 'engine-workspace/decisions',
    canOpen,
  });

  bifrost.editors.registerDocumentType('engine-timer-schedules', {
    uriMatch: /^engine:\/\/timers\/.+$/,
    modelKey: 'EngineTimerSchedulesModel',
    modelConstructor: TimerSchedulesDocumentModel,
    rendererKey: 'EngineTimerSchedulesRenderer',
    rendererConstructor: TimerSchedulesRenderer,
    icon: 'engine-workspace/timers',
    canOpen,
  });
}
