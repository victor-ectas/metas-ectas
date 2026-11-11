import { Bloco } from '@metas/tipos';

import { paraDecimal, ZERO } from '../formula/decimal.js';
import { calcularMeta } from './meta.js';
import { calcularPontos } from './pontuacao.js';
import type {
  CicloEntrada,
  NotaBloco,
  NotaGestor,
  ResultadoAtribuicao,
  ResultadoCiclo,
  ResultadoMeta,
  VariavelEntrada,
} from './tipos.js';

/**
 * Calcula as metas sem pai de um ciclo (com suas submetas), os pontos de cada atribuição e as
 * notas por bloco e final de cada gestor (RN-05, RN-22, RN-31).
 *
 * Meta corporativa tem um resultado e um atendimento; cada gestor atribuído recebe
 * `pontos = regra(atendimento) × seu peso`.
 */
export function calcularCiclo(entrada: CicloEntrada): ResultadoCiclo {
  const variaveis = new Map<string, VariavelEntrada>(entrada.variaveis.map((v) => [v.id, v]));
  const metas = entrada.metas.map((meta) => ({ meta, resultado: calcularMeta(meta, variaveis) }));
  const porId = new Map(metas.map((m) => [m.meta.id, m]));

  const atribuicoes: ResultadoAtribuicao[] = entrada.atribuicoes.map((atribuicao) => {
    const calculada = porId.get(atribuicao.metaId);
    if (calculada === undefined) {
      throw new Error(
        `Atribuição ${atribuicao.id} aponta para a meta ${atribuicao.metaId}, que não é uma meta sem pai do ciclo`,
      );
    }
    const peso = paraDecimal(atribuicao.peso);
    return {
      atribuicaoId: atribuicao.id,
      metaId: atribuicao.metaId,
      usuarioId: atribuicao.usuarioId,
      bloco: calculada.meta.bloco,
      peso,
      pontos: calcularPontos(
        calculada.resultado.regraPontuacao,
        calculada.resultado.atendimento,
        peso,
      ),
    };
  });

  const notasPorBloco = somarPorBloco(atribuicoes);
  const totais = new Map<string, NotaGestor>();
  for (const nota of notasPorBloco) {
    const total = totais.get(nota.usuarioId) ?? { usuarioId: nota.usuarioId, pontos: ZERO };
    totais.set(nota.usuarioId, { ...total, pontos: total.pontos.plus(nota.pontos) });
  }

  return {
    metas: metas.map((m): ResultadoMeta => m.resultado),
    atribuicoes,
    notasPorBloco,
    notas: [...totais.values()],
  };
}

/** Nota do bloco = soma dos pontos das metas do bloco do gestor (RN-31). */
function somarPorBloco(atribuicoes: readonly ResultadoAtribuicao[]): NotaBloco[] {
  const notas = new Map<string, NotaBloco>();
  for (const a of atribuicoes) {
    const chave = `${a.usuarioId}|${a.bloco}`;
    const nota = notas.get(chave) ?? {
      usuarioId: a.usuarioId,
      bloco: a.bloco,
      pesoTotal: ZERO,
      pontos: ZERO,
    };
    notas.set(chave, {
      ...nota,
      pesoTotal: nota.pesoTotal.plus(a.peso),
      pontos: nota.pontos.plus(a.pontos),
    });
  }
  // Ordem estável: gestores na ordem em que aparecem, Corporativo antes de Departamental.
  const ordemGestor = new Map<string, number>();
  for (const a of atribuicoes) {
    if (!ordemGestor.has(a.usuarioId)) ordemGestor.set(a.usuarioId, ordemGestor.size);
  }
  const posicao = (n: NotaBloco): number =>
    (ordemGestor.get(n.usuarioId) as number) * 2 + ordemBloco(n.bloco);
  return [...notas.values()].sort((x, y) => posicao(x) - posicao(y));
}

const ordemBloco = (bloco: Bloco): number => (bloco === Bloco.CORPORATIVO ? 0 : 1);
