/**
 * Consistência e ativação do ciclo (CLAUDE.md P15, RF-07, RF-16, especificação 9.1): o painel
 * que lista o que impede ativar o ciclo e o que é só aviso, os pesos de cada gestor (RN-03) e se
 * o ciclo já pode ser encerrado (RN-32).
 */
import { z } from 'zod';

import { CicloSchema } from './cadastros.js';
import { CodigoErroSchema } from './erros.js';
import { UuidSchema } from './schemas.js';

/** `BLOQUEIA` impede ativar o ciclo; `AVISO` só chama a atenção (decisão de 12/11/2026). */
export const GravidadeProblema = {
  BLOQUEIA: 'BLOQUEIA',
  AVISO: 'AVISO',
} as const;
export type GravidadeProblema = (typeof GravidadeProblema)[keyof typeof GravidadeProblema];
export const GravidadeProblemaSchema = z.enum(GravidadeProblema);

export const TipoProblema = {
  /** Pesos do gestor fora de 50/50 ou 100 (RN-03, CT-17). */
  PESOS_GESTOR: 'PESOS_GESTOR',
  /** Configuração da meta (validarMeta do motor): período, objetivo, pesos internos etc. */
  META_INVALIDA: 'META_INVALIDA',
  /** Fórmula que não valida mais contra as variáveis ativas do ciclo. */
  FORMULA_INVALIDA: 'FORMULA_INVALIDA',
  /** Meta ativa sem pai e sem nenhuma atribuição: não vale pontos para ninguém. */
  META_SEM_ATRIBUICAO: 'META_SEM_ATRIBUICAO',
  /** Responsável ou gestor atribuído que deixou de ser Gestor ativo. */
  USUARIO_INVALIDO: 'USUARIO_INVALIDO',
  /** Variável ativa do Corporativo sem responsável próprio (RN-07). */
  VARIAVEL_SEM_RESPONSAVEL: 'VARIAVEL_SEM_RESPONSAVEL',
  /** Setor com variáveis ou metas ativas sem responsável no ciclo (bloqueia) ou setor vazio (aviso). */
  SETOR_SEM_RESPONSAVEL: 'SETOR_SEM_RESPONSAVEL',
  /** Responsável da meta departamental diferente do responsável do setor no ciclo (aviso). */
  RESPONSAVEL_DIFERENTE: 'RESPONSAVEL_DIFERENTE',
  /** Gestor ativo sem nenhuma meta atribuída no ciclo (aviso). */
  GESTOR_SEM_METAS: 'GESTOR_SEM_METAS',
  /** Ciclo sem nenhuma meta ativa (aviso). */
  CICLO_SEM_METAS: 'CICLO_SEM_METAS',
} as const;
export type TipoProblema = (typeof TipoProblema)[keyof typeof TipoProblema];
export const TipoProblemaSchema = z.enum(TipoProblema);

export const ProblemaConsistenciaSchema = z.object({
  tipo: TipoProblemaSchema,
  gravidade: GravidadeProblemaSchema,
  /** Código de erro equivalente (ex.: `PESOS_INCONSISTENTES` no CT-17). */
  codigo: CodigoErroSchema,
  mensagem: z.string(),
  /** Meta sem pai onde está o problema (a submeta aparece pela mãe), para abrir no editor. */
  metaId: UuidSchema.nullable(),
  metaCodigo: z.string().nullable(),
  variavelId: UuidSchema.nullable(),
  setorId: UuidSchema.nullable(),
  usuarioId: UuidSchema.nullable(),
});
export type ProblemaConsistencia = z.infer<typeof ProblemaConsistenciaSchema>;

/** Soma dos pesos de um gestor por bloco (RN-03), em pontos, como texto decimal. */
export const PesosGestorSchema = z.object({
  usuarioId: UuidSchema,
  nome: z.string(),
  /** Gestor ativo? Atribuição a usuário inativo também aparece como problema. */
  ativo: z.boolean(),
  corporativo: z.string(),
  departamental: z.string(),
  total: z.string(),
  /** Tem metas corporativas: os blocos devem somar 50 e 50; senão, Departamental soma 100. */
  comCorporativas: z.boolean(),
  ok: z.boolean(),
});
export type PesosGestor = z.infer<typeof PesosGestorSchema>;

export const EncerramentoCicloSchema = z.object({
  /** Já pode encerrar agora (ciclo ativo, dezembro fechado, sem reabertura em vigor). */
  permitido: z.boolean(),
  /** Por que ainda não pode, em português; `null` quando pode. */
  motivo: z.string().nullable(),
  /** Fim do prazo de lançamento de dezembro (15º dia útil de janeiro), ISO 8601. */
  dezembroFechaEm: z.string(),
});
export type EncerramentoCiclo = z.infer<typeof EncerramentoCicloSchema>;

export const ConsistenciaCicloSchema = z.object({
  ciclo: CicloSchema,
  /** Ciclo em Rascunho, sem outro ativo e sem problema que bloqueia. */
  podeAtivar: z.boolean(),
  /** Por que não pode ativar além dos problemas (status, outro ciclo ativo); `null` quando pode. */
  motivoNaoAtivar: z.string().nullable(),
  gestores: z.array(PesosGestorSchema),
  problemas: z.array(ProblemaConsistenciaSchema),
  encerramento: EncerramentoCicloSchema,
});
export type ConsistenciaCiclo = z.infer<typeof ConsistenciaCicloSchema>;
