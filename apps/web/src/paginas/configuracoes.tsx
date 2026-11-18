import {
  Box,
  Card,
  CardContent,
  Chip,
  FormControlLabel,
  Stack,
  Switch,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { type ReactNode, useId } from 'react';

import { useSessao } from '../api/sessao';
import { ROTULO_PERFIL } from '../app/menu';
import {
  definirPreferencias,
  type EscolhaTema,
  useModoTema,
  usePreferencias,
} from '../app/preferencias';
import { CORES, MARCA, transparente } from '../app/tema';
import { useAutenticacao } from '../auth/autenticacao';
import { CabecalhoPagina } from '../componentes/cabecalho-pagina';
import { Pagina } from '../componentes/pagina';
import { formatarData } from '../formatacao';

/**
 * Configurações de quem usa o sistema (ADR-030): aparência e movimento, guardados neste aparelho;
 * a conta (só consulta: perfil e setores são do Administrador); e sobre o sistema.
 */
export function Configuracoes() {
  return (
    <Pagina>
      <CabecalhoPagina
        titulo="Configurações"
        descricao="A aparência vale para este aparelho. Os dados da conta são definidos pelo Administrador."
      />
      <Stack spacing={3}>
        <Aparencia />
        <Box
          sx={{
            display: 'grid',
            gap: 3,
            gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
            alignItems: 'start',
          }}
        >
          <MinhaConta />
          <SobreOSistema />
        </Box>
      </Stack>
    </Pagina>
  );
}

function Secao(props: { readonly titulo: string; readonly children: ReactNode }) {
  const id = useId();
  return (
    <Card component="section" aria-labelledby={id}>
      <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
        <Typography id={id} variant="h2" sx={{ mb: 2.5 }}>
          {props.titulo}
        </Typography>
        {props.children}
      </CardContent>
    </Card>
  );
}

// --- Aparência --------------------------------------------------------------------------------------

const OPCOES: readonly { valor: EscolhaTema; rotulo: string; descricao: string }[] = [
  {
    valor: 'AUTOMATICO',
    rotulo: 'Automático',
    descricao: 'Segue o modo claro ou escuro do seu celular ou computador.',
  },
  { valor: 'CLARO', rotulo: 'Claro', descricao: 'Fundo branco, como o manual da marca.' },
  { valor: 'ESCURO', rotulo: 'Escuro', descricao: 'Fundo marinho, mais confortável à noite.' },
];

function Aparencia() {
  const preferencias = usePreferencias();
  const modo = useModoTema();
  const aparelhoPedeMenosMovimento = useMediaQuery('(prefers-reduced-motion: reduce)', {
    noSsr: true,
  });
  const nomeGrupo = useId();
  return (
    <Secao titulo="Aparência">
      <Box
        role="radiogroup"
        aria-label="Tema"
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
        }}
      >
        {OPCOES.map((opcao) => (
          <OpcaoTema
            key={opcao.valor}
            nomeGrupo={nomeGrupo}
            {...opcao}
            marcada={preferencias.tema === opcao.valor}
          />
        ))}
      </Box>
      <Typography variant="body2" color="text.secondary" role="status" sx={{ mt: 1.5 }}>
        {preferencias.tema === 'AUTOMATICO'
          ? `Agora: ${modo}, como o seu aparelho.`
          : `Agora: ${modo}.`}
      </Typography>

      <Box sx={{ mt: 3, pt: 2.5, borderTop: `1px solid ${CORES.borda}` }}>
        <FormControlLabel
          control={
            <Switch
              checked={preferencias.reduzirMovimento}
              onChange={(evento) => {
                definirPreferencias({ reduzirMovimento: evento.target.checked });
              }}
            />
          }
          label="Reduzir movimento"
          sx={{ ml: 0, gap: 1, '& .MuiFormControlLabel-label': { fontWeight: 600 } }}
        />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: '62ch' }}>
          Desliga a água subindo no símbolo da nota e as outras animações.
          {aparelhoPedeMenosMovimento
            ? ' Seu aparelho já pede menos movimento, e o sistema respeita isso.'
            : ''}
        </Typography>
      </Box>
    </Secao>
  );
}

/**
 * Cartão de escolha de tema: um rádio nativo (teclado e leitor de tela), com a miniatura da tela
 * naquele tema.
 */
function OpcaoTema(props: {
  readonly nomeGrupo: string;
  readonly valor: EscolhaTema;
  readonly rotulo: string;
  readonly descricao: string;
  readonly marcada: boolean;
}) {
  const idDescricao = useId();
  return (
    <Box
      component="label"
      sx={{
        position: 'relative',
        display: 'grid',
        gap: 1.25,
        p: 1.5,
        borderRadius: 3.5,
        cursor: 'pointer',
        border: `2px solid ${props.marcada ? CORES.azul : CORES.borda}`,
        bgcolor: props.marcada ? transparente(CORES.turquesaClaro, 55) : 'transparent',
        transitionProperty: 'border-color, background-color',
        transitionDuration: '150ms',
        '&:hover': { borderColor: props.marcada ? CORES.azul : transparente(CORES.azul, 55) },
        '&:has(input:focus-visible)': { outline: `3px solid ${CORES.azul}`, outlineOffset: 2 },
      }}
    >
      <Miniatura valor={props.valor} />
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Box
          component="input"
          type="radio"
          name={props.nomeGrupo}
          value={props.valor}
          checked={props.marcada}
          aria-describedby={idDescricao}
          onChange={() => {
            definirPreferencias({ tema: props.valor });
          }}
          sx={{ m: 0, mt: '3px', accentColor: CORES.azul, width: 16, height: 16, flexShrink: 0 }}
        />
        <Box sx={{ minWidth: 0 }}>
          <Typography component="span" sx={{ display: 'block', fontWeight: 600 }}>
            {props.rotulo}
          </Typography>
          <Typography id={idDescricao} component="span" variant="body2" color="text.secondary">
            {props.descricao}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

/** Tons fixos das miniaturas: mostram cada tema, seja qual for o que está em uso. */
const MINIATURA = {
  claro: { fundo: '#F5F9FA', cartao: '#FFFFFF', borda: '#D7E3E8', texto: MARCA.marinho },
  escuro: { fundo: '#0B1620', cartao: '#11212E', borda: '#26394A', texto: '#E3EEF4' },
} as const;

function Tela(props: { readonly modo: 'claro' | 'escuro' }) {
  const t = MINIATURA[props.modo];
  return (
    <Box sx={{ display: 'flex', height: '100%', bgcolor: t.fundo }}>
      {/* Menu lateral marinho, igual nos dois temas. */}
      <Box sx={{ width: '24%', bgcolor: MARCA.marinho, p: 0.75, display: 'grid', gap: 0.5 }}>
        <Box sx={{ height: 5, width: '70%', borderRadius: 1, bgcolor: MARCA.turquesa }} />
        <Box sx={{ height: 3, width: '85%', borderRadius: 1, bgcolor: transparente('#fff', 45) }} />
        <Box sx={{ height: 3, width: '60%', borderRadius: 1, bgcolor: transparente('#fff', 45) }} />
        <Box sx={{ height: 3, width: '75%', borderRadius: 1, bgcolor: transparente('#fff', 45) }} />
      </Box>
      <Box sx={{ flex: 1, p: 1, display: 'grid', gap: 0.75, alignContent: 'start' }}>
        <Box sx={{ height: 6, width: '55%', borderRadius: 1, bgcolor: t.texto }} />
        <Box sx={{ height: 1, bgcolor: MARCA.turquesa }} />
        <Box
          sx={{
            height: 26,
            borderRadius: 1.5,
            bgcolor: t.cartao,
            border: `1px solid ${t.borda}`,
            display: 'flex',
            alignItems: 'center',
            px: 0.75,
            gap: 0.75,
          }}
        >
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: MARCA.azul }} />
          <Box sx={{ height: 4, flex: 1, borderRadius: 1, bgcolor: t.borda }} />
        </Box>
      </Box>
    </Box>
  );
}

function Miniatura(props: { readonly valor: EscolhaTema }) {
  return (
    <Box
      aria-hidden
      sx={{
        position: 'relative',
        height: 84,
        borderRadius: 2,
        overflow: 'hidden',
        border: `1px solid ${CORES.borda}`,
      }}
    >
      {props.valor === 'ESCURO' ? (
        <Tela modo="escuro" />
      ) : props.valor === 'CLARO' ? (
        <Tela modo="claro" />
      ) : (
        <>
          <Tela modo="claro" />
          {/* Automático: metade de cada, em diagonal. */}
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              clipPath: 'polygon(62% 0, 100% 0, 100% 100%, 38% 100%)',
            }}
          >
            <Tela modo="escuro" />
          </Box>
        </>
      )}
    </Box>
  );
}

// --- Minha conta ------------------------------------------------------------------------------------

function Campo(props: { readonly rotulo: string; readonly children: ReactNode }) {
  return (
    <div>
      <Typography component="dt" variant="body2" color="text.secondary">
        {props.rotulo}
      </Typography>
      <Box component="dd" sx={{ m: 0, mt: 0.25 }}>
        {props.children}
      </Box>
    </div>
  );
}

function MinhaConta() {
  const { data: sessao } = useSessao();
  if (sessao === undefined) return null;
  const { usuario } = sessao;
  return (
    <Secao titulo="Minha conta">
      <Box component="dl" sx={{ m: 0, display: 'grid', gap: 2 }}>
        <Campo rotulo="Nome">
          <Typography sx={{ fontWeight: 600 }}>{usuario.nome}</Typography>
        </Campo>
        <Campo rotulo="Perfil">
          <Typography sx={{ fontWeight: 600 }}>
            {ROTULO_PERFIL[usuario.perfil]}
            {usuario.gerenteGeral ? ' · Gerente Geral' : ''}
            {usuario.ativo ? '' : ' (inativo)'}
          </Typography>
        </Campo>
        <Campo rotulo="E-mail">
          <Typography sx={{ overflowWrap: 'anywhere' }}>{usuario.email}</Typography>
        </Campo>
        <Campo rotulo="Setores">
          {sessao.todosOsSetores ? (
            <Typography>Todos os setores</Typography>
          ) : sessao.setores.length === 0 ? (
            <Typography color="text.secondary">Nenhum setor atribuído</Typography>
          ) : (
            <Stack direction="row" useFlexGap spacing={1} sx={{ flexWrap: 'wrap', pt: 0.5 }}>
              {sessao.setores.map((setor) => (
                <Chip
                  key={setor.id}
                  label={setor.nome}
                  sx={{ bgcolor: CORES.turquesaClaro, color: CORES.marinho }}
                />
              ))}
            </Stack>
          )}
        </Campo>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2.5 }}>
        Para mudar o perfil ou os setores, fale com o Administrador do sistema.
      </Typography>
    </Secao>
  );
}

// --- Sobre o sistema --------------------------------------------------------------------------------

function SobreOSistema() {
  const autenticacao = useAutenticacao();
  const versao = __VERSAO_WEB__;
  return (
    <Secao titulo="Sobre o sistema">
      <Box component="dl" sx={{ m: 0, display: 'grid', gap: 2 }}>
        <Campo rotulo="Sistema">
          <Typography sx={{ fontWeight: 600 }}>Gestão de Metas · ECTAS Saneamento</Typography>
        </Campo>
        <Campo rotulo="Versão">
          <Typography>
            <Box component="span" translate="no" sx={{ fontWeight: 600 }}>
              {versao.commit}
            </Box>
            , publicada em {formatarData(versao.geradoEm)}
          </Typography>
        </Campo>
        <Campo rotulo="Ambiente">
          <Typography>{import.meta.env.DEV ? 'Desenvolvimento' : 'Produção'}</Typography>
        </Campo>
        <Campo rotulo="Login">
          <Typography>
            {autenticacao.modo === 'DEV'
              ? 'Simulado (modo de desenvolvimento)'
              : 'Conta Microsoft da empresa'}
          </Typography>
        </Campo>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2.5 }}>
        Acesso, reabertura de mês ou um número que não bate: fale com o Administrador do sistema.
      </Typography>
    </Secao>
  );
}
