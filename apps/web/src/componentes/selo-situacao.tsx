import { Box } from '@mui/material';

import { CORES } from '../app/tema';

/** Ativo/Inativo com texto e cor (nunca só cor, RNF-11). */
export function SeloSituacao(props: { readonly ativo: boolean }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1,
        py: 0.25,
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 600,
        bgcolor: props.ativo ? CORES.turquesaClaro : '#EEF0F2',
        color: props.ativo ? CORES.marinho : CORES.textoSecundario,
        whiteSpace: 'nowrap',
      }}
    >
      <Box
        component="span"
        aria-hidden
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          bgcolor: props.ativo ? CORES.turquesa : '#9AA7B2',
        }}
      />
      {props.ativo ? 'Ativo' : 'Inativo'}
    </Box>
  );
}
