import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from './generated/client.js';

export * from './generated/client.js';

/** Opções do PrismaClient com o driver `pg` (no Prisma 7 o client sempre usa um adapter). */
export function opcoesPrismaClient(url: string): { adapter: PrismaPg } {
  return { adapter: new PrismaPg({ connectionString: url }) };
}

/**
 * Cria o PrismaClient. Quem chama decide a URL: `DATABASE_URL` na aplicação,
 * `DATABASE_URL_MIGRACAO` no seed.
 */
export function criarPrismaClient(url: string): PrismaClient {
  return new PrismaClient(opcoesPrismaClient(url));
}
