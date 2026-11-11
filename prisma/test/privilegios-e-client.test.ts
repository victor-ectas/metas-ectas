import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

import { criarPrismaClient } from '../src/index.js';
import { urlBancoTeste, urlBancoTesteComoApp } from './ambiente.js';
import { SQLSTATE, usarBanco } from './banco.js';

describe('usuário da aplicação (metas_app) tem privilégios mínimos', () => {
  const { sql, falha } = usarBanco(urlBancoTesteComoApp);

  it('lê e escreve dados', async () => {
    await sql("INSERT INTO setor (codigo, nome) VALUES ('APP', 'App')");
    expect(await sql("SELECT codigo FROM setor WHERE codigo = 'APP'")).toEqual([{ codigo: 'APP' }]);
  });

  it('não cria nem altera tabelas', async () => {
    expect((await falha('CREATE TABLE invasora (id int)')).code).toBe(SQLSTATE.SEM_PRIVILEGIO);
    expect((await falha('ALTER TABLE setor ADD COLUMN x int')).code).toBe(SQLSTATE.SEM_PRIVILEGIO);
    expect((await falha('DROP TABLE auditoria')).code).toBe(SQLSTATE.SEM_PRIVILEGIO);
  });
});

describe('PrismaClient com adapter pg', () => {
  it('grava e lê com Decimal exato e desfaz na transação', async () => {
    const prisma = criarPrismaClient(urlBancoTeste());
    const desfazer = new Error('desfazer');
    let lido: { valor: string; peso: string } | undefined;
    try {
      await prisma.$transaction(async (tx) => {
        const u = await tx.usuario.create({ data: { nome: 'Teste', email: 'teste@empresa.com' } });
        const s = await tx.setor.create({ data: { codigo: 'TESTE', nome: 'Teste' } });
        const c = await tx.ciclo.create({ data: { ano: 2099 } });
        const m = await tx.meta.create({
          data: {
            cicloId: c.id,
            setorId: s.id,
            codigo: 'M',
            indicador: 'I',
            metrica: 'M',
            unidade: 'PERCENTUAL',
            formulaTexto: 'A / B',
            formulaAst: { tipo: 'binario' },
            modoApuracao: 'FORMULA_SOBRE_ACUMULADOS',
            operador: 'GE',
            mesInicio: 1,
            mesFim: 12,
            regraPontuacao: 'PROPORCIONAL',
            responsavelId: u.id,
            objetivos: { create: { mes: 0, valor: '0.1' } },
            atribuicoes: { create: { usuarioId: u.id, peso: '33.333333' } },
          },
          include: { objetivos: true, atribuicoes: true },
        });
        lido = {
          valor: m.objetivos[0]?.valor.plus('0.2').toString() ?? '',
          peso: m.atribuicoes[0]?.peso.toString() ?? '',
        };
        throw desfazer;
      });
    } catch (erro) {
      if (erro !== desfazer) throw erro;
    } finally {
      await prisma.$disconnect();
    }
    expect(lido).toEqual({ valor: '0.3', peso: '33.333333' });
  });
});

describe('seed', () => {
  it('recusa rodar com NODE_ENV=production', async () => {
    const rodar = promisify(execFile);
    const pasta = path.resolve(import.meta.dirname, '..');
    const tsx = path.join(pasta, 'node_modules', 'tsx', 'dist', 'cli.mjs');
    const erro: unknown = await rodar(process.execPath, [tsx, 'seed.ts'], {
      cwd: pasta,
      env: { ...process.env, NODE_ENV: 'production', SEED_ADMIN_EMAIL: 'x@x.com' },
    }).then(
      () => null,
      (e: unknown) => e,
    );
    expect(erro).toMatchObject({
      code: 1,
      stderr: expect.stringContaining('O seed é só para desenvolvimento') as unknown,
    });
  });
});
