import eslintReact from '@eslint-react/eslint-plugin';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import js from '@eslint/js';

import { customRules, reactSettings, sharedGlobals } from '../eslint.config.base.mjs';

const boundaryMessage = 'Module boundary violation, see .cursor/rules/module-boundaries.mdc.';

/** Matches `#modules/<prefix>…` and relative `../<prefix>…` imports of a sibling module. */
function forbidModules(prefix) {
  return [
    { regex: `^#modules/${prefix}`, message: boundaryMessage },
    { regex: `(^|/)\\.\\./(\\.\\./)*${prefix}`, message: boundaryMessage },
  ];
}

const noEngineModules = forbidModules('engine-');
const noGitCruiser = forbidModules('git-cruiser(/|$)');
// ponytail: "export only what is used" is a manual audit. This config does not detect unused exports.
// The upgrade path is knip, once that dependency is accepted.
const noTestImports = [
  {
    regex: '(^|/)\\.\\./(\\.\\./)*test(/|$)',
    message:
      'Production code must not import from test. See module-boundaries §Tests never shape production code.',
  },
];

// Flat config does not merge one rule across `files` blocks, so each block lists every pattern for its files.
const moduleBoundaryZones = [
  {
    files: ['src/bifrost/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
    patterns: [
      { regex: '^#modules/', message: boundaryMessage },
      { regex: '(^|/)modules/', message: boundaryMessage },
      ...noTestImports,
    ],
  },
  {
    // Neutral modules: every module outside the engine, bpmn and dmn families.
    files: ['src/modules/**/*.{ts,tsx}'],
    ignores: ['src/modules/engine-*/**', 'src/modules/bpmn-*/**', 'src/modules/dmn-*/**'],
    patterns: [...noEngineModules, ...noTestImports],
  },
  {
    files: ['src/modules/bpmn-*/**/*.{ts,tsx}'],
    patterns: [...noEngineModules, ...noGitCruiser, ...forbidModules('dmn-(?!core\\b)'), ...noTestImports],
  },
  {
    files: ['src/modules/dmn-*/**/*.{ts,tsx}'],
    patterns: [...noEngineModules, ...noGitCruiser, ...forbidModules('bpmn-(?!core\\b)'), ...noTestImports],
  },
].map(({ files, ignores = [], patterns }) => ({
  files,
  ignores,
  rules: { 'no-restricted-imports': ['error', { patterns }] },
}));

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
  ...moduleBoundaryZones,
  {
    // Not `src/**`: a later no-restricted-imports block replaces the module-boundary patterns on the same files.
    files: ['src/*.{ts,tsx}', 'src/*.d.ts', 'src/types/**/*.{ts,tsx,d.ts}', 'src/modules/engine-*/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: noTestImports }] },
  },
);
