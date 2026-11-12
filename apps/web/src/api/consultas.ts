import { QueryClient } from '@tanstack/react-query';

import { ErroApi } from './erro-api';

/** Erros que não melhoram ao repetir: 4xx, inclusive permissão e validação. */
function repetir(tentativas: number, erro: unknown): boolean {
  if (erro instanceof ErroApi && erro.status !== null && erro.status < 500) return false;
  return tentativas < 2;
}

export function criarQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: repetir, staleTime: 30 * 1000, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}
