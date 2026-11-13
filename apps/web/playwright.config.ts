import { defineConfig, devices } from '@playwright/test';

import { ADMIN, AGORA, PORTA_API, PORTA_WEB, RAIZ, URL_API, URL_WEB, urlApp } from './e2e/ambiente';

/**
 * Testes ponta a ponta (P21): API e web de verdade, no modo DEV de autenticação, contra o banco
 * próprio do E2E (preparado por `e2e/preparar-banco.ts`). Portas diferentes das do `pnpm dev`,
 * para rodar com o ambiente de desenvolvimento no ar. O navegador é o Edge instalado no Windows.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: URL_WEB,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Edge'], channel: 'msedge' } },
    {
      name: 'celular',
      use: {
        ...devices['Desktop Edge'],
        channel: 'msedge',
        viewport: { width: 360, height: 780 },
        isMobile: false,
        hasTouch: true,
      },
    },
  ],
  webServer: [
    {
      // API compilada (o script `e2e` da raiz faz o build antes).
      // O mesmo Node que roda o Playwright: não depende do PATH do terminal.
      command: `"${process.execPath}" dist/main.js`,
      cwd: `${RAIZ}/apps/api`,
      url: `${URL_API}/saude`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        NODE_ENV: 'development',
        PORT_API: String(PORTA_API),
        DATABASE_URL: urlApp(),
        WEB_ORIGIN: URL_WEB,
        AUTH_DEV: 'true',
        AUTH_DEV_EMAIL: ADMIN.email,
        RELOGIO_FIXO: AGORA,
        LOG_LEVEL: 'warn',
      },
    },
    {
      command: `pnpm exec vite --port ${String(PORTA_WEB)} --strictPort`,
      url: URL_WEB,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { VITE_AUTH_DEV: 'true', VITE_API_URL: URL_API },
    },
  ],
});
