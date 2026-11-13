import { Injectable } from '@nestjs/common';
import type { Prisma } from '@metas/prisma';
import { calcularCiclo, Decimal, type ResultadoMeta as ResultadoMotor } from '@metas/motor';
import {
  Bloco,
  type CicloResumo,
  CodigoErro,
  type MemoriaCalculo,
  type MetaDoGestor,
  type NotasGestor,
  type ResultadoAcumulado,
  type ResultadoMes,
  type ResultadoMeta,
  type ResultadosGestor,
  StatusCiclo,
} from '@metas/tipos';

import type { Transacao } from '../auditoria/auditoria.service.js';
import type { UsuarioAtual } from '../auth/usuario-atual.js';
import { ErroApi } from '../comum/erro-api.js';
import { PoliticasService } from '../politicas/politicas.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { carregarCiclo } from './carregar-ciclo.js';

/** Decimal do motor com as 6 casas do banco (`numeric(18,6)`). */
const seis = (valor: { toDecimalPlaces(casas: number): { toFixed(): string } }): string =>
  valor.toDecimalPlaces(6).toFixed();
const seisOuNulo = (valor: Parameters<typeof seis>[0] | null): string | null =>
  valor === null ? null : seis(valor);
const texto = (valor: Prisma.Decimal): string => valor.toFixed();
const textoOuNulo = (valor: Prisma.Decimal | null): string | null =>
  valor === null ? null : texto(valor);

const CAMPOS_RESULTADO = {
  id: true,
  codigo: true,
  indicador: true,
  unidade: true,
  modoApuracao: true,
  operador: true,
  formulaTexto: true,
  ativo: true,
  resultado: {
    select: {
      resultadoAcumulado: true,
      objetivoUsado: true,
      atendimento: true,
      situacao: true,
      memoria: true,
      calculadoEm: true,
    },
  },
  resultadosMes: { orderBy: { mes: 'asc' } },
  variaveis: {
    select: { variavel: { select: { id: true, codigo: true, nome: true, tipo: true } } },
    orderBy: { variavel: { codigo: 'asc' } },
  },
} as const satisfies Prisma.MetaSelect;

type ItemBanco = Prisma.MetaGetPayload<{ select: typeof CAMPOS_RESULTADO }>;

function acumulado(r: ItemBanco['resultado']): ResultadoAcumulado | null {
  if (r === null) return null;
  return {
    acumulado: textoOuNulo(r.resultadoAcumulado),
    objetivo: textoOuNulo(r.objetivoUsado),
    atendimento: texto(r.atendimento),
    situacao: r.situacao,
    calculadoEm: r.calculadoEm.toISOString(),
  };
}

function item(m: ItemBanco) {
  return {
    metaId: m.id,
    codigo: m.codigo,
    indicador: m.indicador,
    unidade: m.unidade,
    modoApuracao: m.modoApuracao,
    operador: m.operador,
    formula: m.formulaTexto,
    resultado: acumulado(m.resultado),
    mensal: m.resultadosMes.map((r): ResultadoMes => ({
      mes: r.mes,
      resultado: textoOuNulo(r.resultado),
      objetivo: textoOuNulo(r.objetivo),
      atendimento: textoOuNulo(r.atendimento),
      situacao: r.situacao,
      foraPeriodo: r.foraPeriodo,
      aviso: r.aviso,
    })),
    // Gravada pelo próprio motor (`MemoriaCalculo`), com os decimais já como texto.
    memoria: (m.resultado?.memoria ?? null) as MemoriaCalculo | null,
    variaveis: m.variaveis.map((v) => v.variavel),
  };
}

/**
 * Resultados (CLAUDE.md P17, especificação 6 e 7.4): roda o motor e grava `resultado_meta_mes`,
 * `resultado_meta`, `resultado_atribuicao` e `nota_gestor`, e serve as leituras.
 *
 * O recálculo roda dentro da transação de quem provocou a mudança (meta salva, variável alterada,
 * lançamento no P18), por escopo (especificação 6.5): o motor calcula só as metas sem pai
 * afetadas, com as submetas; as notas dos gestores são refeitas por uma soma no banco. Um lock
 * por ciclo impede dois recálculos cruzados. Ciclo encerrado não recalcula (notas congeladas).
 * Meta inativa não tem resultado nem entra na nota.
 */
@Injectable()
export class ResultadosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly politicas: PoliticasService,
  ) {}

  // ---------------------------------------------------------------------------------------------
  // Recálculo
  // ---------------------------------------------------------------------------------------------

  /** Ciclo inteiro. Devolve quantas metas sem pai foram calculadas. */
  recalcularCiclo(tx: Transacao, cicloId: string): Promise<number> {
    return this.recalcular(tx, cicloId, undefined);
  }

  /** Metas (sem pai ou submetas) que mudaram: recalcula as metas sem pai delas. */
  async recalcularMetas(tx: Transacao, metaIds: readonly string[]): Promise<void> {
    if (metaIds.length === 0) return;
    const metas = await tx.meta.findMany({
      where: { id: { in: [...metaIds] } },
      select: { id: true, cicloId: true, metaPaiId: true },
    });
    await this.recalcularRaizes(
      tx,
      metas.map((m) => ({ cicloId: m.cicloId, raizId: m.metaPaiId ?? m.id })),
    );
  }

  /** Variáveis que mudaram (lançamento, acumulação): metas que as usam, e as mães (6.5). */
  async recalcularPorVariaveis(tx: Transacao, variavelIds: readonly string[]): Promise<void> {
    if (variavelIds.length === 0) return;
    const usos = await tx.metaVariavel.findMany({
      where: { variavelId: { in: [...variavelIds] } },
      select: { meta: { select: { id: true, cicloId: true, metaPaiId: true } } },
    });
    await this.recalcularRaizes(
      tx,
      usos.map(({ meta: m }) => ({ cicloId: m.cicloId, raizId: m.metaPaiId ?? m.id })),
    );
  }

  /** Só as notas do ciclo (ex.: meta excluída, que leva os resultados em cascata). */
  async recalcularNotas(tx: Transacao, cicloId: string): Promise<void> {
    const ciclo = await tx.ciclo.findUnique({ where: { id: cicloId }, select: { status: true } });
    if (ciclo === null || ciclo.status === StatusCiclo.ENCERRADO) return;
    await this.travar(tx, cicloId);
    await this.gravarNotas(tx, cicloId);
  }

  private async recalcularRaizes(
    tx: Transacao,
    alvos: readonly { cicloId: string; raizId: string }[],
  ): Promise<void> {
    const porCiclo = new Map<string, Set<string>>();
    for (const { cicloId, raizId } of alvos) {
      const raizes = porCiclo.get(cicloId) ?? new Set<string>();
      raizes.add(raizId);
      porCiclo.set(cicloId, raizes);
    }
    for (const [cicloId, raizes] of porCiclo) await this.recalcular(tx, cicloId, [...raizes]);
  }

  private async travar(tx: Transacao, cicloId: string): Promise<void> {
    // Lock da transação: libera sozinho no commit ou rollback.
    const chave = `recalculo:${cicloId}`;
    await tx.$executeRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${chave}))`;
  }

  private async recalcular(
    tx: Transacao,
    cicloId: string,
    raizIds: readonly string[] | undefined,
  ): Promise<number> {
    const ciclo = await tx.ciclo.findUnique({ where: { id: cicloId }, select: { status: true } });
    if (ciclo === null || ciclo.status === StatusCiclo.ENCERRADO) return 0;
    await this.travar(tx, cicloId);

    // Limpa os resultados das metas do escopo (ativas ou não) e das submetas delas.
    const doEscopo = await tx.meta.findMany({
      where:
        raizIds === undefined
          ? { cicloId }
          : { cicloId, OR: [{ id: { in: [...raizIds] } }, { metaPaiId: { in: [...raizIds] } }] },
      select: { id: true, metaPaiId: true },
    });
    const ids = doEscopo.map((m) => m.id);
    const raizesDoEscopo = doEscopo.filter((m) => m.metaPaiId === null).map((m) => m.id);
    await tx.resultadoMetaMes.deleteMany({ where: { metaId: { in: ids } } });
    await tx.resultadoMeta.deleteMany({ where: { metaId: { in: ids } } });
    await tx.resultadoAtribuicao.deleteMany({
      where: { atribuicao: { metaId: { in: raizesDoEscopo } } },
    });

    const { entrada } = await carregarCiclo(tx, cicloId, raizIds);
    const calculo = calcularCiclo(entrada);
    const calculadoEm = new Date();

    // Linhas em snake_case, como as colunas: vão inteiras num único parâmetro jsonb.
    const meses: Record<string, unknown>[] = [];
    const metas: Record<string, unknown>[] = [];
    const guardar = (r: ResultadoMotor): void => {
      for (const m of r.mensal) {
        meses.push({
          meta_id: r.metaId,
          mes: m.mes,
          resultado: seisOuNulo(m.resultado),
          objetivo: seisOuNulo(m.objetivo),
          atendimento: seisOuNulo(m.atendimento),
          situacao: m.situacao,
          fora_periodo: m.foraPeriodo,
          aviso: m.avisos.length === 0 ? null : m.avisos.join(','),
        });
      }
      metas.push({
        meta_id: r.metaId,
        resultado_acumulado: seisOuNulo(r.acumulado),
        objetivo_usado: seisOuNulo(r.objetivo),
        atendimento: seis(r.atendimento),
        situacao: r.situacao,
        memoria: r.memoria,
      });
      for (const submeta of r.submetas) guardar(submeta);
    };
    for (const r of calculo.metas) guardar(r);

    // Uma instrução por tabela, com os dados num parâmetro (nada concatenado no SQL): o
    // `createMany` do Prisma levava ~400 ms nas 1.800 linhas mensais de um ciclo de 150 metas.
    await tx.$executeRaw`
      INSERT INTO resultado_meta_mes
        (meta_id, mes, resultado, objetivo, atendimento, situacao, fora_periodo, aviso, calculado_em)
      SELECT x.meta_id, x.mes, x.resultado, x.objetivo, x.atendimento, x.situacao, x.fora_periodo,
             x.aviso, ${calculadoEm}
      FROM jsonb_to_recordset(${JSON.stringify(meses)}::jsonb) AS x(
        meta_id uuid, mes smallint, resultado numeric, objetivo numeric, atendimento numeric,
        situacao situacao, fora_periodo boolean, aviso varchar)`;
    await tx.$executeRaw`
      INSERT INTO resultado_meta
        (meta_id, resultado_acumulado, objetivo_usado, atendimento, situacao, memoria, calculado_em)
      SELECT x.meta_id, x.resultado_acumulado, x.objetivo_usado, x.atendimento, x.situacao,
             x.memoria, ${calculadoEm}
      FROM jsonb_to_recordset(${JSON.stringify(metas)}::jsonb) AS x(
        meta_id uuid, resultado_acumulado numeric, objetivo_usado numeric, atendimento numeric,
        situacao situacao, memoria jsonb)`;
    await tx.resultadoAtribuicao.createMany({
      data: calculo.atribuicoes.map((a) => ({
        atribuicaoId: a.atribuicaoId,
        pontos: seis(a.pontos),
        calculadoEm,
      })),
    });
    await this.gravarNotas(tx, cicloId);
    return calculo.metas.length;
  }

  /**
   * Notas por gestor e bloco (RN-31): soma dos pesos e dos pontos das atribuições das metas sem
   * pai ativas do ciclo. Refeita inteira a cada recálculo: são poucas linhas (gestores × 2).
   */
  private async gravarNotas(tx: Transacao, cicloId: string): Promise<void> {
    await tx.notaGestor.deleteMany({ where: { cicloId } });
    await tx.$executeRaw`
      INSERT INTO nota_gestor (ciclo_id, usuario_id, bloco, peso_total, pontos, calculado_em)
      SELECT m.ciclo_id,
             a.usuario_id,
             CASE WHEN s.corporativo THEN 'CORPORATIVO'::bloco ELSE 'DEPARTAMENTAL'::bloco END,
             sum(a.peso),
             sum(coalesce(r.pontos, 0)),
             now()
      FROM meta_atribuicao a
      JOIN meta m ON m.id = a.meta_id
      JOIN setor s ON s.id = m.setor_id
      LEFT JOIN resultado_atribuicao r ON r.atribuicao_id = a.id
      WHERE m.ciclo_id = ${cicloId}::uuid AND m.ativo AND m.meta_pai_id IS NULL
      GROUP BY m.ciclo_id, a.usuario_id, s.corporativo`;
  }

  // ---------------------------------------------------------------------------------------------
  // Leitura
  // ---------------------------------------------------------------------------------------------

  /**
   * `GET /resultados/meta/{id}`: a meta sem pai com submetas, pontos e memória. Pedida pelo id
   * de uma submeta, devolve a mãe (a submeta só faz sentido dentro dela).
   */
  async porMeta(usuario: UsuarioAtual, id: string): Promise<ResultadoMeta> {
    const pedida = await this.prisma.meta.findUnique({
      where: { id },
      select: { metaPaiId: true },
    });
    if (pedida === null) throw new ErroApi(CodigoErro.NAO_ENCONTRADO, 'Meta não encontrada.');
    const raizId = pedida.metaPaiId ?? id;
    const meta = await this.prisma.meta.findUniqueOrThrow({
      where: { id: raizId },
      select: {
        ...CAMPOS_RESULTADO,
        cicloId: true,
        ciclo: { select: { id: true, ano: true, status: true } },
        setorId: true,
        responsavelId: true,
        regraPontuacao: true,
        setor: { select: { nome: true, corporativo: true } },
        atribuicoes: {
          select: {
            usuarioId: true,
            peso: true,
            usuario: { select: { nome: true } },
            resultado: { select: { pontos: true } },
          },
          orderBy: { usuario: { nome: 'asc' } },
        },
        submetas: {
          select: { ...CAMPOS_RESULTADO, pesoInterno: true },
          orderBy: [{ ordem: 'asc' }, { codigo: 'asc' }],
        },
      },
    });
    const acesso = {
      setorId: meta.setorId,
      responsavelId: meta.responsavelId,
      atribuidos: meta.atribuicoes.map((a) => a.usuarioId),
    };
    const rascunhoOculto =
      meta.ciclo.status === StatusCiclo.RASCUNHO && !this.politicas.veResultadosEmRascunho(usuario);
    if (rascunhoOculto || !this.politicas.podeVerMeta(usuario, acesso)) {
      // Mesmo erro de meta inexistente: não revela que ela existe.
      throw new ErroApi(CodigoErro.NAO_ENCONTRADO, 'Meta não encontrada.');
    }
    const todos = this.politicas.vePontosDeTodos(usuario);
    return {
      ...item(meta),
      cicloId: meta.cicloId,
      ciclo: meta.ciclo,
      setorId: meta.setorId,
      setorNome: meta.setor.nome,
      bloco: meta.setor.corporativo ? Bloco.CORPORATIVO : Bloco.DEPARTAMENTAL,
      regraPontuacao: meta.regraPontuacao,
      ativo: meta.ativo,
      submetas: meta.submetas.map((s) => ({ ...item(s), pesoInterno: textoOuNulo(s.pesoInterno) })),
      atribuicoes: meta.atribuicoes
        .filter((a) => todos || a.usuarioId === usuario.id)
        .map((a) => ({
          usuarioId: a.usuarioId,
          usuarioNome: a.usuario.nome,
          peso: texto(a.peso),
          pontos: a.resultado === null ? null : texto(a.resultado.pontos),
        })),
    };
  }

  /**
   * `GET /resultados/gestor/{id}?ciclo=`: metas atribuídas ao gestor e as notas (7.5). Sem ciclo,
   * o ativo; sem ativo, o encerrado mais recente em que ele tem metas (P20).
   */
  async porGestor(
    usuario: UsuarioAtual,
    gestorId: string,
    cicloPedido: string | undefined,
  ): Promise<ResultadosGestor> {
    const acesso = this.politicas.acessoResultadosDoGestor(usuario, gestorId);
    if (acesso === null) {
      throw new ErroApi(CodigoErro.SEM_PERMISSAO, 'Você só pode ver os seus próprios resultados.');
    }
    const gestor = await this.prisma.usuario.findUnique({
      where: { id: gestorId },
      select: { id: true, nome: true },
    });
    if (gestor === null) throw new ErroApi(CodigoErro.NAO_ENCONTRADO, 'Gestor não encontrado.');

    const veRascunho = this.politicas.veResultadosEmRascunho(usuario);
    const doSetorVisivel =
      acesso === 'SETORES' ? { setorId: { in: [...usuario.setoresLeitor] } } : {};
    // Ciclos em que o gestor tem metas que o usuário pode ver: o seletor de ano.
    const ciclos: CicloResumo[] = await this.prisma.ciclo.findMany({
      where: {
        ...(veRascunho ? {} : { status: { not: StatusCiclo.RASCUNHO } }),
        metas: {
          some: {
            ativo: true,
            metaPaiId: null,
            ...doSetorVisivel,
            atribuicoes: { some: { usuarioId: gestorId } },
          },
        },
      },
      select: { id: true, ano: true, status: true },
      orderBy: { ano: 'desc' },
    });

    let ciclo: CicloResumo | null;
    if (cicloPedido === undefined) {
      ciclo =
        ciclos.find((c) => c.status === StatusCiclo.ATIVO) ??
        ciclos.find((c) => c.status === StatusCiclo.ENCERRADO) ??
        null;
    } else {
      ciclo = await this.prisma.ciclo.findUnique({
        where: { id: cicloPedido },
        select: { id: true, ano: true, status: true },
      });
      if (ciclo === null || (ciclo.status === StatusCiclo.RASCUNHO && !veRascunho)) {
        throw new ErroApi(CodigoErro.NAO_ENCONTRADO, 'Ciclo não encontrado.');
      }
    }
    if (ciclo === null) {
      return { ciclo: null, ciclos, usuario: gestor, notas: null, metas: [] };
    }
    const cicloId = ciclo.id;

    const atribuicoes = await this.prisma.metaAtribuicao.findMany({
      where: {
        usuarioId: gestorId,
        meta: {
          cicloId,
          ativo: true,
          metaPaiId: null,
          ...doSetorVisivel,
        },
      },
      select: {
        peso: true,
        resultado: { select: { pontos: true } },
        meta: {
          select: {
            id: true,
            codigo: true,
            indicador: true,
            unidade: true,
            setorId: true,
            operador: true,
            tolerancia: true,
            regraPontuacao: true,
            ordem: true,
            setor: { select: { nome: true, corporativo: true } },
            resultado: {
              select: {
                resultadoAcumulado: true,
                objetivoUsado: true,
                atendimento: true,
                situacao: true,
                memoria: true,
                calculadoEm: true,
              },
            },
          },
        },
      },
    });
    // Corporativo primeiro, depois setor e ordem do cadastro.
    const ordenadas = [...atribuicoes].sort(
      (a, b) =>
        Number(b.meta.setor.corporativo) - Number(a.meta.setor.corporativo) ||
        a.meta.setor.nome.localeCompare(b.meta.setor.nome) ||
        a.meta.ordem - b.meta.ordem ||
        a.meta.codigo.localeCompare(b.meta.codigo),
    );
    const metas: MetaDoGestor[] = ordenadas.map(({ meta, peso, resultado }) => ({
      metaId: meta.id,
      codigo: meta.codigo,
      indicador: meta.indicador,
      unidade: meta.unidade,
      bloco: meta.setor.corporativo ? Bloco.CORPORATIVO : Bloco.DEPARTAMENTAL,
      setorId: meta.setorId,
      setorNome: meta.setor.nome,
      operador: meta.operador,
      tolerancia: textoOuNulo(meta.tolerancia),
      regraPontuacao: meta.regraPontuacao,
      peso: texto(peso),
      pontos: resultado === null ? null : texto(resultado.pontos),
      resultado: acumulado(meta.resultado),
    }));

    return {
      ciclo,
      ciclos,
      usuario: gestor,
      notas: acesso === 'COMPLETO' ? await this.notas(cicloId, gestorId) : null,
      metas,
    };
  }

  private async notas(cicloId: string, usuarioId: string): Promise<NotasGestor> {
    const linhas = await this.prisma.notaGestor.findMany({ where: { cicloId, usuarioId } });
    const bloco = (b: Bloco) => {
      const linha = linhas.find((l) => l.bloco === b);
      return linha === undefined
        ? null
        : { peso: texto(linha.pesoTotal), pontos: texto(linha.pontos) };
    };
    const total = linhas.reduce((soma, l) => soma.plus(texto(l.pontos)), new Decimal(0));
    return {
      corporativo: bloco(Bloco.CORPORATIVO),
      departamental: bloco(Bloco.DEPARTAMENTAL),
      total: total.toFixed(),
      calculadoEm:
        linhas.length === 0
          ? null
          : new Date(Math.max(...linhas.map((l) => l.calculadoEm.getTime()))).toISOString(),
    };
  }
}
