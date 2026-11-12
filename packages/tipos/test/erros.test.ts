import { describe, expect, it } from 'vitest';

import { CodigoErro, CodigoErroSchema, ErroApiSchema } from '../src/index.js';

describe('códigos de erro (CLAUDE.md 5.3)', () => {
  it('tem os códigos iniciais da 5.3, MUITAS_REQUISICOES, JA_EXISTE e EM_USO', () => {
    expect(Object.values(CodigoErro)).toEqual([
      'NAO_AUTENTICADO',
      'SEM_PERMISSAO',
      'SEM_PERMISSAO_VARIAVEL',
      'NAO_ENCONTRADO',
      'VALIDACAO',
      'MES_FECHADO',
      'MES_FUTURO',
      'CONFLITO_VERSAO',
      'FORMULA_INVALIDA',
      'PESOS_INCONSISTENTES',
      'CICLO_ENCERRADO',
      'IMPORTACAO_INVALIDA',
      'MUITAS_REQUISICOES',
      'JA_EXISTE',
      'EM_USO',
      'ERRO_INTERNO',
    ]);
  });

  it('recusa código desconhecido', () => {
    expect(CodigoErroSchema.safeParse('ERRO_QUALQUER').success).toBe(false);
  });
});

describe('ErroApiSchema', () => {
  it('aceita o exemplo da seção 5.3', () => {
    const erro = {
      codigo: 'MES_FECHADO',
      mensagem: 'Outubro/2026 fechou em 24/11/2026.',
      detalhes: {},
    };
    expect(ErroApiSchema.parse(erro)).toEqual(erro);
  });

  it('aceita detalhes com qualquer conteúdo', () => {
    const resultado = ErroApiSchema.safeParse({
      codigo: 'VALIDACAO',
      mensagem: 'Dados inválidos.',
      detalhes: { campos: [{ campo: 'mes', mensagem: 'O mês deve estar entre 1 e 12.' }] },
    });
    expect(resultado.success).toBe(true);
  });

  it('recusa erro sem mensagem, sem detalhes ou com código inválido', () => {
    expect(
      ErroApiSchema.safeParse({ codigo: 'VALIDACAO', mensagem: '', detalhes: {} }).success,
    ).toBe(false);
    expect(ErroApiSchema.safeParse({ codigo: 'VALIDACAO', mensagem: 'x' }).success).toBe(false);
    expect(ErroApiSchema.safeParse({ codigo: 'OUTRO', mensagem: 'x', detalhes: {} }).success).toBe(
      false,
    );
  });
});
