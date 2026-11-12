import { defineConfig, mergeConfig } from 'vitest/config';

import configVite from './vite.config.ts';

export default mergeConfig(
  configVite,
  defineConfig({
    test: {
      include: ['test/**/*.test.{ts,tsx}'],
      environment: 'jsdom',
      setupFiles: ['test/preparar.ts'],
      // Testes não dependem do `.env` local: cada um monta a configuração de que precisa.
      env: { VITE_AUTH_DEV: 'true', VITE_API_URL: 'http://api.teste/api/v1' },
      // Telas inteiras com digitação simulada: sozinhas levam 1–2 s, mas com todos os arquivos
      // em paralelo no Windows passam dos 5 s padrão (P15). O limite cobre a disputa de CPU.
      testTimeout: 15_000,
    },
  }),
);
