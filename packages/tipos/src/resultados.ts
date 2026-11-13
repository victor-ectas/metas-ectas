/**
 * Resultados calculados pelo motor e gravados pela API (CLAUDE.md P17, especificação 6 e 7.4,
 * RF-36 a RF-38): resultado de cada mês, acumulado do período, atendimento, situação, pontos de
 * cada atribuição, notas por bloco e memória de cálculo. Números como texto decimal (5.4).
 */
import { z } from 'zod';

import {
  BlocoSchema,
  ModoApuracaoSchema,
  OperadorSchema,
  RegraPontuacaoSchema,
  SituacaoSchema,
  UnidadeSchema,
} from './enums.js';
import { UuidSchema } from './schemas.js';

const decimal = z.string();

export const ResultadoMesSchema = z.object({
  mes: z.number().int().min(1).max(12),
  resultado: decimal.nullable(),
  objetivo: decimal.nullable(),
  atendimento: decimal.nullable(),
  /** `null` quando o mês não tem objetivo (situação mensal é só para exibição). */
  situacao: SituacaoSchema.nullable(),
  /** Mês fora do período da meta: histórico, não conta para a nota (RN-14). */
  foraPeriodo: z.boolean(),
  /** Avisos do cálculo, ex.: `DIVISAO_POR_ZERO` (RN-18). */
  aviso: z.string().nullable(),
});
export type ResultadoMes = z.infer<typeof ResultadoMesSchema>;

/** Acumulado do período (RN-17), comparado com o objetivo do último mês (RN-15). */
export const ResultadoAcumuladoSchema = z.object({
  acumulado: decimal.nullable(),
  objetivo: decimal.nullable(),
  /** Entre 0 e 1 (RN-21). Numa meta-mãe, o atendimento composto (RN-27). */
  atendimento: decimal,
  situacao: SituacaoSchema,
  calculadoEm: z.string(),
});
export type ResultadoAcumulado = z.infer<typeof ResultadoAcumuladoSchema>;

const ResultadoItemSchema = z.object({
  metaId: UuidSchema,
  codigo: z.string(),
  indicador: z.string(),
  unidade: UnidadeSchema,
  modoApuracao: ModoApuracaoSchema,
  operador: OperadorSchema,
  formula: z.string().nullable(),
  /** `null` enquanto a meta não foi calculada (ou está inativa). */
  resultado: ResultadoAcumuladoSchema.nullable(),
  mensal: z.array(ResultadoMesSchema),
  /** Memória de cálculo do motor (RF-38): variáveis acumuladas, fórmula, passos e avisos. */
  memoria: z.record(z.string(), z.unknown()).nullable(),
});

export const ResultadoSubmetaSchema = ResultadoItemSchema.extend({
  /** Peso dentro da mãe, como fração (RN-04). */
  pesoInterno: decimal.nullable(),
});
export type ResultadoSubmeta = z.infer<typeof ResultadoSubmetaSchema>;

export const PontosAtribuicaoSchema = z.object({
  usuarioId: UuidSchema,
  usuarioNome: z.string(),
  peso: decimal,
  /** `null` enquanto a meta não foi calculada. */
  pontos: decimal.nullable(),
});
export type PontosAtribuicao = z.infer<typeof PontosAtribuicaoSchema>;

/** `GET /resultados/meta/{id}`: a meta sem pai com submetas, pontos e memória de cálculo. */
export const ResultadoMetaSchema = ResultadoItemSchema.extend({
  cicloId: UuidSchema,
  setorId: UuidSchema,
  setorNome: z.string(),
  bloco: BlocoSchema,
  regraPontuacao: RegraPontuacaoSchema,
  ativo: z.boolean(),
  submetas: z.array(ResultadoSubmetaSchema),
  /**
   * Pontos de cada gestor atribuído (RN-05, CT-15). O Gestor vê só a própria atribuição;
   * Administrador, Diretoria e Leitor veem todas.
   */
  atribuicoes: z.array(PontosAtribuicaoSchema),
});
export type ResultadoMeta = z.infer<typeof ResultadoMetaSchema>;

/** Nota de um bloco (RN-31): soma dos pontos e dos pesos das metas do bloco. */
export const NotaBlocoSchema = z.object({
  peso: decimal,
  pontos: decimal,
});
export type NotaBloco = z.infer<typeof NotaBlocoSchema>;

export const NotasGestorSchema = z.object({
  corporativo: NotaBlocoSchema.nullable(),
  departamental: NotaBlocoSchema.nullable(),
  /** Corporativo + Departamental (RN-31). Parcial durante o ano (RN-32). */
  total: decimal,
  calculadoEm: z.string().nullable(),
});
export type NotasGestor = z.infer<typeof NotasGestorSchema>;

export const MetaDoGestorSchema = z.object({
  metaId: UuidSchema,
  codigo: z.string(),
  indicador: z.string(),
  unidade: UnidadeSchema,
  bloco: BlocoSchema,
  setorId: UuidSchema,
  setorNome: z.string(),
  regraPontuacao: RegraPontuacaoSchema,
  peso: decimal,
  pontos: decimal.nullable(),
  resultado: ResultadoAcumuladoSchema.nullable(),
});
export type MetaDoGestor = z.infer<typeof MetaDoGestorSchema>;

/** `GET /resultados/gestor/{id}?ciclo=`: metas atribuídas ao gestor e as notas. */
export const ResultadosGestorSchema = z.object({
  cicloId: UuidSchema,
  usuario: z.object({ id: UuidSchema, nome: z.string() }),
  /**
   * `null` para o Leitor: as notas somam metas de setores que ele não vê (decisão de
   * 13/11/2026); ele recebe só as metas dos setores liberados.
   */
  notas: NotasGestorSchema.nullable(),
  metas: z.array(MetaDoGestorSchema),
});
export type ResultadosGestor = z.infer<typeof ResultadosGestorSchema>;

export const FiltroResultadosGestorSchema = z.object({ ciclo: UuidSchema });

/** `POST /ciclos/{id}/recalcular`: quantas metas foram recalculadas e em quanto tempo. */
export const RecalculoSchema = z.object({
  metas: z.number().int(),
  milissegundos: z.number(),
});
export type Recalculo = z.infer<typeof RecalculoSchema>;
