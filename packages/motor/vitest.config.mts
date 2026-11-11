import { defineConfig } from 'vitest/config';

// Pacotes do monorepo (@metas/*) resolvem para o código-fonte nos testes (ADR-005).
// Definir `conditions` substitui as padrões do Vite, por isso elas são repetidas aqui.
const CONDICAO_FONTE = '@metas/source';

export default defineConfig({
  resolve: {
    conditions: [CONDICAO_FONTE, 'module', 'browser', 'development|production'],
  },
  ssr: {
    resolve: {
      conditions: [CONDICAO_FONTE, 'module', 'node', 'development|production'],
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // CLAUDE.md 5.5: o motor exige 100% de cobertura de linhas e ramos.
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
});
