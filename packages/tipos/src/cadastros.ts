/**
 * Contratos dos cadastros básicos (CLAUDE.md P11, especificação 4.1 e 10.1): usuários, setores,
 * ciclos, feriados, responsáveis por setor no ciclo e setores do Leitor. Os mesmos schemas
 * validam a API e os formulários da web.
 */
import { z } from 'zod';

import { Perfil, PerfilSchema, StatusCicloSchema, TipoFeriadoSchema } from './enums.js';
import { PaginacaoSchema, UuidSchema } from './schemas.js';

/** Lista paginada (CLAUDE.md 5.2). */
export function listaPaginadaSchema<T extends z.ZodType>(item: T) {
  return z.object({
    itens: z.array(item),
    total: z.number().int().min(0),
    pagina: z.number().int().min(1),
    tamanho: z.number().int().min(1),
  });
}

const texto = (campo: string, minimo: number, maximo: number) =>
  z
    .string({ error: `${campo} é obrigatório.` })
    .trim()
    .min(minimo, { error: `${campo} precisa ter ao menos ${String(minimo)} caracteres.` })
    .max(maximo, { error: `${campo} pode ter no máximo ${String(maximo)} caracteres.` });

// ---------------------------------------------------------------------------------------------
// Usuários (RF-03)
// ---------------------------------------------------------------------------------------------

/** E-mail da conta Microsoft da empresa; guardado em minúsculas (CHECK no banco). */
export const EmailSchema = z
  .string({ error: 'O e-mail é obrigatório.' })
  .trim()
  .toLowerCase()
  .max(254, { error: 'O e-mail pode ter no máximo 254 caracteres.' })
  .pipe(z.email({ error: 'E-mail inválido.' }));

export const UsuarioSchema = z.object({
  id: UuidSchema,
  nome: z.string(),
  email: z.string(),
  perfil: PerfilSchema,
  ativo: z.boolean(),
  gerenteGeral: z.boolean(),
  superiorId: UuidSchema.nullable(),
  superiorNome: z.string().nullable(),
  /** Já entrou ao menos uma vez com a conta Microsoft (o `oid` está ligado). */
  entrouAlgumaVez: z.boolean(),
  /** Setores liberados, quando o perfil é Leitor. */
  setoresLeitor: z.array(UuidSchema),
});
export type Usuario = z.infer<typeof UsuarioSchema>;

export const ListaUsuariosSchema = listaPaginadaSchema(UsuarioSchema);
export type ListaUsuarios = z.infer<typeof ListaUsuariosSchema>;

/** Filtros de `GET /usuarios`: busca por nome ou e-mail, perfil e situação. */
export const FiltroUsuariosSchema = PaginacaoSchema.extend({
  busca: z.string().trim().max(100).optional(),
  perfil: PerfilSchema.optional(),
  ativo: z
    .enum(['true', 'false'], { error: 'Use "true" ou "false".' })
    .transform((valor) => valor === 'true')
    .optional(),
});
export type FiltroUsuarios = z.infer<typeof FiltroUsuariosSchema>;

/**
 * Cadastro e edição de usuário. O usuário é pré-cadastrado pelo e-mail e ligado à conta
 * Microsoft no primeiro login (ADR-013). Gerente Geral só na Diretoria (decisão do
 * desenvolvedor, 12/11/2026; pode haver mais de um).
 */
export const UsuarioEntradaSchema = z
  .object({
    nome: texto('O nome', 2, 200),
    email: EmailSchema,
    perfil: PerfilSchema,
    ativo: z.boolean().default(true),
    gerenteGeral: z.boolean().default(false),
    superiorId: UuidSchema.nullable().default(null),
  })
  .superRefine((usuario, contexto) => {
    if (usuario.gerenteGeral && usuario.perfil !== Perfil.DIRETORIA) {
      contexto.addIssue({
        code: 'custom',
        path: ['gerenteGeral'],
        message: 'Só quem tem o perfil Diretoria pode ser Gerente Geral.',
      });
    }
  });
export type UsuarioEntrada = z.input<typeof UsuarioEntradaSchema>;

/** Setores liberados a um Leitor (`PUT /usuarios/{id}/setores-leitor`). */
export const SetoresLeitorEntradaSchema = z.object({
  setorIds: z
    .array(UuidSchema)
    .max(200)
    .transform((ids) => [...new Set(ids)]),
});
export type SetoresLeitorEntrada = z.input<typeof SetoresLeitorEntradaSchema>;

// ---------------------------------------------------------------------------------------------
// Setores (RF-04)
// ---------------------------------------------------------------------------------------------

/** Código do setor, usado nas fórmulas (`RH.TOTAL_COLAB`): maiúsculas, números e _. */
export const CodigoSetorSchema = z
  .string({ error: 'O código é obrigatório.' })
  .trim()
  .toUpperCase()
  .min(1, { error: 'O código é obrigatório.', abort: true })
  .max(30, { error: 'O código pode ter no máximo 30 caracteres.' })
  .regex(/^[A-Z_][A-Z0-9_]*$/, {
    error: 'Use letras sem acento, números e _, começando por letra (ex.: RH, FISCAL_2).',
  });

export const SetorSchema = z.object({
  id: UuidSchema,
  codigo: z.string(),
  nome: z.string(),
  corporativo: z.boolean(),
  ativo: z.boolean(),
});
export type Setor = z.infer<typeof SetorSchema>;
export const ListaSetoresSchema = z.array(SetorSchema);

export const SetorEntradaSchema = z.object({
  codigo: CodigoSetorSchema,
  nome: texto('O nome', 2, 120),
  corporativo: z.boolean().default(false),
  ativo: z.boolean().default(true),
});
export type SetorEntrada = z.input<typeof SetorEntradaSchema>;

// ---------------------------------------------------------------------------------------------
// Ciclos (RF-07). Ativar e encerrar ficam no P15.
// ---------------------------------------------------------------------------------------------

export const CicloSchema = z.object({
  id: UuidSchema,
  ano: z.number().int(),
  status: StatusCicloSchema,
  encerradoEm: z.string().nullable(),
});
export type Ciclo = z.infer<typeof CicloSchema>;
export const ListaCiclosSchema = z.array(CicloSchema);

export const CicloEntradaSchema = z.object({
  ano: z
    .number({ error: 'O ano deve ser um número.' })
    .int({ error: 'O ano deve ser um número inteiro.' })
    .min(2000, { error: 'O ano deve estar entre 2000 e 2100.' })
    .max(2100, { error: 'O ano deve estar entre 2000 e 2100.' }),
});
export type CicloEntrada = z.input<typeof CicloEntradaSchema>;

/** Responsável de cada setor no ciclo (RF-05). `usuarioId` nulo: setor sem responsável. */
export const ResponsavelSetorSchema = z.object({
  setor: SetorSchema,
  usuarioId: UuidSchema.nullable(),
  usuarioNome: z.string().nullable(),
});
export type ResponsavelSetor = z.infer<typeof ResponsavelSetorSchema>;
export const ListaResponsaveisSchema = z.array(ResponsavelSetorSchema);

/** `PUT /ciclos/{id}/responsaveis`: só os setores enviados mudam; `null` tira o responsável. */
export const ResponsaveisEntradaSchema = z.object({
  responsaveis: z
    .array(z.object({ setorId: UuidSchema, usuarioId: UuidSchema.nullable() }))
    .min(1, { error: 'Informe ao menos um setor.' })
    .max(200)
    .refine((lista) => new Set(lista.map((item) => item.setorId)).size === lista.length, {
      error: 'Cada setor pode aparecer só uma vez.',
    }),
});
export type ResponsaveisEntrada = z.input<typeof ResponsaveisEntradaSchema>;

// ---------------------------------------------------------------------------------------------
// Feriados (RF-06)
// ---------------------------------------------------------------------------------------------

/** Data sem hora, "aaaa-mm-dd", que precisa existir no calendário. */
export const DataSchema = z
  .string({ error: 'A data é obrigatória.' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Data inválida. Use o formato aaaa-mm-dd.', abort: true })
  .refine(
    (valor) => {
      const data = new Date(`${valor}T00:00:00Z`);
      return !Number.isNaN(data.getTime()) && data.toISOString().startsWith(valor);
    },
    { error: 'Essa data não existe no calendário.' },
  );

export const FeriadoSchema = z.object({
  id: UuidSchema,
  data: z.string(),
  descricao: z.string(),
  tipo: TipoFeriadoSchema,
});
export type Feriado = z.infer<typeof FeriadoSchema>;
export const ListaFeriadosSchema = z.array(FeriadoSchema);

export const FiltroFeriadosSchema = z.object({
  ano: z.coerce
    .number({ error: 'O ano deve ser um número.' })
    .int({ error: 'O ano deve ser um número inteiro.' })
    .min(2000, { error: 'O ano deve estar entre 2000 e 2100.' })
    .max(2100, { error: 'O ano deve estar entre 2000 e 2100.' }),
});

export const FeriadoEntradaSchema = z.object({
  data: DataSchema,
  descricao: texto('A descrição', 2, 120),
  tipo: TipoFeriadoSchema,
});
export type FeriadoEntrada = z.input<typeof FeriadoEntradaSchema>;
