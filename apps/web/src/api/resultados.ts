import {
  type Pendencias,
  PendenciasSchema,
  type ResultadoMeta,
  ResultadoMetaSchema,
  type ResultadosGestor,
  ResultadosGestorSchema,
} from '@metas/tipos';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useClienteApi } from './contexto';
import type { ErroApi } from './erro-api';

/** Chave dos resultados: salvar lançamentos invalida tudo debaixo dela (P19). */
export const CHAVE_RESULTADOS = ['resultados'] as const;

/**
 * Metas e notas de um gestor (P17/P20). Sem ciclo, a API escolhe o ativo (ou o encerrado mais
 * recente) e devolve os ciclos do seletor de ano.
 */
export function useResultadosGestor(
  gestorId: string | undefined,
  ciclo: string | undefined,
): UseQueryResult<ResultadosGestor, ErroApi> {
  const cliente = useClienteApi();
  return useQuery({
    queryKey: [...CHAVE_RESULTADOS, 'gestor', gestorId ?? '', ciclo ?? ''],
    queryFn: () =>
      cliente.get(
        `/resultados/gestor/${gestorId ?? ''}${ciclo === undefined ? '' : `?ciclo=${ciclo}`}`,
        ResultadosGestorSchema,
      ),
    enabled: gestorId !== undefined,
  });
}

/** Uma meta com submetas, mês a mês, pontos e memória de cálculo (RF-38). */
export function useResultadoMeta(id: string | undefined): UseQueryResult<ResultadoMeta, ErroApi> {
  const cliente = useClienteApi();
  return useQuery({
    queryKey: [...CHAVE_RESULTADOS, 'meta', id ?? ''],
    queryFn: () => cliente.get(`/resultados/meta/${id ?? ''}`, ResultadoMetaSchema),
    enabled: id !== undefined,
  });
}

/**
 * Pendências do Gestor no Início (RF-28). Fica debaixo dos lançamentos: salvar valores muda as
 * pendências.
 */
export function usePendencias(ativo: boolean): UseQueryResult<Pendencias, ErroApi> {
  const cliente = useClienteApi();
  return useQuery({
    queryKey: ['lancamentos', 'pendencias'],
    queryFn: () => cliente.get('/lancamentos/pendencias', PendenciasSchema),
    enabled: ativo,
  });
}
