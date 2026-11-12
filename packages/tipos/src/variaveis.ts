/**
 * Contratos das variáveis (CLAUDE.md P12, especificação 4.4 e RN-07 a RN-12): o que o gestor
 * lança mês a mês e as fórmulas das metas usam pelo código.
 */
import { z } from 'zod';

import {
  AcumulacaoSchema,
  OrigemVariavel,
  OrigemVariavelSchema,
  TipoVariavel,
  TipoVariavelSchema,
} from './enums.js';
import { UuidSchema } from './schemas.js';

/**
 * Nomes de função da linguagem de fórmulas (CLAUDE.md 8.1), inclusive os da Fase 2. Não podem
 * ser código de variável: `MAX` como variável e `MAX(...)` como função confundiriam quem lê.
 */
export const NOMES_RESERVADOS = [
  'SE',
  'E',
  'OU',
  'NAO',
  'ARRED',
  'MIN',
  'MAX',
  'ABS',
  'ANTERIOR',
  'META',
] as const;

/** Código usado na fórmula (`PRESENCAS`, `RH.TOTAL_COLAB`): maiúsculas, números e _. */
export const CodigoVariavelSchema = z
  .string({ error: 'O código é obrigatório.' })
  .trim()
  .toUpperCase()
  .min(1, { error: 'O código é obrigatório.', abort: true })
  .max(40, { error: 'O código pode ter no máximo 40 caracteres.', abort: true })
  .regex(/^[A-Z_][A-Z0-9_]*$/, {
    error: 'Use letras sem acento, números e _, começando por letra (ex.: TOTAL_REQ).',
    abort: true,
  })
  .refine((codigo) => !(NOMES_RESERVADOS as readonly string[]).includes(codigo), {
    error: 'Este código é o nome de uma função das fórmulas. Escolha outro.',
  });

/** Meta cuja fórmula usa a variável (`meta_variavel`). */
export const UsoVariavelSchema = z.object({
  id: UuidSchema,
  codigo: z.string(),
  indicador: z.string(),
  ativo: z.boolean(),
});
export type UsoVariavel = z.infer<typeof UsoVariavelSchema>;

export const VariavelSchema = z.object({
  id: UuidSchema,
  cicloId: UuidSchema,
  setorId: UuidSchema,
  setorCodigo: z.string(),
  setorNome: z.string(),
  codigo: z.string(),
  nome: z.string(),
  tipo: TipoVariavelSchema,
  acumulacao: AcumulacaoSchema,
  origem: OrigemVariavelSchema,
  /** Só no Corporativo (RN-07); nos outros setores lança o responsável pelo setor no ciclo. */
  responsavelId: UuidSchema.nullable(),
  responsavelNome: z.string().nullable(),
  casasDecimais: z.number().int(),
  ativo: z.boolean(),
  /** Já tem lançamentos: tipo, acumulação e setor ficam fixos. */
  temLancamentos: z.boolean(),
  /** Metas que usam a variável (RF-20). */
  usadaPor: z.array(UsoVariavelSchema),
});
export type Variavel = z.infer<typeof VariavelSchema>;
export const ListaVariaveisSchema = z.array(VariavelSchema);

/** `GET /ciclos/{id}/variaveis?setor=`. */
export const FiltroVariaveisSchema = z.object({ setor: UuidSchema.optional() });

/**
 * Cadastro e edição (RF-19). SIM/NÃO é guardado como 1/0 (RN-10), por isso não tem casas
 * decimais.
 */
export const VariavelEntradaSchema = z
  .object({
    setorId: UuidSchema,
    codigo: CodigoVariavelSchema,
    nome: z
      .string({ error: 'O nome é obrigatório.' })
      .trim()
      .min(2, { error: 'O nome precisa ter ao menos 2 caracteres.' })
      .max(200, { error: 'O nome pode ter no máximo 200 caracteres.' }),
    tipo: TipoVariavelSchema,
    acumulacao: AcumulacaoSchema,
    origem: OrigemVariavelSchema.default(OrigemVariavel.DIGITADA),
    responsavelId: UuidSchema.nullable().default(null),
    casasDecimais: z
      .number({ error: 'Informe as casas decimais.' })
      .int({ error: 'As casas decimais devem ser um número inteiro.' })
      .min(0, { error: 'As casas decimais vão de 0 a 6.' })
      .max(6, { error: 'As casas decimais vão de 0 a 6.' })
      .default(2),
    ativo: z.boolean().default(true),
  })
  .transform((variavel) =>
    variavel.tipo === TipoVariavel.SIM_NAO ? { ...variavel, casasDecimais: 0 } : variavel,
  );
export type VariavelEntrada = z.input<typeof VariavelEntradaSchema>;
