import type { No } from './ast.js';

/** Variável como aparece na fórmula: código simples (setor da própria meta) ou `SETOR.VAR`. */
export interface ReferenciaVariavel {
  setor: string | null;
  codigo: string;
}

/** Chave da variável no escopo e na lista de disponíveis: `CODIGO` ou `SETOR.CODIGO`. */
export function chaveVariavel(referencia: ReferenciaVariavel): string {
  return referencia.setor === null ? referencia.codigo : `${referencia.setor}.${referencia.codigo}`;
}

/** Variáveis referenciadas pela fórmula, sem repetição, na ordem em que aparecem. */
export function variaveisUsadas(ast: No): ReferenciaVariavel[] {
  const encontradas = new Map<string, ReferenciaVariavel>();
  visitar(ast, (no) => {
    if (no.tipo === 'variavel') {
      const referencia = { setor: no.setor, codigo: no.codigo };
      const chave = chaveVariavel(referencia);
      if (!encontradas.has(chave)) encontradas.set(chave, referencia);
    }
  });
  return [...encontradas.values()];
}

/** Percorre a AST em profundidade, da esquerda para a direita. */
export function visitar(no: No, visita: (no: No) => void): void {
  visita(no);
  switch (no.tipo) {
    case 'unario':
      visitar(no.operando, visita);
      break;
    case 'binario':
      visitar(no.esquerda, visita);
      visitar(no.direita, visita);
      break;
    case 'funcao':
      for (const argumento of no.argumentos) visitar(argumento, visita);
      break;
    case 'numero':
    case 'variavel':
      break;
  }
}
