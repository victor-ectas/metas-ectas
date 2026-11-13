import { Box } from '@mui/material';
import type { Situacao } from '@metas/tipos';

import { ROTULO_SITUACAO } from '../app/rotulos';
import { CORES } from '../app/tema';

/**
 * Cores da situação (RN-25). A cor só reforça: o texto vem sempre junto (nunca só cor, RNF-11).
 * Contraste do texto sobre o fundo ≥ 4,5:1 em todas.
 */
const ESTILO: Readonly<Record<Situacao, { fundo: string; texto: string; ponto: string }>> = {
  BATIDA: { fundo: CORES.turquesaClaro, texto: CORES.marinho, ponto: CORES.turquesa },
  ABAIXO: { fundo: '#F6E9DC', texto: '#7C2D12', ponto: '#C2410C' },
  FORA_DA_FAIXA: { fundo: '#F8E4E4', texto: '#8A1C1C', ponto: '#C53030' },
  SEM_DADOS: { fundo: '#EEF0F2', texto: CORES.textoSecundario, ponto: '#9AA7B2' },
};

/** Situação da meta com texto e cor: "Batida", "Abaixo", "Fora da faixa", "Sem dados". */
export function SituacaoMeta(props: { readonly situacao: Situacao }) {
  const estilo = ESTILO[props.situacao];
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1.25,
        py: 0.5,
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 700,
        lineHeight: 1.2,
        bgcolor: estilo.fundo,
        color: estilo.texto,
        whiteSpace: 'nowrap',
      }}
    >
      <Box
        component="span"
        aria-hidden
        sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: estilo.ponto, flexShrink: 0 }}
      />
      {ROTULO_SITUACAO[props.situacao]}
    </Box>
  );
}
