import type { No, NoBinario, NoFuncao } from './ast.js';
import { Decimal, paraDecimal, UM, type ValorDecimal, ZERO } from './decimal.js';
import { FormulaErro } from './erros.js';
import { aridadeValida, ehFuncaoConhecida, mensagemAridade } from './funcoes.js';
import { chaveVariavel, variaveisUsadas } from './variaveis.js';

/**
 * Valores das variáveis de um mês (ou acumulados do período), pela chave `CODIGO` ou
 * `SETOR.CODIGO`. `null` ou ausente = vazio (RN-08); vazio não é zero.
 */
export type Escopo = Readonly<Record<string, ValorDecimal | null | undefined>>;

export type CodigoAviso = 'DIVISAO_POR_ZERO';

export interface Aviso {
  codigo: CodigoAviso;
  /** Posição (a partir de 1) do operador ou função que gerou o aviso. */
  posicao: number;
}

export interface ResultadoAvaliacao {
  /** `null` quando alguma variável usada está vazia ou houve divisão por zero. */
  valor: Decimal | null;
  avisos: Aviso[];
}

/**
 * Avalia a AST com aritmética decimal exata (CLAUDE.md 8.1).
 *
 * - Se qualquer variável usada pela fórmula estiver vazia, o resultado é `null` (RN-16).
 * - Divisão por zero dá `null` com aviso `DIVISAO_POR_ZERO` (RN-18); o `null` se propaga.
 * - Comparações e funções lógicas devolvem 1 ou 0; na condição, diferente de zero é verdadeiro.
 * - `SE` só avalia o ramo escolhido, então `SE(B = 0; 0; A / B)` não gera aviso.
 *
 * Lança `FormulaErro` se a AST tiver função desconhecida ou aridade errada (AST não validada).
 */
export function avaliar(ast: No, escopo: Escopo): ResultadoAvaliacao {
  const valores = new Map<string, Decimal>();
  for (const referencia of variaveisUsadas(ast)) {
    const chave = chaveVariavel(referencia);
    const valor = Object.hasOwn(escopo, chave) ? escopo[chave] : undefined;
    if (valor === null || valor === undefined) return { valor: null, avisos: [] };
    valores.set(chave, paraDecimal(valor));
  }
  const avisos: Aviso[] = [];
  return { valor: new Avaliacao(valores, avisos).no(ast), avisos };
}

class Avaliacao {
  constructor(
    private readonly valores: ReadonlyMap<string, Decimal>,
    private readonly avisos: Aviso[],
  ) {}

  no(no: No): Decimal | null {
    switch (no.tipo) {
      case 'numero':
        return new Decimal(no.valor);
      case 'variavel':
        // Todas as variáveis usadas foram conferidas antes de avaliar.
        return this.valores.get(chaveVariavel(no)) as Decimal;
      case 'unario': {
        const operando = this.no(no.operando);
        return operando === null ? null : operando.neg();
      }
      case 'binario':
        return this.binario(no);
      case 'funcao':
        return this.funcao(no);
    }
  }

  private binario(no: NoBinario): Decimal | null {
    const a = this.no(no.esquerda);
    const b = this.no(no.direita);
    if (a === null || b === null) return null;
    switch (no.operador) {
      case '+':
        return a.plus(b);
      case '-':
        return a.minus(b);
      case '*':
        return a.times(b);
      case '/':
        if (b.isZero()) {
          this.avisos.push({ codigo: 'DIVISAO_POR_ZERO', posicao: no.posicao });
          return null;
        }
        return a.div(b);
      case '=':
        return logico(a.eq(b));
      case '<>':
        return logico(!a.eq(b));
      case '<':
        return logico(a.lt(b));
      case '>':
        return logico(a.gt(b));
      case '<=':
        return logico(a.lte(b));
      case '>=':
        return logico(a.gte(b));
    }
  }

  private funcao(no: NoFuncao): Decimal | null {
    const { nome, argumentos } = no;
    if (!ehFuncaoConhecida(nome)) {
      throw new FormulaErro(`Função desconhecida: ${nome}`, no.posicao);
    }
    if (!aridadeValida(nome, argumentos.length)) {
      throw new FormulaErro(mensagemAridade(nome), no.posicao);
    }

    if (nome === 'SE') {
      // Aridade conferida: exatamente 3 argumentos.
      const [condicao, seVerdadeiro, seFalso] = argumentos as [No, No, No];
      const valorCondicao = this.no(condicao);
      if (valorCondicao === null) return null;
      return this.no(verdadeiro(valorCondicao) ? seVerdadeiro : seFalso);
    }

    const valores: Decimal[] = [];
    for (const argumento of argumentos) {
      const valor = this.no(argumento);
      if (valor === null) return null;
      valores.push(valor);
    }
    // Aridade conferida: cada função tem pelo menos os argumentos que usa abaixo.
    const [primeiro, segundo] = valores as [Decimal, Decimal];

    switch (nome) {
      case 'E':
        return logico(valores.every(verdadeiro));
      case 'OU':
        return logico(valores.some(verdadeiro));
      case 'NAO':
        return logico(!verdadeiro(primeiro));
      case 'ABS':
        return primeiro.abs();
      case 'MIN':
        return Decimal.min(...valores);
      case 'MAX':
        return Decimal.max(...valores);
      case 'ARRED':
        return arredondar(primeiro, segundo);
    }
  }
}

const verdadeiro = (valor: Decimal): boolean => !valor.isZero();
const logico = (condicao: boolean): Decimal => (condicao ? UM : ZERO);

/** Limite de casas do ARRED: além disso não há o que arredondar com 40 dígitos significativos. */
export const ARRED_CASAS_LIMITE = 1000;

/**
 * `ARRED(x; casas)`, meio para cima (CLAUDE.md 5.4), como o ARRED do Excel: casas fracionadas
 * são truncadas e casas negativas arredondam à esquerda da vírgula (`ARRED(1250; -2)` = 1300).
 * Casas fora de ±1000 são tratadas como ±1000.
 */
function arredondar(valor: Decimal, casas: Decimal): Decimal {
  const limite = ARRED_CASAS_LIMITE;
  const inteiras = Math.min(Math.max(casas.trunc().toNumber(), -limite), limite);
  if (inteiras >= 0) return valor.toDecimalPlaces(inteiras);
  return valor.toNearest(new Decimal(10).pow(-inteiras));
}
