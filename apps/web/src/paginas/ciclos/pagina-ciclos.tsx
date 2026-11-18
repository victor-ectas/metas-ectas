import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import { Alert, Box, Button, Link, Skeleton, Stack, Typography } from '@mui/material';
import {
  type Ciclo,
  type ConsistenciaCiclo,
  GravidadeProblema,
  Perfil,
  type PesosGestor,
  type ProblemaConsistencia,
  StatusCiclo,
  TipoProblema,
} from '@metas/tipos';
import { useState } from 'react';
import { Link as LinkRouter, useSearchParams } from 'react-router';

import { useAtivarCiclo, useConsistencia, useEncerrarCiclo } from '../../api/ciclos';
import { useCiclos } from '../../api/cadastros';
import { mensagemDeErro } from '../../api/erro-api';
import { useSessao } from '../../api/sessao';
import { plural } from '../../app/plural';
import { ROTULO_STATUS_CICLO } from '../../app/rotulos';
import { CORES } from '../../app/tema';
import { useAvisar } from '../../componentes/avisos';
import { CabecalhoPagina, CabecalhoSecao } from '../../componentes/cabecalho-pagina';
import { DialogoConfirmacao } from '../../componentes/dialogo-confirmacao';
import { type Coluna, ListaResponsiva } from '../../componentes/lista-responsiva';
import { Pagina } from '../../componentes/pagina';
import { cicloInicial, SeletorCiclo } from '../../componentes/seletor-ciclo';
import { formatarData, formatarNumero } from '../../formatacao';

/**
 * Ciclos e consistência (P15, especificação 9.1 e 10.2): o Administrador revisa os pesos de cada
 * gestor e os problemas do ciclo, ativa o ciclo quando nada bloqueia e o encerra depois do prazo
 * de dezembro. Quem decide é a API; a tela só mostra e pede confirmação.
 */
export function PaginaCiclos() {
  const sessao = useSessao();
  const ciclos = useCiclos();
  const [parametros, setParametros] = useSearchParams();
  const lista = ciclos.data ?? [];
  const ciclo = lista.find((c) => c.id === parametros.get('ciclo')) ?? cicloInicial(lista);

  if (sessao.data?.usuario.perfil !== Perfil.ADMIN) {
    return (
      <Pagina>
        <CabecalhoPagina titulo="Ciclos e consistência" />
        <Alert severity="info">Os ciclos são ativados e encerrados pelo Administrador.</Alert>
      </Pagina>
    );
  }

  return (
    <Pagina>
      <CabecalhoPagina
        titulo="Ciclos e consistência"
        descricao="Confira os pesos de cada gestor e o que falta acertar. O ciclo só é ativado quando nada impede."
      />
      {ciclos.isError ? (
        <Alert severity="error">{mensagemDeErro(ciclos.error)}</Alert>
      ) : ciclos.isPending ? (
        <Skeleton variant="rounded" height={44} width={240} />
      ) : ciclo === undefined ? (
        <Alert severity="info">
          Nenhum ciclo cadastrado. Crie o ciclo do ano em{' '}
          <Link component={LinkRouter} to="/cadastros?aba=ciclos">
            Cadastros → Ciclos e responsáveis
          </Link>
          .
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
          <PainelCiclo key={ciclo.id} ciclo={ciclo} />
        </>
      )}
    </Pagina>
  );
}

function PainelCiclo({ ciclo }: { readonly ciclo: Ciclo }) {
  const painel = useConsistencia(ciclo.id);

  if (painel.isError) return <Alert severity="error">{mensagemDeErro(painel.error)}</Alert>;
  if (painel.data === undefined) {
    return (
      <Stack spacing={2} aria-busy="true" aria-label="Conferindo o ciclo…">
        <Skeleton variant="rounded" height={140} />
        <Skeleton variant="rounded" height={200} />
      </Stack>
    );
  }
  const dados = painel.data;
  const bloqueios = dados.problemas.filter((p) => p.gravidade === GravidadeProblema.BLOQUEIA);
  const avisos = dados.problemas.filter((p) => p.gravidade === GravidadeProblema.AVISO);

  return (
    <Stack spacing={4}>
      <Situacao dados={dados} bloqueios={bloqueios.length} />
      <Pesos gestores={dados.gestores} />
      <section aria-labelledby="titulo-problemas">
        <CabecalhoSecao
          id="titulo-problemas"
          titulo="O que conferir"
          descricao="Os itens que impedem a ativação precisam ser resolvidos; os avisos ficam a seu critério."
        />
        {dados.problemas.length === 0 ? (
          <Alert severity="success" icon={<CheckCircleOutlinedIcon />}>
            Nenhum problema encontrado neste ciclo.
          </Alert>
        ) : (
          <Stack spacing={3}>
            {bloqueios.length > 0 && (
              <ListaProblemas
                titulo={`Impedem a ativação (${String(bloqueios.length)})`}
                problemas={bloqueios}
                cicloId={ciclo.id}
              />
            )}
            {avisos.length > 0 && (
              <ListaProblemas
                titulo={`Avisos (${String(avisos.length)})`}
                problemas={avisos}
                cicloId={ciclo.id}
              />
            )}
          </Stack>
        )}
      </section>
    </Stack>
  );
}

// --- Situação do ciclo e ações ---------------------------------------------------------------

const ETAPAS = [StatusCiclo.RASCUNHO, StatusCiclo.ATIVO, StatusCiclo.ENCERRADO] as const;

function Situacao({
  dados,
  bloqueios,
}: {
  readonly dados: ConsistenciaCiclo;
  readonly bloqueios: number;
}) {
  const { ciclo, encerramento } = dados;
  const [confirmando, setConfirmando] = useState<'ativar' | 'encerrar' | null>(null);
  const ativar = useAtivarCiclo();
  const encerrar = useEncerrarCiclo();
  const avisar = useAvisar();
  const ano = String(ciclo.ano);
  const acao = confirmando === 'encerrar' ? encerrar : ativar;

  let explicacao: string;
  if (ciclo.status === StatusCiclo.RASCUNHO) {
    explicacao =
      dados.motivoNaoAtivar ??
      (bloqueios > 0
        ? `${plural(bloqueios, 'item impede', 'itens impedem')} a ativação. Resolva e volte a esta tela.`
        : 'Tudo certo para ativar. Depois de ativo, os gestores lançam os meses abertos e as metas continuam editáveis, com histórico.');
  } else if (ciclo.status === StatusCiclo.ATIVO) {
    explicacao =
      encerramento.motivo ??
      `Dezembro fechou em ${formatarData(encerramento.dezembroFechaEm)}. O ciclo já pode ser encerrado.`;
  } else {
    explicacao = `Encerrado em ${formatarData(ciclo.encerradoEm)}. As notas estão congeladas e o ciclo não aceita mais alterações.`;
  }

  return (
    <Box
      component="section"
      aria-labelledby="titulo-situacao"
      sx={{
        p: { xs: 2, sm: 3 },
        bgcolor: CORES.branco,
        border: `1px solid ${CORES.borda}`,
        borderRadius: 3,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ minWidth: 0, maxWidth: '62ch' }}>
          <Typography id="titulo-situacao" variant="h2" sx={{ color: CORES.marinho }}>
            Ciclo {ano}: {ROTULO_STATUS_CICLO[ciclo.status].toLowerCase()}
          </Typography>
          <Box
            component="ol"
            aria-label="Etapas do ciclo"
            sx={{
              display: 'flex',
              gap: 1,
              p: 0,
              m: 0,
              mt: 1.5,
              listStyle: 'none',
              flexWrap: 'wrap',
            }}
          >
            {ETAPAS.map((etapa, i) => {
              const atual = etapa === ciclo.status;
              const feita = ETAPAS.indexOf(ciclo.status) > i;
              return (
                <Box
                  component="li"
                  key={etapa}
                  aria-current={atual ? 'step' : undefined}
                  sx={{
                    px: 1.25,
                    py: 0.25,
                    borderRadius: 999,
                    fontSize: 13,
                    fontWeight: 600,
                    bgcolor: atual ? CORES.marinho : feita ? CORES.turquesaClaro : 'transparent',
                    color: atual ? CORES.branco : CORES.textoSecundario,
                    border: `1px solid ${atual ? CORES.marinho : CORES.borda}`,
                  }}
                >
                  {ROTULO_STATUS_CICLO[etapa]}
                </Box>
              );
            })}
          </Box>
          <Typography color="text.secondary" sx={{ mt: 1.5 }} role="status">
            {explicacao}
          </Typography>
        </Box>

        {ciclo.status === StatusCiclo.RASCUNHO && (
          <Button
            variant="contained"
            disabled={!dados.podeAtivar}
            onClick={() => {
              ativar.reset();
              setConfirmando('ativar');
            }}
            sx={{ minHeight: 48 }}
          >
            Ativar ciclo {ano}
          </Button>
        )}
        {ciclo.status === StatusCiclo.ATIVO && (
          <Button
            variant="outlined"
            disabled={!encerramento.permitido}
            onClick={() => {
              encerrar.reset();
              setConfirmando('encerrar');
            }}
            sx={{ minHeight: 48 }}
          >
            Encerrar ciclo {ano}
          </Button>
        )}
      </Box>

      <DialogoConfirmacao
        aberto={confirmando !== null}
        titulo={confirmando === 'encerrar' ? `Encerrar o ciclo ${ano}?` : `Ativar o ciclo ${ano}?`}
        mensagem={
          confirmando === 'encerrar'
            ? `As notas de cada gestor serão calculadas e congeladas. Depois disso, o ciclo ${ano} não aceita mais lançamentos nem alterações. Não é possível desfazer.`
            : `Os gestores passam a lançar os meses abertos de ${ano}. Só um ciclo fica ativo por vez; para ativar o próximo, este precisa ser encerrado.`
        }
        rotuloConfirmar={confirmando === 'encerrar' ? 'Encerrar ciclo' : 'Ativar ciclo'}
        enviando={acao.isPending}
        erro={acao.isError ? mensagemDeErro(acao.error) : null}
        aoCancelar={() => {
          setConfirmando(null);
        }}
        aoConfirmar={() => {
          const encerrando = confirmando === 'encerrar';
          acao.mutate(ciclo.id, {
            onSuccess: () => {
              avisar(encerrando ? `Ciclo ${ano} encerrado.` : `Ciclo ${ano} ativado.`);
              setConfirmando(null);
            },
          });
        }}
      />
    </Box>
  );
}

// --- Pesos por gestor (RN-03) ----------------------------------------------------------------

function Fecha({ gestor }: { readonly gestor: PesosGestor }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        fontWeight: 600,
        fontSize: 14,
        color: gestor.ok ? CORES.marinho : CORES.alertaTexto,
        whiteSpace: 'nowrap',
      }}
    >
      {gestor.ok ? (
        <CheckCircleOutlinedIcon fontSize="small" sx={{ color: CORES.turquesa }} aria-hidden />
      ) : (
        <ErrorOutlinedIcon fontSize="small" aria-hidden />
      )}
      {gestor.ok ? 'Fecha' : 'Não fecha'}
    </Box>
  );
}

const COLUNAS_PESOS: readonly Coluna<PesosGestor>[] = [
  {
    titulo: 'Gestor',
    principal: true,
    valor: (g) => (
      <Box component="span" sx={{ fontWeight: 600 }}>
        {g.nome}
        {!g.ativo && (
          <Box component="span" sx={{ fontWeight: 400, color: 'text.secondary' }}>
            {' '}
            (inativo)
          </Box>
        )}
      </Box>
    ),
  },
  {
    titulo: 'Corporativo',
    valor: (g) => (g.comCorporativas ? `${formatarNumero(g.corporativo)} de 50` : '—'),
    alinhar: 'right',
    largura: 150,
  },
  {
    titulo: 'Departamental',
    valor: (g) => `${formatarNumero(g.departamental)} de ${g.comCorporativas ? '50' : '100'}`,
    alinhar: 'right',
    largura: 160,
  },
  {
    titulo: 'Total',
    valor: (g) => `${formatarNumero(g.total)} de 100`,
    alinhar: 'right',
    largura: 130,
  },
  { titulo: 'Situação', valor: (g) => <Fecha gestor={g} />, largura: 130 },
];

function Pesos({ gestores }: { readonly gestores: readonly PesosGestor[] }) {
  return (
    <section aria-labelledby="titulo-pesos">
      <CabecalhoSecao
        id="titulo-pesos"
        titulo="Pesos por gestor"
        descricao="Com metas corporativas, cada bloco soma 50 pontos; sem elas, o Departamental soma 100."
      />
      <ListaResponsiva
        rotulo="Pesos por gestor"
        itens={gestores}
        colunas={COLUNAS_PESOS}
        chave={(g) => g.usuarioId}
        vazio="Nenhuma meta atribuída a gestores neste ciclo ainda."
      />
    </section>
  );
}

// --- Problemas -------------------------------------------------------------------------------

/** Onde resolver cada problema. */
function destino(p: ProblemaConsistencia, cicloId: string): { para: string; rotulo: string } {
  if (p.metaId !== null)
    return { para: `/metas/${p.metaId}`, rotulo: `Abrir ${p.metaCodigo ?? 'meta'}` };
  switch (p.tipo) {
    case TipoProblema.VARIAVEL_SEM_RESPONSAVEL:
      return { para: '/variaveis', rotulo: 'Ir para Variáveis' };
    case TipoProblema.SETOR_SEM_RESPONSAVEL:
      return { para: '/cadastros?aba=ciclos', rotulo: 'Definir responsável' };
    case TipoProblema.USUARIO_INVALIDO:
      return p.variavelId !== null
        ? { para: '/variaveis', rotulo: 'Ir para Variáveis' }
        : { para: '/cadastros?aba=ciclos', rotulo: 'Definir responsável' };
    case TipoProblema.CICLO_SEM_METAS:
      return { para: `/metas/nova?ciclo=${cicloId}`, rotulo: 'Cadastrar meta' };
    default:
      return { para: `/metas?ciclo=${cicloId}`, rotulo: 'Ver metas' };
  }
}

function ListaProblemas(props: {
  readonly titulo: string;
  readonly problemas: readonly ProblemaConsistencia[];
  readonly cicloId: string;
}) {
  const bloqueia = props.problemas[0]?.gravidade === GravidadeProblema.BLOQUEIA;
  const Icone = bloqueia ? ErrorOutlinedIcon : ReportProblemOutlinedIcon;
  return (
    <Box>
      <Typography variant="h3" sx={{ color: CORES.marinho, mb: 1 }}>
        {props.titulo}
      </Typography>
      <Box
        component="ul"
        sx={{
          listStyle: 'none',
          p: 0,
          m: 0,
          bgcolor: CORES.branco,
          border: `1px solid ${CORES.borda}`,
          borderLeft: `4px solid ${bloqueia ? CORES.alertaPonto : CORES.turquesa}`,
          borderRadius: 2,
        }}
      >
        {props.problemas.map((p, i) => {
          const { para, rotulo } = destino(p, props.cicloId);
          return (
            <Box
              component="li"
              key={`${p.tipo}-${String(i)}`}
              sx={{
                // Celular: ícone + texto, e o link embaixo do texto; do sm em diante, numa linha só.
                display: 'grid',
                gridTemplateColumns: { xs: '20px 1fr', sm: '20px 1fr auto' },
                columnGap: 1.5,
                rowGap: 0.5,
                alignItems: 'start',
                px: 2,
                py: 1.5,
                borderTop: i === 0 ? 'none' : `1px solid ${CORES.borda}`,
              }}
            >
              <Icone
                fontSize="small"
                aria-hidden
                sx={{ mt: 0.25, color: bloqueia ? CORES.alertaPonto : CORES.azul }}
              />
              <Typography sx={{ minWidth: 0, overflowWrap: 'break-word' }}>{p.mensagem}</Typography>
              <Link
                component={LinkRouter}
                to={para}
                sx={{
                  gridColumn: { xs: 2, sm: 3 },
                  justifySelf: 'start',
                  whiteSpace: 'nowrap',
                  fontWeight: 600,
                }}
              >
                {rotulo}
              </Link>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
