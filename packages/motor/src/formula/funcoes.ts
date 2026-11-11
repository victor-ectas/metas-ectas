/**
 * Funções da linguagem na Fase 1 (CLAUDE.md 8.1), com a quantidade de argumentos.
 * `ANTERIOR` e `META` são da Fase 2 e por enquanto são "função desconhecida".
 */
export interface Aridade {
  minimo: number;
  /** `null` = sem limite. */
  maximo: number | null;
}

export const FUNCOES = {
  SE: { minimo: 3, maximo: 3 },
  E: { minimo: 1, maximo: null },
  OU: { minimo: 1, maximo: null },
  NAO: { minimo: 1, maximo: 1 },
  ARRED: { minimo: 2, maximo: 2 },
  MIN: { minimo: 1, maximo: null },
  MAX: { minimo: 1, maximo: null },
  ABS: { minimo: 1, maximo: 1 },
} as const satisfies Record<string, Aridade>;

export type NomeFuncao = keyof typeof FUNCOES;

export function ehFuncaoConhecida(nome: string): nome is NomeFuncao {
  return Object.hasOwn(FUNCOES, nome);
}

/** `true` se a quantidade de argumentos é aceita pela função. */
export function aridadeValida(nome: NomeFuncao, quantidade: number): boolean {
  const { minimo, maximo } = FUNCOES[nome];
  return quantidade >= minimo && (maximo === null || quantidade <= maximo);
}

/** Ex.: "ARRED espera 2 argumentos", "ABS espera 1 argumento", "MIN espera pelo menos 1 argumento". */
export function mensagemAridade(nome: NomeFuncao): string {
  const { minimo, maximo } = FUNCOES[nome];
  const argumentos = minimo === 1 ? 'argumento' : 'argumentos';
  return maximo === null
    ? `${nome} espera pelo menos ${String(minimo)} ${argumentos}`
    : `${nome} espera ${String(minimo)} ${argumentos}`;
}
