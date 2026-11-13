// Configuração do Prisma CLI no servidor (P16). Igual à de prisma/prisma.config.ts, sem o .env:
// a URL do dono do esquema vem do ambiente, posta pelo publicar.ps1 só durante a migração.
export default {
  schema: 'schema.prisma',
  migrations: { path: 'migrations' },
  datasource: { url: process.env.DATABASE_URL_MIGRACAO },
};
