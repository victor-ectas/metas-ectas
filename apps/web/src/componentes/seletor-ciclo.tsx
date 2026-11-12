import { Chip, Stack } from '@mui/material';
import { type Ciclo, StatusCiclo } from '@metas/tipos';

import { ROTULO_STATUS_CICLO } from '../app/rotulos';
import { CORES } from '../app/tema';

/** Ciclo mostrado de início: o ativo; senão, o mais recente. */
export function cicloInicial(ciclos: readonly Ciclo[]): Ciclo | undefined {
  return ciclos.find((c) => c.status === StatusCiclo.ATIVO) ?? ciclos[0];
}

/** Botões de escolha do ciclo (ano e situação), usados nas telas de cadastro por ciclo. */
export function SeletorCiclo(props: {
  readonly ciclos: readonly Ciclo[];
  readonly selecionado: string | undefined;
  readonly aoEscolher: (id: string) => void;
}) {
  return (
    <Stack
      direction="row"
      useFlexGap
      spacing={1}
      sx={{ flexWrap: 'wrap' }}
      role="group"
      aria-label="Ciclo"
    >
      {props.ciclos.map((c) => {
        const selecionado = c.id === props.selecionado;
        return (
          <Chip
            key={c.id}
            label={`${String(c.ano)} (${ROTULO_STATUS_CICLO[c.status]})`}
            aria-pressed={selecionado}
            onClick={() => {
              props.aoEscolher(c.id);
            }}
            sx={{
              height: 40,
              px: 0.5,
              fontWeight: 600,
              bgcolor: selecionado ? CORES.marinho : CORES.branco,
              color: selecionado ? CORES.branco : CORES.marinho,
              border: `1px solid ${selecionado ? CORES.marinho : CORES.borda}`,
              '&:hover': { bgcolor: selecionado ? CORES.marinho : CORES.turquesaClaro },
            }}
          />
        );
      })}
    </Stack>
  );
}
