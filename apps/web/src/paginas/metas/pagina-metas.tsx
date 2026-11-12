import AddIcon from '@mui/icons-material/Add';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import SearchIcon from '@mui/icons-material/Search';
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  InputAdornment,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { type Ciclo, type Meta, Perfil, StatusCiclo } from '@metas/tipos';
import { useDeferredValue, useMemo, useState } from 'react';
import { Link as LinkRouter, useNavigate, useSearchParams } from 'react-router';

import { useCiclos, useSetores } from '../../api/cadastros';
import { mensagemDeErro } from '../../api/erro-api';
import { useExcluirMeta, useMetas } from '../../api/metas';
import { useSessao } from '../../api/sessao';
import { plural } from '../../app/plural';
import { CORES } from '../../app/tema';
import { useAvisar } from '../../componentes/avisos';
import { CabecalhoPagina } from '../../componentes/cabecalho-pagina';
import { DialogoConfirmacao } from '../../componentes/dialogo-confirmacao';
import { type Coluna, ListaResponsiva } from '../../componentes/lista-responsiva';
import { Pagina } from '../../componentes/pagina';
import { cicloInicial, SeletorCiclo } from '../../componentes/seletor-ciclo';
import { SeloSituacao } from '../../componentes/selo-situacao';
import { formatarNumero } from '../../formatacao';

function Pesos({ meta }: { readonly meta: Meta }) {
  if (meta.atribuicoes.length === 1) {
    return <>{formatarNumero(meta.atribuicoes[0]?.peso)} pts</>;
  }
  return (
    <>
      {meta.atribuicoes
        .map((a) => `${a.usuarioNome.split(' ')[0] ?? ''} ${formatarNumero(a.peso)}`)
        .join(', ')}
    </>
  );
}

const COLUNAS: readonly Coluna<Meta>[] = [
  {
    titulo: 'Meta',
    principal: true,
    valor: (m) => (
      <Box>
        <Box component="span" sx={{ display: 'block', fontWeight: 600 }}>
          {m.indicador}
        </Box>
        <Box
          component="span"
          translate="no"
          sx={{ display: 'block', fontSize: 13, color: CORES.azulEscuro, fontWeight: 600 }}
        >
          {m.codigo}
          {m.submetas.length > 0 && ` (${plural(m.submetas.length, 'submeta', 'submetas')})`}
        </Box>
      </Box>
    ),
  },
  {
    titulo: 'Setor',
    valor: (m) => (
      <Box>
        {m.setorNome}
        {m.bloco === 'CORPORATIVO' && (
          <Chip size="small" label="Corporativo" sx={{ ml: 1, height: 22, fontWeight: 600 }} />
        )}
      </Box>
    ),
    largura: 200,
  },
  { titulo: 'Responsável', valor: (m) => m.responsavelNome, largura: 180 },
  { titulo: 'Peso', valor: (m) => <Pesos meta={m} />, largura: 150 },
  { titulo: 'Situação', valor: (m) => <SeloSituacao ativo={m.ativo} />, largura: 110 },
];

/**
 * Metas do ciclo (P14, especificação 10.2): lista por ciclo, setor e gestor, com acesso ao
 * editor. Só o Administrador cadastra.
 */
export function PaginaMetas() {
  const sessao = useSessao();
  const ciclos = useCiclos();
  const [parametros, setParametros] = useSearchParams();
  const lista = ciclos.data ?? [];
  const ciclo = lista.find((c) => c.id === parametros.get('ciclo')) ?? cicloInicial(lista);

  if (sessao.data?.usuario.perfil !== Perfil.ADMIN) {
    return (
      <Pagina>
        <CabecalhoPagina titulo="Metas" />
        <Alert severity="info">As metas são cadastradas pelo Administrador do sistema.</Alert>
      </Pagina>
    );
  }

  return (
    <Pagina>
      <CabecalhoPagina
        titulo="Metas"
        descricao="As metas de cada gestor no ciclo: o que medem, como calculam e quanto valem."
      />
      {ciclos.isError ? (
        <Alert severity="error">{mensagemDeErro(ciclos.error)}</Alert>
      ) : ciclos.isPending ? (
        <Skeleton variant="rounded" height={44} width={240} />
      ) : ciclo === undefined ? (
        <Alert severity="info">
          Nenhum ciclo cadastrado. Crie o ciclo do ano em Cadastros → Ciclos e responsáveis.
        </Alert>
      ) : (
        <>
          <Box sx={{ mb: 3 }}>
            <SeletorCiclo
              ciclos={lista}
              selecionado={ciclo.id}
              aoEscolher={(id) => {
                setParametros({ ciclo: id }, { replace: true });
              }}
            />
          </Box>
          <MetasDoCiclo key={ciclo.id} ciclo={ciclo} />
        </>
      )}
    </Pagina>
  );
}

function MetasDoCiclo({ ciclo }: { readonly ciclo: Ciclo }) {
  const metas = useMetas(ciclo.id);
  const setores = useSetores();
  const navegar = useNavigate();
  const [setorId, setSetorId] = useState('');
  const [gestorId, setGestorId] = useState('');
  const [busca, setBusca] = useState('');
  const buscaAdiada = useDeferredValue(busca);
  const [excluindo, setExcluindo] = useState<Meta | null>(null);
  const excluir = useExcluirMeta();
  const avisar = useAvisar();
  const encerrado = ciclo.status === StatusCiclo.ENCERRADO;

  const gestores = useMemo(() => {
    const porId = new Map<string, string>();
    for (const m of metas.data ?? []) {
      porId.set(m.responsavelId, m.responsavelNome);
      for (const a of m.atribuicoes) porId.set(a.usuarioId, a.usuarioNome);
    }
    return [...porId].sort((a, b) => a[1].localeCompare(b[1]));
  }, [metas.data]);

  const filtradas = useMemo(() => {
    const termo = buscaAdiada.trim().toUpperCase();
    return metas.data?.filter(
      (m) =>
        (setorId === '' || m.setorId === setorId) &&
        (gestorId === '' ||
          m.responsavelId === gestorId ||
          m.atribuicoes.some((a) => a.usuarioId === gestorId)) &&
        (termo === '' ||
          m.codigo.includes(termo) ||
          m.indicador.toUpperCase().includes(termo) ||
          m.submetas.some(
            (s) => s.codigo.includes(termo) || s.indicador.toUpperCase().includes(termo),
          )),
    );
  }, [metas.data, setorId, gestorId, buscaAdiada]);

  return (
    <section aria-label={`Metas do ciclo ${String(ciclo.ano)}`}>
      {encerrado && (
        <Alert severity="info" sx={{ mb: 2 }}>
          O ciclo {ciclo.ano} está encerrado: as metas ficam só para consulta.
        </Alert>
      )}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.5}
        sx={{ mb: 2, alignItems: { md: 'center' } }}
      >
        <TextField
          select
          label="Setor"
          value={setorId}
          onChange={(evento) => {
            setSetorId(evento.target.value);
          }}
          sx={{ minWidth: { md: 200 }, bgcolor: CORES.branco }}
          slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
        >
          <MenuItem value="">Todos os setores</MenuItem>
          {(setores.data ?? []).map((s) => (
            <MenuItem key={s.id} value={s.id}>
              {s.nome}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Gestor"
          value={gestorId}
          onChange={(evento) => {
            setGestorId(evento.target.value);
          }}
          sx={{ minWidth: { md: 200 }, bgcolor: CORES.branco }}
          slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
        >
          <MenuItem value="">Todos os gestores</MenuItem>
          {gestores.map(([id, nome]) => (
            <MenuItem key={id} value={id}>
              {nome}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Buscar"
          type="search"
          value={busca}
          onChange={(evento) => {
            setBusca(evento.target.value);
          }}
          placeholder="Código ou indicador…"
          autoComplete="off"
          spellCheck={false}
          sx={{ flexGrow: 1, bgcolor: CORES.branco }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon aria-hidden />
                </InputAdornment>
              ),
            },
          }}
        />
        {!encerrado && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              void navegar(`/metas/nova?ciclo=${ciclo.id}`);
            }}
            sx={{ flexShrink: 0, minHeight: 48 }}
          >
            Nova meta
          </Button>
        )}
      </Stack>

      {filtradas !== undefined && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }} aria-live="polite">
          {plural(filtradas.length, 'meta', 'metas')}
        </Typography>
      )}

      {metas.isError ? (
        <Alert severity="error">{mensagemDeErro(metas.error)}</Alert>
      ) : (
        <ListaResponsiva
          rotulo="Metas"
          itens={filtradas}
          colunas={COLUNAS}
          chave={(m) => m.id}
          vazio={
            metas.data?.length === 0
              ? `Nenhuma meta no ciclo ${String(ciclo.ano)} ainda. Cadastre as variáveis do setor e depois a meta.`
              : 'Nenhuma meta com esse filtro.'
          }
          acoes={(m) => (
            <>
              <Tooltip title={encerrado ? 'Ver' : 'Editar'}>
                <IconButton
                  component={LinkRouter}
                  to={`/metas/${m.id}`}
                  aria-label={`${encerrado ? 'Ver' : 'Editar'} ${m.codigo}`}
                >
                  <EditOutlinedIcon />
                </IconButton>
              </Tooltip>
              {!encerrado && !m.temLancamentos && (
                <Tooltip title="Excluir">
                  <IconButton
                    aria-label={`Excluir ${m.codigo}`}
                    onClick={() => {
                      excluir.reset();
                      setExcluindo(m);
                    }}
                  >
                    <DeleteOutlinedIcon />
                  </IconButton>
                </Tooltip>
              )}
            </>
          )}
        />
      )}

      <DialogoConfirmacao
        aberto={excluindo !== null}
        titulo="Excluir meta?"
        mensagem={`A meta ${excluindo?.codigo ?? ''}${
          excluindo !== null && excluindo.submetas.length > 0
            ? ` e ${plural(excluindo.submetas.length, 'submeta', 'submetas')}`
            : ''
        } será excluída definitivamente. Só é possível excluir uma meta sem lançamentos; nos outros casos, inative-a.`}
        rotuloConfirmar="Excluir meta"
        enviando={excluir.isPending}
        erro={excluir.isError ? mensagemDeErro(excluir.error) : null}
        aoCancelar={() => {
          setExcluindo(null);
        }}
        aoConfirmar={() => {
          if (excluindo === null) return;
          excluir.mutate(excluindo.id, {
            onSuccess: () => {
              avisar('Meta excluída.');
              setExcluindo(null);
            },
          });
        }}
      />
    </section>
  );
}
