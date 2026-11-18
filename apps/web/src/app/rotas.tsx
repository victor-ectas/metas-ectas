import type { RouteObject } from 'react-router';

import { PaginaCadastros } from '../paginas/cadastros/pagina-cadastros';
import { PaginaCiclos } from '../paginas/ciclos/pagina-ciclos';
import { Configuracoes } from '../paginas/configuracoes';
import { EmConstrucao } from '../paginas/em-construcao';
import { Inicio } from '../paginas/inicio';
import { PaginaLancamentos } from '../paginas/lancamentos/pagina-lancamentos';
import { EditorMeta } from '../paginas/metas/editor-meta';
import { PaginaMetas } from '../paginas/metas/pagina-metas';
import { DetalheMeta } from '../paginas/minhas-metas/detalhe-meta';
import { PaginaMinhasMetas } from '../paginas/minhas-metas/pagina-minhas-metas';
import { NaoEncontrada } from '../paginas/nao-encontrada';
import { PaginaVariaveis } from '../paginas/variaveis/pagina-variaveis';
import { Layout } from './layout';
import { ITENS_MENU } from './menu';

export function criarRotas(): RouteObject[] {
  return [
    {
      element: <Layout />,
      children: [
        { index: true, element: <Inicio /> },
        { path: 'cadastros', element: <PaginaCadastros /> },
        { path: 'variaveis', element: <PaginaVariaveis /> },
        { path: 'metas', element: <PaginaMetas /> },
        { path: 'metas/nova', element: <EditorMeta /> },
        { path: 'metas/:id', element: <EditorMeta /> },
        { path: 'ciclos', element: <PaginaCiclos /> },
        { path: 'lancamentos', element: <PaginaLancamentos /> },
        { path: 'minhas-metas', element: <PaginaMinhasMetas /> },
        { path: 'minhas-metas/:id', element: <DetalheMeta /> },
        { path: 'configuracoes', element: <Configuracoes /> },
        ...ITENS_MENU.filter((item) => item.passo !== null).map((item) => ({
          path: item.caminho.slice(1),
          element: <EmConstrucao item={item} />,
        })),
        { path: '*', element: <NaoEncontrada /> },
      ],
    },
  ];
}
