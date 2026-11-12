import { ListaMetasSchema, type Meta, type MetaEntrada, MetaSchema } from '@metas/tipos';
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

/** Tudo de metas começa com `metas`; variáveis também mudam ("usada por"). */
export const CHAVES_METAS = {
  lista: (cicloId: string) => ['metas', 'ciclo', cicloId] as const,
  meta: (id: string) => ['metas', 'meta', id] as const,
};

export function useMetas(cicloId: string | undefined): UseQueryResult<Meta[], ErroApi> {
  const cliente = useClienteApi();
  return useQuery({
    queryKey: CHAVES_METAS.lista(cicloId ?? ''),
    queryFn: () => cliente.get(`/ciclos/${cicloId ?? ''}/metas`, ListaMetasSchema),
    enabled: cicloId !== undefined,
  });
}

export function useMeta(id: string | undefined): UseQueryResult<Meta, ErroApi> {
  const cliente = useClienteApi();
  return useQuery({
    queryKey: CHAVES_METAS.meta(id ?? ''),
    queryFn: () => cliente.get(`/metas/${id ?? ''}`, MetaSchema),
    enabled: id !== undefined,
    // O editor guarda a versão lida: recarregar sozinho apagaria o que está sendo digitado.
    refetchOnWindowFocus: false,
  });
}

function useAoAlterar() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['metas'] }),
      queryClient.invalidateQueries({ queryKey: ['variaveis'] }),
    ]);
}

/** Cria (sem `id`) ou altera a meta inteira (com `id` e a `versao` lida). */
export function useSalvarMeta(
  cicloId: string,
): UseMutationResult<
  Meta,
  ErroApi,
  { id: string; versao: number; meta: MetaEntrada } | { id: null; meta: MetaEntrada }
> {
  const cliente = useClienteApi();
  const aoAlterar = useAoAlterar();
  return useMutation({
    mutationFn: (dados) =>
      dados.id === null
        ? cliente.enviar('POST', `/ciclos/${cicloId}/metas`, dados.meta, MetaSchema)
        : cliente.enviar(
            'PUT',
            `/metas/${dados.id}`,
            { versao: dados.versao, meta: dados.meta },
            MetaSchema,
          ),
    onSuccess: aoAlterar,
  });
}

export function useExcluirMeta(): UseMutationResult<undefined, ErroApi, string> {
  const cliente = useClienteApi();
  const aoAlterar = useAoAlterar();
  return useMutation({
    mutationFn: (id) => cliente.enviar('DELETE', `/metas/${id}`, undefined, z.undefined()),
    onSuccess: aoAlterar,
  });
}
