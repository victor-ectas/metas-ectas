import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** Raiz do monorepo: o `.env` único fica lá (CLAUDE.md 11). */
const RAIZ = fileURLToPath(new URL('../..', import.meta.url));

/**
 * Pacotes do monorepo (@metas/*) resolvem para o código-fonte: o Vite compila o TypeScript deles
 * junto com a web, no desenvolvimento e no build (ADR-005, ADR-014). Definir `conditions`
 * substitui as padrões do Vite, por isso elas são repetidas aqui.
 */
const CONDICAO_FONTE = '@metas/source';

/** Versão da web para "Sobre o sistema" (Configurações): commit e data do build. */
function versaoWeb(): { commit: string; geradoEm: string } {
  let commit = 'local';
  try {
    commit = execSync('git rev-parse --short HEAD', {
      cwd: RAIZ,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    // Sem git (ex.: pacote copiado): fica "local".
  }
  return { commit, geradoEm: new Date().toISOString() };
}

export default defineConfig({
  plugins: [react()],
  define: { __VERSAO_WEB__: JSON.stringify(versaoWeb()) },
  envDir: RAIZ,
  resolve: {
    conditions: [CONDICAO_FONTE, 'module', 'browser', 'development|production'],
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  build: {
    sourcemap: true,
    // MUI + React Router + Zod: ~210 KB comprimidos, aceitável na rede interna (RNF-03). Quebrar
    // por rota quando as telas crescerem (ADR-014).
    chunkSizeWarningLimit: 800,
  },
});
