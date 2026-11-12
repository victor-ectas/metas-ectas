/**
 * Contratos das metas (CLAUDE.md P13, especificação 4.3, RN-01 a RN-06, RN-13 a RN-31): meta com
 * submetas, objetivos e atribuições, salva de uma vez (os pesos internos só fecham juntos), e a
 * validação de fórmula do editor.
 */
import { z } from 'zod';

import {
  BlocoSchema,
  ModoApuracaoSchema,
  OperadorSchema,
  RegraPontuacao,
  RegraPontuacaoSchema,
  TipoVariavelSchema,
  UnidadeSchema,
} from './enums.js';
import {
  DecimalStringSchema,
  MES_OBJETIVO_UNICO,
  MesObjetivoSchema,
  MesSchema,
  UuidSchema,
} from './schemas.js';

/** Código da meta (único no ciclo; usado em `META("CODIGO")` na Fase 2). */
export const CodigoMetaSchema = z
  .string({ error: 'O código é obrigatório.' })
  .trim()
  .toUpperCase()
  .min(1, { error: 'O código é obrigatório.', abort: true })
  .max(40, { error: 'O código pode ter no máximo 40 caracteres.', abort: true })
  .regex(/^[A-Z_][A-Z0-9_]*$/, {
    error: 'Use letras sem acento, números e _, começando por letra (ex.: FISCAL_PRAZO).',
  });

const texto = (campo: string, minimo: number, maximo: number) =>
  z
    .string({ error: `${campo} é obrigatório.` })
    .trim()
    .min(minimo, { error: `${campo} precisa ter ao menos ${String(minimo)} caracteres.` })
    .max(maximo, { error: `${campo} pode ter no máximo ${String(maximo)} caracteres.` });

/** Número positivo como texto decimal (pesos). */
const positivo = (mensagem: string) =>
  DecimalStringSchema.refine((valor) => Number(valor) > 0, { error: mensagem });

/** Objetivo de um mês (1 a 12) ou único (mês 0), na unidade guardada (percentual como fração). */
export const ObjetivoSchema = z.object({ mes: MesObjetivoSchema, valor: DecimalStringSchema });
export type Objetivo = z.infer<typeof ObjetivoSchema>;

/**
 * Objetivo único (só o mês 0) ou mensal (meses 1 a 12 dentro do período), sem misturar (RN-15,
 * RF-12). O período vem da meta, por isso a checagem fica no `superRefine` da meta.
 */
const ObjetivosSchema = z
  .array(ObjetivoSchema)
  .max(12)
  .refine((lista) => new Set(lista.map((o) => o.mes)).size === lista.length, {
    error: 'Cada mês pode ter só um objetivo.',
  });

/** Peso no bloco do gestor (RN-03): em pontos, maior que zero e até 100. */
export const PesoAtribuicaoSchema = positivo('O peso precisa ser maior que zero.').refine(
  (valor) => Number(valor) <= 100,
  { error: 'O peso pode ser no máximo 100.' },
);

/** Peso interno (RN-04, RN-30): fração maior que zero e até 1 (20% = "0.2"). */
export const PesoInternoSchema = positivo('O peso interno precisa ser maior que zero.').refine(
  (valor) => Number(valor) <= 1,
  { error: 'O peso interno pode ser no máximo 100%.' },
);

export const AtribuicaoEntradaSchema = z.object({
  usuarioId: UuidSchema,
  peso: PesoAtribuicaoSchema,
});

/** O que meta e submeta têm em comum (RN-29: a submeta tem fórmula, operador, objetivo e período). */
const camposDeCalculo = {
  codigo: CodigoMetaSchema,
  indicador: texto('O indicador', 2, 200),
  metrica: texto('A métrica', 2, 2000),
  unidade: UnidadeSchema,
  /** Texto da fórmula; `null` só na meta-mãe que apenas agrega as submetas (RN-30). */
  formula: z
    .string()
    .trim()
    .max(2000, { error: 'A fórmula pode ter no máximo 2000 caracteres.' })
    .nullable()
    .transform((valor) => (valor === '' ? null : valor)),
  modoApuracao: ModoApuracaoSchema,
  operador: OperadorSchema,
  tolerancia: DecimalStringSchema.nullable().default(null),
  mesInicio: MesSchema,
  mesFim: MesSchema,
  objetivos: ObjetivosSchema,
  ativo: z.boolean().default(true),
};

type ComPeriodo = { mesInicio: number; mesFim: number; objetivos: readonly Objetivo[] };

function conferirPeriodoEObjetivos(meta: ComPeriodo, contexto: z.RefinementCtx) {
  if (meta.mesFim < meta.mesInicio) {
    contexto.addIssue({
      code: 'custom',
      path: ['mesFim'],
      message: 'O mês final precisa ser igual ou depois do mês inicial.',
    });
    return;
  }
  const unico = meta.objetivos.some((o) => o.mes === MES_OBJETIVO_UNICO);
  if (unico && meta.objetivos.length > 1) {
    contexto.addIssue({
      code: 'custom',
      path: ['objetivos'],
      message: 'Use um objetivo único ou objetivos por mês, não os dois.',
    });
  }
  if (meta.objetivos.some((o) => o.mes !== 0 && (o.mes < meta.mesInicio || o.mes > meta.mesFim))) {
    contexto.addIssue({
      code: 'custom',
      path: ['objetivos'],
      message: 'Os objetivos mensais precisam estar dentro do período da meta.',
    });
  }
}

/**
 * Submeta (RN-29): herda ciclo, setor e responsável da mãe; não tem atribuição nem pontuação
 * própria. `id` presente altera a submeta existente; ausente, cria.
 */
export const SubmetaEntradaSchema = z
  .object({
    id: UuidSchema.optional(),
    ...camposDeCalculo,
    pesoInterno: PesoInternoSchema,
    /** Só para recusar com mensagem clara: no máximo 2 níveis (RN-26). */
    submetas: z
      .array(z.unknown())
      .max(0, { error: 'Uma submeta não pode ter submetas (máximo de 2 níveis).' })
      .optional(),
  })
  .superRefine(conferirPeriodoEObjetivos);
export type SubmetaEntrada = z.input<typeof SubmetaEntradaSchema>;

/**
 * Meta sem pai, com as submetas e as atribuições, salva de uma vez. O bloco vem do setor (RN-02).
 * Departamental: uma atribuição, ao responsável; corporativa: uma ou mais (RN-05). Decisões do
 * desenvolvedor em 12/11/2026 (ADR-018).
 */
export const MetaEntradaSchema = z
  .object({
    setorId: UuidSchema,
    ...camposDeCalculo,
    regraPontuacao: RegraPontuacaoSchema.default(RegraPontuacao.TUDO_OU_NADA),
    /** Peso do resultado próprio dentro da composição, quando há fórmula e submetas (RN-30). */
    pesoInterno: PesoInternoSchema.nullable().default(null),
    responsavelId: UuidSchema,
    ordem: z.number().int().min(0).max(9999).default(0),
    atribuicoes: z
      .array(AtribuicaoEntradaSchema)
      .min(1, { error: 'Atribua a meta a pelo menos um gestor.' })
      .max(50)
      .refine((lista) => new Set(lista.map((a) => a.usuarioId)).size === lista.length, {
        error: 'Cada gestor pode aparecer só uma vez nas atribuições.',
      }),
    submetas: z.array(SubmetaEntradaSchema).max(30).default([]),
  })
  .superRefine((meta, contexto) => {
    conferirPeriodoEObjetivos(meta, contexto);
    const codigos = [meta.codigo, ...meta.submetas.map((s) => s.codigo)];
    if (new Set(codigos).size !== codigos.length) {
      contexto.addIssue({
        code: 'custom',
        path: ['submetas'],
        message: 'A meta e as submetas precisam de códigos diferentes.',
      });
    }
  });
export type MetaEntrada = z.input<typeof MetaEntradaSchema>;

/** `PUT /metas/{id}`: a meta inteira e a versão lida (controle otimista, 409 `CONFLITO_VERSAO`). */
export const MetaAlteracaoSchema = z.object({
  versao: z.number({ error: 'Informe a versão da meta.' }).int().min(1),
  meta: MetaEntradaSchema,
});
export type MetaAlteracao = z.input<typeof MetaAlteracaoSchema>;

// ---------------------------------------------------------------------------------------------
// Saída
// ---------------------------------------------------------------------------------------------

export const VariavelDaMetaSchema = z.object({
  id: UuidSchema,
  /** Como aparece na fórmula: `CODIGO` ou `SETOR.CODIGO`. */
  chave: z.string(),
  nome: z.string(),
});

const SubmetaSchema = z.object({
  id: UuidSchema,
  codigo: z.string(),
  indicador: z.string(),
  metrica: z.string(),
  unidade: UnidadeSchema,
  formula: z.string().nullable(),
  modoApuracao: ModoApuracaoSchema,
  operador: OperadorSchema,
  tolerancia: z.string().nullable(),
  mesInicio: z.number().int(),
  mesFim: z.number().int(),
  objetivos: z.array(ObjetivoSchema),
  pesoInterno: z.string().nullable(),
  ordem: z.number().int(),
  ativo: z.boolean(),
  versao: z.number().int(),
  variaveis: z.array(VariavelDaMetaSchema),
});
export type Submeta = z.infer<typeof SubmetaSchema>;

export const MetaSchema = SubmetaSchema.extend({
  cicloId: UuidSchema,
  setorId: UuidSchema,
  setorCodigo: z.string(),
  setorNome: z.string(),
  bloco: BlocoSchema,
  regraPontuacao: RegraPontuacaoSchema,
  responsavelId: UuidSchema,
  responsavelNome: z.string(),
  atribuicoes: z.array(
    z.object({ id: UuidSchema, usuarioId: UuidSchema, usuarioNome: z.string(), peso: z.string() }),
  ),
  submetas: z.array(SubmetaSchema),
  /** Alguma variável da meta ou das submetas tem valor lançado: só inativa, não exclui (RF-18). */
  temLancamentos: z.boolean(),
});
export type Meta = z.infer<typeof MetaSchema>;
export const ListaMetasSchema = z.array(MetaSchema);

/** `GET /ciclos/{id}/metas?setor=&gestor=` (gestor: responsável ou atribuído). */
export const FiltroMetasSchema = z.object({
  setor: UuidSchema.optional(),
  gestor: UuidSchema.optional(),
});

// ---------------------------------------------------------------------------------------------
// Validação de fórmula (`POST /formulas/validar`, RF-17)
// ---------------------------------------------------------------------------------------------

export const ValidarFormulaEntradaSchema = z.object({
  cicloId: UuidSchema,
  /** Setor da meta: resolve os códigos sem prefixo. */
  setorId: UuidSchema,
  formula: z.string().max(2000, { error: 'A fórmula pode ter no máximo 2000 caracteres.' }),
  /** Valores de teste por chave (`CODIGO` ou `SETOR.CODIGO`); `null` = vazio. */
  valores: z.record(z.string(), DecimalStringSchema.nullable()).optional(),
});
export type ValidarFormulaEntrada = z.input<typeof ValidarFormulaEntradaSchema>;

export const ValidarFormulaSaidaSchema = z.object({
  valida: z.boolean(),
  erros: z.array(z.object({ mensagem: z.string(), posicao: z.number().int().nullable() })),
  variaveis: z.array(VariavelDaMetaSchema.extend({ tipo: TipoVariavelSchema })),
  /** Só quando vieram valores de teste. `resultado` nulo: variável vazia ou divisão por zero. */
  teste: z.object({ resultado: z.string().nullable(), avisos: z.array(z.string()) }).nullable(),
});
export type ValidarFormulaSaida = z.infer<typeof ValidarFormulaSaidaSchema>;
