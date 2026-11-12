import { zodResolver } from '@hookform/resolvers/zod';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
  IconButton,
  MenuItem,
  Pagination,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Perfil, type Usuario, type UsuarioEntrada, UsuarioEntradaSchema } from '@metas/tipos';
import { useDeferredValue, useEffect, useId, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';

import {
  useDefinirSetoresLeitor,
  useExcluirUsuario,
  useSalvarUsuario,
  useSetores,
  useUsuarios,
} from '../../api/cadastros';
import { useSessao } from '../../api/sessao';
import { mensagemDeErro } from '../../api/erro-api';
import { ROTULO_PERFIL } from '../../app/menu';
import { plural } from '../../app/plural';
import { useAvisar } from '../../componentes/avisos';
import { CabecalhoSecao } from '../../componentes/cabecalho-pagina';
import { CampoChave, CampoSelecao, CampoTexto } from '../../componentes/campos';
import { DialogoConfirmacao } from '../../componentes/dialogo-confirmacao';
import { aplicarErrosDaApi } from '../../componentes/formulario';
import { type Coluna, ListaResponsiva } from '../../componentes/lista-responsiva';
import { SeloSituacao } from '../../componentes/selo-situacao';

const TAMANHO = 20;
const OPCOES_PERFIL = Object.values(Perfil).map((perfil) => ({
  valor: perfil,
  rotulo: ROTULO_PERFIL[perfil],
}));

type Formulario = z.input<typeof UsuarioEntradaSchema>;

const COLUNAS: readonly Coluna<Usuario>[] = [
  {
    titulo: 'Nome',
    principal: true,
    largura: '34%',
    valor: (u) => (
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 600 }}>{u.nome}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
          {u.email}
        </Typography>
      </Box>
    ),
  },
  {
    titulo: 'Perfil',
    valor: (u) => `${ROTULO_PERFIL[u.perfil]}${u.gerenteGeral ? ' (Gerente Geral)' : ''}`,
  },
  { titulo: 'Superior', valor: (u) => u.superiorNome ?? '—', soNoDesktop: true },
  {
    titulo: 'Acesso',
    soNoDesktop: true,
    valor: (u) => (u.entrouAlgumaVez ? 'Já entrou' : 'Aguardando o 1º acesso'),
  },
  { titulo: 'Situação', valor: (u) => <SeloSituacao ativo={u.ativo} /> },
];

/** Usuários (RF-03): pré-cadastro pelo e-mail, perfil, situação, Gerente Geral e superior. */
export function AbaUsuarios() {
  const [busca, setBusca] = useState('');
  const [perfil, setPerfil] = useState<Perfil | ''>('');
  const [situacao, setSituacao] = useState<'' | 'true' | 'false'>('');
  const [pagina, setPagina] = useState(1);
  const buscaAdiada = useDeferredValue(busca);
  const lista = useUsuarios({
    busca: buscaAdiada.trim(),
    perfil: perfil === '' ? undefined : perfil,
    ativo: situacao === '' ? undefined : situacao === 'true',
    pagina,
    tamanho: TAMANHO,
  });

  const [editando, setEditando] = useState<Usuario | 'novo' | null>(null);
  const [setoresDe, setSetoresDe] = useState<Usuario | null>(null);
  const [excluindo, setExcluindo] = useState<Usuario | null>(null);
  const excluir = useExcluirUsuario();
  const avisar = useAvisar();
  const eu = useSessao().data?.usuario.id;

  const total = lista.data?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / TAMANHO));

  return (
    <section aria-labelledby="titulo-usuarios">
      <CabecalhoSecao
        id="titulo-usuarios"
        titulo="Usuários"
        descricao="Cadastre pelo e-mail da conta Microsoft da empresa. No primeiro acesso, a pessoa entra com o perfil definido aqui."
        acao={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditando('novo');
            }}
          >
            Novo usuário
          </Button>
        }
      />

      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          mb: 2,
          gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr 1fr' },
        }}
      >
        <TextField
          label="Buscar por nome ou e-mail"
          type="search"
          name="busca"
          autoComplete="off"
          spellCheck={false}
          value={busca}
          onChange={(evento) => {
            setBusca(evento.target.value);
            setPagina(1);
          }}
        />
        <TextField
          select
          label="Perfil"
          value={perfil}
          onChange={(evento) => {
            setPerfil(evento.target.value as Perfil | '');
            setPagina(1);
          }}
        >
          <MenuItem value="">Todos</MenuItem>
          {OPCOES_PERFIL.map((opcao) => (
            <MenuItem key={opcao.valor} value={opcao.valor}>
              {opcao.rotulo}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Situação"
          value={situacao}
          onChange={(evento) => {
            setSituacao(evento.target.value as '' | 'true' | 'false');
            setPagina(1);
          }}
        >
          <MenuItem value="">Todas</MenuItem>
          <MenuItem value="true">Ativos</MenuItem>
          <MenuItem value="false">Inativos</MenuItem>
        </TextField>
      </Box>

      {lista.isError ? (
        <Alert severity="error">{mensagemDeErro(lista.error)}</Alert>
      ) : (
        <ListaResponsiva
          rotulo="Usuários"
          itens={lista.data?.itens}
          colunas={COLUNAS}
          chave={(u) => u.id}
          vazio={
            busca !== '' || perfil !== '' || situacao !== ''
              ? 'Nenhum usuário com esses filtros.'
              : 'Nenhum usuário cadastrado ainda. Use “Novo usuário” para começar.'
          }
          acoes={(u) => (
            <>
              <Tooltip title="Editar">
                <IconButton
                  aria-label={`Editar ${u.nome}`}
                  onClick={() => {
                    setEditando(u);
                  }}
                >
                  <EditOutlinedIcon />
                </IconButton>
              </Tooltip>
              {u.perfil === Perfil.LEITOR && (
                <Tooltip title="Setores liberados">
                  <IconButton
                    aria-label={`Setores liberados para ${u.nome}`}
                    onClick={() => {
                      setSetoresDe(u);
                    }}
                  >
                    <VisibilityOutlinedIcon />
                  </IconButton>
                </Tooltip>
              )}
              {u.id !== eu && (
                <Tooltip title="Excluir">
                  <IconButton
                    aria-label={`Excluir ${u.nome}`}
                    onClick={() => {
                      excluir.reset();
                      setExcluindo(u);
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

      {paginas > 1 && (
        <Stack
          direction="row"
          sx={{
            mt: 2,
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 1,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            {plural(total, 'usuário', 'usuários')}
          </Typography>
          <Pagination
            count={paginas}
            page={pagina}
            onChange={(_evento, valor) => {
              setPagina(valor);
            }}
            color="primary"
            aria-label="Páginas de usuários"
          />
        </Stack>
      )}

      {editando !== null && (
        <DialogoUsuario
          usuario={editando === 'novo' ? null : editando}
          eu={eu}
          aoFechar={() => {
            setEditando(null);
          }}
        />
      )}
      {setoresDe !== null && (
        <DialogoSetoresLeitor
          usuario={setoresDe}
          aoFechar={() => {
            setSetoresDe(null);
          }}
        />
      )}
      <DialogoConfirmacao
        aberto={excluindo !== null}
        titulo="Excluir usuário?"
        mensagem={`${excluindo?.nome ?? ''} será excluído definitivamente. Só é possível excluir quem não tem nenhum registro no sistema; nos outros casos, inative o usuário.`}
        rotuloConfirmar="Excluir usuário"
        enviando={excluir.isPending}
        erro={excluir.isError ? mensagemDeErro(excluir.error) : null}
        aoCancelar={() => {
          setExcluindo(null);
        }}
        aoConfirmar={() => {
          if (excluindo === null) return;
          excluir.mutate(excluindo.id, {
            onSuccess: () => {
              avisar('Usuário excluído.');
              setExcluindo(null);
            },
          });
        }}
      />
    </section>
  );
}

function DialogoUsuario(props: {
  readonly usuario: Usuario | null;
  readonly eu: string | undefined;
  readonly aoFechar: () => void;
}) {
  const { usuario } = props;
  const idTitulo = useId();
  const salvar = useSalvarUsuario();
  const avisar = useAvisar();
  const candidatos = useUsuarios({ ativo: true, tamanho: 200 });
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const { control, handleSubmit, setError, setValue } = useForm<
    Formulario,
    unknown,
    UsuarioEntrada
  >({
    resolver: zodResolver(UsuarioEntradaSchema),
    defaultValues: {
      nome: usuario?.nome ?? '',
      email: usuario?.email ?? '',
      perfil: usuario?.perfil ?? Perfil.GESTOR,
      ativo: usuario?.ativo ?? true,
      gerenteGeral: usuario?.gerenteGeral ?? false,
      superiorId: usuario?.superiorId ?? null,
    },
  });
  const perfilEscolhido = useWatch({ control, name: 'perfil' });
  // Fora da Diretoria, Gerente Geral não vale: desmarca assim que o perfil muda.
  useEffect(() => {
    if (perfilEscolhido !== Perfil.DIRETORIA) setValue('gerenteGeral', false);
  }, [perfilEscolhido, setValue]);
  const proprio = usuario !== null && usuario.id === props.eu;

  const opcoesSuperior = (candidatos.data?.itens ?? [])
    .filter((u) => u.id !== usuario?.id)
    .map((u) => ({ valor: u.id, rotulo: u.nome }));

  const enviar = handleSubmit((dados) => {
    setErroGeral(null);
    salvar.mutate(
      { id: usuario?.id ?? null, dados },
      {
        onSuccess: () => {
          avisar(usuario === null ? 'Usuário cadastrado.' : 'Usuário salvo.');
          props.aoFechar();
        },
        onError: (erro) => {
          setErroGeral(
            aplicarErrosDaApi(
              erro,
              ['nome', 'email', 'perfil', 'ativo', 'gerenteGeral', 'superiorId'],
              setError,
            ),
          );
        },
      },
    );
  });

  return (
    <Dialog open onClose={props.aoFechar} aria-labelledby={idTitulo} fullWidth maxWidth="sm">
      <form onSubmit={(evento) => void enviar(evento)} noValidate>
        <DialogTitle id={idTitulo}>
          {usuario === null ? 'Novo usuário' : 'Editar usuário'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <CampoTexto control={control} nome="nome" label="Nome" autoComplete="off" required />
            <CampoTexto
              control={control}
              nome="email"
              label="E-mail da conta Microsoft"
              type="email"
              autoComplete="off"
              spellCheck={false}
              placeholder="Ex.: nome@ectas.com.br"
              helperText={
                usuario?.entrouAlgumaVez === true
                  ? 'Esta pessoa já entrou no sistema; o e-mail serve só de referência.'
                  : 'A pessoa entra com este e-mail no primeiro acesso.'
              }
              required
            />
            <CampoSelecao
              control={control}
              nome="perfil"
              label="Perfil"
              opcoes={OPCOES_PERFIL}
              disabled={proprio}
              helperText={proprio ? 'Você não pode mudar o próprio perfil.' : undefined}
            />
            <CampoChave
              control={control}
              nome="gerenteGeral"
              rotulo="Gerente Geral (aprova correções)"
              ajuda="Só para quem tem o perfil Diretoria."
              desabilitado={perfilEscolhido !== Perfil.DIRETORIA}
            />
            <CampoSelecao
              control={control}
              nome="superiorId"
              label="Superior imediato"
              vazio="Nenhum"
              opcoes={opcoesSuperior}
            />
            <CampoChave
              control={control}
              nome="ativo"
              rotulo="Ativo"
              ajuda={proprio ? 'Você não pode se inativar.' : 'Inativo não acessa o sistema.'}
              desabilitado={proprio}
            />
            {erroGeral !== null && <Alert severity="error">{erroGeral}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={props.aoFechar}>Cancelar</Button>
          <Button type="submit" variant="contained" loading={salvar.isPending}>
            {usuario === null ? 'Cadastrar usuário' : 'Salvar usuário'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

function DialogoSetoresLeitor(props: { readonly usuario: Usuario; readonly aoFechar: () => void }) {
  const idTitulo = useId();
  const setores = useSetores();
  const definir = useDefinirSetoresLeitor();
  const avisar = useAvisar();
  const [marcados, setMarcados] = useState<Set<string>>(new Set(props.usuario.setoresLeitor));

  function alternar(id: string): void {
    setMarcados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  return (
    <Dialog open onClose={props.aoFechar} aria-labelledby={idTitulo} fullWidth maxWidth="xs">
      <DialogTitle id={idTitulo}>Setores liberados</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {props.usuario.nome} verá as metas e os resultados destes setores.
        </Typography>
        {setores.isPending ? (
          <Typography color="text.secondary">Carregando setores…</Typography>
        ) : (
          <FormGroup>
            {(setores.data ?? [])
              .filter((s) => s.ativo || marcados.has(s.id))
              .map((setor) => (
                <FormControlLabel
                  key={setor.id}
                  sx={{ minHeight: 44 }}
                  control={
                    <Checkbox
                      checked={marcados.has(setor.id)}
                      onChange={() => {
                        alternar(setor.id);
                      }}
                    />
                  }
                  label={setor.nome}
                />
              ))}
          </FormGroup>
        )}
        {definir.isError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {mensagemDeErro(definir.error)}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={props.aoFechar}>Cancelar</Button>
        <Button
          variant="contained"
          loading={definir.isPending}
          onClick={() => {
            definir.mutate(
              { id: props.usuario.id, setorIds: [...marcados] },
              {
                onSuccess: () => {
                  avisar('Setores liberados salvos.');
                  props.aoFechar();
                },
              },
            );
          }}
        >
          Salvar setores
        </Button>
      </DialogActions>
    </Dialog>
  );
}
