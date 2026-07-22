import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import prettierConfig from 'eslint-config-prettier'

const reactAppGlobs = [
  'apps/admin-web/**/*.{ts,tsx}',
  'apps/customer-web/**/*.{ts,tsx}',
  'apps/desktop-pos/**/*.{ts,tsx}',
  'apps/developer-portal/**/*.{ts,tsx}',
  'apps/kds-web/**/*.{ts,tsx}',
  'apps/manager-web/**/*.{ts,tsx}',
  'apps/owner-web/**/*.{ts,tsx}',
  'apps/pos-mobile/**/*.{ts,tsx}',
  'packages/ui/**/*.{ts,tsx}',
]

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/.expo/**',
      '**/android/**',
      '**/ios/**',
      '**/coverage/**',
      'apps/marketing-web/.astro/**',
      'apps/marketing-web/src/**/*.astro',
      'services/ai-ml/**',
      'archive/**',
      'packages/database/src/migrations/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: reactAppGlobs,
    plugins: { react, 'react-hooks': reactHooks },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
    },
    settings: {
      react: { version: '19' },
    },
  },
  {
    files: ['**/*.config.{js,mjs,ts}', '**/vite.config.ts', '**/vitest.config.ts'],
    rules: {
      '@typescript-eslint/no-var-requires': 'off',
    },
  },
  prettierConfig,
)
