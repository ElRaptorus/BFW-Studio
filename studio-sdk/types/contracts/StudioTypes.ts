export declare type StudioClient = 'web' | 'electron' | 'embed';

export declare type StudioOperatingSystem = 'linux' | 'macos' | 'windows' | 'unknown';

export declare type StudioLocalStorage = {
  getItem: (key: string) => string | null;
  removeItem: (key: string) => void;
  setItem: (key: string, value: string) => void;
};

export declare type StudioEventListener = (...args: any[]) => void;

export declare type StudioEventSubscription = {
  dispose: () => void;
};

export declare type StudioStartupArgs = {
  [name: string]: any;
};
