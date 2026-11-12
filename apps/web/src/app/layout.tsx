import AccountTreeIcon from '@mui/icons-material/AccountTree';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CategoryIcon from '@mui/icons-material/Category';
import DashboardIcon from '@mui/icons-material/Dashboard';
import EditCalendarIcon from '@mui/icons-material/EditCalendar';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import FlagIcon from '@mui/icons-material/Flag';
import FunctionsIcon from '@mui/icons-material/Functions';
import HomeIcon from '@mui/icons-material/Home';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import PeopleIcon from '@mui/icons-material/People';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  Link,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { UsuarioSessao } from '@metas/tipos';
import { lazy, type ReactElement, Suspense, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';

import { mensagemDeErro } from '../api/erro-api';
import { useSessao } from '../api/sessao';
import { useAutenticacao } from '../auth/autenticacao';
import { TelaCarregando, TelaErro } from '../componentes/telas-estado';
import { type ItemMenu, itensDoUsuario, ROTULO_SECAO, type Secao } from './menu';
import { LARGURA_MENU } from './tema';

/**
 * Seletor do usuário simulado: só existe no servidor de desenvolvimento. No build de produção
 * `import.meta.env.DEV` é `false` e o Vite deixa o componente fora do pacote.
 */
const SeletorUsuarioDev = import.meta.env.DEV
  ? lazy(() =>
      import('../auth/seletor-usuario-dev').then((modulo) => ({
        default: modulo.SeletorUsuarioDev,
      })),
    )
  : null;

const ICONES: Readonly<Record<string, ReactElement>> = {
  '/': <HomeIcon />,
  '/minhas-metas': <FlagIcon />,
  '/lancamentos': <EditCalendarIcon />,
  '/importacao': <UploadFileIcon />,
  '/visao-geral': <DashboardIcon />,
  '/metas': <TrackChangesIcon />,
  '/variaveis': <FunctionsIcon />,
  '/modelos': <CategoryIcon />,
  '/ciclos': <AccountTreeIcon />,
  '/fechamento': <EventAvailableIcon />,
  '/cadastros': <PeopleIcon />,
};

const SECOES: readonly Secao[] = ['GERAL', 'ADMINISTRACAO'];

function ativo(item: ItemMenu, caminhoAtual: string): boolean {
  if (item.caminho === '/') return caminhoAtual === '/';
  return caminhoAtual === item.caminho || caminhoAtual.startsWith(`${item.caminho}/`);
}

function Menu(props: { readonly usuario: UsuarioSessao; readonly aoNavegar: () => void }) {
  const { pathname } = useLocation();
  const itens = itensDoUsuario(props.usuario);
  return (
    <Box component="nav" aria-label="Menu principal">
      {SECOES.map((secao) => {
        const daSecao = itens.filter((item) => item.secao === secao);
        if (daSecao.length === 0) return null;
        return (
          <List
            key={secao}
            subheader={<ListSubheader component="div">{ROTULO_SECAO[secao]}</ListSubheader>}
          >
            {daSecao.map((item) => {
              const selecionado = ativo(item, pathname);
              return (
                <ListItemButton
                  key={item.caminho}
                  component={NavLink}
                  to={item.caminho}
                  end={item.caminho === '/'}
                  selected={selecionado}
                  aria-current={selecionado ? 'page' : undefined}
                  onClick={props.aoNavegar}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>{ICONES[item.caminho]}</ListItemIcon>
                  <ListItemText primary={item.rotulo} />
                </ListItemButton>
              );
            })}
          </List>
        );
      })}
    </Box>
  );
}

/**
 * Estrutura de todas as páginas: barra superior, menu lateral fixo no desktop e gaveta no
 * celular e no tablet (CLAUDE.md P10, RNF-01).
 */
export function Layout() {
  const tema = useTheme();
  const desktop = useMediaQuery(tema.breakpoints.up('md'), { noSsr: true });
  const [gavetaAberta, setGavetaAberta] = useState(false);
  const sessao = useSessao();
  const autenticacao = useAutenticacao();
  const usuario = sessao.data?.usuario;

  const menu =
    usuario === undefined ? null : (
      <Menu
        usuario={usuario}
        aoNavegar={() => {
          setGavetaAberta(false);
        }}
      />
    );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Link
        href="#conteudo"
        sx={{
          position: 'absolute',
          left: -9999,
          zIndex: (t) => t.zIndex.tooltip,
          '&:focus': { left: 8, top: 8, p: 1, bgcolor: 'background.paper' },
        }}
      >
        Pular para o conteúdo
      </Link>

      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar sx={{ gap: 1 }}>
          {!desktop && menu !== null && (
            <IconButton
              color="inherit"
              edge="start"
              aria-label="Abrir menu"
              aria-expanded={gavetaAberta}
              onClick={() => {
                setGavetaAberta(true);
              }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <AssignmentIcon aria-hidden sx={{ display: { xs: 'none', sm: 'block' } }} />
          <Typography component="span" variant="h6" sx={{ fontWeight: 700, flexGrow: 1 }}>
            Metas
          </Typography>
          {SeletorUsuarioDev !== null && autenticacao.modo === 'DEV' && (
            <Suspense fallback={null}>
              <SeletorUsuarioDev />
            </Suspense>
          )}
          {usuario !== undefined && (
            <Typography
              component="span"
              variant="body2"
              sx={{ display: { xs: 'none', md: 'block' } }}
            >
              {usuario.nome}
            </Typography>
          )}
          {autenticacao.modo === 'ENTRA' && (
            <Tooltip title="Sair">
              <IconButton
                color="inherit"
                aria-label="Sair"
                onClick={() => void autenticacao.sair()}
              >
                <LogoutIcon />
              </IconButton>
            </Tooltip>
          )}
        </Toolbar>
      </AppBar>

      {menu !== null &&
        (desktop ? (
          <Drawer
            variant="permanent"
            sx={{
              width: LARGURA_MENU,
              flexShrink: 0,
              '& .MuiDrawer-paper': { width: LARGURA_MENU, boxSizing: 'border-box' },
            }}
          >
            <Toolbar />
            {menu}
          </Drawer>
        ) : (
          <Drawer
            variant="temporary"
            open={gavetaAberta}
            onClose={() => {
              setGavetaAberta(false);
            }}
            ModalProps={{ keepMounted: true }}
            sx={{ '& .MuiDrawer-paper': { width: LARGURA_MENU, maxWidth: '85vw' } }}
          >
            <Toolbar />
            {menu}
          </Drawer>
        ))}

      <Box
        component="main"
        id="conteudo"
        tabIndex={-1}
        sx={{ flexGrow: 1, minWidth: 0, px: { xs: 2, sm: 3 }, pb: 4, outline: 'none' }}
      >
        <Toolbar />
        {sessao.isPending ? (
          <TelaCarregando />
        ) : sessao.isError ? (
          <TelaErro
            titulo="Não foi possível carregar seus dados"
            mensagem={mensagemDeErro(sessao.error)}
            acao={{ rotulo: 'Tentar de novo', aoClicar: () => void sessao.refetch() }}
          />
        ) : (
          <Outlet />
        )}
      </Box>
    </Box>
  );
}
