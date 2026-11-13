import { Alert, Box, Button, Card, CardContent, Skeleton, Stack, Typography } from '@mui/material';
import { type MesPendente, StatusCiclo, StatusMes } from '@metas/tipos';
import { Link as RouterLink } from 'react-router';

import { mensagemDeErro } from '../api/erro-api';
import { usePendencias, useResultadosGestor } from '../api/resultados';
import { plural } from '../app/plural';
import { CORES } from '../app/tema';
import { formatarData, nomeMes } from '../formatacao';
import { resumoNota } from './minhas-metas/exibicao';

/**
 * Parte do Início só do Gestor (especificação 10.2, RF-28): a nota parcial e os meses com prazo
 * correndo, com quantas variáveis faltam e os dias úteis até o fechamento.
 */
export function PainelGestor(props: { readonly usuarioId: string }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 3,
        gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
        alignItems: 'stretch',
      }}
    >
      <Pendencias />
      <NotaParcial usuarioId={props.usuarioId} />
    </Box>
  );
}

function Pendencias() {
  const consulta = usePendencias(true);
  const dados = consulta.data;
  return (
    <Card component="section" aria-labelledby="titulo-pendencias">
      <CardContent sx={{ p: 3 }}>
        <Typography id="titulo-pendencias" variant="h2" sx={{ color: CORES.marinho, mb: 2 }}>
          Pendências
        </Typography>
        {consulta.isError ? (
          <Alert severity="error">{mensagemDeErro(consulta.error)}</Alert>
        ) : dados === undefined ? (
          <Skeleton variant="rounded" height={88} aria-label="Carregando as pendências…" />
        ) : dados.ciclo === null ? (
          <Typography color="text.secondary">Não há ciclo ativo para lançamento.</Typography>
        ) : dados.meses.length === 0 ? (
          <Typography color="text.secondary">
            Nenhum mês aguardando lançamento agora. O mês corrente entra aqui quando terminar.
          </Typography>
        ) : (
          <Stack component="ul" spacing={2.5} sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {dados.meses.map((m) => (
              <MesComPrazo key={m.mes} mes={m} ano={dados.ciclo?.ano ?? 0} />
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

function MesComPrazo({ mes, ano }: { readonly mes: MesPendente; readonly ano: number }) {
  const nome = nomeMes(mes.mes, ano);
  const completo = mes.pendentes === 0;
  return (
    <Box component="li" sx={{ display: 'grid', gap: 1 }}>
      <Typography sx={{ fontWeight: 700, color: CORES.marinho }}>{nome}</Typography>
      <Typography>
        {completo
          ? `Tudo lançado: ${plural(mes.total, 'variável', 'variáveis')}.`
          : `Faltam ${String(mes.pendentes)} de ${plural(mes.total, 'variável', 'variáveis')}.`}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {textoPrazo(mes)}
      </Typography>
      {!completo && (
        <Button
          component={RouterLink}
          to={`/lancamentos?mes=${String(mes.mes)}`}
          variant="contained"
          sx={{ justifySelf: 'start', minHeight: 44 }}
        >
          Lançar {nomeMes(mes.mes).toLowerCase()}
        </Button>
      )}
    </Box>
  );
}

function textoPrazo(mes: MesPendente): string {
  const data = formatarData(mes.fechaEm).slice(0, 5);
  if (mes.status === StatusMes.REABERTO) {
    return 'Reaberto pelo Administrador para correção.';
  }
  const dias = mes.diasUteisRestantes ?? 0;
  return dias <= 1
    ? `Fecha em ${data}: hoje é o último dia útil.`
    : `Fecha em ${data}: faltam ${plural(dias, 'dia útil', 'dias úteis')}.`;
}

function NotaParcial(props: { readonly usuarioId: string }) {
  const consulta = useResultadosGestor(props.usuarioId, undefined);
  const dados = consulta.data;
  const encerrado = dados?.ciclo?.status === StatusCiclo.ENCERRADO;
  return (
    <Card component="section" aria-labelledby="titulo-nota-inicio">
      <CardContent sx={{ p: 3 }}>
        <Typography id="titulo-nota-inicio" variant="h2" sx={{ color: CORES.marinho, mb: 2 }}>
          {encerrado ? 'Nota final' : 'Nota parcial'}
        </Typography>
        {consulta.isError ? (
          <Alert severity="error">{mensagemDeErro(consulta.error)}</Alert>
        ) : dados === undefined ? (
          <Skeleton variant="rounded" height={88} aria-label="Carregando a nota…" />
        ) : dados.ciclo === null || dados.notas === null ? (
          <Typography color="text.secondary">Você ainda não tem metas num ciclo ativo.</Typography>
        ) : (
          <ResumoDaNota notas={dados.notas} ano={dados.ciclo.ano} encerrado={encerrado} />
        )}
      </CardContent>
    </Card>
  );
}

function ResumoDaNota(props: {
  readonly notas: Parameters<typeof resumoNota>[0];
  readonly ano: number;
  readonly encerrado: boolean;
}) {
  const resumo = resumoNota(props.notas);
  return (
    <Stack spacing={2}>
      <Typography
        component="p"
        sx={{
          color: CORES.marinho,
          fontWeight: 700,
          fontSize: '2.5rem',
          lineHeight: 1.1,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {resumo.total}
        <Box
          component="span"
          sx={{ ml: 1, fontSize: '1rem', fontWeight: 600, color: CORES.textoSecundario }}
        >
          de {resumo.peso} pontos
        </Box>
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {props.encerrado
          ? `Ciclo ${String(props.ano)}, encerrado.`
          : `Ciclo ${String(props.ano)}, com os meses lançados até agora.`}{' '}
        {resumo.blocos.map((b) => `${b.nome}: ${b.pontos} de ${b.peso}.`).join(' ')}
      </Typography>
      <Button
        component={RouterLink}
        to="/minhas-metas"
        variant="outlined"
        sx={{ justifySelf: 'start', alignSelf: 'flex-start', minHeight: 44 }}
      >
        Ver minhas metas
      </Button>
    </Stack>
  );
}
