import AddIcon from '@mui/icons-material/Add';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import SearchIcon from '@mui/icons-material/Search';
import {
  Alert,
  Box,
  Button,
  IconButton,
  InputAdornment,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { type Ciclo, Perfil, StatusCiclo, type Variavel } from '@metas/tipos';
import { useDeferredValue, useMemo, useState } from 'react';

import { useCiclos, useSetores } from '../../api/cadastros';
import { mensagemDeErro } from '../../api/erro-api';
import { useSessao } from '../../api/sessao';
import { useExcluirVariavel, useVariaveis } from '../../api/variaveis';
import { plural } from '../../app/plural';
import { ROTULO_ACUMULACAO, ROTULO_TIPO_VARIAVEL } from '../../app/rotulos';
import { CORES } from '../../app/tema';
import { useAvisar } from '../../componentes/avisos';
import { CabecalhoPagina } from '../../componentes/cabecalho-pagina';
import { DialogoConfirmacao } from '../../componentes/dialogo-confirmacao';
import { type Coluna, ListaResponsiva } from '../../componentes/lista-responsiva';
import { Pagina } from '../../componentes/pagina';
import { cicloInicial, SeletorCiclo } from '../../componentes/seletor-ciclo';
import { SeloSituacao } from '../../componentes/selo-situacao';
import { DialogoVariavel, emUso } from './dialogo-variavel';

function UsadaPor({ variavel }: { readonly variavel: Variavel }) {
  if (variavel.usadaPor.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Nenhuma meta
      </Typography>
    );
  }
  return <span translate="no">{variavel.usadaPor.map((meta) => meta.codigo).join(', ')}</span>;
}

const COLUNAS: readonly Coluna<Variavel>[] = [
  {
    titulo: 'Variável',
    principal: true,
    valor: (v) => (
      <Box>
        <Box component="span" sx={{ display: 'block', fontWeight: 600 }}>
          {v.nome}
        </Box>
        <Box
          component="span"
          translate="no"
          sx={{ display: 'block', fontSize: 13, color: CORES.azulEscuro, fontWeight: 600 }}
        >
          {v.setorCodigo}.{v.codigo}
        </Box>
      </Box>
    ),
  },
  { titulo: 'Setor', valor: (v) => v.setorNome, largura: 180, soNoDesktop: true },
  { titulo: 'Tipo', valor: (v) => ROTULO_TIPO_VARIAVEL[v.tipo], largura: 130 },
  { titulo: 'Acumulação', valor: (v) => ROTULO_ACUMULACAO[v.acumulacao], largura: 130 },
  { titulo: 'Usada por', valor: (v) => <UsadaPor variavel={v} />, largura: 200 },
  { titulo: 'Situação', valor: (v) => <SeloSituacao ativo={v.ativo} />, largura: 110 },
];

/**
 * Variáveis do ciclo (P12, especificação 10.2): por setor, com as metas que usam cada uma
 * (RF-20). Trocar o código atualiza as fórmulas (RF-21). Só o Administrador.
 */
export function PaginaVariaveis() {
  const sessao = useSessao();
  const ciclos = useCiclos();
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const lista = ciclos.data ?? [];
  const ciclo = lista.find((c) => c.id === escolhido) ?? cicloInicial(lista);

  if (sessao.data?.usuario.perfil !== Perfil.ADMIN) {
    return (
      <Pagina>
        <CabecalhoPagina titulo="Variáveis" />
        <Alert severity="info">As variáveis são cadastradas pelo Administrador do sistema.</Alert>
      </Pagina>
    );
  }

  return (
    <Pagina>
      <CabecalhoPagina
        titulo="Variáveis"
        descricao="O que cada setor lança mês a mês. As fórmulas das metas usam o código: PRESENCAS no próprio setor ou RH.TOTAL_COLAB de outro setor."
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
            <SeletorCiclo ciclos={lista} selecionado={ciclo.id} aoEscolher={setEscolhido} />
          </Box>
          <VariaveisDoCiclo key={ciclo.id} ciclo={ciclo} />
        </>
      )}
    </Pagina>
  );
}

function VariaveisDoCiclo({ ciclo }: { readonly ciclo: Ciclo }) {
  const variaveis = useVariaveis(ciclo.id);
  const setores = useSetores();
  const [setorId, setSetorId] = useState('');
  const [busca, setBusca] = useState('');
  const buscaAdiada = useDeferredValue(busca);
  const [editando, setEditando] = useState<Variavel | 'nova' | null>(null);
  const [excluindo, setExcluindo] = useState<Variavel | null>(null);
  const excluir = useExcluirVariavel(ciclo.id);
  const avisar = useAvisar();
  const encerrado = ciclo.status === StatusCiclo.ENCERRADO;

  const filtradas = useMemo(() => {
    const termo = buscaAdiada.trim().toUpperCase();
    return variaveis.data?.filter(
      (v) =>
        (setorId === '' || v.setorId === setorId) &&
        (termo === '' || v.codigo.includes(termo) || v.nome.toUpperCase().includes(termo)),
    );
  }, [variaveis.data, setorId, buscaAdiada]);

  return (
    <section aria-label={`Variáveis do ciclo ${String(ciclo.ano)}`}>
      {encerrado && (
        <Alert severity="info" sx={{ mb: 2 }}>
          O ciclo {ciclo.ano} está encerrado: as variáveis ficam só para consulta.
        </Alert>
      )}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        sx={{ mb: 2, alignItems: { sm: 'center' } }}
      >
        <TextField
          select
          label="Setor"
          value={setorId}
          onChange={(evento) => {
            setSetorId(evento.target.value);
          }}
          sx={{ minWidth: { sm: 240 }, bgcolor: CORES.branco }}
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
          label="Buscar"
          type="search"
          value={busca}
          onChange={(evento) => {
            setBusca(evento.target.value);
          }}
          placeholder="Código ou nome…"
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
              setEditando('nova');
            }}
            sx={{ flexShrink: 0, minHeight: 48 }}
          >
            Nova variável
          </Button>
        )}
      </Stack>

      {filtradas !== undefined && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }} aria-live="polite">
          {plural(filtradas.length, 'variável', 'variáveis')}
        </Typography>
      )}

      {variaveis.isError ? (
        <Alert severity="error">{mensagemDeErro(variaveis.error)}</Alert>
      ) : (
        <ListaResponsiva
          rotulo="Variáveis"
          itens={filtradas}
          colunas={COLUNAS}
          chave={(v) => v.id}
          vazio={
            variaveis.data?.length === 0
              ? `Nenhuma variável no ciclo ${String(ciclo.ano)} ainda.`
              : 'Nenhuma variável com esse filtro.'
          }
          acoes={
            encerrado
              ? undefined
              : (v) => (
                  <>
                    <Tooltip title="Editar">
                      <IconButton
                        aria-label={`Editar ${v.codigo}`}
                        onClick={() => {
                          setEditando(v);
                        }}
                      >
                        <EditOutlinedIcon />
                      </IconButton>
                    </Tooltip>
                    {!emUso(v) && (
                      <Tooltip title="Excluir">
                        <IconButton
                          aria-label={`Excluir ${v.codigo}`}
                          onClick={() => {
                            excluir.reset();
                            setExcluindo(v);
                          }}
                        >
                          <DeleteOutlinedIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                  </>
                )
          }
        />
      )}

      {editando !== null && (
        <DialogoVariavel
          cicloId={ciclo.id}
          variavel={editando === 'nova' ? null : editando}
          setores={setores.data ?? []}
          setorInicial={setorId}
          aoFechar={() => {
            setEditando(null);
          }}
        />
      )}
      <DialogoConfirmacao
        aberto={excluindo !== null}
        titulo="Excluir variável?"
        mensagem={`A variável ${excluindo?.codigo ?? ''} será excluída definitivamente. Só é possível excluir uma variável sem lançamentos e que nenhuma meta usa; nos outros casos, inative-a.`}
        rotuloConfirmar="Excluir variável"
        enviando={excluir.isPending}
        erro={excluir.isError ? mensagemDeErro(excluir.error) : null}
        aoCancelar={() => {
          setExcluindo(null);
        }}
        aoConfirmar={() => {
          if (excluindo === null) return;
          excluir.mutate(excluindo.id, {
            onSuccess: () => {
              avisar('Variável excluída.');
              setExcluindo(null);
            },
          });
        }}
      />
    </section>
  );
}
