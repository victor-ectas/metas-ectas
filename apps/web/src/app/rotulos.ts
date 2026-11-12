import type { StatusCiclo, TipoFeriado } from '@metas/tipos';

/** Nomes na tela dos valores guardados no banco. */

export const ROTULO_STATUS_CICLO: Readonly<Record<StatusCiclo, string>> = {
  RASCUNHO: 'Rascunho',
  ATIVO: 'Ativo',
  ENCERRADO: 'Encerrado',
};

export const ROTULO_TIPO_FERIADO: Readonly<Record<TipoFeriado, string>> = {
  NACIONAL: 'Nacional',
  ESTADUAL: 'Estadual',
  MUNICIPAL: 'Municipal',
  EMPRESA: 'Ponto facultativo da empresa',
};
