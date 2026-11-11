/**
 * Enums do domínio (CLAUDE.md 9.1), iguais aos enums do PostgreSQL.
 *
 * Cada enum é um objeto `as const` (para usar como valor: `Perfil.ADMIN`), um tipo com o mesmo
 * nome (união dos valores) e um schema Zod para validar entradas.
 */
import { z } from 'zod';

/** Tipo união dos valores de um objeto `as const`. */
type ValorDe<T> = T[keyof T];

export const Perfil = {
  ADMIN: 'ADMIN',
  DIRETORIA: 'DIRETORIA',
  GESTOR: 'GESTOR',
  LEITOR: 'LEITOR',
} as const;
export type Perfil = ValorDe<typeof Perfil>;
export const PerfilSchema = z.enum(Perfil);

export const StatusCiclo = {
  RASCUNHO: 'RASCUNHO',
  ATIVO: 'ATIVO',
  ENCERRADO: 'ENCERRADO',
} as const;
export type StatusCiclo = ValorDe<typeof StatusCiclo>;
export const StatusCicloSchema = z.enum(StatusCiclo);

export const TipoFeriado = {
  NACIONAL: 'NACIONAL',
  ESTADUAL: 'ESTADUAL',
  MUNICIPAL: 'MUNICIPAL',
  EMPRESA: 'EMPRESA',
} as const;
export type TipoFeriado = ValorDe<typeof TipoFeriado>;
export const TipoFeriadoSchema = z.enum(TipoFeriado);

export const TipoVariavel = {
  NUMERO: 'NUMERO',
  PERCENTUAL: 'PERCENTUAL',
  MOEDA: 'MOEDA',
  DIAS: 'DIAS',
  HORAS: 'HORAS',
  SIM_NAO: 'SIM_NAO',
} as const;
export type TipoVariavel = ValorDe<typeof TipoVariavel>;
export const TipoVariavelSchema = z.enum(TipoVariavel);

/** Como a variável vira um número do período (RN-09). */
export const Acumulacao = {
  SOMA: 'SOMA',
  MEDIA: 'MEDIA',
  ULTIMO: 'ULTIMO',
  MAXIMO: 'MAXIMO',
} as const;
export type Acumulacao = ValorDe<typeof Acumulacao>;
export const AcumulacaoSchema = z.enum(Acumulacao);

export const OrigemVariavel = {
  DIGITADA: 'DIGITADA',
  IMPORTADA: 'IMPORTADA',
} as const;
export type OrigemVariavel = ValorDe<typeof OrigemVariavel>;
export const OrigemVariavelSchema = z.enum(OrigemVariavel);

/** Como a meta chega ao resultado do período (RN-17). */
export const ModoApuracao = {
  FORMULA_SOBRE_ACUMULADOS: 'FORMULA_SOBRE_ACUMULADOS',
  SOMA_RESULTADOS: 'SOMA_RESULTADOS',
  MEDIA_RESULTADOS: 'MEDIA_RESULTADOS',
  MAXIMO_RESULTADOS: 'MAXIMO_RESULTADOS',
  ULTIMO_RESULTADO: 'ULTIMO_RESULTADO',
} as const;
export type ModoApuracao = ValorDe<typeof ModoApuracao>;
export const ModoApuracaoSchema = z.enum(ModoApuracao);

/** Operador de comparação com o objetivo (RN-20): ≥, ≤, = e faixa (objetivo ± tolerância). */
export const Operador = {
  GE: 'GE',
  LE: 'LE',
  EQ: 'EQ',
  FAIXA: 'FAIXA',
} as const;
export type Operador = ValorDe<typeof Operador>;
export const OperadorSchema = z.enum(Operador);

export const RegraPontuacao = {
  TUDO_OU_NADA: 'TUDO_OU_NADA',
  PROPORCIONAL: 'PROPORCIONAL',
} as const;
export type RegraPontuacao = ValorDe<typeof RegraPontuacao>;
export const RegraPontuacaoSchema = z.enum(RegraPontuacao);

export const Unidade = {
  PERCENTUAL: 'PERCENTUAL',
  NUMERO: 'NUMERO',
  DIAS: 'DIAS',
  HORAS: 'HORAS',
  MOEDA: 'MOEDA',
  SIM_NAO: 'SIM_NAO',
} as const;
export type Unidade = ValorDe<typeof Unidade>;
export const UnidadeSchema = z.enum(Unidade);

export const OrigemLancamento = {
  DIGITACAO: 'DIGITACAO',
  IMPORTACAO: 'IMPORTACAO',
  CARGA_HISTORICA: 'CARGA_HISTORICA',
  CORRECAO: 'CORRECAO',
} as const;
export type OrigemLancamento = ValorDe<typeof OrigemLancamento>;
export const OrigemLancamentoSchema = z.enum(OrigemLancamento);

export const EscopoReabertura = {
  TODOS: 'TODOS',
  SETOR: 'SETOR',
  GESTOR: 'GESTOR',
} as const;
export type EscopoReabertura = ValorDe<typeof EscopoReabertura>;
export const EscopoReaberturaSchema = z.enum(EscopoReabertura);

/** Situação da meta (RN-25). */
export const Situacao = {
  BATIDA: 'BATIDA',
  ABAIXO: 'ABAIXO',
  FORA_DA_FAIXA: 'FORA_DA_FAIXA',
  SEM_DADOS: 'SEM_DADOS',
} as const;
export type Situacao = ValorDe<typeof Situacao>;
export const SituacaoSchema = z.enum(Situacao);

/**
 * Status de um mês para lançamento (RN-34 a RN-36). Não é enum do banco: é calculado pelo
 * calendário do motor a partir da data de fechamento e das reaberturas.
 */
export const StatusMes = {
  ABERTO: 'ABERTO',
  FECHADO: 'FECHADO',
  REABERTO: 'REABERTO',
  FUTURO: 'FUTURO',
} as const;
export type StatusMes = ValorDe<typeof StatusMes>;
export const StatusMesSchema = z.enum(StatusMes);

/** Bloco da nota do gestor, derivado do setor da meta (RN-02). */
export const Bloco = {
  CORPORATIVO: 'CORPORATIVO',
  DEPARTAMENTAL: 'DEPARTAMENTAL',
} as const;
export type Bloco = ValorDe<typeof Bloco>;
export const BlocoSchema = z.enum(Bloco);
