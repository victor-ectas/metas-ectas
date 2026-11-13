import { defineConfig } from 'vitest/config';

// Pacotes do monorepo (@metas/*) resolvem para o código-fonte nos testes (ADR-005).
const CONDICAO_FONTE = '@metas/source';

export default defineConfig({
  resolve: {
    conditions: [CONDICAO_FONTE, 'module', 'node', 'development|production'],
  },
  ssr: {
    resolve: {
      conditions: [CONDICAO_FONTE, 'module', 'node', 'development|production'],
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/preparar-banco.ts'],
    environment: 'node',
    // Testes de integração no banco de testes real.
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
