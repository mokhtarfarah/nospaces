// Flat config (ESLint 9+ dropped the old .eslintrc format). Mirrors what the
// old .eslintrc.cjs did: JS-recommended + typescript-eslint recommended +
// react-hooks rules, over our .ts/.tsx source only.
//
// Note: react-refresh/only-export-components (a dev-only hot-reload hint) is
// intentionally not enabled — we co-export a few constants/types alongside
// components (e.g. SortOption).
//
// react-hooks v7 ships a big new "React Compiler" rule set (set-state-in-effect,
// immutability, purity, static-components, …). We deliberately keep only the two
// rules the old config enforced (rules-of-hooks + exhaustive-deps) so this stays
// a dependency bump, not a code sweep. Adopting the new rules is a separate,
// opt-in pass (~36 call sites to review) — see ROADMAP.
import js from '@eslint/js'
import tseslint from '@typescript-eslint/eslint-plugin'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

export default [
  // Build output, generated files, config + node scripts. The old setup only
  // linted .ts/.tsx (eslint --ext ts,tsx); flat config lints .js/.mjs by
  // default, so ignore those here to keep the same scope.
  {
    ignores: [
      'dist',
      'dev-dist',
      'node_modules',
      '**/*.js',
      '**/*.cjs',
      '**/*.mjs',
    ],
  },

  js.configs.recommended,
  // A 3-block array: parser+plugin setup, the eslint-recommended overrides
  // (turns off base rules that clash with TS), then the recommended rules.
  ...tseslint.configs['flat/recommended'],

  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    },
    rules: {
      // The two classic react-hooks rules (what the old config had).
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // A leading underscore marks a binding we intentionally don't use
      // (e.g. dropping a key via destructure, or a re-exported constant).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // tseslint v8 added this to recommended. Our codebase uses the
      // `cond ? a() : b()` and `cond && fn()` idioms for side effects; allow them.
      '@typescript-eslint/no-unused-expressions': [
        'error',
        { allowShortCircuit: true, allowTernary: true },
      ],
    },
  },
]
