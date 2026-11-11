import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // Aplica as migrações no banco de teste antes de tudo.
    globalSetup: ['test/preparar-banco.ts'],
    // Os testes usam um banco real: um arquivo por vez evita disputa entre transações.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
