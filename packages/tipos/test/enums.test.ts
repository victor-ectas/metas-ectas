import { describe, expect, it } from 'vitest';

import {
  Acumulacao,
  AcumulacaoSchema,
  Bloco,
  BlocoSchema,
  EscopoReabertura,
  EscopoReaberturaSchema,
  ModoApuracao,
  ModoApuracaoSchema,
  Operador,
  OperadorSchema,
  OrigemLancamento,
  OrigemLancamentoSchema,
  OrigemVariavel,
  OrigemVariavelSchema,
  Perfil,
  PerfilSchema,
  RegraPontuacao,
  RegraPontuacaoSchema,
  Situacao,
  SituacaoSchema,
  StatusCiclo,
  StatusCicloSchema,
  TipoFeriado,
  TipoFeriadoSchema,
  TipoVariavel,
  TipoVariavelSchema,
  Unidade,
  UnidadeSchema,
} from '../src/index.js';

/** Valores exatos da seção 9.1 do CLAUDE.md, na mesma ordem. */
const casos = [
  ['Perfil', Perfil, PerfilSchema, ['ADMIN', 'DIRETORIA', 'GESTOR', 'LEITOR']],
  ['StatusCiclo', StatusCiclo, StatusCicloSchema, ['RASCUNHO', 'ATIVO', 'ENCERRADO']],
  ['TipoFeriado', TipoFeriado, TipoFeriadoSchema, ['NACIONAL', 'ESTADUAL', 'MUNICIPAL', 'EMPRESA']],
  [
    'TipoVariavel',
    TipoVariavel,
    TipoVariavelSchema,
    ['NUMERO', 'PERCENTUAL', 'MOEDA', 'DIAS', 'HORAS', 'SIM_NAO'],
  ],
  ['Acumulacao', Acumulacao, AcumulacaoSchema, ['SOMA', 'MEDIA', 'ULTIMO', 'MAXIMO']],
  ['OrigemVariavel', OrigemVariavel, OrigemVariavelSchema, ['DIGITADA', 'IMPORTADA']],
  [
    'ModoApuracao',
    ModoApuracao,
    ModoApuracaoSchema,
    [
      'FORMULA_SOBRE_ACUMULADOS',
      'SOMA_RESULTADOS',
      'MEDIA_RESULTADOS',
      'MAXIMO_RESULTADOS',
      'ULTIMO_RESULTADO',
    ],
  ],
  ['Operador', Operador, OperadorSchema, ['GE', 'LE', 'EQ', 'FAIXA']],
  ['RegraPontuacao', RegraPontuacao, RegraPontuacaoSchema, ['TUDO_OU_NADA', 'PROPORCIONAL']],
  [
    'Unidade',
    Unidade,
    UnidadeSchema,
    ['PERCENTUAL', 'NUMERO', 'DIAS', 'HORAS', 'MOEDA', 'SIM_NAO'],
  ],
  [
    'OrigemLancamento',
    OrigemLancamento,
    OrigemLancamentoSchema,
    ['DIGITACAO', 'IMPORTACAO', 'CARGA_HISTORICA', 'CORRECAO'],
  ],
  ['EscopoReabertura', EscopoReabertura, EscopoReaberturaSchema, ['TODOS', 'SETOR', 'GESTOR']],
  ['Situacao', Situacao, SituacaoSchema, ['BATIDA', 'ABAIXO', 'FORA_DA_FAIXA', 'SEM_DADOS']],
  ['Bloco', Bloco, BlocoSchema, ['CORPORATIVO', 'DEPARTAMENTAL']],
] as const;

describe('enums da seção 9.1', () => {
  it('cobre os 14 enums', () => {
    expect(casos).toHaveLength(14);
  });

  describe.each(casos)('%s', (_nome, objeto, schema, valores) => {
    it('tem exatamente os valores da especificação, com chave igual ao valor', () => {
      expect(Object.values(objeto)).toEqual(valores);
      for (const [chave, valor] of Object.entries(objeto)) {
        expect(chave).toBe(valor);
      }
    });

    it('o schema aceita cada valor', () => {
      for (const valor of valores) {
        expect(schema.parse(valor)).toBe(valor);
      }
    });

    it('o schema recusa valor desconhecido, minúsculo ou de outro tipo', () => {
      expect(schema.safeParse('INEXISTENTE').success).toBe(false);
      expect(schema.safeParse(valores[0].toLowerCase()).success).toBe(false);
      expect(schema.safeParse(1).success).toBe(false);
      expect(schema.safeParse(null).success).toBe(false);
    });
  });
});
