import { execSync } from 'node:child_process';
import path from 'node:path';

import { urlBancoTeste } from './ambiente.js';

/**
 * globalSetup do Vitest: aplica as migrações pendentes no banco de testes com
 * `prisma migrate deploy` (não apaga nada). Os testes rodam cada um numa transação desfeita.
 */
export default function prepararBanco(): void {
  const url = urlBancoTeste();
  execSync('pnpm exec prisma migrate deploy', {
    cwd: path.resolve(import.meta.dirname, '..'),
    env: { ...process.env, DATABASE_URL_MIGRACAO: url },
    stdio: 'pipe',
  });
}
