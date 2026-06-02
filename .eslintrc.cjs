module.exports = {
  root: true,
  env: { browser: true, es2021: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  ignorePatterns: ['dist', 'dev-dist', 'node_modules', '.eslintrc.cjs', '*.config.ts', '*.config.js'],
  // Note: react-refresh/only-export-components (a dev-only hot-reload hint) is intentionally
  // not enabled — we co-export a few constants/types alongside components (e.g. SortOption).
  rules: {},
}
