import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: ['**/node_modules/', '**/dist/', '**/coverage/', 'prisma/src/generated/'],
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // CLAUDE.md 2.2: nada de eval, new Function ou similares.
      'no-eval': 'error',
      'no-new-func': 'error',
      '@typescript-eslint/no-implied-eval': 'error',
      // Módulos do NestJS são classes vazias ou estáticas com decorator: é o padrão do framework.
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
    },
  },
  {
    // Web: regras dos hooks do React (ordem das chamadas e dependências dos efeitos).
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat['recommended-latest']],
  },
  {
    // Arquivos JavaScript de configuração não fazem parte de nenhum tsconfig.
    files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
