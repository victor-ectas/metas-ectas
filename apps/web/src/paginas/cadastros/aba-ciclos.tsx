import { zodResolver } from '@hookform/resolvers/zod';
import AddIcon from '@mui/icons-material/Add';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  type Ciclo,
  type CicloEntrada,
  CicloEntradaSchema,
  Perfil,
  type ResponsavelSetor,
  StatusCiclo,
} from '@metas/tipos';
import { useId, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import {
  useCiclos,
  useCriarCiclo,
  useDefinirResponsaveis,
  useResponsaveis,
  useUsuarios,
} from '../../api/cadastros';
import { mensagemDeErro } from '../../api/erro-api';
import { plural } from '../../app/plural';
import { CORES } from '../../app/tema';
import { useAvisar } from '../../componentes/avisos';
import { CabecalhoSecao } from '../../componentes/cabecalho-pagina';
import { CampoTexto } from '../../componentes/campos';
import { aplicarErrosDaApi } from '../../componentes/formulario';
import { cicloInicial, SeletorCiclo } from '../../componentes/seletor-ciclo';

/**
 * Ciclos (RF-07: criar e listar; ativar e encerrar ficam no P15) e o gestor responsável por cada
 * setor no ciclo (RF-05). Responsável só Gestor ativo.
 */
export function AbaCiclos() {
  const ciclos = useCiclos();
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const lista = ciclos.data ?? [];
  const ciclo = lista.find((c) => c.id === escolhido) ?? cicloInicial(lista);

  return (
    <section aria-labelledby="titulo-ciclos">
      <CabecalhoSecao
        id="titulo-ciclos"
        titulo="Ciclos e responsáveis"
        descricao="Cada ciclo é um ano de metas, de janeiro a dezembro. Nasce como rascunho; ativar e encerrar ficam na tela Ciclos e consistência."
        acao={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setCriando(true);
            }}
          >
            Novo ciclo
          </Button>
        }
      />

      {ciclos.isError ? (
        <Alert severity="error">{mensagemDeErro(ciclos.error)}</Alert>
      ) : ciclos.isPending ? (
        <Skeleton variant="rounded" height={44} width={240} />
      ) : lista.length === 0 ? (
        <Box
          sx={{
            p: 4,
            textAlign: 'center',
            border: `1px dashed ${CORES.borda}`,
            borderRadius: 3,
            bgcolor: CORES.branco,
            color: 'text.secondary',
          }}
        >
          Nenhum ciclo ainda. Crie o ciclo do ano para definir os responsáveis pelos setores.
        </Box>
      ) : (
        <>
          <Box sx={{ mb: 3 }}>
            <SeletorCiclo ciclos={lista} selecionado={ciclo?.id} aoEscolher={setEscolhido} />
          </Box>
          {ciclo !== undefined && <Responsaveis key={ciclo.id} ciclo={ciclo} />}
        </>
      )}

      {criando && (
        <DialogoCiclo
          anos={lista.map((c) => c.ano)}
          aoFechar={(criado) => {
            setCriando(false);
            if (criado !== null) setEscolhido(criado.id);
          }}
        />
      )}
    </section>
  );
}

function Responsaveis(props: { readonly ciclo: Ciclo }) {
  const { ciclo } = props;
  const responsaveis = useResponsaveis(ciclo.id);
  const gestores = useUsuarios({ perfil: Perfil.GESTOR, ativo: true, tamanho: 200 });
  const definir = useDefinirResponsaveis(ciclo.id);
  const avisar = useAvisar();
  const [alterados, setAlterados] = useState<ReadonlyMap<string, string | null>>(new Map());
  const encerrado = ciclo.status === StatusCiclo.ENCERRADO;

  const opcoes = useMemo(() => {
    const lista = (gestores.data?.itens ?? []).map((g) => ({ id: g.id, nome: g.nome }));
    // Responsável atual que deixou de ser Gestor ativo continua aparecendo, para não sumir da tela.
    for (const r of responsaveis.data ?? []) {
      if (r.usuarioId !== null && !lista.some((g) => g.id === r.usuarioId)) {
        lista.push({ id: r.usuarioId, nome: `${r.usuarioNome ?? ''} (não é mais Gestor ativo)` });
      }
    }
    return lista;
  }, [gestores.data, responsaveis.data]);

  if (responsaveis.isError)
    return <Alert severity="error">{mensagemDeErro(responsaveis.error)}</Alert>;
  if (responsaveis.data === undefined) {
    return (
      <Stack spacing={1}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} variant="rounded" height={56} />
        ))}
      </Stack>
    );
  }

  const valor = (r: ResponsavelSetor) =>
    alterados.has(r.setor.id) ? alterados.get(r.setor.id) : r.usuarioId;
  const semResponsavel = responsaveis.data.filter((r) => r.setor.ativo && valor(r) == null).length;

  function salvar(): void {
    definir.mutate(
      { responsaveis: [...alterados].map(([setorId, usuarioId]) => ({ setorId, usuarioId })) },
      {
        onSuccess: () => {
          avisar('Responsáveis salvos.');
          setAlterados(new Map());
        },
      },
    );
  }

  return (
    <Box component="section" aria-labelledby="titulo-responsaveis">
      <Typography id="titulo-responsaveis" variant="h3" sx={{ color: CORES.marinho, mb: 0.5 }}>
        Responsáveis em {ciclo.ano}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {encerrado
          ? 'Ciclo encerrado: os responsáveis não podem mais mudar.'
          : semResponsavel > 0
            ? `${plural(semResponsavel, 'setor ativo', 'setores ativos')} sem responsável. Só Gestores ativos aparecem na lista.`
            : 'Todos os setores ativos têm responsável. Só Gestores ativos aparecem na lista.'}
      </Typography>

      {responsaveis.data.length === 0 ? (
        <Typography color="text.secondary">Nenhum setor ativo cadastrado.</Typography>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
          }}
        >
          {responsaveis.data.map((r) => (
            <TextField
              key={r.setor.id}
              select
              label={
                r.setor.corporativo && !/corporativo/i.test(r.setor.nome)
                  ? `${r.setor.nome} (Corporativo)`
                  : r.setor.nome
              }
              value={valor(r) ?? ''}
              disabled={encerrado || (!r.setor.ativo && valor(r) == null)}
              helperText={r.setor.ativo ? undefined : 'Setor inativo'}
              onChange={(evento) => {
                const novo = evento.target.value === '' ? null : evento.target.value;
                setAlterados((atual) => {
                  const mapa = new Map(atual);
                  if (novo === r.usuarioId) mapa.delete(r.setor.id);
                  else mapa.set(r.setor.id, novo);
                  return mapa;
                });
              }}
              sx={{ bgcolor: CORES.branco }}
            >
              <MenuItem value="">
                <em>Sem responsável</em>
              </MenuItem>
              {opcoes.map((g) => (
                <MenuItem key={g.id} value={g.id}>
                  {g.nome}
                </MenuItem>
              ))}
            </TextField>
          ))}
        </Box>
      )}

      {definir.isError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {mensagemDeErro(definir.error)}
        </Alert>
      )}
      {!encerrado && (
        <Box sx={{ display: 'flex', gap: 1.5, mt: 3, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button
            variant="contained"
            disabled={alterados.size === 0}
            loading={definir.isPending}
            onClick={salvar}
          >
            Salvar responsáveis
          </Button>
          {alterados.size > 0 && (
            <>
              <Button
                onClick={() => {
                  setAlterados(new Map());
                }}
              >
                Desfazer alterações
              </Button>
              <Typography variant="body2" color="text.secondary" role="status">
                {plural(alterados.size, 'alteração não salva', 'alterações não salvas')}
              </Typography>
            </>
          )}
        </Box>
      )}
    </Box>
  );
}

type FormularioCiclo = z.input<typeof CicloEntradaSchema>;

function DialogoCiclo(props: {
  readonly anos: readonly number[];
  readonly aoFechar: (criado: Ciclo | null) => void;
}) {
  const idTitulo = useId();
  const criar = useCriarCiclo();
  const avisar = useAvisar();
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  // Sugere o próximo ano ainda sem ciclo.
  const sugerido = Math.max(new Date().getFullYear(), ...props.anos.map((a) => a + 1));
  const { control, handleSubmit, setError } = useForm<FormularioCiclo, unknown, CicloEntrada>({
    resolver: zodResolver(CicloEntradaSchema),
    defaultValues: { ano: sugerido },
  });

  const enviar = handleSubmit((dados) => {
    setErroGeral(null);
    criar.mutate(dados, {
      onSuccess: (ciclo) => {
        avisar(`Ciclo ${String(ciclo.ano)} criado como rascunho.`);
        props.aoFechar(ciclo);
      },
      onError: (erro) => {
        setErroGeral(aplicarErrosDaApi(erro, ['ano'], setError));
      },
    });
  });

  return (
    <Dialog
      open
      onClose={() => {
        props.aoFechar(null);
      }}
      aria-labelledby={idTitulo}
      fullWidth
      maxWidth="xs"
    >
      <form onSubmit={(evento) => void enviar(evento)} noValidate>
        <DialogTitle id={idTitulo}>Novo ciclo</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <CampoTexto
              control={control}
              nome="ano"
              label="Ano"
              type="number"
              numerico
              required
              helperText="O ciclo vai de janeiro a dezembro deste ano."
              slotProps={{ htmlInput: { min: 2000, max: 2100, inputMode: 'numeric' } }}
            />
            {erroGeral !== null && <Alert severity="error">{erroGeral}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              props.aoFechar(null);
            }}
          >
            Cancelar
          </Button>
          <Button type="submit" variant="contained" loading={criar.isPending}>
            Criar ciclo
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
