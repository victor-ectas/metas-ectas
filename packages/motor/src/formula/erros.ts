import { CodigoErro } from '@metas/tipos';

/**
 * Erro de fórmula com mensagem em português para o Administrador.
 * `posicao` é a coluna (a partir de 1) onde o problema foi encontrado, ou `null` quando não se
 * aplica a um ponto específico do texto.
 */
export class FormulaErro extends Error {
  readonly codigo = CodigoErro.FORMULA_INVALIDA;

  constructor(
    mensagem: string,
    readonly posicao: number | null,
  ) {
    super(mensagem);
    this.name = 'FormulaErro';
  }
}
