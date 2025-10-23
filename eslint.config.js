// ESLint flat config (ESLint v9)
// - JS: @eslint/js recommended
// - TS: @typescript-eslint recommended (no type-checking)
// - Playwright: plugin recommended on e2e specs

import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import playwright from 'eslint-plugin-playwright';
import globals from 'globals';

export default [
  // Global ignores (keep CI/docs out, and build artifacts)
  {
    ignores: [
      'bmad/**',
      'docs/**',
      'node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/*.html',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      // Temporary ignores for WIP modules; re-enable after fixes
      'apps/ui/src/pages/dashboard/MinimalPanel.mjs',
      'apps/ui/src/stores/minimalPanelStore.mjs'
    ]
  },

  // Base JS rules
  js.configs.recommended,

  // TS files: parser + recommended rules (no project needed)
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2023,
        sourceType: 'module'
      }
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      // Loosen a few rules for migration phase
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'warn'
    }
  },

  // Node contexts (tools, services, packages)
  {
    files: [
      'tools/**/*.{js,mjs,ts}',
      'services/**/*.{js,mjs,ts,tsx}',
      'packages/**/*.{js,mjs,ts,tsx}',
      'apps/ui/demo/server.mjs',
      'apps/ui/demo/metrics-mock.mjs',
      'apps/ui/test/**/*.{js,mjs,ts,tsx}',
      'services/**/test/**/*.{js,mjs,ts,tsx}'
    ],
    languageOptions: {
      globals: globals.node,
      ecmaVersion: 2023,
      sourceType: 'module'
    },
    rules: {
      'no-undef': 'off'
    }
  },

  // Browser contexts (UI src & demos)
  {
    files: [
      'apps/ui/src/**/*.{js,mjs,ts,tsx}',
      'apps/ui/demo/**/*.{js,mjs,ts,tsx}'
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        SharedWorker: 'readonly'
      },
      ecmaVersion: 2023,
      sourceType: 'module'
    },
    rules: {
      'no-undef': 'off'
    }
  },

  // E2E tests: Playwright env and recommended rules
  {
    files: ['**/e2e/**/*.{js,mjs,ts,tsx}','**/*.spec.{js,mjs,ts,tsx}'],
    ...playwright.configs['flat/recommended'],
    languageOptions: {
      ...(playwright.configs['flat/recommended'].languageOptions || {}),
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser
      }
    },
    rules: {
      'no-empty': 'off',
      'no-unused-vars': 'off'
    }
  },

  // Final global relaxations (non-blocking)
  {
    rules: {
      'no-empty': 'warn',
      'no-unused-vars': 'warn'
    }
  }
];
