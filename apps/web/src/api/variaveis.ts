import {
  ListaVariaveisSchema,
  type Variavel,
  type VariavelEntrada,
  VariavelSchema,
} from '@metas/tipos';
import {
  useMutation,
  type UseMutationResult,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { z } from 'zod';

import { useClienteApi } from './contexto';
import type { ErroApi } from './erro-api';

/** Tudo de variáveis começa com `variaveis`, para invalidar junto (inclusive o "usada por"). */
export const CHAVES_VARIAVEIS = {
  lista: (cicloId: string) => ['variaveis', cicloId] as const,
};

const rota = (cicloId: string) => `/ciclos/${cicloId}/variaveis`;

/** Variáveis do ciclo inteiro; o filtro por setor e a busca são feitos na tela. */
export function useVariaveis(cicloId: string | undefined): UseQueryResult<Variavel[], ErroApi> {
  const cliente = useClienteApi();
  return useQuery({
    queryKey: CHAVES_VARIAVEIS.lista(cicloId ?? ''),
    queryFn: () => cliente.get(rota(cicloId ?? ''), ListaVariaveisSchema),
    enabled: cicloId !== undefined,
  });
}

function useAoAlterar() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['variaveis'] });
}

export function useSalvarVariavel(
  cicloId: string,
): UseMutationResult<Variavel, ErroApi, { id: string | null; dados: VariavelEntrada }> {
  const cliente = useClienteApi();
  const aoAlterar = useAoAlterar();
  return useMutation({
    mutationFn: ({ id, dados }) =>
      id === null
        ? cliente.enviar('POST', rota(cicloId), dados, VariavelSchema)
        : cliente.enviar('PUT', `${rota(cicloId)}/${id}`, dados, VariavelSchema),
    onSuccess: aoAlterar,
  });
}

export function useExcluirVariavel(cicloId: string): UseMutationResult<undefined, ErroApi, string> {
  const cliente = useClienteApi();
  const aoAlterar = useAoAlterar();
  return useMutation({
    mutationFn: (id) =>
      cliente.enviar('DELETE', `${rota(cicloId)}/${id}`, undefined, z.undefined()),
    onSuccess: aoAlterar,
  });
}
