import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from './generated/client.js';

export * from './generated/client.js';

/**
 * Cria o PrismaClient com o driver `pg` (no Prisma 7 o client sempre usa um adapter).
 * Quem chama decide a URL: `DATABASE_URL` na aplicação, `DATABASE_URL_MIGRACAO` no seed.
 */
export function criarPrismaClient(url: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}
