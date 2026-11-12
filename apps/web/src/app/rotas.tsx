import type { RouteObject } from 'react-router';

import { PaginaCadastros } from '../paginas/cadastros/pagina-cadastros';
import { EmConstrucao } from '../paginas/em-construcao';
import { Inicio } from '../paginas/inicio';
import { NaoEncontrada } from '../paginas/nao-encontrada';
import { Layout } from './layout';
import { ITENS_MENU } from './menu';

export function criarRotas(): RouteObject[] {
  return [
    {
      element: <Layout />,
      children: [
        { index: true, element: <Inicio /> },
        { path: 'cadastros', element: <PaginaCadastros /> },
        ...ITENS_MENU.filter((item) => item.passo !== null).map((item) => ({
          path: item.caminho.slice(1),
          element: <EmConstrucao item={item} />,
        })),
        { path: '*', element: <NaoEncontrada /> },
      ],
    },
  ];
}
