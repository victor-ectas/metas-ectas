import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import {
  Alert,
  Box,
  Button,
  Chip,
  Link,
  Skeleton,
  Stack,
  Step,
  StepButton,
  Stepper,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Decimal } from '@metas/motor';
import {
  type Ciclo,
  CodigoErro,
  type Meta,
  MetaEntradaSchema,
  Perfil,
  StatusCiclo,
} from '@metas/tipos';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link as LinkRouter, useNavigate, useParams, useSearchParams } from 'react-router';

import { useCiclos, useResponsaveis, useSetores, useUsuarios } from '../../api/cadastros';
import { ErroApi, mensagemDeErro } from '../../api/erro-api';
import { useMeta, useSalvarMeta } from '../../api/metas';
import { useSessao } from '../../api/sessao';
import { useVariaveis } from '../../api/variaveis';
import { CORES } from '../../app/tema';
import { useAvisar } from '../../componentes/avisos';
import { CabecalhoPagina } from '../../componentes/cabecalho-pagina';
import { DialogoConfirmacao } from '../../componentes/dialogo-confirmacao';
import { Pagina } from '../../componentes/pagina';
import { formatarNumero } from '../../formatacao';
import { type Base, baseSubmeta, type FormEditor } from './campos-editor';
import {
  type ContextoEditor,
  EtapaFormula,
  EtapaObjetivo,
  EtapaOQueE,
  EtapaPeriodo,
  EtapaVariaveis,
} from './etapas';
import {
  calculoVazio,
  type FormularioMeta,
  formularioDe,
  formularioVazio,
  paraEntrada,
  type ProblemaFormulario,
  somaPesosInternos,
} from './formulario';
import { FRASE_SO_AGREGA, fraseBateQuando, fraseVale } from './frase-resumo';

const ETAPAS = [
  { titulo: 'O que é', componente: EtapaOQueE },
  { titulo: 'Variáveis', componente: EtapaVariaveis },
  { titulo: 'Fórmula', componente: EtapaFormula },
  { titulo: 'Acumulação e período', componente: EtapaPeriodo },
  { titulo: 'Objetivo e pontuação', componente: EtapaObjetivo },
] as const;

/** Nome dos campos da API nas mensagens de validação. */
const ROTULO_CAMPO: Readonly<Record<string, string>> = {
  setorId: 'Setor',
  responsavelId: 'Responsável',
  codigo: 'Código',
  indicador: 'Indicador',
  metrica: 'Como é medida',
  formula: 'Fórmula',
  tolerancia: 'Tolerância',
  mesInicio: 'Período',
  mesFim: 'Período',
  objetivos: 'Objetivo',
  pesoInterno: 'Peso interno',
  atribuicoes: 'Pesos',
  submetas: 'Submetas',
};

/**
 * Cadastro e edição de meta (P14, especificação 10.2): as 5 etapas do protótipo, submetas com a
 * soma dos pesos internos ao vivo e a frase-resumo. A prévia usa o motor no navegador (o mesmo da
 * API); quem decide ao salvar é a API.
 */
export function EditorMeta() {
  const { id } = useParams<{ id: string }>();
  const [parametros] = useSearchParams();
  const sessao = useSessao();
  const meta = useMeta(id);
  const ciclos = useCiclos();
  const cicloId = meta.data?.cicloId ?? parametros.get('ciclo') ?? undefined;
  const setores = useSetores();
  const variaveis = useVariaveis(cicloId);
  const gestores = useUsuarios({ perfil: Perfil.GESTOR, ativo: true, tamanho: 200 });
  const responsaveis = useResponsaveis(cicloId ?? null);
  const ciclo = ciclos.data?.find((c) => c.id === cicloId);

  if (sessao.data !== undefined && sessao.data.usuario.perfil !== Perfil.ADMIN) {
    return (
      <Pagina>
        <CabecalhoPagina titulo="Meta" />
        <Alert severity="info">As metas são cadastradas pelo Administrador do sistema.</Alert>
      </Pagina>
    );
  }

  const erro = [meta, ciclos, setores, variaveis, gestores, responsaveis].find((c) => c.isError);
  if (erro !== undefined) {
    return (
      <Pagina>
        <CabecalhoPagina titulo="Meta" />
        <Alert severity="error">{mensagemDeErro(erro.error)}</Alert>
      </Pagina>
    );
  }
  if (cicloId === undefined || (ciclos.data !== undefined && ciclo === undefined)) {
    return (
      <Pagina>
        <CabecalhoPagina titulo="Nova meta" />
        <Alert severity="info">
          Escolha o ciclo na{' '}
          <Link component={LinkRouter} to="/metas">
            lista de metas
          </Link>
          .
        </Alert>
      </Pagina>
    );
  }
  if (
    ciclo === undefined ||
    (id !== undefined && meta.data === undefined) ||
    setores.data === undefined ||
    variaveis.data === undefined ||
    gestores.data === undefined ||
    responsaveis.data === undefined
  ) {
    return (
      <Pagina>
        <Skeleton variant="text" width={280} height={48} />
        <Skeleton variant="rounded" height={320} sx={{ mt: 2 }} />
      </Pagina>
    );
  }

  // Gestores para escolher: os ativos e quem já está na meta (mesmo que tenha sido inativado).
  const nomes = new Map(gestores.data.itens.map((u) => [u.id, u.nome]));
  if (meta.data !== undefined) {
    nomes.set(meta.data.responsavelId, meta.data.responsavelNome);
    for (const a of meta.data.atribuicoes) nomes.set(a.usuarioId, a.usuarioNome);
  }
  const contexto: ContextoEditor = {
    cicloId,
    setores: setores.data,
    variaveis: variaveis.data,
    gestores: [...nomes]
      .map(([gid, nome]) => ({ id: gid, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome)),
    responsaveis: responsaveis.data,
    somenteLeitura: ciclo.status === StatusCiclo.ENCERRADO,
  };

  return (
    <Editor
      key={meta.data === undefined ? 'nova' : `${meta.data.id}-${String(meta.data.versao)}`}
      ciclo={ciclo}
      meta={meta.data ?? null}
      contexto={contexto}
    />
  );
}

function Editor(props: { ciclo: Ciclo; meta: Meta | null; contexto: ContextoEditor }) {
  const { ciclo, meta, contexto } = props;
  const tema = useTheme();
  const largo = useMediaQuery(tema.breakpoints.up('md'), { noSsr: true });
  const navegar = useNavigate();
  const avisar = useAvisar();
  const salvar = useSalvarMeta(ciclo.id);
  const form: FormEditor = useForm<FormularioMeta>({
    defaultValues: meta === null ? formularioVazio() : formularioDe(meta),
  });
  const [base, setBase] = useState<Base>('raiz');
  const [etapa, setEtapa] = useState(0);
  const [erros, setErros] = useState<ProblemaFormulario[]>([]);
  const [conflito, setConflito] = useState(false);
  const [removendo, setRemovendo] = useState<number | null>(null);

  const valores = useWatch({ control: form.control }) as FormularioMeta;
  const submetas = valores.submetas;
  const indiceSubmeta = base === 'raiz' ? null : Number(base.split('.')[1]);
  const item = indiceSubmeta === null ? valores.raiz : submetas[indiceSubmeta];
  const somenteLeitura = contexto.somenteLeitura;

  // Responsável sugerido: o do setor no ciclo, ao escolher o setor (se ainda não há um).
  const setorId = valores.setorId;
  useEffect(() => {
    const sugerido = contexto.responsaveis.find((r) => r.setor.id === setorId)?.usuarioId ?? null;
    if (sugerido !== null && form.getValues('responsavelId') === '') {
      form.setValue('responsavelId', sugerido);
    }
  }, [setorId, contexto.responsaveis, form]);

  // Meta departamental: uma atribuição só, ao responsável (ADR-018); o peso é mantido.
  const corporativo = contexto.setores.find((s) => s.id === setorId)?.corporativo === true;
  const responsavelId = valores.responsavelId;
  const atribuicoes = valores.atribuicoes;
  useEffect(() => {
    if (corporativo) return;
    const [unica] = atribuicoes;
    if (atribuicoes.length === 1 && unica?.usuarioId === responsavelId) return;
    form.setValue('atribuicoes', [{ usuarioId: responsavelId, peso: unica?.peso ?? '' }]);
  }, [corporativo, responsavelId, atribuicoes, form]);

  const soma = somaPesosInternos([
    ...submetas.filter((s) => s.ativo),
    ...(submetas.length > 0 && !valores.soAgrega ? [valores.raiz] : []),
  ]);
  const somaFecha = soma.toDecimalPlaces(2).eq(100);
  const nomeGestor = (gid: string) => contexto.gestores.find((g) => g.id === gid)?.nome ?? 'gestor';

  const adicionarSubmeta = () => {
    const nova = calculoVazio({
      unidade: valores.raiz.unidade,
      mesInicio: valores.raiz.mesInicio,
      mesFim: valores.raiz.mesFim,
    });
    form.setValue('submetas', [...submetas, nova], { shouldDirty: true });
    // Primeira submeta numa meta nova: o normal é a mãe só agregar (RN-30).
    if (submetas.length === 0 && valores.raiz.formula.trim() === '')
      form.setValue('soAgrega', true);
    setBase(baseSubmeta(submetas.length));
    setEtapa(0);
  };

  const enviar = form.handleSubmit(async (dados) => {
    setErros([]);
    setConflito(false);
    const { entrada, problemas } = paraEntrada(dados);
    // Mostra tudo de uma vez: números mal digitados e o que o schema da API recusaria.
    const conferida = MetaEntradaSchema.safeParse(entrada);
    const todos = [
      ...problemas,
      ...(conferida.success
        ? []
        : conferida.error.issues.map((issue) => descrever(issue.path, issue.message, dados))),
    ];
    if (!conferida.success || todos.length > 0) {
      setErros(todos);
      return;
    }
    // mutateAsync, não mutate: ao salvar, a meta recarrega com a versão nova e este editor é
    // remontado; os callbacks de `mutate` de um componente desmontado não são chamados.
    try {
      const salva = await salvar.mutateAsync(
        meta === null
          ? { id: null, meta: conferida.data }
          : { id: meta.id, versao: meta.versao, meta: conferida.data },
      );
      avisar(meta === null ? `Meta ${salva.codigo} cadastrada.` : `Meta ${salva.codigo} salva.`);
      await navegar(`/metas?ciclo=${ciclo.id}`);
    } catch (falha) {
      if (falha instanceof ErroApi && falha.codigo === CodigoErro.CONFLITO_VERSAO)
        setConflito(true);
      setErros(errosDaApi(falha));
    }
  });

  const Etapa = ETAPAS[etapa]?.componente ?? EtapaOQueE;
  const titulo = meta === null ? 'Nova meta' : `Meta ${meta.codigo}`;

  return (
    <Pagina>
      <Button
        component={LinkRouter}
        to={`/metas?ciclo=${ciclo.id}`}
        startIcon={<ArrowBackIcon />}
        sx={{ mb: 1, ml: -1 }}
      >
        Metas de {ciclo.ano}
      </Button>
      <CabecalhoPagina
        titulo={titulo}
        descricao={
          somenteLeitura
            ? `O ciclo ${String(ciclo.ano)} está encerrado: a meta fica só para consulta.`
            : meta?.temLancamentos === true
              ? 'Esta meta já tem lançamentos. Alterações ficam no histórico e recalculam os resultados.'
              : undefined
        }
      />

      {/* Partes da meta: a mãe e as submetas, com a soma dos pesos internos ao vivo. */}
      <Box
        sx={{
          p: 1.5,
          mb: 3,
          border: `1px solid ${CORES.borda}`,
          borderRadius: 3,
          bgcolor: CORES.branco,
        }}
      >
        <Stack
          direction="row"
          useFlexGap
          spacing={1}
          sx={{ flexWrap: 'wrap', alignItems: 'center' }}
          role="group"
          aria-label="Partes da meta"
        >
          <ChipParte
            rotulo={
              valores.raiz.codigo.trim() === ''
                ? 'Meta principal'
                : valores.raiz.codigo.toUpperCase()
            }
            ativo={base === 'raiz'}
            aoClicar={() => {
              setBase('raiz');
            }}
          />
          {submetas.map((s, i) => (
            <ChipParte
              key={s.id ?? `nova-${String(i)}`}
              rotulo={s.codigo.trim() === '' ? `Submeta ${String(i + 1)}` : s.codigo.toUpperCase()}
              detalhe={s.pesoInterno.trim() === '' ? undefined : `${s.pesoInterno}%`}
              ativo={base === baseSubmeta(i)}
              inativa={!s.ativo}
              aoClicar={() => {
                setBase(baseSubmeta(i));
              }}
            />
          ))}
          {!somenteLeitura && (
            <Button size="small" startIcon={<AddIcon />} onClick={adicionarSubmeta}>
              Submeta
            </Button>
          )}
        </Stack>
        {submetas.length > 0 && (
          <Typography
            variant="body2"
            role="status"
            sx={{ mt: 1, fontWeight: 600, color: somaFecha ? 'success.main' : 'warning.dark' }}
          >
            Pesos internos: {formatarNumero(soma.toFixed())}% de 100,00%
            {somaFecha
              ? '.'
              : soma.lt(100)
                ? `. Faltam ${formatarNumero(new Decimal(100).minus(soma).toFixed())}%.`
                : `. Passou ${formatarNumero(soma.minus(100).toFixed())}%.`}
          </Typography>
        )}
      </Box>

      {largo ? (
        <Stepper nonLinear activeStep={etapa} alternativeLabel sx={{ mb: 3 }}>
          {ETAPAS.map((e, i) => (
            <Step key={e.titulo} completed={false}>
              <StepButton
                onClick={() => {
                  setEtapa(i);
                }}
              >
                {e.titulo}
              </StepButton>
            </Step>
          ))}
        </Stepper>
      ) : (
        <Typography sx={{ mb: 2, fontWeight: 600, color: CORES.marinho }}>
          Etapa {etapa + 1} de {ETAPAS.length}: {ETAPAS[etapa]?.titulo}
        </Typography>
      )}

      <Box
        sx={{
          display: 'grid',
          gap: 3,
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 320px' },
          alignItems: 'start',
        }}
      >
        <Box
          component="form"
          noValidate
          onSubmit={(evento) => void enviar(evento)}
          aria-label={`${ETAPAS[etapa]?.titulo ?? ''} de ${base === 'raiz' ? 'meta principal' : 'submeta'}`}
        >
          <Box
            sx={{
              p: { xs: 2, sm: 3 },
              border: `1px solid ${CORES.borda}`,
              borderRadius: 3,
              bgcolor: CORES.branco,
            }}
          >
            <Etapa key={base} form={form} base={base} contexto={contexto} />
          </Box>

          {erros.length > 0 && (
            <Alert severity="error" sx={{ mt: 2 }} role="alert">
              <Box component="ul" sx={{ m: 0, pl: 2 }}>
                {erros.map((e, i) => (
                  <li key={`${e.onde}-${String(i)}`}>
                    <strong>{e.onde}</strong>: {e.mensagem}
                  </li>
                ))}
              </Box>
              {conflito && (
                <Button
                  size="small"
                  sx={{ mt: 1 }}
                  onClick={() => {
                    window.location.reload();
                  }}
                >
                  Recarregar a versão atual
                </Button>
              )}
            </Alert>
          )}

          <Stack
            direction={{ xs: 'column-reverse', sm: 'row' }}
            spacing={1.5}
            sx={{ mt: 2, justifyContent: 'space-between' }}
          >
            <Stack direction="row" spacing={1}>
              <Button
                disabled={etapa === 0}
                onClick={() => {
                  setEtapa((e) => e - 1);
                }}
              >
                Voltar
              </Button>
              {etapa < ETAPAS.length - 1 && (
                <Button
                  variant="outlined"
                  onClick={() => {
                    setEtapa((e) => e + 1);
                  }}
                >
                  Próxima: {ETAPAS[etapa + 1]?.titulo}
                </Button>
              )}
            </Stack>
            <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
              {indiceSubmeta !== null && !somenteLeitura && (
                <Button
                  color="error"
                  startIcon={<DeleteOutlinedIcon />}
                  onClick={() => {
                    setRemovendo(indiceSubmeta);
                  }}
                >
                  Remover submeta
                </Button>
              )}
              {!somenteLeitura && (
                <Button type="submit" variant="contained" loading={salvar.isPending}>
                  {meta === null ? 'Cadastrar meta' : 'Salvar meta'}
                </Button>
              )}
            </Stack>
          </Stack>
        </Box>

        <Box
          component="aside"
          aria-label="Resumo da meta"
          sx={{
            p: 2.5,
            borderRadius: 3,
            bgcolor: CORES.marinho,
            color: CORES.branco,
            position: { lg: 'sticky' },
            top: { lg: 88 },
          }}
        >
          <Typography variant="h3" sx={{ fontSize: 16, mb: 1, color: CORES.turquesa }}>
            {base === 'raiz' ? 'Resumo da meta' : 'Resumo da submeta'}
          </Typography>
          <Typography sx={{ lineHeight: 1.6 }} aria-live="polite">
            {base === 'raiz' && submetas.length > 0 && valores.soAgrega
              ? FRASE_SO_AGREGA
              : item === undefined
                ? ''
                : fraseBateQuando(item)}
          </Typography>
          {base === 'raiz' && (
            <Typography sx={{ mt: 1.5, lineHeight: 1.6, opacity: 0.9 }}>
              {fraseVale(
                valores.regraPontuacao,
                valores.raiz.operador,
                valores.atribuicoes
                  .filter((a) => a.usuarioId !== '')
                  .map((a) => ({ nome: nomeGestor(a.usuarioId), peso: a.peso })),
              )}
            </Typography>
          )}
        </Box>
      </Box>

      <DialogoConfirmacao
        aberto={removendo !== null}
        titulo="Remover submeta?"
        mensagem={`A submeta ${
          removendo === null ? '' : (submetas[removendo]?.codigo.toUpperCase() ?? '')
        } sai desta meta ao salvar. Se ela já tiver lançamentos, a API recusa: nesse caso, inative-a.`}
        rotuloConfirmar="Remover submeta"
        enviando={false}
        erro={null}
        aoCancelar={() => {
          setRemovendo(null);
        }}
        aoConfirmar={() => {
          if (removendo === null) return;
          const restantes = submetas.filter((_s, i) => i !== removendo);
          setBase('raiz');
          form.setValue('submetas', restantes, { shouldDirty: true });
          if (restantes.length === 0) form.setValue('soAgrega', false);
          setRemovendo(null);
        }}
      />
    </Pagina>
  );
}

function ChipParte(props: {
  rotulo: string;
  detalhe?: string;
  ativo: boolean;
  inativa?: boolean;
  aoClicar: () => void;
}) {
  return (
    <Chip
      label={props.detalhe === undefined ? props.rotulo : `${props.rotulo} (${props.detalhe})`}
      aria-pressed={props.ativo}
      onClick={props.aoClicar}
      translate="no"
      sx={{
        height: 40,
        px: 0.5,
        fontWeight: 600,
        textDecoration: props.inativa === true ? 'line-through' : undefined,
        bgcolor: props.ativo ? CORES.marinho : CORES.espuma,
        color: props.ativo ? CORES.branco : CORES.marinho,
        border: `1px solid ${props.ativo ? CORES.marinho : CORES.borda}`,
        '&:hover': { bgcolor: props.ativo ? CORES.marinho : CORES.turquesaClaro },
      }}
    />
  );
}

/** Problema do schema com o nome da parte da meta e do campo. */
function descrever(
  caminho: readonly PropertyKey[],
  mensagem: string,
  dados: FormularioMeta,
): ProblemaFormulario {
  const [primeiro, segundo, terceiro] = caminho;
  if (primeiro === 'submetas' && typeof segundo === 'number') {
    const submeta = dados.submetas[segundo];
    const onde =
      submeta === undefined || submeta.codigo.trim() === ''
        ? `Submeta ${String(segundo + 1)}`
        : submeta.codigo.toUpperCase();
    const campo = typeof terceiro === 'string' ? ROTULO_CAMPO[terceiro] : undefined;
    return { onde, mensagem: campo === undefined ? mensagem : `${campo}: ${mensagem}` };
  }
  const onde = dados.raiz.codigo.trim() === '' ? 'Meta principal' : dados.raiz.codigo.toUpperCase();
  const campo = typeof primeiro === 'string' ? ROTULO_CAMPO[primeiro] : undefined;
  return { onde, mensagem: campo === undefined ? mensagem : `${campo}: ${mensagem}` };
}

/** Erros da API em linhas legíveis (fórmulas e validação do motor vêm em `detalhes.erros`). */
function errosDaApi(erro: unknown): ProblemaFormulario[] {
  if (!(erro instanceof ErroApi)) return [{ onde: 'Erro', mensagem: mensagemDeErro(erro) }];
  const lista = erro.detalhes.erros;
  if (Array.isArray(lista) && lista.length > 0) {
    return (lista as { meta?: unknown; mensagem?: unknown }[]).map((e) => ({
      onde: typeof e.meta === 'string' ? e.meta : 'Meta',
      mensagem: typeof e.mensagem === 'string' ? e.mensagem : erro.mensagem,
    }));
  }
  const campos = erro.detalhes.campos;
  if (Array.isArray(campos) && campos.length > 0) {
    return (campos as { campo?: unknown; mensagem?: unknown }[]).map((c) => ({
      onde:
        typeof c.campo === 'string'
          ? (ROTULO_CAMPO[c.campo.split('.')[0] ?? ''] ?? c.campo)
          : 'Meta',
      mensagem: typeof c.mensagem === 'string' ? c.mensagem : erro.mensagem,
    }));
  }
  return [
    {
      onde: erro.codigo === CodigoErro.CONFLITO_VERSAO ? 'Versão' : 'Meta',
      mensagem: erro.mensagem,
    },
  ];
}
