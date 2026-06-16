export type ThemeType = 'light' | 'dark';

export type ThemeDefinition = {
  readonly id: string;
  readonly label: string;
  readonly type: ThemeType;
};
