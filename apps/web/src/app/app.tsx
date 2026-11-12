import { useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';

import { criarQueryClient } from '../api/consultas';
import type { Autenticacao } from '../auth/autenticacao';
import { Provedores } from './provedores';
import { criarRotas } from './rotas';

export function App(props: { readonly apiUrl: string; readonly autenticacao: Autenticacao }) {
  const [queryClient] = useState(criarQueryClient);
  const [roteador] = useState(() => createBrowserRouter(criarRotas()));
  return (
    <Provedores apiUrl={props.apiUrl} autenticacao={props.autenticacao} queryClient={queryClient}>
      <RouterProvider router={roteador} />
    </Provedores>
  );
}
