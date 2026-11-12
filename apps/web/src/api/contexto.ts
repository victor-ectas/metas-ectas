import { createContext, useContext } from 'react';

import type { ClienteApi } from './cliente';

export const ClienteApiContexto = createContext<ClienteApi | null>(null);

export function useClienteApi(): ClienteApi {
  const cliente = useContext(ClienteApiContexto);
  if (cliente === null) throw new Error('useClienteApi fora do ClienteApiContexto.');
  return cliente;
}
