import { randomUUID } from 'node:crypto';

import { criarPrismaClient, type Prisma, type PrismaClient } from '@metas/prisma';
import { parse } from '@metas/motor';
import type { Perfil } from '@metas/tipos';

import { urlBancoTeste, urlBancoTesteComoApp } from './ambiente.js';

/**
 * Dados dos testes de integração da API. A API grava de verdade (não há transação desfeita como
 * nos testes do @metas/prisma), então tudo o que os testes criam é marcado para ser apagado:
 * usuários com e-mail em DOMINIO, setores com código iniciado por PREFIXO_SETOR, ciclos em ANOS.
 */
export const DOMINIO = 'api-teste.local';
const PREFIXO_SETOR = 'TAPI_';
const ANOS = [2097, 2098, 2003];
/** ANO_FECHADO: ciclo com dezembro já fechado, para o encerramento (P15). */
export const [ANO_ATIVO, ANO_RASCUNHO, ANO_FECHADO] = ANOS as [number, number, number];
/** Feriados de teste: 2001 (meses já fechados, para a trava) e os anos de teste. */
export const ANO_PASSADO = 2001;
const ANOS_FERIADO = [ANO_PASSADO, ...ANOS];

let app: PrismaClient | undefined;

/** Client com o usuário da aplicação (o mesmo da API), para montar os cenários. */
export function banco(): PrismaClient {
  app ??= criarPrismaClient(urlBancoTesteComoApp());
  return app;
}

export const emailTeste = (nome: string) => `${nome}-${randomUUID().slice(0, 8)}@${DOMINIO}`;

export async function criarUsuario(
  perfil: Perfil,
  alteracoes: { ativo?: boolean; entraOid?: string | null; email?: string; nome?: string } = {},
) {
  return banco().usuario.create({
    data: {
      nome: alteracoes.nome ?? `Teste ${perfil}`,
      email: alteracoes.email ?? emailTeste(perfil.toLowerCase()),
      perfil,
      ativo: alteracoes.ativo ?? true,
      entraOid: alteracoes.entraOid === undefined ? randomUUID() : alteracoes.entraOid,
    },
  });
}

export async function criarSetor(nome: string) {
  const codigo = `${PREFIXO_SETOR}${randomUUID().slice(0, 8).toUpperCase().replace(/-/g, '')}`;
  return banco().setor.create({ data: { codigo, nome } });
}

/** O setor Corporativo do banco de teste (cria um de teste se ainda não houver). */
export async function setorCorporativo() {
  const existente = await banco().setor.findFirst({ where: { corporativo: true } });
  return (
    existente ??
    banco().setor.create({
      data: { codigo: `${PREFIXO_SETOR}CORP`, nome: 'Corporativo (teste)', corporativo: true },
    })
  );
}

export async function criarVariavel(
  cicloId: string,
  setorId: string,
  codigo: string,
  extra: { tipo?: 'NUMERO' | 'PERCENTUAL'; ativo?: boolean } = {},
) {
  return banco().variavel.create({
    data: {
      cicloId,
      setorId,
      codigo,
      nome: `Variável ${codigo}`,
      tipo: extra.tipo ?? 'NUMERO',
      acumulacao: 'SOMA',
      ativo: extra.ativo ?? true,
    },
  });
}

/**
 * Meta mínima com fórmula e o vínculo `meta_variavel` (o cadastro de metas vem no P13). A AST é
 * a do motor, como a API grava.
 */
export async function criarMeta(dados: {
  cicloId: string;
  setorId: string;
  responsavelId: string;
  formula: string;
  variavelIds: string[];
  ativo?: boolean;
}) {
  return banco().meta.create({
    data: {
      cicloId: dados.cicloId,
      setorId: dados.setorId,
      responsavelId: dados.responsavelId,
      codigo: `M_${randomUUID().slice(0, 8).toUpperCase()}`,
      indicador: 'Meta de teste',
      metrica: 'Teste',
      unidade: 'NUMERO',
      formulaTexto: dados.formula,
      formulaAst: parse(dados.formula) as unknown as Prisma.InputJsonValue,
      modoApuracao: 'FORMULA_SOBRE_ACUMULADOS',
      operador: 'GE',
      mesInicio: 1,
      mesFim: 12,
      regraPontuacao: 'PROPORCIONAL',
      ativo: dados.ativo ?? true,
      variaveis: { create: dados.variavelIds.map((variavelId) => ({ variavelId })) },
    },
  });
}

export async function criarCiclo(ano: number, status: 'ATIVO' | 'RASCUNHO' | 'ENCERRADO') {
  return banco().ciclo.create({
    data: { ano, status, encerradoEm: status === 'ENCERRADO' ? new Date() : null },
  });
}

/**
 * Apaga os dados de teste. Roda com o dono do esquema porque a auditoria é somente inclusão: o
 * trigger que a protege é desligado só dentro desta transação, só no banco `_teste`.
 */
export async function limparDados(): Promise<void> {
  const dono = criarPrismaClient(urlBancoTeste());
  const emails = `%@${DOMINIO}`;
  const setores = `${PREFIXO_SETOR}%`;
  try {
    await dono.$transaction(async (tx) => {
      await tx.$executeRaw`ALTER TABLE auditoria DISABLE TRIGGER auditoria_somente_inclusao`;
      await tx.$executeRaw`
        DELETE FROM auditoria
        WHERE usuario_id IN (SELECT id FROM usuario WHERE email LIKE ${emails})`;
      await tx.$executeRaw`ALTER TABLE auditoria ENABLE TRIGGER auditoria_somente_inclusao`;
      await tx.$executeRaw`
        DELETE FROM setor_responsavel
        WHERE ciclo_id IN (SELECT id FROM ciclo WHERE ano = ANY(${ANOS}))
           OR setor_id IN (SELECT id FROM setor WHERE codigo LIKE ${setores})`;
      await tx.$executeRaw`
        DELETE FROM leitor_setor
        WHERE setor_id IN (SELECT id FROM setor WHERE codigo LIKE ${setores})
           OR usuario_id IN (SELECT id FROM usuario WHERE email LIKE ${emails})`;
      // Lançamentos e metas dos ciclos de teste (meta_variavel vai junto, em cascata).
      await tx.$executeRaw`
        DELETE FROM lancamento WHERE variavel_id IN (
          SELECT id FROM variavel
          WHERE ciclo_id IN (SELECT id FROM ciclo WHERE ano = ANY(${ANOS}))
             OR setor_id IN (SELECT id FROM setor WHERE codigo LIKE ${setores}))`;
      // Submetas antes das mães (meta_pai_id é RESTRICT).
      for (const submetas of [true, false]) {
        await tx.$executeRaw`
          DELETE FROM meta
          WHERE (meta_pai_id IS NOT NULL) = ${submetas}
            AND (ciclo_id IN (SELECT id FROM ciclo WHERE ano = ANY(${ANOS}))
              OR setor_id IN (SELECT id FROM setor WHERE codigo LIKE ${setores}))`;
      }
      await tx.$executeRaw`
        DELETE FROM meta
        WHERE ciclo_id IN (SELECT id FROM ciclo WHERE ano = ANY(${ANOS}))
           OR setor_id IN (SELECT id FROM setor WHERE codigo LIKE ${setores})`;
      await tx.$executeRaw`
        DELETE FROM variavel
        WHERE ciclo_id IN (SELECT id FROM ciclo WHERE ano = ANY(${ANOS}))
           OR setor_id IN (SELECT id FROM setor WHERE codigo LIKE ${setores})`;
      await tx.$executeRaw`
        DELETE FROM nota_fechamento WHERE ciclo_id IN (SELECT id FROM ciclo WHERE ano = ANY(${ANOS}))`;
      await tx.$executeRaw`
        DELETE FROM reabertura WHERE ciclo_id IN (SELECT id FROM ciclo WHERE ano = ANY(${ANOS}))`;
      await tx.$executeRaw`DELETE FROM ciclo WHERE ano = ANY(${ANOS})`;
      await tx.$executeRaw`
        DELETE FROM feriado WHERE extract(year FROM data)::int = ANY(${ANOS_FERIADO})`;
      await tx.$executeRaw`DELETE FROM setor WHERE codigo LIKE ${setores}`;
      // superior_id é RESTRICT: desfaz a hierarquia antes de apagar.
      await tx.$executeRaw`UPDATE usuario SET superior_id = NULL WHERE email LIKE ${emails}`;
      await tx.$executeRaw`DELETE FROM usuario WHERE email LIKE ${emails}`;
    });
  } finally {
    await dono.$disconnect();
  }
}

export async function desconectar(): Promise<void> {
  await app?.$disconnect();
  app = undefined;
}
