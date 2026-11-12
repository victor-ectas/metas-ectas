import { Decimal } from '@metas/motor';
import {
  MES_OBJETIVO_UNICO,
  type Meta,
  type MetaEntrada,
  ModoApuracao,
  type Objetivo,
  Operador,
  RegraPontuacao,
  type Submeta,
  type SubmetaEntrada,
  Unidade,
} from '@metas/tipos';

/**
 * Estado do editor de metas (P14). Os números ficam como foram digitados (pt-BR, percentual de
 * 0 a 100) e só viram o formato da API (ponto decimal, percentual como fração) ao salvar, com
 * `Decimal`: nenhum `number` no caminho (CLAUDE.md 5.4).
 */

/** O que meta e submeta têm em comum: o cálculo (RN-29). */
export interface CamposCalculo {
  /** Presente nas submetas já gravadas. */
  id?: string;
  codigo: string;
  indicador: string;
  metrica: string;
  unidade: Unidade;
  formula: string;
  modoApuracao: ModoApuracao;
  operador: Operador;
  /** Digitada, na unidade da meta (percentual de 0 a 100). */
  tolerancia: string;
  mesInicio: number;
  mesFim: number;
  tipoObjetivo: 'UNICO' | 'MENSAL';
  objetivoUnico: string;
  /** Objetivo digitado de cada mês: posição 0 = janeiro … 11 = dezembro. Só o período conta. */
  objetivosMensais: string[];
  /** Peso dentro da mãe, digitado de 0 a 100 (submetas e resultado próprio da mãe). */
  pesoInterno: string;
  ativo: boolean;
}

export interface FormularioMeta {
  setorId: string;
  responsavelId: string;
  regraPontuacao: RegraPontuacao;
  ordem: number;
  /** Meta-mãe sem fórmula própria: só agrega as submetas (RN-30). */
  soAgrega: boolean;
  atribuicoes: { usuarioId: string; peso: string }[];
  raiz: CamposCalculo;
  submetas: CamposCalculo[];
}

const MESES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export function calculoVazio(alteracoes: Partial<CamposCalculo> = {}): CamposCalculo {
  return {
    codigo: '',
    indicador: '',
    metrica: '',
    unidade: Unidade.PERCENTUAL,
    formula: '',
    modoApuracao: ModoApuracao.FORMULA_SOBRE_ACUMULADOS,
    operador: Operador.GE,
    tolerancia: '',
    mesInicio: 1,
    mesFim: 12,
    tipoObjetivo: 'UNICO',
    objetivoUnico: '',
    objetivosMensais: MESES.map(() => ''),
    pesoInterno: '',
    ativo: true,
    ...alteracoes,
  };
}

export function formularioVazio(setorId = '', responsavelId = ''): FormularioMeta {
  return {
    setorId,
    responsavelId,
    regraPontuacao: RegraPontuacao.TUDO_OU_NADA,
    ordem: 0,
    soAgrega: false,
    atribuicoes: responsavelId === '' ? [] : [{ usuarioId: responsavelId, peso: '' }],
    raiz: calculoVazio(),
    submetas: [],
  };
}

// ---------------------------------------------------------------------------------------------
// Números digitados
// ---------------------------------------------------------------------------------------------

/**
 * Lê um número digitado em pt-BR: "0,5", "1.234,56", "-10", e também "0.5". Com vírgula, os
 * pontos são separadores de milhar. Vazio devolve `null`; texto inválido devolve `undefined`.
 */
export function lerNumero(texto: string): Decimal | null | undefined {
  const limpo = texto.trim().replace(/\s/g, '');
  if (limpo === '') return null;
  const normalizado = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo;
  if (!/^-?\d+(\.\d+)?$/.test(normalizado)) return undefined;
  return new Decimal(normalizado);
}

/** Percentual é digitado de 0 a 100 e guardado como fração (RN-11). */
const ehPercentual = (unidade: Unidade) => unidade === Unidade.PERCENTUAL;

/** Digitado → texto da API (ponto decimal; percentual como fração). */
export function paraApi(texto: string, unidade: Unidade): string | null | undefined {
  const valor = lerNumero(texto);
  if (valor === null || valor === undefined) return valor;
  return (ehPercentual(unidade) ? valor.dividedBy(100) : valor).toFixed();
}

/** Texto da API → como se digita (vírgula decimal; percentual de 0 a 100). */
export function paraDigitado(valor: string | null, unidade: Unidade): string {
  if (valor === null) return '';
  const numero = new Decimal(valor);
  return (ehPercentual(unidade) ? numero.times(100) : numero).toFixed().replace('.', ',');
}

/** Peso interno digitado de 0 a 100 → fração (20 → "0.2"). */
export const pesoInternoParaApi = (texto: string) => paraApi(texto, Unidade.PERCENTUAL);

/** Soma dos pesos internos digitados (inválidos e vazios contam zero), em pontos percentuais. */
export function somaPesosInternos(itens: readonly { pesoInterno: string }[]): Decimal {
  return itens.reduce((soma, item) => soma.plus(lerNumero(item.pesoInterno) ?? 0), new Decimal(0));
}

// ---------------------------------------------------------------------------------------------
// API → formulário
// ---------------------------------------------------------------------------------------------

function calculoDe(item: Submeta, unidade = item.unidade): CamposCalculo {
  const unico = item.objetivos.find((o) => o.mes === MES_OBJETIVO_UNICO);
  return {
    id: item.id,
    codigo: item.codigo,
    indicador: item.indicador,
    metrica: item.metrica,
    unidade: item.unidade,
    formula: item.formula ?? '',
    modoApuracao: item.modoApuracao,
    operador: item.operador,
    tolerancia: paraDigitado(item.tolerancia, unidade),
    mesInicio: item.mesInicio,
    mesFim: item.mesFim,
    tipoObjetivo: unico !== undefined || item.objetivos.length === 0 ? 'UNICO' : 'MENSAL',
    objetivoUnico: unico === undefined ? '' : paraDigitado(unico.valor, unidade),
    objetivosMensais: MESES.map((mes) => {
      const objetivo = item.objetivos.find((o) => o.mes === mes);
      return objetivo === undefined ? '' : paraDigitado(objetivo.valor, unidade);
    }),
    pesoInterno: paraDigitado(item.pesoInterno, Unidade.PERCENTUAL),
    ativo: item.ativo,
  };
}

export function formularioDe(meta: Meta): FormularioMeta {
  const raiz = calculoDe(meta);
  delete raiz.id;
  return {
    setorId: meta.setorId,
    responsavelId: meta.responsavelId,
    regraPontuacao: meta.regraPontuacao,
    ordem: meta.ordem,
    soAgrega: meta.formula === null,
    atribuicoes: meta.atribuicoes.map((a) => ({
      usuarioId: a.usuarioId,
      peso: paraDigitado(a.peso, Unidade.NUMERO),
    })),
    raiz,
    submetas: meta.submetas.map((s) => calculoDe(s)),
  };
}

// ---------------------------------------------------------------------------------------------
// Formulário → API
// ---------------------------------------------------------------------------------------------

export interface ProblemaFormulario {
  /** Código da meta ou submeta (ou "Meta" quando ainda não tem código). */
  onde: string;
  mensagem: string;
}

/** Converte os números digitados; o resto da validação é do schema e da API. */
function objetivosDe(
  item: CamposCalculo,
  problemas: ProblemaFormulario[],
  onde: string,
): Objetivo[] {
  const converter = (mes: number, texto: string): Objetivo[] => {
    const valor = paraApi(texto, item.unidade);
    if (valor === undefined) {
      problemas.push({
        onde,
        mensagem: `Objetivo inválido: "${texto}". Use, por exemplo, 80 ou 0,5.`,
      });
      return [];
    }
    return valor === null ? [] : [{ mes, valor }];
  };
  if (item.tipoObjetivo === 'UNICO') return converter(MES_OBJETIVO_UNICO, item.objetivoUnico);
  return MESES.filter((mes) => mes >= item.mesInicio && mes <= item.mesFim).flatMap((mes) =>
    converter(mes, item.objetivosMensais[mes - 1] ?? ''),
  );
}

function camposDe(item: CamposCalculo, semFormula: boolean, problemas: ProblemaFormulario[]) {
  const onde = item.codigo.trim() === '' ? 'Meta' : item.codigo.trim().toUpperCase();
  const tolerancia =
    item.operador === Operador.FAIXA ? paraApi(item.tolerancia, item.unidade) : null;
  if (tolerancia === undefined) {
    problemas.push({ onde, mensagem: `Tolerância inválida: "${item.tolerancia}".` });
  }
  return {
    codigo: item.codigo,
    indicador: item.indicador,
    metrica: item.metrica,
    unidade: item.unidade,
    formula: semFormula ? null : item.formula,
    modoApuracao: item.modoApuracao,
    operador: item.operador,
    tolerancia: tolerancia ?? null,
    mesInicio: item.mesInicio,
    mesFim: item.mesFim,
    objetivos: semFormula ? [] : objetivosDe(item, problemas, onde),
    ativo: item.ativo,
  };
}

/** Peso interno digitado → fração; registra o problema quando inválido. */
function pesoInterno(item: CamposCalculo, problemas: ProblemaFormulario[]): string | null {
  const valor = pesoInternoParaApi(item.pesoInterno);
  if (valor === undefined) {
    problemas.push({
      onde: item.codigo.toUpperCase() || 'Submeta',
      mensagem: `Peso interno inválido: "${item.pesoInterno}".`,
    });
    return null;
  }
  return valor;
}

/**
 * Monta o corpo da API. Devolve também os problemas de digitação (número inválido), que impedem
 * de enviar.
 */
export function paraEntrada(form: FormularioMeta): {
  entrada: MetaEntrada;
  problemas: ProblemaFormulario[];
} {
  const problemas: ProblemaFormulario[] = [];
  const temSubmetas = form.submetas.length > 0;
  const soAgrega = temSubmetas && form.soAgrega;
  // Atribuição sem gestor escolhido não vai: o schema avisa que falta gestor.
  const atribuicoes = form.atribuicoes
    .filter((a) => a.usuarioId !== '')
    .map((a) => {
      const peso = paraApi(a.peso, Unidade.NUMERO);
      if (peso === undefined || peso === null) {
        problemas.push({ onde: 'Pontuação', mensagem: 'Informe o peso de cada gestor atribuído.' });
      }
      return { usuarioId: a.usuarioId, peso: peso ?? '0' };
    });
  const submetas: SubmetaEntrada[] = form.submetas.map((s) => ({
    ...(s.id === undefined ? {} : { id: s.id }),
    ...camposDe(s, false, problemas),
    pesoInterno: pesoInterno(s, problemas) ?? '0',
  }));
  const entrada: MetaEntrada = {
    setorId: form.setorId,
    ...camposDe(form.raiz, soAgrega, problemas),
    regraPontuacao: form.regraPontuacao,
    pesoInterno: temSubmetas && !soAgrega ? pesoInterno(form.raiz, problemas) : null,
    responsavelId: form.responsavelId,
    ordem: form.ordem,
    atribuicoes,
    submetas,
  };
  return { entrada, problemas };
}
