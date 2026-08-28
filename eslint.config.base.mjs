/**
 * Shared ESLint configuration for all packages in the monorepo.
 *
 * This file exports plain objects only — no npm package imports.
 * Each consumer (studio, studio-sdk) imports their own ESLint packages
 * and composes them with these shared definitions.
 */

export const sharedGlobals = {
  process: 'readonly',
};

export const reactSettings = {
  'react-x': { version: '19.2.8', importSource: 'react' },
};

export const customRules = {
  // -- Readability: braces & structure --
  curly: ['error', 'all'],
  'no-nested-ternary': 'error',
  'no-unneeded-ternary': 'error',

  // -- Readability: naming --
  'id-length': ['warn', { min: 2, exceptions: ['_', 'i', 'j', 'k', 'x', 'y', 'e'] }],

  // -- Modern JS --
  'no-var': 'error',
  'prefer-const': 'error',
  'no-async-promise-executor': 'off',

  // -- TypeScript --
  '@typescript-eslint/consistent-type-imports': ['error', { disallowTypeAnnotations: true }],
  '@typescript-eslint/ban-ts-comment': 'off',
  '@typescript-eslint/no-explicit-any': 'off',
  '@typescript-eslint/no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }],
  '@typescript-eslint/no-require-imports': 'off',
  '@typescript-eslint/array-type': ['warn', { default: 'array' }],

  // -- React (@eslint-react) --
  // Keep missing-key at warn to match the previous react/jsx-key policy.
  '@eslint-react/no-missing-key': 'warn',
  // recommended-typescript ships this as warn; list identity must not be the map index.
  '@eslint-react/no-array-index-key': 'error',
  // Official eslint-plugin-react-hooks owns compiler / Rules-of-React coverage.
  // recommended-typescript ships overlapping twins; turn those off so suppressions
  // and docs stay on the react-hooks/* names.
  '@eslint-react/rules-of-hooks': 'off',
  '@eslint-react/exhaustive-deps': 'off',
  '@eslint-react/purity': 'off',
  '@eslint-react/set-state-in-effect': 'off',
  '@eslint-react/set-state-in-render': 'off',
  '@eslint-react/static-components': 'off',
  '@eslint-react/unsupported-syntax': 'off',
  '@eslint-react/use-memo': 'off',
  '@eslint-react/error-boundaries': 'off',
  // Class editor methods (focus / getCurrentValue / resetValue) are called via refs,
  // which this rule cannot see.
  '@eslint-react/no-unused-class-component-members': 'off',

  // -- Console --
  'no-console': 'off',
};
