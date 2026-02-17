import { defineConfig, globalIgnores } from 'eslint/config';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import globals from 'globals';

export default defineConfig([
  globalIgnores(['dist', 'client/dist', 'drizzle', 'node_modules']),

  eslint.configs.recommended,

  tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  {
    files: ['client/src/**/*.ts'],
    languageOptions: {
      globals: globals.browser,
    },
  },

  {
    files: ['server/src/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },

  {
    files: ['shared/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },

  {
    files: ['**/*.test.ts', '**/__tests__/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },

  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: globals.node,
    },
  },

  {
    files: ['*.config.ts', '*.config.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
  },

  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    extends: [tseslint.configs.disableTypeChecked],
  },

  eslintConfigPrettier,
]);
