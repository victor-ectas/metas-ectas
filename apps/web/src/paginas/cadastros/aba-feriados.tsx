import { zodResolver } from '@hookform/resolvers/zod';
import AddIcon from '@mui/icons-material/Add';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { type Feriado, type FeriadoEntrada, FeriadoEntradaSchema, TipoFeriado } from '@metas/tipos';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { useExcluirFeriado, useFeriados, useSalvarFeriado } from '../../api/cadastros';
import { mensagemDeErro } from '../../api/erro-api';
import { ROTULO_TIPO_FERIADO } from '../../app/rotulos';
import { CORES } from '../../app/tema';
import { useAvisar } from '../../componentes/avisos';
import { CabecalhoSecao } from '../../componentes/cabecalho-pagina';
import { CampoSelecao, CampoTexto } from '../../componentes/campos';
import { DialogoConfirmacao } from '../../componentes/dialogo-confirmacao';
import { aplicarErrosDaApi } from '../../componentes/formulario';
import { type Coluna, ListaResponsiva } from '../../componentes/lista-responsiva';
import { formatarData } from '../../formatacao';

type Formulario = z.input<typeof FeriadoEntradaSchema>;

const OPCOES_TIPO = Object.values(TipoFeriado).map((tipo) => ({
  valor: tipo,
  rotulo: ROTULO_TIPO_FERIADO[tipo],
}));

const DIA_DA_SEMANA = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' });

function diaDaSemana(data: string): string {
  return DIA_DA_SEMANA.format(new Date(`${data}T12:00:00Z`));
}

const COLUNAS: readonly Coluna<Feriado>[] = [
  {
    titulo: 'Data',
    principal: true,
    largura: 220,
    valor: (f) => (
      <Box sx={{ whiteSpace: 'nowrap' }}>
        <Typography component="span" sx={{ fontWeight: 600 }}>
          {formatarData(f.data)}
        </Typography>
        <Typography component="span" color="text.secondary" sx={{ ml: 1, fontSize: 14 }}>
          {diaDaSemana(f.data)}
        </Typography>
      </Box>
    ),
  },
  { titulo: 'Descrição', valor: (f) => f.descricao },
  { titulo: 'Tipo', valor: (f) => ROTULO_TIPO_FERIADO[f.tipo], largura: 240 },
];

/**
 * Feriados de Joinville/SC (RF-06): contam no prazo de fechamento (15º dia útil). Alterações que
 * mudariam o prazo de um mês já fechado são recusadas pela API.
 */
export function AbaFeriados() {
  const [ano, setAno] = useState(() => new Date().getFullYear());
  const feriados = useFeriados(ano);
  const [editando, setEditando] = useState<Feriado | 'novo' | null>(null);
  const [excluindo, setExcluindo] = useState<Feriado | null>(null);
  const excluir = useExcluirFeriado();
  const avisar = useAvisar();

  return (
    <section aria-labelledby="titulo-feriados">
      <CabecalhoSecao
        id="titulo-feriados"
        titulo="Feriados"
        descricao="Calendário de Joinville/SC. Os feriados em dias úteis adiam o fechamento dos meses (15º dia útil do mês seguinte)."
        acao={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditando('novo');
            }}
          >
            Novo feriado
          </Button>
        }
      />

      <Box
        sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}
        role="group"
        aria-label="Ano dos feriados"
      >
        <IconButton
          aria-label={`Ano anterior (${String(ano - 1)})`}
          onClick={() => {
            setAno((a) => a - 1);
          }}
        >
          <ChevronLeftIcon />
        </IconButton>
        <Typography
          component="span"
          aria-live="polite"
          sx={{
            fontWeight: 700,
            fontSize: 18,
            color: CORES.marinho,
            minWidth: 56,
            textAlign: 'center',
          }}
        >
          {ano}
        </Typography>
        <IconButton
          aria-label={`Próximo ano (${String(ano + 1)})`}
          onClick={() => {
            setAno((a) => a + 1);
          }}
        >
          <ChevronRightIcon />
        </IconButton>
      </Box>

      {feriados.isError ? (
        <Alert severity="error">{mensagemDeErro(feriados.error)}</Alert>
      ) : (
        <ListaResponsiva
          rotulo={`Feriados de ${String(ano)}`}
          itens={feriados.data}
          colunas={COLUNAS}
          chave={(f) => f.id}
          vazio={`Nenhum feriado cadastrado em ${String(ano)}.`}
          acoes={(f) => (
            <>
              <Tooltip title="Editar">
                <IconButton
                  aria-label={`Editar ${f.descricao}`}
                  onClick={() => {
                    setEditando(f);
                  }}
                >
                  <EditOutlinedIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Excluir">
                <IconButton
                  aria-label={`Excluir ${f.descricao}`}
                  onClick={() => {
                    excluir.reset();
                    setExcluindo(f);
                  }}
                >
                  <DeleteOutlinedIcon />
                </IconButton>
              </Tooltip>
            </>
          )}
        />
      )}

      {editando !== null && (
        <DialogoFeriado
          feriado={editando === 'novo' ? null : editando}
          anoSugerido={ano}
          aoFechar={() => {
            setEditando(null);
          }}
        />
      )}
      <DialogoConfirmacao
        aberto={excluindo !== null}
        titulo="Excluir feriado?"
        mensagem={`${excluindo?.descricao ?? ''} (${formatarData(excluindo?.data)}) sairá do calendário.`}
        rotuloConfirmar="Excluir feriado"
        enviando={excluir.isPending}
        erro={excluir.isError ? mensagemDeErro(excluir.error) : null}
        aoCancelar={() => {
          setExcluindo(null);
        }}
        aoConfirmar={() => {
          if (excluindo === null) return;
          excluir.mutate(excluindo.id, {
            onSuccess: () => {
              avisar('Feriado excluído.');
              setExcluindo(null);
            },
          });
        }}
      />
    </section>
  );
}

function DialogoFeriado(props: {
  readonly feriado: Feriado | null;
  readonly anoSugerido: number;
  readonly aoFechar: () => void;
}) {
  const { feriado } = props;
  const idTitulo = useId();
  const salvar = useSalvarFeriado();
  const avisar = useAvisar();
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const { control, handleSubmit, setError } = useForm<Formulario, unknown, FeriadoEntrada>({
    resolver: zodResolver(FeriadoEntradaSchema),
    defaultValues: {
      data: feriado?.data ?? '',
      descricao: feriado?.descricao ?? '',
      tipo: feriado?.tipo ?? TipoFeriado.MUNICIPAL,
    },
  });

  const enviar = handleSubmit((dados) => {
    setErroGeral(null);
    salvar.mutate(
      { id: feriado?.id ?? null, dados },
      {
        onSuccess: () => {
          avisar(feriado === null ? 'Feriado cadastrado.' : 'Feriado salvo.');
          props.aoFechar();
        },
        onError: (erro) => {
          setErroGeral(aplicarErrosDaApi(erro, ['data', 'descricao', 'tipo'], setError));
        },
      },
    );
  });

  return (
    <Dialog open onClose={props.aoFechar} aria-labelledby={idTitulo} fullWidth maxWidth="sm">
      <form onSubmit={(evento) => void enviar(evento)} noValidate>
        <DialogTitle id={idTitulo}>
          {feriado === null ? 'Novo feriado' : 'Editar feriado'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <CampoTexto
              control={control}
              nome="data"
              label="Data"
              type="date"
              required
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: {
                  min: `${String(props.anoSugerido - 1)}-01-01`,
                  max: `${String(props.anoSugerido + 1)}-12-31`,
                },
              }}
            />
            <CampoTexto
              control={control}
              nome="descricao"
              label="Descrição"
              autoComplete="off"
              placeholder="Ex.: Aniversário de Joinville"
              required
            />
            <CampoSelecao control={control} nome="tipo" label="Tipo" opcoes={OPCOES_TIPO} />
            {erroGeral !== null && <Alert severity="error">{erroGeral}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={props.aoFechar}>Cancelar</Button>
          <Button type="submit" variant="contained" loading={salvar.isPending}>
            {feriado === null ? 'Cadastrar feriado' : 'Salvar feriado'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
