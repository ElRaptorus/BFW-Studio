import AutoVersionOnPoolBehavior from './AutoVersionOnPoolBehavior';
import DrilldownBehavior from './DrilldownBehavior';
import EvilCopyPasteBehavior from './EvilCopyPasteBehavior';
import EvilEmptyExtensionCleanupBehavior from './EvilEmptyExtensionCleanupBehavior';
import EvilExtensionOrderBehavior from './EvilExtensionOrderBehavior';
import EvilMutualExclusionBehavior from './EvilMutualExclusionBehavior';
import PreserveIsExecutableBehavior from './PreserveIsExecutableBehavior';

const evilPlatformBehaviorsModule = {
  __init__: [
    'autoVersionOnPoolBehavior',
    'drilldownBehavior',
    'evilCopyPasteBehavior',
    'evilMutualExclusionBehavior',
    'evilEmptyExtensionCleanupBehavior',
    'evilExtensionOrderBehavior',
    'preserveIsExecutableBehavior',
  ],
  autoVersionOnPoolBehavior: ['type', AutoVersionOnPoolBehavior],
  drilldownBehavior: ['type', DrilldownBehavior],
  evilCopyPasteBehavior: ['type', EvilCopyPasteBehavior],
  evilMutualExclusionBehavior: ['type', EvilMutualExclusionBehavior],
  evilEmptyExtensionCleanupBehavior: ['type', EvilEmptyExtensionCleanupBehavior],
  evilExtensionOrderBehavior: ['type', EvilExtensionOrderBehavior],
  preserveIsExecutableBehavior: ['type', PreserveIsExecutableBehavior],
};

export default evilPlatformBehaviorsModule;
