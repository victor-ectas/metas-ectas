import { execSync } from 'node:child_process';
import path from 'node:path';

import { urlBancoTeste } from './ambiente.js';

/**
 * globalSetup do Vitest: aplica as migrações pendentes no banco de testes
 * (`prisma migrate deploy`, não apaga nada), pelo pacote @metas/prisma.
 */
export default function prepararBanco(): void {
  execSync('pnpm exec prisma migrate deploy', {
    cwd: path.resolve(import.meta.dirname, '../../../prisma'),
    env: { ...process.env, DATABASE_URL_MIGRACAO: urlBancoTeste() },
    stdio: 'pipe',
  });
}
