import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import {
  AppBar,
  Avatar,
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
import { alpha, useTheme } from '@mui/material/styles';
import type { UsuarioSessao } from '@metas/tipos';
import { lazy, Suspense, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';

import { mensagemDeErro } from '../api/erro-api';
import { useSessao } from '../api/sessao';
import { useAutenticacao } from '../auth/autenticacao';
import { MarcaEctas } from '../componentes/marca';
import { OndasMenu } from '../componentes/ondas';
import { TelaCarregando, TelaErro } from '../componentes/telas-estado';
import { type ItemMenu, itensDoUsuario, ROTULO_PERFIL, ROTULO_SECAO, type Secao } from './menu';
import { ICONES } from './icones';
import { CORES, LARGURA_MENU } from './tema';

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

const SECOES: readonly Secao[] = ['GERAL', 'ADMINISTRACAO'];

/** Altura da barra superior (padrão do MUI no desktop). */
const ALTURA_BARRA = 64;

function ativo(item: ItemMenu, caminhoAtual: string): boolean {
  if (item.caminho === '/') return caminhoAtual === '/';
  return caminhoAtual === item.caminho || caminhoAtual.startsWith(`${item.caminho}/`);
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  const primeira = partes[0]?.[0] ?? '';
  const ultima = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? '') : '';
  return `${primeira}${ultima}`.toUpperCase();
}

const estiloItem = {
  mx: 1.5,
  my: 0.25,
  px: 1.5,
  borderRadius: 2,
  position: 'relative',
  color: alpha(CORES.branco, 0.86),
  transitionProperty: 'background-color, color',
  '& .MuiListItemIcon-root': { minWidth: 38, color: alpha(CORES.turquesa, 0.9) },
  '&:hover': { bgcolor: alpha(CORES.branco, 0.07), color: CORES.branco },
  // Item da página atual: "nível de água" turquesa à esquerda e fundo levemente aceso.
  '&.Mui-selected': {
    bgcolor: alpha(CORES.turquesa, 0.16),
    color: CORES.branco,
    '& .MuiListItemText-primary': { fontWeight: 600 },
    '& .MuiListItemIcon-root': { color: CORES.turquesa },
    '&::before': {
      content: '""',
      position: 'absolute',
      left: -12,
      top: 10,
      bottom: 10,
      width: 4,
      borderRadius: 2,
      bgcolor: CORES.turquesa,
    },
  },
  '&.Mui-selected:hover': { bgcolor: alpha(CORES.turquesa, 0.24) },
} as const;

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
            dense={false}
            subheader={
              <ListSubheader
                component="div"
                disableSticky
                sx={{
                  bgcolor: 'transparent',
                  color: CORES.turquesa,
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  lineHeight: '32px',
                  px: 3,
                }}
              >
                {ROTULO_SECAO[secao]}
              </ListSubheader>
            }
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
                  sx={estiloItem}
                >
                  <ListItemIcon>{ICONES[item.caminho]}</ListItemIcon>
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

/** Painel marinho do menu: logotipo, itens e as ondas do logotipo no pé. */
function PainelMenu(props: { readonly usuario: UsuarioSessao; readonly aoNavegar: () => void }) {
  return (
    <Box
      className="fundo-escuro"
      sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: CORES.marinho }}
    >
      <Box
        sx={{ px: 3, height: ALTURA_BARRA, display: 'flex', alignItems: 'center', flexShrink: 0 }}
      >
        <MarcaEctas />
      </Box>
      <Box sx={{ flexGrow: 1, overflowY: 'auto', pb: 2 }}>
        <Menu usuario={props.usuario} aoNavegar={props.aoNavegar} />
      </Box>
      <Box
        sx={{
          position: 'relative',
          flexShrink: 0,
          // Em telas baixas as ondas dariam lugar ao menu.
          '@media (max-height: 640px)': { display: 'none' },
        }}
      >
        <OndasMenu />
        <Typography
          sx={{
            position: 'absolute',
            left: 24,
            right: 16,
            bottom: 10,
            color: alpha(CORES.branco, 0.78),
            fontSize: 11,
            fontWeight: 500,
          }}
        >
          Ninguém cuida da ÁGUA como nós.
        </Typography>
      </Box>
    </Box>
  );
}

/**
 * Estrutura de todas as páginas: menu lateral marinho fixo no desktop e em gaveta no celular e
 * no tablet, com a barra superior (CLAUDE.md P10, RNF-01, ADR-015).
 */
export function Layout() {
  const tema = useTheme();
  const desktop = useMediaQuery(tema.breakpoints.up('md'), { noSsr: true });
  const [gavetaAberta, setGavetaAberta] = useState(false);
  const sessao = useSessao();
  const autenticacao = useAutenticacao();
  const usuario = sessao.data?.usuario;

  const fecharGaveta = (): void => {
    setGavetaAberta(false);
  };
  const painel =
    usuario === undefined ? null : <PainelMenu usuario={usuario} aoNavegar={fecharGaveta} />;
  const comMenuFixo = desktop && painel !== null;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Link
        href="#conteudo"
        sx={{
          position: 'absolute',
          left: -9999,
          zIndex: (t) => t.zIndex.tooltip,
          '&:focus-visible': { left: 8, top: 8, p: 1.5, bgcolor: 'background.paper' },
        }}
      >
        Pular para o conteúdo
      </Link>

      <AppBar
        position="fixed"
        className={desktop ? undefined : 'fundo-escuro'}
        sx={{
          width: comMenuFixo ? `calc(100% - ${String(LARGURA_MENU)}px)` : '100%',
          ml: comMenuFixo ? `${String(LARGURA_MENU)}px` : 0,
          bgcolor: desktop ? alpha(CORES.branco, 0.92) : CORES.marinho,
          color: desktop ? CORES.marinho : CORES.branco,
          backdropFilter: desktop ? 'blur(8px)' : undefined,
          borderBottom: desktop ? `1px solid ${CORES.borda}` : 'none',
          pt: 'env(safe-area-inset-top)',
        }}
      >
        <Toolbar sx={{ gap: 1.5, minHeight: { md: ALTURA_BARRA } }}>
          {!desktop && painel !== null && (
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
          {!desktop && <MarcaEctas compacta />}
          <Box sx={{ flexGrow: 1 }} />
          {SeletorUsuarioDev !== null && autenticacao.modo === 'DEV' && (
            <Suspense fallback={null}>
              <SeletorUsuarioDev />
            </Suspense>
          )}
          {usuario !== undefined && (
            <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1.25 }}>
              <Avatar
                aria-hidden
                sx={{
                  width: 36,
                  height: 36,
                  fontSize: 14,
                  fontWeight: 700,
                  bgcolor: CORES.turquesaClaro,
                  color: CORES.marinho,
                }}
              >
                {iniciais(usuario.nome)}
              </Avatar>
              <Box sx={{ display: 'grid', lineHeight: 1.2, minWidth: 0 }}>
                <Typography component="span" variant="body2" sx={{ fontWeight: 600 }} noWrap>
                  {usuario.nome}
                </Typography>
                <Typography component="span" variant="caption" color="text.secondary" noWrap>
                  {ROTULO_PERFIL[usuario.perfil]}
                </Typography>
              </Box>
            </Box>
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

      {painel !== null &&
        (desktop ? (
          <Drawer
            variant="permanent"
            sx={{
              width: LARGURA_MENU,
              flexShrink: 0,
              '& .MuiDrawer-paper': {
                width: LARGURA_MENU,
                boxSizing: 'border-box',
                border: 'none',
                bgcolor: CORES.marinho,
              },
            }}
          >
            {painel}
          </Drawer>
        ) : (
          <Drawer
            variant="temporary"
            open={gavetaAberta}
            onClose={fecharGaveta}
            ModalProps={{ keepMounted: true }}
            sx={{
              '& .MuiDrawer-paper': {
                width: LARGURA_MENU,
                maxWidth: '85vw',
                bgcolor: CORES.marinho,
                pt: 'env(safe-area-inset-top)',
              },
            }}
          >
            {painel}
          </Drawer>
        ))}

      <Box
        component="main"
        id="conteudo"
        tabIndex={-1}
        sx={{
          flexGrow: 1,
          minWidth: 0,
          pb: 'calc(32px + env(safe-area-inset-bottom))',
          outline: 'none',
        }}
      >
        <Toolbar sx={{ minHeight: { md: ALTURA_BARRA } }} />
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
