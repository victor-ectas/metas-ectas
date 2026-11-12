import type {
  Acumulacao,
  OrigemVariavel,
  StatusCiclo,
  TipoFeriado,
  TipoVariavel,
} from '@metas/tipos';

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

export const ROTULO_TIPO_VARIAVEL: Readonly<Record<TipoVariavel, string>> = {
  NUMERO: 'Número',
  PERCENTUAL: 'Percentual (%)',
  MOEDA: 'Moeda (R$)',
  DIAS: 'Dias',
  HORAS: 'Horas',
  SIM_NAO: 'Sim/Não',
};

/** Acumulação no período (RN-09), com o que ela faz, para quem cadastra escolher. */
export const ROTULO_ACUMULACAO: Readonly<Record<Acumulacao, string>> = {
  SOMA: 'Soma',
  MEDIA: 'Média',
  ULTIMO: 'Último valor',
  MAXIMO: 'Maior valor',
};

export const AJUDA_ACUMULACAO: Readonly<Record<Acumulacao, string>> = {
  SOMA: 'Soma os meses com valor.',
  MEDIA: 'Média só dos meses com valor (vazio não conta como zero).',
  ULTIMO: 'Usa o último mês com valor no período.',
  MAXIMO: 'Usa o maior valor lançado no período.',
};

export const ROTULO_ORIGEM_VARIAVEL: Readonly<Record<OrigemVariavel, string>> = {
  DIGITADA: 'Digitada',
  IMPORTADA: 'Importada (Excel)',
};
