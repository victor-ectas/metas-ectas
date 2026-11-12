import {
  Box,
  Card,
  CardContent,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { ReactNode } from 'react';

import { CORES } from '../app/tema';

export interface Coluna<T> {
  readonly titulo: string;
  readonly valor: (item: T) => ReactNode;
  /** Largura da coluna na tabela (desktop). */
  readonly largura?: number | string;
  readonly alinhar?: 'left' | 'right' | 'center';
  /** No celular, a coluna principal vira o título do cartão; as outras, linhas "rótulo: valor". */
  readonly principal?: boolean;
  /** Esconde a coluna no celular (informação secundária). */
  readonly soNoDesktop?: boolean;
}

/**
 * Lista de registros que vira tabela no desktop e cartões no celular (RNF-01): em 360 px uma
 * tabela com 5 colunas não cabe, e rolar para o lado esconde informação.
 */
export function ListaResponsiva<T>(props: {
  readonly rotulo: string;
  readonly itens: readonly T[] | undefined;
  readonly colunas: readonly Coluna<T>[];
  readonly chave: (item: T) => string;
  /** Botões de ação de cada linha (editar, excluir…). */
  readonly acoes?: (item: T) => ReactNode;
  readonly vazio: ReactNode;
  readonly carregando?: boolean;
}) {
  const tema = useTheme();
  const desktop = useMediaQuery(tema.breakpoints.up('md'), { noSsr: true });
  const { itens, colunas } = props;

  if (props.carregando === true || itens === undefined) {
    return (
      <Stack spacing={1} aria-busy="true" aria-label={`Carregando ${props.rotulo.toLowerCase()}…`}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} variant="rounded" height={52} />
        ))}
      </Stack>
    );
  }

  if (itens.length === 0) {
    return (
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
        {props.vazio}
      </Box>
    );
  }

  if (desktop) {
    return (
      <TableContainer
        sx={{ bgcolor: CORES.branco, border: `1px solid ${CORES.borda}`, borderRadius: 3 }}
      >
        <Table aria-label={props.rotulo} size="medium">
          <TableHead>
            <TableRow>
              {colunas.map((coluna) => (
                <TableCell
                  key={coluna.titulo}
                  align={coluna.alinhar}
                  sx={{
                    width: coluna.largura,
                    color: CORES.textoSecundario,
                    fontWeight: 600,
                    fontSize: 13,
                    bgcolor: CORES.espuma,
                  }}
                >
                  {coluna.titulo}
                </TableCell>
              ))}
              {props.acoes !== undefined && (
                <TableCell sx={{ width: '1%', bgcolor: CORES.espuma }}>
                  <Box component="span" sx={visualmenteOculto}>
                    Ações
                  </Box>
                </TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {itens.map((item) => (
              <TableRow key={props.chave(item)} hover>
                {colunas.map((coluna) => (
                  <TableCell key={coluna.titulo} align={coluna.alinhar}>
                    {coluna.valor(item)}
                  </TableCell>
                ))}
                {props.acoes !== undefined && (
                  <TableCell sx={{ whiteSpace: 'nowrap' }} align="right">
                    {props.acoes(item)}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  }

  const principal = colunas.find((coluna) => coluna.principal === true) ?? colunas[0];
  const demais = colunas.filter((coluna) => coluna !== principal && coluna.soNoDesktop !== true);
  return (
    <Stack
      component="ul"
      spacing={1.5}
      aria-label={props.rotulo}
      sx={{ listStyle: 'none', m: 0, p: 0 }}
    >
      {itens.map((item) => (
        <Card component="li" key={props.chave(item)}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <Box sx={{ flexGrow: 1, minWidth: 0, fontWeight: 600, overflowWrap: 'anywhere' }}>
                {principal?.valor(item)}
              </Box>
              {props.acoes !== undefined && (
                <Box sx={{ display: 'flex', flexShrink: 0, mt: -1, mr: -1 }}>
                  {props.acoes(item)}
                </Box>
              )}
            </Box>
            <Box component="dl" sx={{ m: 0, mt: 1, display: 'grid', gap: 0.5 }}>
              {demais.map((coluna) => (
                <Box key={coluna.titulo} sx={{ display: 'flex', gap: 1, alignItems: 'baseline' }}>
                  <Typography
                    component="dt"
                    variant="body2"
                    color="text.secondary"
                    sx={{ flexShrink: 0 }}
                  >
                    {coluna.titulo}:
                  </Typography>
                  <Box component="dd" sx={{ m: 0, minWidth: 0, overflowWrap: 'anywhere' }}>
                    {coluna.valor(item)}
                  </Box>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}

/** Texto só para leitores de tela. */
export const visualmenteOculto = {
  position: 'absolute',
  // Em `sx`, o número 1 vale 100%: aqui é 1 pixel de verdade.
  width: '1px',
  height: '1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const;
