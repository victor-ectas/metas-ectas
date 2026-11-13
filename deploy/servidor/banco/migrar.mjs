// Roda o Prisma CLI que vem no pacote da API contra as migrações deste pacote (P16).
//
//   node migrar.mjs deploy    -> prisma migrate deploy (aplica as pendentes; nunca apaga nada)
//   node migrar.mjs status    -> prisma migrate status
//
// Precisa de DATABASE_URL_MIGRACAO (usuário metas_owner) no ambiente.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const PERMITIDOS = new Set(['deploy', 'status']);
const comando = process.argv[2] ?? 'status';
if (!PERMITIDOS.has(comando)) {
  console.error(`Uso: node migrar.mjs <${[...PERMITIDOS].join('|')}>`);
  process.exit(2);
}
if (!process.env.DATABASE_URL_MIGRACAO) {
  console.error('Defina DATABASE_URL_MIGRACAO (usuário metas_owner) antes de migrar.');
  process.exit(2);
}

const aqui = import.meta.dirname;
const cli = path.resolve(aqui, '../api/node_modules/prisma/build/index.js');
if (!existsSync(cli)) {
  console.error(`Prisma CLI não encontrado em ${cli}. O pacote está completo?`);
  process.exit(2);
}

const resultado = spawnSync(
  process.execPath,
  [cli, 'migrate', comando, '--config', path.join(aqui, 'prisma.config.mjs')],
  { cwd: aqui, stdio: 'inherit', env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: '1' } },
);
process.exit(resultado.status ?? 1);
