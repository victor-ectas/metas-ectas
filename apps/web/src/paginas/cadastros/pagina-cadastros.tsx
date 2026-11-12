import { Alert, Box, Tab, Tabs } from '@mui/material';
import { Perfil } from '@metas/tipos';
import { useSearchParams } from 'react-router';

import { useSessao } from '../../api/sessao';
import { CORES } from '../../app/tema';
import { CabecalhoPagina } from '../../componentes/cabecalho-pagina';
import { Pagina } from '../../componentes/pagina';
import { AbaCiclos } from './aba-ciclos';
import { AbaFeriados } from './aba-feriados';
import { AbaSetores } from './aba-setores';
import { AbaUsuarios } from './aba-usuarios';

const ABAS = [
  { id: 'usuarios', rotulo: 'Usuários', conteudo: <AbaUsuarios /> },
  { id: 'setores', rotulo: 'Setores', conteudo: <AbaSetores /> },
  { id: 'ciclos', rotulo: 'Ciclos e responsáveis', conteudo: <AbaCiclos /> },
  { id: 'feriados', rotulo: 'Feriados', conteudo: <AbaFeriados /> },
] as const;

type IdAba = (typeof ABAS)[number]['id'];

/**
 * Cadastros básicos (P11, especificação 10.2): usuários, setores, ciclos com responsáveis e
 * feriados. A aba fica na URL (`?aba=setores`), para voltar e compartilhar o link certo.
 */
export function PaginaCadastros() {
  const [parametros, setParametros] = useSearchParams();
  const sessao = useSessao();
  const pedida = parametros.get('aba');
  const aba: IdAba = ABAS.some((a) => a.id === pedida) ? (pedida as IdAba) : 'usuarios';
  const atual = ABAS.find((a) => a.id === aba) ?? ABAS[0];

  // A interface só esconde: quem decide é a API (403). Isto evita uma tela cheia de erros.
  if (sessao.data?.usuario.perfil !== Perfil.ADMIN) {
    return (
      <Pagina>
        <CabecalhoPagina titulo="Cadastros" />
        <Alert severity="info">Os cadastros são mantidos pelo Administrador do sistema.</Alert>
      </Pagina>
    );
  }

  return (
    <Pagina>
      <CabecalhoPagina
        titulo="Cadastros"
        descricao="Quem usa o sistema, os setores, os ciclos de cada ano e o calendário de feriados."
      />
      <Box sx={{ borderBottom: `1px solid ${CORES.borda}`, mb: 3 }}>
        <Tabs
          value={aba}
          onChange={(_evento, valor: IdAba) => {
            setParametros({ aba: valor }, { replace: true });
          }}
          variant="scrollable"
          allowScrollButtonsMobile
          aria-label="Cadastros"
          sx={{
            minHeight: 48,
            '& .MuiTab-root': { minHeight: 48, fontWeight: 600 },
            '& .MuiTabs-indicator': { height: 3, borderRadius: 2, bgcolor: CORES.turquesa },
          }}
        >
          {ABAS.map((a) => (
            <Tab
              key={a.id}
              value={a.id}
              label={a.rotulo}
              id={`aba-${a.id}`}
              aria-controls={`painel-${a.id}`}
            />
          ))}
        </Tabs>
      </Box>
      <div role="tabpanel" id={`painel-${aba}`} aria-labelledby={`aba-${aba}`}>
        {atual.conteudo}
      </div>
    </Pagina>
  );
}
