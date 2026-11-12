import {
  type Ciclo,
  CicloSchema,
  type ConsistenciaCiclo,
  ConsistenciaCicloSchema,
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

export const CHAVE_CONSISTENCIA = (cicloId: string) => ['consistencia', cicloId] as const;

/** Painel de consistência do ciclo (P15): pesos por gestor, problemas e encerramento. */
export function useConsistencia(
  cicloId: string | undefined,
): UseQueryResult<ConsistenciaCiclo, ErroApi> {
  const cliente = useClienteApi();
  return useQuery({
    queryKey: CHAVE_CONSISTENCIA(cicloId ?? ''),
    queryFn: () => cliente.get(`/ciclos/${cicloId ?? ''}/consistencia`, ConsistenciaCicloSchema),
    enabled: cicloId !== undefined,
  });
}

/** Ativar ou encerrar muda o status do ciclo, que aparece em todas as telas por ciclo. */
function useMudarStatus(acao: 'ativar' | 'encerrar'): UseMutationResult<Ciclo, ErroApi, string> {
  const cliente = useClienteApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cicloId) =>
      cliente.enviar('POST', `/ciclos/${cicloId}/${acao}`, undefined, CicloSchema),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['cadastros'] }),
        queryClient.invalidateQueries({ queryKey: ['consistencia'] }),
        queryClient.invalidateQueries({ queryKey: ['metas'] }),
        queryClient.invalidateQueries({ queryKey: ['variaveis'] }),
      ]),
  });
}

export const useAtivarCiclo = () => useMudarStatus('ativar');
export const useEncerrarCiclo = () => useMudarStatus('encerrar');
