import type {
  Acumulacao,
  Bloco,
  CodigoErro,
  ModoApuracao,
  Operador,
  RegraPontuacao,
  Situacao,
} from '@metas/tipos';

import type { No } from '../formula/ast.js';
import type { Decimal, ValorDecimal } from '../formula/decimal.js';

// ---------------------------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------------------------

/** Lançamentos de uma variável por mês (1 a 12). Mês ausente ou `null` = vazio (RN-08). */
export type Lancamentos = Readonly<Partial<Record<number, ValorDecimal | null>>>;

export interface VariavelEntrada {
  id: string;
  acumulacao: Acumulacao;
  valores: Lancamentos;
}

export interface MetaEntrada {
  id: string;
  /** AST da fórmula. `null` só em meta-mãe que apenas agrega as submetas (RN-30). */
  formula: No | null;
  /** Texto da fórmula, só para a memória de cálculo. */
  formulaTexto?: string;
  /** Chave usada na fórmula (`CODIGO` ou `SETOR.CODIGO`) → id da variável. */
  variaveis: Readonly<Record<string, string>>;
  modoApuracao: ModoApuracao;
  operador: Operador;
  /** Só para o operador FAIXA (objetivo ± tolerância). */
  tolerancia: ValorDecimal | null;
  mesInicio: number;
  mesFim: number;
  /** Objetivo por mês (1 a 12) ou único (mês 0). */
  objetivos: Readonly<Partial<Record<number, ValorDecimal>>>;
  regraPontuacao: RegraPontuacao;
  /** Peso dentro da mãe, como fração (20% = 0,2). Em submetas e no componente próprio da mãe. */
  pesoInterno: ValorDecimal | null;
  /** Submetas (um nível só, RN-26). */
  submetas: readonly MetaEntrada[];
}

/** Meta sem pai, com o bloco derivado do setor (RN-02). */
export interface MetaRaizEntrada extends MetaEntrada {
  bloco: Bloco;
}

/** Atribuição de uma meta sem pai a um gestor, com o peso no bloco (RN-05). */
export interface AtribuicaoEntrada {
  id: string;
  metaId: string;
  usuarioId: string;
  peso: ValorDecimal;
}

export interface CicloEntrada {
  metas: readonly MetaRaizEntrada[];
  variaveis: readonly VariavelEntrada[];
  atribuicoes: readonly AtribuicaoEntrada[];
}

// ---------------------------------------------------------------------------------------------
// Saída
// ---------------------------------------------------------------------------------------------

/**
 * - `DIVISAO_POR_ZERO`: a fórmula dividiu por zero (RN-18).
 * - `SEM_OBJETIVO`: não há objetivo para comparar o acumulado.
 */
export type CodigoAvisoCalculo = 'DIVISAO_POR_ZERO' | 'SEM_OBJETIVO';

export interface ResultadoMes {
  mes: number;
  resultado: Decimal | null;
  objetivo: Decimal | null;
  /** `null` quando não há resultado ou objetivo no mês. */
  atendimento: Decimal | null;
  /** `SEM_DADOS` sem resultado; `null` quando o mês não tem objetivo. Só para exibição. */
  situacao: Situacao | null;
  /** Mês fora do período da meta: histórico, não conta para a nota (RN-14). */
  foraPeriodo: boolean;
  avisos: CodigoAvisoCalculo[];
}

export interface ResultadoMeta {
  metaId: string;
  /** Resultado de cada mês de 1 a 12. Vazio em meta-mãe sem fórmula própria. */
  mensal: ResultadoMes[];
  /** Resultado acumulado do período (da fórmula própria, numa meta-mãe). */
  acumulado: Decimal | null;
  /** Objetivo do último mês do período, ou o único (RN-15). */
  objetivo: Decimal | null;
  /** Mês do objetivo usado (0 = único). */
  mesObjetivo: number | null;
  /** Entre 0 e 1. Numa meta-mãe, o atendimento composto (RN-27). */
  atendimento: Decimal;
  situacao: Situacao;
  /** Regra aplicada: FAIXA é sempre tudo ou nada (RN-22). */
  regraPontuacao: RegraPontuacao;
  avisos: CodigoAvisoCalculo[];
  submetas: ResultadoMeta[];
  memoria: MemoriaCalculo;
}

/** Memória de cálculo (RF-38). Só textos e números: vai para `resultado_meta.memoria` (jsonb). */
export interface MemoriaCalculo {
  formula: string | null;
  modoApuracao: ModoApuracao;
  periodo: { mesInicio: number; mesFim: number };
  variaveis: MemoriaVariavel[];
  /** Resultados mensais do período (modos que agregam resultados). */
  resultadosMensais: { mes: number; resultado: string | null }[];
  resultado: string | null;
  objetivo: string | null;
  mesObjetivo: number | null;
  operador: Operador;
  tolerancia: string | null;
  atendimento: string;
  situacao: Situacao;
  regraPontuacao: RegraPontuacao;
  /** Componentes do atendimento composto de uma meta-mãe; `null` em meta sem submetas. */
  componentes: MemoriaComponente[] | null;
  avisos: CodigoAvisoCalculo[];
}

export interface MemoriaVariavel {
  chave: string;
  variavelId: string | null;
  acumulacao: Acumulacao | null;
  /** Valores dos meses do período. */
  valores: { mes: number; valor: string | null }[];
  /** Valor acumulado pela regra da variável (modo fórmula sobre acumulados). */
  acumulado: string | null;
}

export interface MemoriaComponente {
  metaId: string;
  /** `true` para o resultado próprio da mãe (RN-30). */
  proprio: boolean;
  pesoInterno: string;
  atendimento: string;
}

export interface ResultadoAtribuicao {
  atribuicaoId: string;
  metaId: string;
  usuarioId: string;
  bloco: Bloco;
  peso: Decimal;
  pontos: Decimal;
}

export interface NotaBloco {
  usuarioId: string;
  bloco: Bloco;
  /** Soma dos pesos atribuídos no bloco. */
  pesoTotal: Decimal;
  pontos: Decimal;
}

export interface NotaGestor {
  usuarioId: string;
  /** Corporativo + Departamental (RN-31). */
  pontos: Decimal;
}

export interface ResultadoCiclo {
  metas: ResultadoMeta[];
  atribuicoes: ResultadoAtribuicao[];
  notasPorBloco: NotaBloco[];
  notas: NotaGestor[];
}

/** Problema de configuração encontrado pelas validações. */
export interface ErroConsistencia {
  codigo: CodigoErro;
  mensagem: string;
  /** Meta com o problema, quando se aplica. */
  metaId: string | null;
}
