import type { StudioStartupArgs } from '../contracts/StudioTypes';

export declare class Environment {
  appKey: string;
  instanceKey: string;

  productName: string;
  productNameWithReleaseChannel: string;

  version: string;
  releaseChannelName: string;

  startupArgs: StudioStartupArgs;

  isWeb: boolean;
  isElectron: boolean;
  isEmbbed: boolean;
  isMac: boolean;
  isWindows: boolean;
}
