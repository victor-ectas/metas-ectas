import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Pacotes do monorepo (@metas/*) resolvem para o código-fonte nos testes (ADR-005).
// Definir `conditions` substitui as padrões do Vite, por isso elas são repetidas aqui.
const CONDICAO_FONTE = '@metas/source';

export default defineConfig({
  // SWC compila os decorators do Nest com metadados de tipo (emitDecoratorMetadata).
  plugins: [swc.vite({ module: { type: 'es6' } })],
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
    globalSetup: ['test/preparar-banco.ts'],
    environment: 'node',
    // Os testes de integração usam o banco de testes real.
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
