import {
  type Ciclo,
  type CicloEntrada,
  CicloSchema,
  type Feriado,
  type FeriadoEntrada,
  FeriadoSchema,
  type FiltroUsuarios,
  ListaCiclosSchema,
  ListaFeriadosSchema,
  ListaResponsaveisSchema,
  ListaSetoresSchema,
  type ListaUsuarios,
  ListaUsuariosSchema,
  type ResponsaveisEntrada,
  type ResponsavelSetor,
  type Setor,
  type SetorEntrada,
  SetorSchema,
  type Usuario,
  type UsuarioEntrada,
  UsuarioSchema,
} from '@metas/tipos';
import {
  keepPreviousData,
  useMutation,
  type UseMutationResult,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { z } from 'zod';

import { useClienteApi } from './contexto';
import type { ErroApi } from './erro-api';

/** Chaves do cache: tudo de cadastros começa com `cadastros`, para invalidar junto. */
export const CHAVES = {
  usuarios: (filtro: Partial<FiltroUsuarios>) => ['cadastros', 'usuarios', filtro] as const,
  setores: ['cadastros', 'setores'] as const,
  ciclos: ['cadastros', 'ciclos'] as const,
  responsaveis: (cicloId: string) => ['cadastros', 'responsaveis', cicloId] as const,
  feriados: (ano: number) => ['cadastros', 'feriados', ano] as const,
};

const SemCorpo = z.undefined();

function query(params: Record<string, string | number | boolean | undefined>): string {
  const busca = new URLSearchParams();
  for (const [chave, valor] of Object.entries(params)) {
    if (valor !== undefined && valor !== '') busca.set(chave, String(valor));
  }
  const texto = busca.toString();
  return texto === '' ? '' : `?${texto}`;
}

/** Depois de uma alteração, recarrega tudo de cadastros (as listas se cruzam: nomes, setores). */
function useAoAlterar() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['cadastros'] });
}

// --- Usuários --------------------------------------------------------------------------------

export function useUsuarios(
  filtro: Partial<FiltroUsuarios>,
): UseQueryResult<ListaUsuarios, ErroApi> {
  const cliente = useClienteApi();
  return useQuery({
    queryKey: CHAVES.usuarios(filtro),
    queryFn: () => cliente.get(`/usuarios${query(filtro)}`, ListaUsuariosSchema),
    placeholderData: keepPreviousData,
  });
}

export function useSalvarUsuario(): UseMutationResult<
  Usuario,
  ErroApi,
  { id: string | null; dados: UsuarioEntrada }
> {
  const cliente = useClienteApi();
  const aoAlterar = useAoAlterar();
  return useMutation({
    mutationFn: ({ id, dados }) =>
      id === null
        ? cliente.enviar('POST', '/usuarios', dados, UsuarioSchema)
        : cliente.enviar('PUT', `/usuarios/${id}`, dados, UsuarioSchema),
    onSuccess: aoAlterar,
  });
}

export function useExcluirUsuario(): UseMutationResult<undefined, ErroApi, string> {
  const cliente = useClienteApi();
  const aoAlterar = useAoAlterar();
  return useMutation({
    mutationFn: (id) => cliente.enviar('DELETE', `/usuarios/${id}`, undefined, SemCorpo),
    onSuccess: aoAlterar,
  });
}

export function useDefinirSetoresLeitor(): UseMutationResult<
  Usuario,
  ErroApi,
  { id: string; setorIds: string[] }
> {
  const cliente = useClienteApi();
  const aoAlterar = useAoAlterar();
  return useMutation({
    mutationFn: ({ id, setorIds }) =>
      cliente.enviar('PUT', `/usuarios/${id}/setores-leitor`, { setorIds }, UsuarioSchema),
    onSuccess: aoAlterar,
  });
}

// --- Setores ---------------------------------------------------------------------------------

export function useSetores(): UseQueryResult<Setor[], ErroApi> {
  const cliente = useClienteApi();
  return useQuery({
    queryKey: CHAVES.setores,
    queryFn: () => cliente.get('/setores', ListaSetoresSchema),
  });
}

export function useSalvarSetor(): UseMutationResult<
  Setor,
  ErroApi,
  { id: string | null; dados: SetorEntrada }
> {
  const cliente = useClienteApi();
  const aoAlterar = useAoAlterar();
  return useMutation({
    mutationFn: ({ id, dados }) =>
      id === null
        ? cliente.enviar('POST', '/setores', dados, SetorSchema)
        : cliente.enviar('PUT', `/setores/${id}`, dados, SetorSchema),
    onSuccess: aoAlterar,
  });
}

export function useExcluirSetor(): UseMutationResult<undefined, ErroApi, string> {
  const cliente = useClienteApi();
  const aoAlterar = useAoAlterar();
  return useMutation({
    mutationFn: (id) => cliente.enviar('DELETE', `/setores/${id}`, undefined, SemCorpo),
    onSuccess: aoAlterar,
  });
}

// --- Ciclos e responsáveis -------------------------------------------------------------------

export function useCiclos(): UseQueryResult<Ciclo[], ErroApi> {
  const cliente = useClienteApi();
  return useQuery({
    queryKey: CHAVES.ciclos,
    queryFn: () => cliente.get('/ciclos', ListaCiclosSchema),
  });
}

export function useCriarCiclo(): UseMutationResult<Ciclo, ErroApi, CicloEntrada> {
  const cliente = useClienteApi();
  const aoAlterar = useAoAlterar();
  return useMutation({
    mutationFn: (dados) => cliente.enviar('POST', '/ciclos', dados, CicloSchema),
    onSuccess: aoAlterar,
  });
}

export function useResponsaveis(
  cicloId: string | null,
): UseQueryResult<ResponsavelSetor[], ErroApi> {
  const cliente = useClienteApi();
  return useQuery({
    queryKey: CHAVES.responsaveis(cicloId ?? ''),
    queryFn: () => cliente.get(`/ciclos/${cicloId ?? ''}/responsaveis`, ListaResponsaveisSchema),
    enabled: cicloId !== null,
  });
}

export function useDefinirResponsaveis(
  cicloId: string,
): UseMutationResult<ResponsavelSetor[], ErroApi, ResponsaveisEntrada> {
  const cliente = useClienteApi();
  const aoAlterar = useAoAlterar();
  return useMutation({
    mutationFn: (dados) =>
      cliente.enviar('PUT', `/ciclos/${cicloId}/responsaveis`, dados, ListaResponsaveisSchema),
    onSuccess: aoAlterar,
  });
}

// --- Feriados --------------------------------------------------------------------------------

export function useFeriados(ano: number): UseQueryResult<Feriado[], ErroApi> {
  const cliente = useClienteApi();
  return useQuery({
    queryKey: CHAVES.feriados(ano),
    queryFn: () => cliente.get(`/feriados?ano=${String(ano)}`, ListaFeriadosSchema),
    placeholderData: keepPreviousData,
  });
}

export function useSalvarFeriado(): UseMutationResult<
  Feriado,
  ErroApi,
  { id: string | null; dados: FeriadoEntrada }
> {
  const cliente = useClienteApi();
  const aoAlterar = useAoAlterar();
  return useMutation({
    mutationFn: ({ id, dados }) =>
      id === null
        ? cliente.enviar('POST', '/feriados', dados, FeriadoSchema)
        : cliente.enviar('PUT', `/feriados/${id}`, dados, FeriadoSchema),
    onSuccess: aoAlterar,
  });
}

export function useExcluirFeriado(): UseMutationResult<undefined, ErroApi, string> {
  const cliente = useClienteApi();
  const aoAlterar = useAoAlterar();
  return useMutation({
    mutationFn: (id) => cliente.enviar('DELETE', `/feriados/${id}`, undefined, SemCorpo),
    onSuccess: aoAlterar,
  });
}
