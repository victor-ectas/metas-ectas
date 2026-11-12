import { zodResolver } from '@hookform/resolvers/zod';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tooltip,
} from '@mui/material';
import { type Setor, type SetorEntrada, SetorEntradaSchema } from '@metas/tipos';
import { useId, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';

import { useExcluirSetor, useSalvarSetor, useSetores } from '../../api/cadastros';
import { mensagemDeErro } from '../../api/erro-api';
import { useAvisar } from '../../componentes/avisos';
import { CabecalhoSecao } from '../../componentes/cabecalho-pagina';
import { CampoChave, CampoTexto } from '../../componentes/campos';
import { DialogoConfirmacao } from '../../componentes/dialogo-confirmacao';
import { aplicarErrosDaApi } from '../../componentes/formulario';
import { type Coluna, ListaResponsiva } from '../../componentes/lista-responsiva';
import { SeloSituacao } from '../../componentes/selo-situacao';

type Formulario = z.input<typeof SetorEntradaSchema>;

const COLUNAS: readonly Coluna<Setor>[] = [
  { titulo: 'Nome', principal: true, valor: (s) => s.nome },
  { titulo: 'Código', valor: (s) => <span translate="no">{s.codigo}</span>, largura: 160 },
  {
    titulo: 'Bloco das metas',
    valor: (s) => (s.corporativo ? 'Corporativo' : 'Departamental'),
    largura: 180,
  },
  { titulo: 'Situação', valor: (s) => <SeloSituacao ativo={s.ativo} />, largura: 120 },
];

/** Setores (RF-04), com o setor especial Corporativo (único, não inativa, não exclui). */
export function AbaSetores() {
  const setores = useSetores();
  const [editando, setEditando] = useState<Setor | 'novo' | null>(null);
  const [excluindo, setExcluindo] = useState<Setor | null>(null);
  const excluir = useExcluirSetor();
  const avisar = useAvisar();

  return (
    <section aria-labelledby="titulo-setores">
      <CabecalhoSecao
        id="titulo-setores"
        titulo="Setores"
        descricao="O código aparece nas fórmulas (ex.: RH.TOTAL_COLAB). As metas do setor Corporativo formam o bloco Corporativo; as dos outros, o Departamental."
        acao={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditando('novo');
            }}
          >
            Novo setor
          </Button>
        }
      />
      {setores.isError ? (
        <Alert severity="error">{mensagemDeErro(setores.error)}</Alert>
      ) : (
        <ListaResponsiva
          rotulo="Setores"
          itens={setores.data}
          colunas={COLUNAS}
          chave={(s) => s.id}
          vazio="Nenhum setor cadastrado ainda. Comece pelo setor Corporativo."
          acoes={(s) => (
            <>
              <Tooltip title="Editar">
                <IconButton
                  aria-label={`Editar ${s.nome}`}
                  onClick={() => {
                    setEditando(s);
                  }}
                >
                  <EditOutlinedIcon />
                </IconButton>
              </Tooltip>
              {!s.corporativo && (
                <Tooltip title="Excluir">
                  <IconButton
                    aria-label={`Excluir ${s.nome}`}
                    onClick={() => {
                      excluir.reset();
                      setExcluindo(s);
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

      {editando !== null && (
        <DialogoSetor
          setor={editando === 'novo' ? null : editando}
          jaTemCorporativo={(setores.data ?? []).some((s) => s.corporativo)}
          aoFechar={() => {
            setEditando(null);
          }}
        />
      )}
      <DialogoConfirmacao
        aberto={excluindo !== null}
        titulo="Excluir setor?"
        mensagem={`O setor ${excluindo?.nome ?? ''} será excluído definitivamente. Só é possível excluir um setor sem responsáveis, variáveis, metas ou leitores; nos outros casos, inative-o.`}
        rotuloConfirmar="Excluir setor"
        enviando={excluir.isPending}
        erro={excluir.isError ? mensagemDeErro(excluir.error) : null}
        aoCancelar={() => {
          setExcluindo(null);
        }}
        aoConfirmar={() => {
          if (excluindo === null) return;
          excluir.mutate(excluindo.id, {
            onSuccess: () => {
              avisar('Setor excluído.');
              setExcluindo(null);
            },
          });
        }}
      />
    </section>
  );
}

function DialogoSetor(props: {
  readonly setor: Setor | null;
  readonly jaTemCorporativo: boolean;
  readonly aoFechar: () => void;
}) {
  const { setor } = props;
  const idTitulo = useId();
  const salvar = useSalvarSetor();
  const avisar = useAvisar();
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const { control, handleSubmit, setError } = useForm<Formulario, unknown, SetorEntrada>({
    resolver: zodResolver(SetorEntradaSchema),
    defaultValues: {
      codigo: setor?.codigo ?? '',
      nome: setor?.nome ?? '',
      corporativo: setor?.corporativo ?? false,
      ativo: setor?.ativo ?? true,
    },
  });
  const corporativo = useWatch({ control, name: 'corporativo' }) === true;
  // Só pode haver um Corporativo: a opção aparece para quem já é ou se ainda não existe.
  const podeSerCorporativo = setor?.corporativo === true || !props.jaTemCorporativo;

  const enviar = handleSubmit((dados) => {
    setErroGeral(null);
    salvar.mutate(
      { id: setor?.id ?? null, dados },
      {
        onSuccess: () => {
          avisar(setor === null ? 'Setor cadastrado.' : 'Setor salvo.');
          props.aoFechar();
        },
        onError: (erro) => {
          setErroGeral(
            aplicarErrosDaApi(erro, ['codigo', 'nome', 'corporativo', 'ativo'], setError),
          );
        },
      },
    );
  });

  return (
    <Dialog open onClose={props.aoFechar} aria-labelledby={idTitulo} fullWidth maxWidth="sm">
      <form onSubmit={(evento) => void enviar(evento)} noValidate>
        <DialogTitle id={idTitulo}>{setor === null ? 'Novo setor' : 'Editar setor'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <CampoTexto control={control} nome="nome" label="Nome" autoComplete="off" required />
            <CampoTexto
              control={control}
              nome="codigo"
              label="Código"
              autoComplete="off"
              spellCheck={false}
              placeholder="Ex.: RH"
              helperText="Letras sem acento, números e _. Não muda depois que o setor tiver variáveis ou metas."
              slotProps={{ htmlInput: { style: { textTransform: 'uppercase' }, translate: 'no' } }}
              required
            />
            {podeSerCorporativo && (
              <CampoChave
                control={control}
                nome="corporativo"
                rotulo="Setor Corporativo"
                ajuda="Só um setor pode ser o Corporativo. Ele não pode ser inativado nem excluído."
              />
            )}
            <CampoChave
              control={control}
              nome="ativo"
              rotulo="Ativo"
              desabilitado={corporativo}
              ajuda={corporativo ? 'O setor Corporativo fica sempre ativo.' : undefined}
            />
            {erroGeral !== null && <Alert severity="error">{erroGeral}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={props.aoFechar}>Cancelar</Button>
          <Button type="submit" variant="contained" loading={salvar.isPending}>
            {setor === null ? 'Cadastrar setor' : 'Salvar setor'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
