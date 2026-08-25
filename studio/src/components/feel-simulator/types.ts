import type { Ref } from 'react';

import type { FeelEditorVariable, Studio } from '@evil/bifrost_fw_sdk';

export type FeelWarning = {
  type: string;
  message: string;
  position: { from: number; to: number };
};

export type EvalResult =
  | { status: 'success'; value: unknown; warnings: FeelWarning[]; elapsed: number }
  | { status: 'error'; error: string; elapsed: number }
  | { status: 'timeout'; timeout: number };

export type FeelSimulatorLayout = 'SingleLine' | 'MultiLine' | 'Both';

export type FeelSimulatorEditorRef = {
  getCurrentValue(): string | undefined;
};

export type FeelSimulatorProps = {
  studio: Studio;
  initialExpression: string;
  variables: FeelEditorVariable[] | null;
  onChange: (expression: string) => void;
  layout: FeelSimulatorLayout;
  onKeyDown?: (event: KeyboardEvent) => boolean | void;
  autoFocus?: boolean;
  dialect?: 'expression' | 'unaryTests';
  htmlId?: string;
  htmlAttributes?: Record<string, unknown>;
  className?: string;
  initialContext?: Record<string, unknown>;
  ref?: Ref<FeelSimulatorEditorRef | null>;
};
