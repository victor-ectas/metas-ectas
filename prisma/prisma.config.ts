import path from 'node:path';

import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// O .env fica na raiz do repositório.
config({ path: path.resolve(import.meta.dirname, '../.env'), quiet: true });

/**
 * Configuração do Prisma CLI (migrações, seed, generate). As migrações rodam com o dono do
 * esquema (`DATABASE_URL_MIGRACAO`); a aplicação usa `DATABASE_URL`, com privilégios mínimos.
 */
export default defineConfig({
  schema: 'schema.prisma',
  migrations: {
    path: 'migrations',
    seed: 'tsx seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL_MIGRACAO,
  },
});
