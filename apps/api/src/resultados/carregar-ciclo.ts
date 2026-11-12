import type { Prisma } from '@metas/prisma';
import type {
  AtribuicaoEntrada,
  CicloEntrada,
  MetaEntrada,
  MetaRaizEntrada,
  No,
  VariavelEntrada,
} from '@metas/motor';
import { Bloco } from '@metas/tipos';

import type { Transacao } from '../auditoria/auditoria.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

type Cliente = PrismaService | Transacao;

const CAMPOS = {
  id: true,
  codigo: true,
  indicador: true,
  formulaTexto: true,
  formulaAst: true,
  modoApuracao: true,
  operador: true,
  tolerancia: true,
  mesInicio: true,
  mesFim: true,
  regraPontuacao: true,
  pesoInterno: true,
  objetivos: { select: { mes: true, valor: true } },
  variaveis: {
    select: {
      variavel: { select: { id: true, codigo: true, setor: { select: { codigo: true } } } },
    },
  },
} as const satisfies Prisma.MetaSelect;

type MetaBanco = Prisma.MetaGetPayload<{ select: typeof CAMPOS }>;

const texto = (valor: Prisma.Decimal): string => valor.toFixed();

/** Identificação de uma meta sem pai, para a fotografia do encerramento. */
export interface MetaCarregada {
  codigo: string;
  indicador: string;
}

export interface CicloCarregado {
  entrada: CicloEntrada;
  metas: ReadonlyMap<string, MetaCarregada>;
}

/**
 * Monta a entrada do motor (`calcularCiclo`) com as metas ativas do ciclo, as submetas ativas, as
 * atribuições e os lançamentos das variáveis usadas (vazio = `null`, RN-08). A AST vem do banco,
 * gravada já validada ao salvar a meta (P13).
 *
 * Usado no encerramento do ciclo (P15); o serviço de resultados (P17) parte daqui.
 */
export async function carregarCiclo(cliente: Cliente, cicloId: string): Promise<CicloCarregado> {
  const raizes = await cliente.meta.findMany({
    where: { cicloId, metaPaiId: null, ativo: true },
    select: {
      ...CAMPOS,
      setor: { select: { codigo: true, corporativo: true } },
      atribuicoes: { select: { id: true, usuarioId: true, peso: true } },
      submetas: { where: { ativo: true }, select: CAMPOS },
    },
    orderBy: [{ ordem: 'asc' }, { codigo: 'asc' }],
  });

  const variavelIds = new Set<string>();
  const paraMotor = (m: MetaBanco, setorDaMeta: string, submetas: MetaEntrada[]): MetaEntrada => {
    // A fórmula pode citar uma variável do próprio setor por `CODIGO` ou por `SETOR.CODIGO`.
    const variaveis: Record<string, string> = {};
    for (const { variavel: v } of m.variaveis) {
      variavelIds.add(v.id);
      variaveis[`${v.setor.codigo}.${v.codigo}`] = v.id;
      if (v.setor.codigo === setorDaMeta) variaveis[v.codigo] = v.id;
    }
    return {
      id: m.id,
      formula: m.formulaTexto === null ? null : (m.formulaAst as unknown as No),
      formulaTexto: m.formulaTexto ?? undefined,
      variaveis,
      modoApuracao: m.modoApuracao,
      operador: m.operador,
      tolerancia: m.tolerancia === null ? null : texto(m.tolerancia),
      mesInicio: m.mesInicio,
      mesFim: m.mesFim,
      objetivos: Object.fromEntries(m.objetivos.map((o) => [o.mes, texto(o.valor)])),
      regraPontuacao: m.regraPontuacao,
      pesoInterno: m.pesoInterno === null ? null : texto(m.pesoInterno),
      submetas,
    };
  };

  const metas: MetaRaizEntrada[] = [];
  const atribuicoes: AtribuicaoEntrada[] = [];
  const identificacao = new Map<string, MetaCarregada>();
  for (const raiz of raizes) {
    const submetas = raiz.submetas.map((s) => paraMotor(s, raiz.setor.codigo, []));
    metas.push({
      ...paraMotor(raiz, raiz.setor.codigo, submetas),
      bloco: raiz.setor.corporativo ? Bloco.CORPORATIVO : Bloco.DEPARTAMENTAL,
    });
    identificacao.set(raiz.id, { codigo: raiz.codigo, indicador: raiz.indicador });
    for (const a of raiz.atribuicoes) {
      atribuicoes.push({ id: a.id, metaId: raiz.id, usuarioId: a.usuarioId, peso: texto(a.peso) });
    }
  }

  // Em sequência: no encerramento, a conexão da transação é uma só.
  const definicoes = await cliente.variavel.findMany({
    where: { id: { in: [...variavelIds] } },
    select: { id: true, acumulacao: true },
  });
  const lancamentos = await cliente.lancamento.findMany({
    where: { variavelId: { in: [...variavelIds] } },
    select: { variavelId: true, mes: true, valor: true },
  });
  const valores = new Map<string, Record<number, string | null>>();
  for (const l of lancamentos) {
    const daVariavel = valores.get(l.variavelId) ?? {};
    daVariavel[l.mes] = l.valor === null ? null : texto(l.valor);
    valores.set(l.variavelId, daVariavel);
  }
  const variaveis: VariavelEntrada[] = definicoes.map((v) => ({
    id: v.id,
    acumulacao: v.acumulacao,
    valores: valores.get(v.id) ?? {},
  }));

  return { entrada: { metas, variaveis, atribuicoes }, metas: identificacao };
}
