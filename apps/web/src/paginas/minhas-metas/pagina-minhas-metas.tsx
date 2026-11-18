import {
  Alert,
  Box,
  ButtonBase,
  Card,
  CardContent,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import {
  Bloco,
  type MetaDoGestor,
  type NotasGestor,
  type ResultadosGestor,
  StatusCiclo,
} from '@metas/tipos';
import { Link as RouterLink, useSearchParams } from 'react-router';

import { mensagemDeErro } from '../../api/erro-api';
import { useResultadosGestor } from '../../api/resultados';
import { useSessao } from '../../api/sessao';
import { CORES, transparente } from '../../app/tema';
import { CabecalhoPagina, CabecalhoSecao } from '../../componentes/cabecalho-pagina';
import { NivelAgua } from '../../componentes/nivel-agua';
import { Pagina } from '../../componentes/pagina';
import { SeletorCiclo } from '../../componentes/seletor-ciclo';
import { SituacaoMeta } from '../../componentes/situacao-meta';
import { formatarNumero, formatarPercentual, formatarValor } from '../../formatacao';
import { formatarPeso, resumoNota, textoObjetivo, textoPontos } from './exibicao';

const NOME_BLOCO: Readonly<Record<Bloco, string>> = {
  CORPORATIVO: 'Corporativo',
  DEPARTAMENTAL: 'Departamental',
};

/**
 * Minhas metas (especificação 10.2, P20): a nota por bloco e total e as metas do gestor com
 * acumulado, atendimento, pontos e situação. Abre no ciclo ativo; o seletor de ano mostra os
 * encerrados, com a nota congelada (decisão de 13/11/2026).
 */
export function PaginaMinhasMetas() {
  const { data: sessao } = useSessao();
  const [parametros, setParametros] = useSearchParams();
  const cicloPedido = parametros.get('ciclo') ?? undefined;
  const consulta = useResultadosGestor(sessao?.usuario.id, cicloPedido);
  const dados = consulta.data;

  return (
    <Pagina>
      <CabecalhoPagina
        titulo="Minhas metas"
        descricao={dados?.ciclo == null ? undefined : descricaoDoCiclo(dados)}
      />
      {consulta.isError ? (
        <Alert severity="error">{mensagemDeErro(consulta.error)}</Alert>
      ) : dados === undefined ? (
        <Stack spacing={2} aria-busy="true" aria-label="Carregando as metas…">
          <Skeleton variant="rounded" height={140} />
          <Skeleton variant="rounded" height={260} />
        </Stack>
      ) : dados.ciclo === null ? (
        <Alert severity="info">
          Você ainda não tem metas num ciclo ativo. Quando o Administrador ativar o ciclo, elas
          aparecem aqui.
        </Alert>
      ) : (
        <Stack spacing={4}>
          {dados.ciclos.length > 1 && (
            <SeletorCiclo
              ciclos={dados.ciclos}
              selecionado={dados.ciclo.id}
              aoEscolher={(id) => {
                setParametros({ ciclo: id }, { replace: true });
              }}
            />
          )}
          {dados.notas !== null && (
            <CartaoNota
              notas={dados.notas}
              congelada={dados.ciclo.status === StatusCiclo.ENCERRADO}
            />
          )}
          {dados.metas.length === 0 ? (
            <Alert severity="info">Nenhuma meta atribuída a você neste ciclo.</Alert>
          ) : (
            [Bloco.CORPORATIVO, Bloco.DEPARTAMENTAL].map((bloco) => {
              const metas = dados.metas.filter((m) => m.bloco === bloco);
              if (metas.length === 0) return null;
              const nota =
                bloco === Bloco.CORPORATIVO ? dados.notas?.corporativo : dados.notas?.departamental;
              return <SecaoBloco key={bloco} bloco={bloco} metas={metas} nota={nota ?? null} />;
            })
          )}
        </Stack>
      )}
    </Pagina>
  );
}

function descricaoDoCiclo(dados: ResultadosGestor): string {
  const ano = String(dados.ciclo?.ano ?? '');
  return dados.ciclo?.status === StatusCiclo.ENCERRADO
    ? `Ciclo ${ano}, encerrado: a nota final ficou congelada.`
    : `Ciclo ${ano}. A nota é parcial: usa os meses lançados até agora.`;
}

// --- Nota ----------------------------------------------------------------------------------------

function CartaoNota(props: { readonly notas: NotasGestor; readonly congelada: boolean }) {
  const resumo = resumoNota(props.notas);
  return (
    <Card component="section" aria-labelledby="titulo-nota">
      <CardContent
        sx={{
          p: { xs: 2.5, sm: 3 },
          display: 'grid',
          gap: 3,
          gridTemplateColumns: { xs: '1fr', md: 'auto 1fr' },
          alignItems: 'center',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2.5 }}>
          <NivelAgua nivel={resumo.nivel} largura={112} />
          <Box>
            <Typography id="titulo-nota" variant="h2" sx={{ mb: 1 }}>
              {props.congelada ? 'Nota final' : 'Nota parcial'}
            </Typography>
            <Typography
              component="p"
              sx={{
                color: CORES.marinho,
                fontWeight: 300,
                fontSize: { xs: '2.75rem', sm: '3.25rem' },
                lineHeight: 0.95,
                letterSpacing: '-0.02em',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {resumo.total}
              <Box
                component="span"
                sx={{
                  ml: 1,
                  fontSize: '0.9375rem',
                  fontWeight: 500,
                  letterSpacing: 0,
                  color: CORES.textoSecundario,
                }}
              >
                de {resumo.peso} pontos
              </Box>
            </Typography>
          </Box>
        </Box>
        <Box
          component="dl"
          sx={{
            m: 0,
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
          }}
        >
          {resumo.blocos.map((b) => (
            <Box key={b.nome}>
              <Typography component="dt" variant="body2" color="text.secondary">
                {b.nome}
              </Typography>
              <Typography
                component="dd"
                sx={{
                  m: 0,
                  fontWeight: 700,
                  color: CORES.marinho,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {b.pontos} de {b.peso}
              </Typography>
              <Barra largura={b.largura} />
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
}

/** Quanto do bloco já foi conquistado. Decorativa: o número vem escrito acima. */
function Barra(props: { readonly largura: string }) {
  return (
    <Box aria-hidden sx={{ mt: 1, height: 6, borderRadius: 3, bgcolor: CORES.turquesaClaro }}>
      <Box
        sx={{
          width: `${props.largura}%`,
          height: '100%',
          borderRadius: 3,
          bgcolor: CORES.turquesa,
        }}
      />
    </Box>
  );
}

// --- Metas de um bloco ---------------------------------------------------------------------------

function SecaoBloco(props: {
  readonly bloco: Bloco;
  readonly metas: readonly MetaDoGestor[];
  readonly nota: { readonly peso: string; readonly pontos: string } | null;
}) {
  const id = `bloco-${props.bloco.toLowerCase()}`;
  return (
    <Box component="section" aria-labelledby={id}>
      <CabecalhoSecao
        id={id}
        titulo={NOME_BLOCO[props.bloco]}
        descricao={
          props.nota === null
            ? undefined
            : `${formatarNumero(props.nota.pontos)} de ${formatarPeso(props.nota.peso)} pontos`
        }
      />
      <Stack component="ul" spacing={1.5} sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {props.metas.map((meta) => (
          <li key={meta.metaId}>
            <LinhaMeta meta={meta} />
          </li>
        ))}
      </Stack>
    </Box>
  );
}

function LinhaMeta({ meta }: { readonly meta: MetaDoGestor }) {
  const r = meta.resultado;
  return (
    <ButtonBase
      component={RouterLink}
      to={`/minhas-metas/${meta.metaId}`}
      aria-label={meta.indicador}
      sx={{
        width: '100%',
        display: 'grid',
        textAlign: 'left',
        gap: { xs: 1.5, md: 2 },
        gridTemplateColumns: {
          xs: '1fr 1fr',
          md: 'minmax(0, 2.2fr) repeat(4, minmax(0, 1fr)) 7.5rem',
        },
        alignItems: 'center',
        p: 2,
        borderRadius: 3,
        border: `1px solid ${CORES.borda}`,
        bgcolor: CORES.branco,
        transitionProperty: 'border-color, background-color',
        transitionDuration: '150ms',
        '&:hover': { borderColor: CORES.azul, bgcolor: transparente(CORES.turquesaClaro, 45) },
      }}
    >
      <Box sx={{ gridColumn: { xs: '1 / -1', md: 'auto' }, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, color: CORES.marinho, overflowWrap: 'anywhere' }}>
          {meta.indicador}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {meta.setorNome}
        </Typography>
      </Box>
      <Valor rotulo="Acumulado" valor={formatarValor(r?.acumulado, meta.unidade)} />
      <Valor
        rotulo="Objetivo"
        valor={textoObjetivo(meta.operador, r?.objetivo ?? null, meta.tolerancia, meta.unidade)}
      />
      <Valor
        rotulo="Atendimento"
        valor={r === null ? formatarPercentual(null) : formatarPercentual(r.atendimento)}
      />
      <Valor rotulo="Pontos" valor={textoPontos(meta.pontos, meta.peso)} />
      <Box sx={{ gridColumn: { xs: '1 / -1', md: 'auto' }, justifySelf: { md: 'end' } }}>
        <SituacaoMeta situacao={r?.situacao ?? 'SEM_DADOS'} />
      </Box>
    </ButtonBase>
  );
}

function Valor(props: { readonly rotulo: string; readonly valor: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="body2" color="text.secondary">
        {props.rotulo}
      </Typography>
      <Typography
        sx={{ fontWeight: 600, color: CORES.grafite, fontVariantNumeric: 'tabular-nums' }}
      >
        {props.valor}
      </Typography>
    </Box>
  );
}
