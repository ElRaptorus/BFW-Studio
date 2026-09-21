import AutoVersionOnPoolBehavior from './AutoVersionOnPoolBehavior';
import BfwCopyPasteBehavior from './BfwCopyPasteBehavior';
import BfwEmptyExtensionCleanupBehavior from './BfwEmptyExtensionCleanupBehavior';
import BfwExtensionOrderBehavior from './BfwExtensionOrderBehavior';
import BfwMutualExclusionBehavior from './BfwMutualExclusionBehavior';
import DrilldownBehavior from './DrilldownBehavior';
import PreserveIsExecutableBehavior from './PreserveIsExecutableBehavior';

const bfwPlatformBehaviorsModule = {
  __init__: [
    'autoVersionOnPoolBehavior',
    'drilldownBehavior',
    'bfwCopyPasteBehavior',
    'bfwMutualExclusionBehavior',
    'bfwEmptyExtensionCleanupBehavior',
    'bfwExtensionOrderBehavior',
    'preserveIsExecutableBehavior',
  ],
  autoVersionOnPoolBehavior: ['type', AutoVersionOnPoolBehavior],
  drilldownBehavior: ['type', DrilldownBehavior],
  bfwCopyPasteBehavior: ['type', BfwCopyPasteBehavior],
  bfwMutualExclusionBehavior: ['type', BfwMutualExclusionBehavior],
  bfwEmptyExtensionCleanupBehavior: ['type', BfwEmptyExtensionCleanupBehavior],
  bfwExtensionOrderBehavior: ['type', BfwExtensionOrderBehavior],
  preserveIsExecutableBehavior: ['type', PreserveIsExecutableBehavior],
};

export default bfwPlatformBehaviorsModule;
