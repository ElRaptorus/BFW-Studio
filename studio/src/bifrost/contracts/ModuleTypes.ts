import type { Studio } from '@evil/bifrost_fw_sdk';

export interface IModule {
  /**
   * A callback triggered when the module is loaded.
   * Any initialization code goes here.
   */
  onLoad(bifrost: Studio): void;
}
