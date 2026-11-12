/**
 * Formato único de erro da API (CLAUDE.md 5.3):
 * `{ "codigo": "MES_FECHADO", "mensagem": "Outubro/2026 fechou em 24/11/2026.", "detalhes": {} }`
 */
import { z } from 'zod';

export const CodigoErro = {
  NAO_AUTENTICADO: 'NAO_AUTENTICADO',
  SEM_PERMISSAO: 'SEM_PERMISSAO',
  SEM_PERMISSAO_VARIAVEL: 'SEM_PERMISSAO_VARIAVEL',
  NAO_ENCONTRADO: 'NAO_ENCONTRADO',
  VALIDACAO: 'VALIDACAO',
  MES_FECHADO: 'MES_FECHADO',
  MES_FUTURO: 'MES_FUTURO',
  CONFLITO_VERSAO: 'CONFLITO_VERSAO',
  FORMULA_INVALIDA: 'FORMULA_INVALIDA',
  PESOS_INCONSISTENTES: 'PESOS_INCONSISTENTES',
  CICLO_ENCERRADO: 'CICLO_ENCERRADO',
  IMPORTACAO_INVALIDA: 'IMPORTACAO_INVALIDA',
  /** Limite de taxa nas rotas de escrita (CLAUDE.md 6). Não está entre os códigos iniciais da 5.3. */
  MUITAS_REQUISICOES: 'MUITAS_REQUISICOES',
  /** Código, e-mail, ano ou data que já existe (cadastros, P11). */
  JA_EXISTE: 'JA_EXISTE',
  /** Exclusão de algo que tem registros associados: só pode ser inativado (P11). */
  EM_USO: 'EM_USO',
  /** Ativar ciclo com problema que bloqueia no painel de consistência (P15). */
  CICLO_INCONSISTENTE: 'CICLO_INCONSISTENTE',
  /** Mudança de status do ciclo fora de ordem: já ativo, outro ativo, dezembro aberto (P15). */
  STATUS_CICLO_INVALIDO: 'STATUS_CICLO_INVALIDO',
  ERRO_INTERNO: 'ERRO_INTERNO',
} as const;
export type CodigoErro = (typeof CodigoErro)[keyof typeof CodigoErro];
export const CodigoErroSchema = z.enum(CodigoErro);

export const ErroApiSchema = z.object({
  codigo: CodigoErroSchema,
  /** Mensagem em português para o usuário, sem detalhes internos (stack, SQL). */
  mensagem: z.string().min(1),
  detalhes: z.record(z.string(), z.unknown()),
});
export type ErroApi = z.infer<typeof ErroApiSchema>;
