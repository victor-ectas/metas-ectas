import { CodigoErro } from '@metas/tipos';

/**
 * Erro devolvido pela API no formato da CLAUDE.md 5.3, ou montado aqui quando a resposta não chega
 * (sem rede) ou não está no formato (ex.: página de erro do IIS). A `mensagem` sempre pode ser
 * mostrada ao usuário.
 */
export class ErroApi extends Error {
  constructor(
    readonly codigo: CodigoErro,
    readonly mensagem: string,
    readonly detalhes: Readonly<Record<string, unknown>> = {},
    /** Status HTTP; `null` quando nem houve resposta. */
    readonly status: number | null = null,
  ) {
    super(mensagem);
    this.name = 'ErroApi';
  }

  /** Motivo extra que a API põe em `detalhes.motivo` (ex.: `TOKEN_EXPIRADO`, `USUARIO_INATIVO`). */
  get motivo(): string | undefined {
    const motivo = this.detalhes.motivo;
    return typeof motivo === 'string' ? motivo : undefined;
  }

  static semConexao(): ErroApi {
    return new ErroApi(
      CodigoErro.ERRO_INTERNO,
      'Não foi possível falar com o servidor. Confira se você está na rede da empresa e tente de novo.',
      { motivo: 'SEM_CONEXAO' },
    );
  }

  static respostaInesperada(status: number): ErroApi {
    return new ErroApi(
      CodigoErro.ERRO_INTERNO,
      'O servidor respondeu de um jeito inesperado. Tente de novo em instantes.',
      { motivo: 'RESPOSTA_INESPERADA' },
      status,
    );
  }
}

/** Mensagem para mostrar ao usuário a partir de qualquer erro. */
export function mensagemDeErro(erro: unknown): string {
  if (erro instanceof ErroApi) return erro.mensagem;
  return 'Algo deu errado. Tente de novo em instantes.';
}
