import eslintReact from '@eslint-react/eslint-plugin';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import js from '@eslint/js';

import { customRules, reactSettings, sharedGlobals } from '../eslint.config.base.mjs';

export default defineConfig(
  {
    ignores: ['out/', 'dist/', 'test/fixtures/', 'node_modules/', 'build/', '*.js', '*.mjs', '*.cjs'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    files: ['src/**/*.{ts,tsx}', 'test/**/*.{ts,tsx}'],
    extends: [eslintReact.configs['recommended-typescript'], eslintReact.configs['disable-rsc']],
    plugins: {
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
      ...reactHooks.configs.recommended.rules,
      ...customRules,
    },
  },
);
