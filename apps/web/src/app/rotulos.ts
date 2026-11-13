import type {
  Acumulacao,
  ModoApuracao,
  Operador,
  OrigemVariavel,
  RegraPontuacao,
  Situacao,
  StatusCiclo,
  TipoFeriado,
  TipoVariavel,
  Unidade,
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

export const ROTULO_UNIDADE: Readonly<Record<Unidade, string>> = {
  PERCENTUAL: 'Percentual (%)',
  NUMERO: 'Número',
  DIAS: 'Dias',
  HORAS: 'Horas',
  MOEDA: 'Moeda (R$)',
  SIM_NAO: 'Sim/Não',
};

export const ROTULO_OPERADOR: Readonly<Record<Operador, string>> = {
  GE: 'Maior ou igual (≥)',
  LE: 'Menor ou igual (≤)',
  EQ: 'Igual (=)',
  FAIXA: 'Dentro da faixa (objetivo ± tolerância)',
};

/** Modo de apuração do acumulado (RN-17), com o que ele faz. */
export const ROTULO_MODO_APURACAO: Readonly<Record<ModoApuracao, string>> = {
  FORMULA_SOBRE_ACUMULADOS: 'Fórmula sobre os acumulados',
  SOMA_RESULTADOS: 'Soma dos resultados mensais',
  MEDIA_RESULTADOS: 'Média dos resultados mensais',
  MAXIMO_RESULTADOS: 'Maior resultado mensal',
  ULTIMO_RESULTADO: 'Último resultado mensal',
};

export const AJUDA_MODO_APURACAO: Readonly<Record<ModoApuracao, string>> = {
  FORMULA_SOBRE_ACUMULADOS:
    'Acumula cada variável pela sua regra no período e aplica a fórmula uma vez. O certo para razões (A / B).',
  SOMA_RESULTADOS: 'Calcula a fórmula mês a mês e soma os resultados com valor.',
  MEDIA_RESULTADOS: 'Calcula a fórmula mês a mês e tira a média dos meses com valor.',
  MAXIMO_RESULTADOS:
    'Calcula a fórmula mês a mês e usa o maior resultado (ex.: implantado SIM/NÃO).',
  ULTIMO_RESULTADO: 'Calcula a fórmula mês a mês e usa o último mês com valor.',
};

export const ROTULO_REGRA_PONTUACAO: Readonly<Record<RegraPontuacao, string>> = {
  TUDO_OU_NADA: 'Tudo ou nada',
  PROPORCIONAL: 'Proporcional ao atendimento',
};

/** Situação da meta (RN-25). Sempre com texto, nunca só cor. */
export const ROTULO_SITUACAO: Readonly<Record<Situacao, string>> = {
  BATIDA: 'Batida',
  ABAIXO: 'Abaixo',
  FORA_DA_FAIXA: 'Fora da faixa',
  SEM_DADOS: 'Sem dados',
};
