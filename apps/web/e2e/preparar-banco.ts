/**
 * Prepara o banco dos testes ponta a ponta (P21), antes de subir a API: cria o banco se faltar,
 * aplica as migrações, apaga os dados da rodada anterior e grava um cenário conhecido.
 *
 * Cenário (dados do CT-01, ciclo 2026 ativo):
 * - Paula Fiscal (Gestor) responde pelo setor Fiscal;
 * - meta "Requisições atendidas" = REQ_ATENDIDOS / TOTAL_REQ, ambas SOMA, ≥ 80%, proporcional,
 *   peso 100 (sem metas corporativas, o Departamental soma 100: RN-03);
 * - janeiro 16/20 e fevereiro 14/25 já lançados: acumulado 30/45 = 66,67%, abaixo da meta.
 *
 * Uso: pnpm --filter @metas/web e2e (roda este script e depois o Playwright).
 */
import { execSync } from 'node:child_process';
import path from 'node:path';

import { parse } from '@metas/motor';
import { criarPrismaClient, type Prisma } from '@metas/prisma';

import { ADMIN, BANCO_E2E, GESTOR, RAIZ, urlBancoDeTestes, urlDono, usuarioApp } from './ambiente';

async function criarBancoSeFaltar(): Promise<void> {
  // Conecta pelo banco de testes, que sempre existe, para criar o do E2E.
  const dono = criarPrismaClient(urlBancoDeTestes());
  try {
    const existe = await dono.$queryRaw<unknown[]>`
      SELECT 1 FROM pg_database WHERE datname = ${BANCO_E2E}`;
    if (existe.length > 0) return;
    // CREATE DATABASE não aceita parâmetro; o nome é a constante BANCO_E2E.
    await dono.$executeRawUnsafe(`CREATE DATABASE ${BANCO_E2E}`);
  } finally {
    await dono.$disconnect();
  }

  // Mesmos privilégios dos bancos do Docker (docker/postgres/init): o usuário da aplicação só lê
  // e escreve dados.
  const novo = criarPrismaClient(urlDono());
  try {
    await novo.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('e2e.usuario_app', ${usuarioApp()}, true)`;
      await tx.$executeRaw`
        DO $$
        DECLARE app text := current_setting('e2e.usuario_app');
        BEGIN
          REVOKE CREATE ON SCHEMA public FROM PUBLIC;
          EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', app);
          EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public
            GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I', app);
          EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public
            GRANT USAGE, SELECT ON SEQUENCES TO %I', app);
          EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public
            GRANT EXECUTE ON FUNCTIONS TO %I', app);
        END $$`;
    });
  } finally {
    await novo.$disconnect();
  }
}

function migrar(): void {
  execSync('pnpm exec prisma migrate deploy', {
    cwd: path.join(RAIZ, 'prisma'),
    env: { ...process.env, DATABASE_URL_MIGRACAO: urlDono() },
    stdio: 'pipe',
  });
}

/**
 * Apaga todos os dados do banco do E2E (as migrações ficam). Histórico e auditoria são somente
 * inclusão: os triggers que bloqueiam o TRUNCATE são desligados só nesta transação.
 */
async function limpar(tx: Prisma.TransactionClient): Promise<void> {
  const [banco] = await tx.$queryRaw<{ nome: string }[]>`SELECT current_database() AS nome`;
  if (banco?.nome !== BANCO_E2E) {
    throw new Error(`Limpeza recusada: banco ${String(banco?.nome)} não é o ${BANCO_E2E}.`);
  }
  await tx.$executeRaw`ALTER TABLE auditoria DISABLE TRIGGER auditoria_sem_truncate`;
  await tx.$executeRaw`
    ALTER TABLE lancamento_historico DISABLE TRIGGER lancamento_historico_sem_truncate`;
  await tx.$executeRaw`
    DO $$
    BEGIN
      EXECUTE (
        SELECT 'TRUNCATE ' || string_agg(format('%I', tablename), ', ') || ' CASCADE'
        FROM pg_tables
        WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
      );
    END $$`;
  await tx.$executeRaw`ALTER TABLE auditoria ENABLE TRIGGER auditoria_sem_truncate`;
  await tx.$executeRaw`
    ALTER TABLE lancamento_historico ENABLE TRIGGER lancamento_historico_sem_truncate`;
}

async function gravarCenario(tx: Prisma.TransactionClient): Promise<void> {
  const admin = await tx.usuario.create({
    data: { email: ADMIN.email, nome: ADMIN.nome, perfil: 'ADMIN', ativo: true },
  });
  const gestor = await tx.usuario.create({
    data: { email: GESTOR.email, nome: GESTOR.nome, perfil: 'GESTOR', ativo: true },
  });
  await tx.setor.create({ data: { codigo: 'CORP', nome: 'Corporativo', corporativo: true } });
  const fiscal = await tx.setor.create({ data: { codigo: 'FISCAL', nome: 'Fiscal' } });
  await tx.feriado.createMany({
    data: [
      { data: new Date('2026-11-02'), descricao: 'Finados', tipo: 'NACIONAL' },
      { data: new Date('2026-11-20'), descricao: 'Dia da Consciência Negra', tipo: 'NACIONAL' },
    ],
  });
  const ciclo = await tx.ciclo.create({
    data: { ano: 2026, status: 'ATIVO', criadoPor: admin.id },
  });
  await tx.setorResponsavel.create({
    data: { cicloId: ciclo.id, setorId: fiscal.id, usuarioId: gestor.id },
  });

  const comum = {
    cicloId: ciclo.id,
    setorId: fiscal.id,
    tipo: 'NUMERO',
    acumulacao: 'SOMA',
  } as const;
  const atendidos = await tx.variavel.create({
    data: {
      ...comum,
      codigo: 'REQ_ATENDIDOS',
      nome: 'Requisições atendidas no prazo',
      casasDecimais: 0,
    },
  });
  const total = await tx.variavel.create({
    data: { ...comum, codigo: 'TOTAL_REQ', nome: 'Total de requisições', casasDecimais: 0 },
  });

  const formula = 'REQ_ATENDIDOS / TOTAL_REQ';
  const meta = await tx.meta.create({
    data: {
      cicloId: ciclo.id,
      setorId: fiscal.id,
      codigo: 'FISCAL_REQ',
      indicador: 'Requisições atendidas no prazo',
      metrica: 'Requisições atendidas no prazo ÷ total de requisições',
      unidade: 'PERCENTUAL',
      formulaTexto: formula,
      formulaAst: parse(formula) as unknown as Prisma.InputJsonValue,
      modoApuracao: 'FORMULA_SOBRE_ACUMULADOS',
      operador: 'GE',
      mesInicio: 1,
      mesFim: 12,
      regraPontuacao: 'PROPORCIONAL',
      responsavelId: gestor.id,
    },
  });
  await tx.metaVariavel.createMany({
    data: [
      { metaId: meta.id, variavelId: atendidos.id },
      { metaId: meta.id, variavelId: total.id },
    ],
  });
  await tx.metaObjetivo.create({ data: { metaId: meta.id, mes: 0, valor: '0.8' } });
  await tx.metaAtribuicao.create({ data: { metaId: meta.id, usuarioId: gestor.id, peso: '100' } });

  const valores: readonly [string, number, string][] = [
    [atendidos.id, 1, '16'],
    [total.id, 1, '20'],
    [atendidos.id, 2, '14'],
    [total.id, 2, '25'],
  ];
  await tx.lancamento.createMany({
    data: valores.map(([variavelId, mes, valor]) => ({
      variavelId,
      mes,
      valor,
      origem: 'CARGA_HISTORICA',
      atualizadoPor: admin.id,
    })),
  });
}

async function preparar(): Promise<void> {
  await criarBancoSeFaltar();
  migrar();
  const dono = criarPrismaClient(urlDono());
  try {
    await dono.$transaction(async (tx) => {
      await limpar(tx);
      await gravarCenario(tx);
    });
  } finally {
    await dono.$disconnect();
  }
  console.log(`Banco ${BANCO_E2E} pronto para os testes ponta a ponta.`);
}

await preparar();
