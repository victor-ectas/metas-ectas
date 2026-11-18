import { Box } from '@mui/material';
import type { Situacao } from '@metas/tipos';

import { ROTULO_SITUACAO } from '../app/rotulos';
import { CORES } from '../app/tema';

/**
 * Cores da situação (RN-25). A cor só reforça: o texto vem sempre junto (nunca só cor, RNF-11).
 * Contraste do texto sobre o fundo ≥ 4,5:1 em todas, no claro e no escuro (tons do tema).
 */
const ESTILO: Readonly<Record<Situacao, { fundo: string; texto: string; ponto: string }>> = {
  BATIDA: { fundo: CORES.turquesaClaro, texto: CORES.marinho, ponto: CORES.turquesa },
  ABAIXO: { fundo: CORES.alertaFundo, texto: CORES.alertaTexto, ponto: CORES.alertaPonto },
  FORA_DA_FAIXA: { fundo: CORES.erroFundo, texto: CORES.erroTexto, ponto: CORES.erroPonto },
  SEM_DADOS: { fundo: CORES.neutroFundo, texto: CORES.textoSecundario, ponto: CORES.neutroPonto },
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
