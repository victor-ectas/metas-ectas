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
    },
  }),
);
