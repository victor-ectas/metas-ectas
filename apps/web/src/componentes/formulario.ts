import { CodigoErro } from '@metas/tipos';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

import { ErroApi, mensagemDeErro } from '../api/erro-api';

/**
 * Leva os erros de validação da API (`detalhes.campos`, CLAUDE.md 5.3) para os campos do
 * formulário e devolve a mensagem geral para mostrar acima dos botões. Campos que o formulário
 * não tem entram na mensagem geral.
 */
export function aplicarErrosDaApi<T extends FieldValues>(
  erro: unknown,
  campos: readonly Path<T>[],
  setError: UseFormSetError<T>,
): string {
  if (!(erro instanceof ErroApi) || erro.codigo !== CodigoErro.VALIDACAO) {
    return mensagemDeErro(erro);
  }
  const lista = erro.detalhes.campos;
  if (!Array.isArray(lista)) return erro.mensagem;
  const sobras: string[] = [];
  let primeiro = true;
  for (const item of lista as { campo?: unknown; mensagem?: unknown }[]) {
    const campo = typeof item.campo === 'string' ? item.campo : '';
    const mensagem = typeof item.mensagem === 'string' ? item.mensagem : erro.mensagem;
    if ((campos as readonly string[]).includes(campo)) {
      setError(campo as Path<T>, { type: 'api', message: mensagem }, { shouldFocus: primeiro });
      primeiro = false;
    } else {
      sobras.push(mensagem);
    }
  }
  return sobras.length > 0 ? sobras.join(' ') : erro.mensagem;
}
