/**
 * Lançamentos (CLAUDE.md P18, especificação 4.5, RN-07 a RN-12, RN-34, RN-38): a consulta do
 * mês para a tela de lançamento e o lote de gravação. Valores como texto decimal; percentual
 * como fração (25% → "0.25"); vazio é `null`, nunca zero (RN-08).
 */
import { z } from 'zod';

import {
  AcumulacaoSchema,
  ModoApuracaoSchema,
  OperadorSchema,
  OrigemLancamentoSchema,
  RegraPontuacaoSchema,
  StatusCicloSchema,
  StatusMesSchema,
  TipoVariavelSchema,
  UnidadeSchema,
} from './enums.js';
import { DecimalStringSchema, MesSchema, UuidSchema } from './schemas.js';

/**
 * Sem ciclo: o ciclo ativo. Sem mês: o mês aberto mais antigo com pendências (especificação 9.2),
 * ou o último aberto.
 */
export const FiltroLancamentosSchema = z.object({
  ciclo: UuidSchema.optional(),
  mes: z.coerce.number().pipe(MesSchema).optional(),
});
export type FiltroLancamentos = z.infer<typeof FiltroLancamentosSchema>;

/** Variável na tela de lançamento, com o valor do mês e os do ano (para a prévia do acumulado). */
export const VariavelLancamentoSchema = z.object({
  id: UuidSchema,
  setorId: UuidSchema,
  setorCodigo: z.string(),
  setorNome: z.string(),
  codigo: z.string(),
  nome: z.string(),
  tipo: TipoVariavelSchema,
  acumulacao: AcumulacaoSchema,
  casasDecimais: z.number().int(),
  /**
   * O usuário lança esta variável (RN-07). `false`: variável de outro setor usada nas fórmulas,
   * só para a prévia.
   */
  editavel: z.boolean(),
  /** Situação do mês para esta variável: uma reabertura pode valer só para um setor (RN-36). */
  status: StatusMesSchema,
  valor: DecimalStringSchema.nullable(),
  /** Versão do lançamento lida (controle otimista); 0 quando ainda não há lançamento. */
  versao: z.number().int().min(0),
  origem: OrigemLancamentoSchema.nullable(),
  atualizadoEm: z.string().nullable(),
  /** Valores de janeiro a dezembro (posição 0 = janeiro), para a prévia do acumulado. */
  valoresAno: z.array(DecimalStringSchema.nullable()).length(12),
});
export type VariavelLancamento = z.infer<typeof VariavelLancamentoSchema>;

const ObjetivoLancamentoSchema = z.object({ mes: z.number().int(), valor: DecimalStringSchema });

/** Definição da meta para a prévia com o motor no navegador (RF-24). */
const DefinicaoMetaSchema = z.object({
  id: UuidSchema,
  codigo: z.string(),
  indicador: z.string(),
  unidade: UnidadeSchema,
  formula: z.string().nullable(),
  modoApuracao: ModoApuracaoSchema,
  operador: OperadorSchema,
  tolerancia: DecimalStringSchema.nullable(),
  mesInicio: MesSchema,
  mesFim: MesSchema,
  objetivos: z.array(ObjetivoLancamentoSchema),
  pesoInterno: DecimalStringSchema.nullable(),
  /** Chave da fórmula (`CODIGO` ou `SETOR.CODIGO`) → id da variável. */
  variaveis: z.record(z.string(), UuidSchema),
});

export const MetaLancamentoSchema = DefinicaoMetaSchema.extend({
  setorNome: z.string(),
  regraPontuacao: RegraPontuacaoSchema,
  submetas: z.array(DefinicaoMetaSchema),
});
export type MetaLancamento = z.infer<typeof MetaLancamentoSchema>;

/** Um mês do seletor da tela de lançamento. */
export const MesLancamentoSchema = z.object({
  mes: MesSchema,
  /**
   * Situação para o usuário. Fica `REABERTO` também quando a reabertura vale só para o setor de
   * alguma das variáveis dele.
   */
  status: StatusMesSchema,
  /** Fim do prazo de lançamento (15º dia útil do mês seguinte), ISO 8601. */
  fechaEm: z.string(),
  /** Dias úteis de hoje até o prazo, contando os dois; `null` fora de mês aberto. */
  diasUteisRestantes: z.number().int().nullable(),
  /** Variáveis do usuário ainda vazias no mês. */
  pendentes: z.number().int(),
});
export type MesLancamento = z.infer<typeof MesLancamentoSchema>;

/** `GET /lancamentos?ciclo&mes`. */
export const LancamentosMesSchema = z.object({
  ciclo: z.object({ id: UuidSchema, ano: z.number().int(), status: StatusCicloSchema }),
  mes: MesSchema,
  /** Situação do mês para o usuário (reaberturas de todos ou dele). */
  status: StatusMesSchema,
  /** Fim do prazo de lançamento do mês (15º dia útil do mês seguinte), ISO 8601. */
  fechaEm: z.string(),
  /** Os 12 meses do ciclo, para o seletor. */
  meses: z.array(MesLancamentoSchema).length(12),
  /** Administrador: lança como carga histórica, em qualquer mês (RN-38). */
  cargaHistorica: z.boolean(),
  variaveis: z.array(VariavelLancamentoSchema),
  /** Metas ativas que usam as variáveis do usuário, com as submetas. */
  metas: z.array(MetaLancamentoSchema),
});
export type LancamentosMes = z.infer<typeof LancamentosMesSchema>;

export const ItemLancamentoSchema = z.object({
  variavelId: UuidSchema,
  mes: MesSchema,
  /** `null` apaga o valor (vazio, RN-08). */
  valor: DecimalStringSchema.nullable(),
  /** Versão lida no GET; 0 quando ainda não havia lançamento. */
  versao: z.number().int().min(0),
});
export type ItemLancamento = z.infer<typeof ItemLancamentoSchema>;

/** Itens por gravação: um mês inteiro de um gestor cabe com folga. */
export const MAXIMO_ITENS_LANCAMENTO = 500;

export const LancamentosEntradaSchema = z
  .object({
    ciclo: UuidSchema,
    itens: z
      .array(ItemLancamentoSchema)
      .min(1, { error: 'Envie pelo menos um valor.' })
      .max(MAXIMO_ITENS_LANCAMENTO, {
        error: `Envie no máximo ${String(MAXIMO_ITENS_LANCAMENTO)} valores por vez.`,
      }),
  })
  .refine(
    (dados) =>
      new Set(dados.itens.map((i) => `${i.variavelId}:${String(i.mes)}`)).size ===
      dados.itens.length,
    { error: 'A mesma variável e mês aparecem mais de uma vez.', path: ['itens'] },
  );
export type LancamentosEntrada = z.infer<typeof LancamentosEntradaSchema>;

/** Problema de um item do lote, em `detalhes.itens` do erro. */
export const ProblemaLancamentoSchema = z.object({
  indice: z.number().int(),
  variavelId: UuidSchema,
  mes: MesSchema,
  mensagem: z.string(),
});
export type ProblemaLancamento = z.infer<typeof ProblemaLancamentoSchema>;

/** Conflito de versão, em `detalhes.conflitos` do `CONFLITO_VERSAO`: o valor que está gravado. */
export const ConflitoLancamentoSchema = z.object({
  variavelId: UuidSchema,
  mes: MesSchema,
  valorAtual: DecimalStringSchema.nullable(),
  versaoAtual: z.number().int(),
  atualizadoEm: z.string().nullable(),
});
export type ConflitoLancamento = z.infer<typeof ConflitoLancamentoSchema>;

/** `PUT /lancamentos`: o que ficou gravado. */
export const LancamentosSalvosSchema = z.object({
  /** Itens que mudaram (os iguais ao gravado não geram histórico nem nova versão). */
  gravados: z.number().int(),
  itens: z.array(
    z.object({
      variavelId: UuidSchema,
      mes: MesSchema,
      valor: DecimalStringSchema.nullable(),
      versao: z.number().int(),
    }),
  ),
});
export type LancamentosSalvos = z.infer<typeof LancamentosSalvosSchema>;

/** Um mês com prazo correndo no Início (RF-28). */
export const MesPendenteSchema = MesLancamentoSchema.extend({
  /** Variáveis que o usuário lança no mês (as `pendentes` são as vazias entre elas). */
  total: z.number().int(),
});
export type MesPendente = z.infer<typeof MesPendenteSchema>;

/**
 * `GET /lancamentos/pendencias` (Início do Gestor, RF-28): os meses já terminados que ainda
 * aceitam lançamento (abertos ou reabertos para ele), com o prazo e quantas variáveis faltam. O
 * mês corrente fica de fora: ainda está em andamento (decisão de 13/11/2026).
 */
export const PendenciasSchema = z.object({
  /** `null` sem ciclo ativo. */
  ciclo: z.object({ id: UuidSchema, ano: z.number().int(), status: StatusCicloSchema }).nullable(),
  meses: z.array(MesPendenteSchema),
});
export type Pendencias = z.infer<typeof PendenciasSchema>;
