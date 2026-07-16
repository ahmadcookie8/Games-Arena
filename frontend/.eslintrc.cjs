module.exports = {
  root: true,
  env: {
    browser: true,
    es2020: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'react-hooks', 'jsx-a11y'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:jsx-a11y/recommended',
  ],
  ignorePatterns: ['dist', 'node_modules'],
  rules: {
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
    }],
  },
  overrides: [
    {
      // These are deliberately keyboard-focusable scroll containers.
      files: ['src/components/PropertyManagementBoard.tsx', 'src/components/ScrabbleBoard.tsx'],
      rules: { 'jsx-a11y/no-noninteractive-tabindex': 'off' },
    },
    {
      // Focus is intentionally placed inside the already-open blank-tile dialog.
      files: ['src/components/ScrabbleBoard.tsx'],
      rules: { 'jsx-a11y/no-autofocus': 'off' },
    },
    {
      // CardTitle forwards children through HTMLAttributes; the rule cannot infer the spread.
      files: ['src/components/ui/card.tsx'],
      rules: { 'jsx-a11y/heading-has-content': 'off' },
    },
  ],
}
