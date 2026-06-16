import * as BuildInfo from '../../generatedBuildAndProductInfo';
import type { BifrostClient, BifrostOperatingSystem, BifrostStartupArgs } from '../contracts/BifrostTypes';

export enum ReleaseChannelName {
  bloodforge = 'bloodforge',
  Stable = 'stable',
  Unknown = 'unknown',
}

export class Environment {
  public productName: string;
  public productNameWithReleaseChannel: string;

  public version: string;
  public releaseChannelName: string;

  public appKey: string;
  public instanceKey: string;
  public startupArgs: BifrostStartupArgs;

  public isWeb: boolean;
  public isElectron: boolean;
  public isEmbbed: boolean;
  public isMac: boolean;
  public isWindows: boolean;
  public isPackaged: boolean;

  public webviewProtocol: string | undefined;

  constructor(
    appKey: string,
    instanceKey: string,
    client: BifrostClient,
    os: BifrostOperatingSystem,
    startupArgs: BifrostStartupArgs,
    isPackaged: boolean,
    webviewProtocol?: string,
  ) {
    this.appKey = appKey;
    this.instanceKey = instanceKey;
    this.startupArgs = startupArgs;

    this.isPackaged = isPackaged === true;
    this.isElectron = client === 'electron';
    this.isWeb = client === 'web';
    this.isEmbbed = client === 'embed';

    this.isMac = os === 'macos';
    this.isWindows = os === 'windows';

    this.version = BuildInfo.version;
    this.releaseChannelName = BuildInfo.releaseChannelName;

    this.productName = BuildInfo.productName;
    this.productNameWithReleaseChannel = BuildInfo.productNameWithReleaseChannel;

    this.webviewProtocol = webviewProtocol;
  }
}
