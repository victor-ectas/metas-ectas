import { CodigoErro } from '@metas/tipos';

/** Status HTTP de cada código de erro (CLAUDE.md 5.3). */
export const STATUS_DO_CODIGO: Readonly<Record<CodigoErro, number>> = {
  [CodigoErro.NAO_AUTENTICADO]: 401,
  [CodigoErro.SEM_PERMISSAO]: 403,
  [CodigoErro.SEM_PERMISSAO_VARIAVEL]: 403,
  [CodigoErro.NAO_ENCONTRADO]: 404,
  [CodigoErro.VALIDACAO]: 400,
  [CodigoErro.CONFLITO_VERSAO]: 409,
  // Regras de negócio que impedem a operação: o pedido é válido, mas não pode ser atendido.
  [CodigoErro.MES_FECHADO]: 422,
  [CodigoErro.MES_FUTURO]: 422,
  [CodigoErro.FORMULA_INVALIDA]: 422,
  [CodigoErro.PESOS_INCONSISTENTES]: 422,
  [CodigoErro.CICLO_ENCERRADO]: 422,
  [CodigoErro.IMPORTACAO_INVALIDA]: 422,
  [CodigoErro.CICLO_INCONSISTENTE]: 422,
  [CodigoErro.STATUS_CICLO_INVALIDO]: 422,
  [CodigoErro.MUITAS_REQUISICOES]: 429,
  // Conflito com o estado atual: o registro já existe, ou está em uso e não pode ser excluído.
  [CodigoErro.JA_EXISTE]: 409,
  [CodigoErro.EM_USO]: 409,
  [CodigoErro.ERRO_INTERNO]: 500,
};

/**
 * Erro de domínio da API. O filtro global o converte em
 * `{ codigo, mensagem, detalhes }` com o status do código.
 *
 * A mensagem vai para o usuário: português, sem detalhes internos.
 */
export class ErroApi extends Error {
  readonly status: number;

  constructor(
    readonly codigo: CodigoErro,
    mensagem: string,
    readonly detalhes: Record<string, unknown> = {},
  ) {
    super(mensagem);
    this.name = 'ErroApi';
    this.status = STATUS_DO_CODIGO[codigo];
  }
}
