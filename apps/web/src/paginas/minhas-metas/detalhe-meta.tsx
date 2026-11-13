import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Bloco,
  CodigoErro,
  type MemoriaCalculo,
  type ResultadoMes,
  type ResultadoMeta,
  type Unidade,
  type VariavelDoResultado,
} from '@metas/tipos';
import type { ReactNode } from 'react';
import { Link as RouterLink, useParams } from 'react-router';

import { mensagemDeErro } from '../../api/erro-api';
import { useResultadoMeta } from '../../api/resultados';
import { ROTULO_ACUMULACAO, ROTULO_MODO_APURACAO } from '../../app/rotulos';
import { CORES } from '../../app/tema';
import { CabecalhoSecao } from '../../componentes/cabecalho-pagina';
import { Pagina } from '../../componentes/pagina';
import { SituacaoMeta } from '../../componentes/situacao-meta';
import { formatarPercentual, formatarValor, nomeMes, VAZIO } from '../../formatacao';
import {
  explicacaoPontos,
  mesCurto,
  origemDoObjetivo,
  textoAviso,
  textoObjetivo,
  textoPeriodo,
  textoPontos,
} from './exibicao';

/**
 * Detalhe de uma meta (especificação 10.2, RF-38): resultado mês a mês, submetas e memória de
 * cálculo, com os números gravados pela API (os mesmos da nota).
 */
export function DetalheMeta() {
  const { id } = useParams();
  const consulta = useResultadoMeta(id);
  const meta = consulta.data;

  return (
    <Pagina>
      <Button
        component={RouterLink}
        to={meta === undefined ? '/minhas-metas' : `/minhas-metas?ciclo=${meta.ciclo.id}`}
        startIcon={<ArrowBackIcon />}
        sx={{ mb: 2, ml: -1 }}
      >
        Minhas metas
      </Button>
      {consulta.isError ? (
        <Alert severity={consulta.error.codigo === CodigoErro.NAO_ENCONTRADO ? 'info' : 'error'}>
          {mensagemDeErro(consulta.error)}
        </Alert>
      ) : meta === undefined ? (
        <Stack spacing={2} aria-busy="true" aria-label="Carregando a meta…">
          <Skeleton variant="rounded" height={120} />
          <Skeleton variant="rounded" height={320} />
        </Stack>
      ) : (
        <Conteudo meta={meta} />
      )}
    </Pagina>
  );
}

function Conteudo({ meta }: { readonly meta: ResultadoMeta }) {
  const r = meta.resultado;
  const memoria = meta.memoria;
  return (
    <Stack spacing={4}>
      <Box>
        <Typography variant="h1" sx={{ color: CORES.marinho, overflowWrap: 'anywhere' }}>
          {meta.indicador}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.75 }}>
          {meta.setorNome}, bloco{' '}
          {meta.bloco === Bloco.CORPORATIVO ? 'Corporativo' : 'Departamental'}. Ciclo{' '}
          {String(meta.ciclo.ano)}.
        </Typography>
      </Box>

      <Card component="section" aria-label="Resumo">
        <CardContent
          component="dl"
          sx={{
            m: 0,
            p: { xs: 2.5, sm: 3 },
            display: 'grid',
            gap: 2.5,
            gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(5, auto)' },
            justifyContent: { md: 'space-between' },
            alignItems: 'end',
          }}
        >
          {meta.formula !== null && (
            <Dado rotulo="Acumulado" valor={formatarValor(r?.acumulado, meta.unidade)} />
          )}
          {meta.formula !== null && (
            <Dado
              rotulo="Objetivo"
              valor={textoObjetivo(
                meta.operador,
                r?.objetivo ?? null,
                memoria?.tolerancia ?? null,
                meta.unidade,
              )}
            />
          )}
          <Dado
            rotulo={meta.submetas.length > 0 ? 'Atendimento composto' : 'Atendimento'}
            valor={formatarPercentual(r?.atendimento)}
          />
          {meta.atribuicoes.length === 1 && meta.atribuicoes[0] !== undefined && (
            <Dado
              rotulo="Pontos"
              valor={textoPontos(meta.atribuicoes[0].pontos, meta.atribuicoes[0].peso)}
            />
          )}
          <Box sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }}>
            <Typography component="dt" variant="body2" color="text.secondary">
              Situação
            </Typography>
            <Box component="dd" sx={{ m: 0, mt: 0.5 }}>
              <SituacaoMeta situacao={r?.situacao ?? 'SEM_DADOS'} />
            </Box>
          </Box>
        </CardContent>
      </Card>

      {meta.atribuicoes.length > 1 && (
        <Box component="section" aria-labelledby="titulo-pontos">
          <CabecalhoSecao
            id="titulo-pontos"
            titulo="Pontos de cada gestor"
            descricao="Meta corporativa: um resultado, e cada gestor recebe pontos pelo próprio peso."
          />
          <Stack component="ul" spacing={1} sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {meta.atribuicoes.map((a) => (
              <Box component="li" key={a.usuarioId} sx={{ display: 'flex', gap: 1 }}>
                <Typography sx={{ fontWeight: 600 }}>{a.usuarioNome}:</Typography>
                <Typography sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {textoPontos(a.pontos, a.peso)} pontos
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      )}

      {meta.formula !== null && (
        <MesAMes mensal={meta.mensal} unidade={meta.unidade} ano={meta.ciclo.ano} />
      )}

      {meta.submetas.length > 0 && (
        <Box component="section" aria-labelledby="titulo-submetas">
          <CabecalhoSecao
            id="titulo-submetas"
            titulo="Submetas"
            descricao="O atendimento da meta é a soma do atendimento de cada parte vezes o peso dela."
          />
          <TabelaRolavel rotulo="Submetas">
            <TableHead>
              <TableRow>
                <TableCell>Submeta</TableCell>
                <TableCell align="right">Peso</TableCell>
                <TableCell align="right">Acumulado</TableCell>
                <TableCell align="right">Atendimento</TableCell>
                <TableCell>Situação</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {meta.submetas.map((s) => (
                <TableRow key={s.metaId}>
                  <TableCell sx={{ minWidth: 160 }}>{s.indicador}</TableCell>
                  <TableCell align="right">{formatarPercentual(s.pesoInterno)}</TableCell>
                  <TableCell align="right">
                    {formatarValor(s.resultado?.acumulado, s.unidade)}
                  </TableCell>
                  <TableCell align="right">
                    {formatarPercentual(s.resultado?.atendimento)}
                  </TableCell>
                  <TableCell>
                    <SituacaoMeta situacao={s.resultado?.situacao ?? 'SEM_DADOS'} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </TabelaRolavel>
        </Box>
      )}

      {memoria !== null && <Memoria meta={meta} memoria={memoria} />}
    </Stack>
  );
}

function Dado(props: { readonly rotulo: string; readonly valor: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography component="dt" variant="body2" color="text.secondary">
        {props.rotulo}
      </Typography>
      <Typography
        component="dd"
        sx={{
          m: 0,
          fontWeight: 700,
          fontSize: '1.125rem',
          color: CORES.marinho,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {props.valor}
      </Typography>
    </Box>
  );
}

/** Tabela que rola sozinha na horizontal no celular, sem rolar a página. */
function TabelaRolavel(props: { readonly rotulo: string; readonly children: ReactNode }) {
  return (
    <Box
      sx={{
        overflowX: 'auto',
        border: `1px solid ${CORES.borda}`,
        borderRadius: 3,
        bgcolor: CORES.branco,
      }}
    >
      <Table
        size="small"
        aria-label={props.rotulo}
        sx={{ '& td, & th': { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' } }}
      >
        {props.children}
      </Table>
    </Box>
  );
}

// --- Mês a mês -----------------------------------------------------------------------------------

function MesAMes(props: {
  readonly mensal: readonly ResultadoMes[];
  readonly unidade: Unidade;
  readonly ano: number;
}) {
  // No celular, mês abreviado e sem a coluna Objetivo (ela já está no resumo): as 3 colunas
  // cabem em 360 px sem rolar.
  const largo = useMediaQuery(useTheme().breakpoints.up('sm'), { noSsr: true });
  return (
    <Box component="section" aria-labelledby="titulo-mes-a-mes">
      <CabecalhoSecao
        id="titulo-mes-a-mes"
        titulo="Mês a mês"
        descricao="Meses fora do período da meta aparecem como histórico e não contam na nota."
      />
      <TabelaRolavel rotulo="Resultado mês a mês">
        <TableHead>
          <TableRow>
            <TableCell>Mês</TableCell>
            <TableCell align="right">Resultado</TableCell>
            {largo && <TableCell align="right">Objetivo</TableCell>}
            <TableCell>Situação</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {props.mensal.map((m) => (
            <TableRow
              key={m.mes}
              sx={m.foraPeriodo ? { '& td': { color: CORES.textoSecundario } } : undefined}
            >
              <TableCell component="th" scope="row">
                {largo
                  ? nomeMes(m.mes, props.ano)
                  : `${mesCurto(m.mes)}/${String(props.ano).slice(2)}`}
              </TableCell>
              <TableCell align="right">{formatarValor(m.resultado, props.unidade)}</TableCell>
              {largo && (
                <TableCell align="right">{formatarValor(m.objetivo, props.unidade)}</TableCell>
              )}
              <TableCell>
                {m.foraPeriodo ? (
                  largo ? (
                    'Histórico (fora do período)'
                  ) : (
                    'Histórico'
                  )
                ) : m.aviso === 'DIVISAO_POR_ZERO' ? (
                  'Divisão por zero'
                ) : m.resultado === null || m.situacao === null ? (
                  VAZIO
                ) : (
                  <SituacaoMeta situacao={m.situacao} />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </TabelaRolavel>
    </Box>
  );
}

// --- Memória de cálculo --------------------------------------------------------------------------

function Memoria(props: { readonly meta: ResultadoMeta; readonly memoria: MemoriaCalculo }) {
  const { meta, memoria } = props;
  const meses = Array.from(
    { length: memoria.periodo.mesFim - memoria.periodo.mesInicio + 1 },
    (_, i) => memoria.periodo.mesInicio + i,
  );
  const porId = new Map(meta.variaveis.map((v) => [v.id, v]));
  const agregaResultados = memoria.modoApuracao !== 'FORMULA_SOBRE_ACUMULADOS';
  const nomeComponente = (metaId: string, proprio: boolean) =>
    proprio
      ? 'Resultado próprio da meta'
      : (meta.submetas.find((s) => s.metaId === metaId)?.indicador ?? 'Submeta');

  return (
    <Box component="section" aria-labelledby="titulo-memoria">
      <CabecalhoSecao
        id="titulo-memoria"
        titulo="Como foi calculado"
        descricao="A memória de cálculo: os valores usados, a fórmula, o objetivo e a pontuação."
      />
      <Card>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Stack spacing={3}>
            <Box component="dl" sx={{ m: 0, display: 'grid', gap: 1.5 }}>
              <Linha rotulo="Período" valor={textoPeriodo(memoria.periodo)} />
              <Linha rotulo="Apuração" valor={ROTULO_MODO_APURACAO[memoria.modoApuracao]} />
              {memoria.formula !== null && (
                <Linha rotulo="Fórmula" valor={memoria.formula} codigo />
              )}
            </Box>

            {memoria.variaveis.length > 0 && (
              <TabelaRolavel rotulo="Valores usados no cálculo">
                <TableHead>
                  <TableRow>
                    <TableCell>Variável</TableCell>
                    {!agregaResultados && <TableCell>Acumulação</TableCell>}
                    {!agregaResultados && <TableCell align="right">Acumulado</TableCell>}
                    {meses.map((m) => (
                      <TableCell key={m} align="right">
                        {mesCurto(m)}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {memoria.variaveis.map((v) => {
                    const variavel = v.variavelId === null ? undefined : porId.get(v.variavelId);
                    return (
                      <TableRow key={v.chave}>
                        <TableCell component="th" scope="row">
                          <Box sx={{ fontWeight: 600 }}>{variavel?.nome ?? v.chave}</Box>
                          <Box sx={{ fontSize: 12, color: CORES.textoSecundario }}>{v.chave}</Box>
                        </TableCell>
                        {!agregaResultados && (
                          <TableCell>
                            {v.acumulacao === null ? VAZIO : ROTULO_ACUMULACAO[v.acumulacao]}
                          </TableCell>
                        )}
                        {!agregaResultados && (
                          <TableCell align="right" sx={{ fontWeight: 700 }}>
                            {valorDaVariavel(v.acumulado, variavel)}
                          </TableCell>
                        )}
                        {meses.map((m) => (
                          <TableCell key={m} align="right">
                            {valorDaVariavel(
                              v.valores.find((x) => x.mes === m)?.valor ?? null,
                              variavel,
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                  {agregaResultados && memoria.resultadosMensais.length > 0 && (
                    <TableRow>
                      <TableCell component="th" scope="row" sx={{ fontWeight: 700 }}>
                        Resultado do mês
                      </TableCell>
                      {meses.map((m) => (
                        <TableCell key={m} align="right" sx={{ fontWeight: 700 }}>
                          {formatarValor(
                            memoria.resultadosMensais.find((x) => x.mes === m)?.resultado,
                            meta.unidade,
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  )}
                </TableBody>
              </TabelaRolavel>
            )}

            {memoria.componentes !== null && (
              <TabelaRolavel rotulo="Composição do atendimento">
                <TableHead>
                  <TableRow>
                    <TableCell>Parte</TableCell>
                    <TableCell align="right">Peso</TableCell>
                    <TableCell align="right">Atendimento</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {memoria.componentes.map((c) => (
                    <TableRow key={`${c.metaId}-${String(c.proprio)}`}>
                      <TableCell component="th" scope="row">
                        {nomeComponente(c.metaId, c.proprio)}
                      </TableCell>
                      <TableCell align="right">{formatarPercentual(c.pesoInterno)}</TableCell>
                      <TableCell align="right">{formatarPercentual(c.atendimento)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </TabelaRolavel>
            )}

            <Box component="dl" sx={{ m: 0, display: 'grid', gap: 1.5 }}>
              {memoria.formula !== null && (
                <Linha
                  rotulo="Resultado do período"
                  valor={formatarValor(memoria.resultado, meta.unidade)}
                />
              )}
              {memoria.formula !== null && (
                <Linha
                  rotulo="Objetivo usado"
                  valor={`${textoObjetivo(
                    memoria.operador,
                    memoria.objetivo,
                    memoria.tolerancia,
                    meta.unidade,
                  )} (${origemDoObjetivo(memoria.mesObjetivo)})`}
                />
              )}
              <Linha rotulo="Atendimento" valor={formatarPercentual(memoria.atendimento)} />
              {meta.atribuicoes.map((a) => (
                <Linha
                  key={a.usuarioId}
                  rotulo={meta.atribuicoes.length > 1 ? `Pontos de ${a.usuarioNome}` : 'Pontos'}
                  valor={explicacaoPontos(
                    memoria.regraPontuacao,
                    memoria.operador,
                    a.peso,
                    memoria.atendimento,
                    a.pontos,
                  )}
                />
              ))}
            </Box>

            {memoria.avisos.length > 0 && (
              <Alert severity="warning">
                {memoria.avisos.map((codigo) => (
                  <div key={codigo}>{textoAviso(codigo)}</div>
                ))}
              </Alert>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

function valorDaVariavel(valor: string | null, variavel: VariavelDoResultado | undefined): string {
  // Sem o tipo (variável de outro ciclo ou removida), o número aparece como foi gravado.
  return formatarValor(valor, variavel?.tipo ?? 'NUMERO');
}

function Linha(props: {
  readonly rotulo: string;
  readonly valor: string;
  readonly codigo?: boolean;
}) {
  return (
    <Box
      sx={{
        display: 'grid',
        gap: { xs: 0.25, sm: 2 },
        gridTemplateColumns: { xs: '1fr', sm: '11rem 1fr' },
      }}
    >
      <Typography component="dt" variant="body2" color="text.secondary">
        {props.rotulo}
      </Typography>
      <Typography
        component="dd"
        sx={{
          m: 0,
          fontWeight: 600,
          color: CORES.grafite,
          fontVariantNumeric: 'tabular-nums',
          overflowWrap: 'anywhere',
          ...(props.codigo === true
            ? { fontFamily: 'ui-monospace, Consolas, monospace', fontWeight: 500 }
            : {}),
        }}
      >
        {props.valor}
      </Typography>
    </Box>
  );
}
