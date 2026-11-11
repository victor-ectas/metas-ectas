/**
 * Seed de DESENVOLVIMENTO (CLAUDE.md P07): um Administrador a partir de SEED_ADMIN_EMAIL,
 * setores e ciclo de exemplo e alguns feriados. Idempotente (pode rodar várias vezes).
 * Recusa-se a rodar com NODE_ENV=production.
 *
 * Uso: pnpm --filter @metas/prisma seed
 */
import path from 'node:path';

import { config } from 'dotenv';

import { criarPrismaClient, type TipoFeriado } from './src/index.js';

config({ path: path.resolve(import.meta.dirname, '../.env'), quiet: true });

const SETORES: readonly { codigo: string; nome: string; corporativo?: boolean }[] = [
  { codigo: 'CORP', nome: 'Corporativo', corporativo: true },
  { codigo: 'RH', nome: 'Recursos Humanos' },
  { codigo: 'FISCAL', nome: 'Fiscal' },
  { codigo: 'QUALIDADE', nome: 'Qualidade' },
  { codigo: 'ENGENHARIA', nome: 'Engenharia' },
  { codigo: 'FABRICA', nome: 'Fábrica' },
  { codigo: 'PCPM', nome: 'PCPM' },
];

/** Exemplo para desenvolvimento. O calendário real é mantido pelo Administrador (RF-06). */
const FERIADOS: readonly { data: string; descricao: string; tipo: TipoFeriado }[] = [
  { data: '2026-11-02', descricao: 'Finados', tipo: 'NACIONAL' },
  { data: '2026-11-15', descricao: 'Proclamação da República', tipo: 'NACIONAL' },
  { data: '2026-11-20', descricao: 'Dia da Consciência Negra', tipo: 'NACIONAL' },
  { data: '2026-12-25', descricao: 'Natal', tipo: 'NACIONAL' },
  { data: '2027-01-01', descricao: 'Confraternização Universal', tipo: 'NACIONAL' },
  { data: '2027-03-09', descricao: 'Aniversário de Joinville', tipo: 'MUNICIPAL' },
  { data: '2027-03-26', descricao: 'Sexta-feira Santa', tipo: 'NACIONAL' },
  { data: '2027-04-21', descricao: 'Tiradentes', tipo: 'NACIONAL' },
  { data: '2027-05-01', descricao: 'Dia do Trabalho', tipo: 'NACIONAL' },
  { data: '2027-09-07', descricao: 'Independência do Brasil', tipo: 'NACIONAL' },
  { data: '2027-10-12', descricao: 'Nossa Senhora Aparecida', tipo: 'NACIONAL' },
  { data: '2027-11-02', descricao: 'Finados', tipo: 'NACIONAL' },
  { data: '2027-11-15', descricao: 'Proclamação da República', tipo: 'NACIONAL' },
  { data: '2027-11-20', descricao: 'Dia da Consciência Negra', tipo: 'NACIONAL' },
  { data: '2027-12-25', descricao: 'Natal', tipo: 'NACIONAL' },
];

function obrigatoria(nome: string): string {
  const valor = process.env[nome]?.trim();
  if (valor === undefined || valor === '') {
    throw new Error(`Defina ${nome} no .env para rodar o seed.`);
  }
  return valor;
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('O seed é só para desenvolvimento e não roda com NODE_ENV=production.');
  }
  const emailAdmin = obrigatoria('SEED_ADMIN_EMAIL').toLowerCase();
  const prisma = criarPrismaClient(obrigatoria('DATABASE_URL_MIGRACAO'));

  try {
    await prisma.usuario.upsert({
      where: { email: emailAdmin },
      update: { perfil: 'ADMIN', ativo: true },
      create: { email: emailAdmin, nome: 'Administrador', perfil: 'ADMIN', ativo: true },
    });

    for (const setor of SETORES) {
      await prisma.setor.upsert({
        where: { codigo: setor.codigo },
        update: {},
        create: { codigo: setor.codigo, nome: setor.nome, corporativo: setor.corporativo ?? false },
      });
    }

    await prisma.ciclo.upsert({ where: { ano: 2027 }, update: {}, create: { ano: 2027 } });

    for (const feriado of FERIADOS) {
      const data = new Date(`${feriado.data}T00:00:00Z`);
      await prisma.feriado.upsert({
        where: { data },
        update: {},
        create: { data, descricao: feriado.descricao, tipo: feriado.tipo },
      });
    }

    console.log(
      `Seed concluído: Administrador ${emailAdmin}, ${String(SETORES.length)} setores, ciclo 2027, ${String(FERIADOS.length)} feriados.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((erro: unknown) => {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exitCode = 1;
});
