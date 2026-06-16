import prettier from 'eslint-config-prettier';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import js from '@eslint/js';

import { customRules, reactSettings, sharedGlobals } from '../eslint.config.base.mjs';

export default defineConfig(
  {
    ignores: ['out/', 'node_modules/', '*.js', '*.mjs', '*.cjs'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    files: ['src/**/*.{ts,tsx}', 'types/**/*.ts'],
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...sharedGlobals,
      },
    },
    settings: reactSettings,
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...customRules,
    },
  },
);
