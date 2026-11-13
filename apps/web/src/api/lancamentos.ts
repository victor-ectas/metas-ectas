import {
  type LancamentosEntrada,
  type LancamentosMes,
  LancamentosMesSchema,
  type LancamentosSalvos,
  LancamentosSalvosSchema,
} from '@metas/tipos';
import {
  useMutation,
  type UseMutationResult,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';

import { useClienteApi } from './contexto';
import type { ErroApi } from './erro-api';

export const CHAVE_LANCAMENTOS = ['lancamentos'] as const;

/**
 * Variáveis do usuário no mês (P18). Sem ciclo nem mês, a API escolhe o ciclo ativo e o mês
 * aberto mais antigo com pendências.
 */
export function useLancamentos(
  ciclo: string | undefined,
  mes: number | undefined,
): UseQueryResult<LancamentosMes, ErroApi> {
  const cliente = useClienteApi();
  const busca = new URLSearchParams();
  if (ciclo !== undefined) busca.set('ciclo', ciclo);
  if (mes !== undefined) busca.set('mes', String(mes));
  const query = busca.toString();
  return useQuery({
    queryKey: [...CHAVE_LANCAMENTOS, ciclo ?? '', mes ?? 0],
    queryFn: () =>
      cliente.get(`/lancamentos${query === '' ? '' : `?${query}`}`, LancamentosMesSchema),
    // O gestor digita sobre a versão lida: recarregar sozinho trocaria a base por baixo dele.
    refetchOnWindowFocus: false,
  });
}

/** Grava o lote; depois, lançamentos e resultados mudam. */
export function useSalvarLancamentos(): UseMutationResult<
  LancamentosSalvos,
  ErroApi,
  LancamentosEntrada
> {
  const cliente = useClienteApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dados) => cliente.enviar('PUT', '/lancamentos', dados, LancamentosSalvosSchema),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: CHAVE_LANCAMENTOS }),
        queryClient.invalidateQueries({ queryKey: ['resultados'] }),
      ]),
  });
}
