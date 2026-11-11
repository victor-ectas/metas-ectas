import { Acumulacao, ModoApuracao } from '@metas/tipos';

import { Decimal } from '../formula/decimal.js';

/**
 * Acumula valores mensais, já na ordem dos meses, ignorando vazios (RN-08, RN-09):
 * soma, média dos meses com valor, último mês com valor ou máximo. Sem nenhum valor → `null`.
 */
export function acumular(valores: readonly (Decimal | null)[], regra: Acumulacao): Decimal | null {
  const preenchidos = valores.filter((v): v is Decimal => v !== null);
  const ultimo = preenchidos.at(-1);
  if (ultimo === undefined) return null;
  switch (regra) {
    case Acumulacao.SOMA:
      return Decimal.sum(...preenchidos);
    case Acumulacao.MEDIA:
      return Decimal.sum(...preenchidos).div(preenchidos.length);
    case Acumulacao.ULTIMO:
      return ultimo;
    case Acumulacao.MAXIMO:
      return Decimal.max(...preenchidos);
  }
}

/** Regra de agregação dos resultados mensais em cada modo de apuração que agrega resultados. */
export const AGREGACAO_DO_MODO = {
  [ModoApuracao.SOMA_RESULTADOS]: Acumulacao.SOMA,
  [ModoApuracao.MEDIA_RESULTADOS]: Acumulacao.MEDIA,
  [ModoApuracao.MAXIMO_RESULTADOS]: Acumulacao.MAXIMO,
  [ModoApuracao.ULTIMO_RESULTADO]: Acumulacao.ULTIMO,
} as const;
