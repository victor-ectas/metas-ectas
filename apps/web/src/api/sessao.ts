import { type Sessao, SessaoSchema } from '@metas/tipos';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useClienteApi } from './contexto';
import type { ErroApi } from './erro-api';

export const CHAVE_SESSAO = ['sessao'] as const;

/** Usuário logado, perfil e setores (`GET /me`). */
export function useSessao(): UseQueryResult<Sessao, ErroApi> {
  const cliente = useClienteApi();
  return useQuery({
    queryKey: CHAVE_SESSAO,
    queryFn: () => cliente.get('/me', SessaoSchema),
    staleTime: 5 * 60 * 1000,
  });
}
