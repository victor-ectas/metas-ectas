import { Injectable } from '@nestjs/common';
import { Prisma } from '@metas/prisma';
import {
  dataFechamento,
  Decimal,
  diasUteisRestantes,
  noFusoDasRegras,
  statusMes,
} from '@metas/motor';
import {
  CodigoErro,
  type ConflitoLancamento,
  EscopoReabertura,
  type LancamentosEntrada,
  type LancamentosMes,
  type LancamentosSalvos,
  type MesLancamento,
  type MetaLancamento,
  OrigemLancamento,
  Perfil,
  type ProblemaLancamento,
  StatusCiclo,
  StatusMes,
  TipoVariavel,
  type VariavelLancamento,
} from '@metas/tipos';

import type { Transacao } from '../auditoria/auditoria.service.js';
import type { UsuarioAtual } from '../auth/usuario-atual.js';
import { ErroApi } from '../comum/erro-api.js';
import { Relogio } from '../comum/relogio.js';
import { PoliticasService, responsavelPeloLancamento } from '../politicas/politicas.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ResultadosService } from '../resultados/resultados.service.js';

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const;
const nomeMes = (mes: number, ano: number): string => `${MESES[mes - 1] ?? ''}/${String(ano)}`;
const dataBr = (instante: Date): string => noFusoDasRegras(instante).toFormat('dd/MM/yyyy');
const texto = (valor: Prisma.Decimal): string => valor.toFixed();
const textoOuNulo = (valor: Prisma.Decimal | null): string | null =>
  valor === null ? null : texto(valor);

const VARIAVEL = {
  id: true,
  setorId: true,
  codigo: true,
  nome: true,
  tipo: true,
  acumulacao: true,
  casasDecimais: true,
  ativo: true,
  cicloId: true,
  responsavelId: true,
  setor: { select: { codigo: true, nome: true, corporativo: true } },
} as const satisfies Prisma.VariavelSelect;
type VariavelBanco = Prisma.VariavelGetPayload<{ select: typeof VARIAVEL }>;

const DEFINICAO = {
  id: true,
  codigo: true,
  indicador: true,
  unidade: true,
  formulaTexto: true,
  modoApuracao: true,
  operador: true,
  tolerancia: true,
  mesInicio: true,
  mesFim: true,
  pesoInterno: true,
  objetivos: { select: { mes: true, valor: true }, orderBy: { mes: 'asc' } },
  variaveis: {
    select: {
      variavel: { select: { id: true, codigo: true, setor: { select: { codigo: true } } } },
    },
  },
} as const satisfies Prisma.MetaSelect;
type DefinicaoBanco = Prisma.MetaGetPayload<{ select: typeof DEFINICAO }>;

interface ReaberturaBanco {
  id: string;
  mes: number;
  escopo: EscopoReabertura;
  escopoId: string | null;
  validoAte: Date;
  canceladaEm: Date | null;
}

/** Contexto de calendário do ciclo: feriados e reaberturas, para o status de cada mês (RN-34). */
interface Calendario {
  ano: number;
  feriados: string[];
  reaberturas: ReaberturaBanco[];
}

/**
 * Lançamentos (CLAUDE.md P18, RN-07 a RN-12, RN-34 a RN-38, RN-40).
 *
 * - Gestor: lança só no ciclo ativo, nas variáveis pelas quais responde (RN-07) e nos meses
 *   abertos ou reabertos para ele (RN-34, RN-36). Origem DIGITACAO.
 * - Administrador: carga histórica (RN-38), em qualquer mês, ignorando a trava; só não lança em
 *   ciclo encerrado (RN-39). Origem CARGA_HISTORICA.
 * - Valor: SIM/NÃO só 0 ou 1; no máximo as casas decimais da variável (percentual contado como
 *   digitado, de 0 a 100); qualquer sinal (decisão do desenvolvedor, 13/11/2026).
 * - Lote tudo ou nada, com versão por item (controle otimista) e histórico somente inclusão. Item
 *   igual ao gravado não gera histórico nem nova versão. Depois, recálculo das metas que usam as
 *   variáveis (P17).
 */
@Injectable()
export class LancamentosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly politicas: PoliticasService,
    private readonly resultados: ResultadosService,
    private readonly relogio: Relogio,
  ) {}

  // ---------------------------------------------------------------------------------------------
  // Consulta
  // ---------------------------------------------------------------------------------------------

  async consultar(
    usuario: UsuarioAtual,
    cicloPedido: string | undefined,
    mesPedido: number | undefined,
  ): Promise<LancamentosMes> {
    const ciclo =
      cicloPedido === undefined ? await this.cicloAtivo() : await this.obterCiclo(cicloPedido);
    const cicloId = ciclo.id;
    const carga = this.politicas.podeFazerCargaHistorica(usuario);
    const calendario = await this.calendario(this.prisma, ciclo.id, ciclo.ano);
    const agora = this.relogio.agora();

    const todas = await this.prisma.variavel.findMany({
      where: { cicloId, ativo: true },
      select: VARIAVEL,
      orderBy: [{ setor: { nome: 'asc' } }, { codigo: 'asc' }],
    });
    const responsaveis = await this.responsaveisDosSetores(this.prisma, cicloId);
    const editaveis = new Set(
      todas.filter((v) => carga || this.responde(usuario, v, responsaveis)).map((v) => v.id),
    );

    // Metas ativas que usam alguma variável do usuário, com as submetas ativas.
    const raizes = await this.prisma.meta.findMany({
      where: {
        cicloId,
        ativo: true,
        metaPaiId: null,
        OR: [
          { variaveis: { some: { variavelId: { in: [...editaveis] } } } },
          {
            submetas: {
              some: { ativo: true, variaveis: { some: { variavelId: { in: [...editaveis] } } } },
            },
          },
        ],
      },
      select: {
        ...DEFINICAO,
        regraPontuacao: true,
        setor: { select: { codigo: true, nome: true } },
        submetas: {
          where: { ativo: true },
          select: DEFINICAO,
          orderBy: [{ ordem: 'asc' }, { codigo: 'asc' }],
        },
      },
      orderBy: [{ setor: { nome: 'asc' } }, { ordem: 'asc' }, { codigo: 'asc' }],
    });

    // Variáveis mostradas: as do usuário e as outras que as fórmulas dessas metas usam.
    const usadas = new Set(
      raizes.flatMap((r) =>
        [r, ...r.submetas].flatMap((m) => m.variaveis.map((v) => v.variavel.id)),
      ),
    );
    const mostradas = todas.filter((v) => editaveis.has(v.id) || usadas.has(v.id));
    const lancamentos = await this.prisma.lancamento.findMany({
      where: { variavelId: { in: mostradas.map((v) => v.id) } },
      select: {
        variavelId: true,
        mes: true,
        valor: true,
        versao: true,
        origem: true,
        atualizadoEm: true,
      },
    });
    const porChave = new Map(lancamentos.map((l) => [`${l.variavelId}:${String(l.mes)}`, l]));

    // Seletor de meses: status para o usuário, prazo, dias úteis e pendências (9.2).
    const minhas = mostradas.filter((v) => editaveis.has(v.id));
    const meses: MesLancamento[] = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      let status = this.status(calendario, m, agora, this.reaberturasDe(calendario, usuario, null));
      const reabertaParaAlguma = minhas.some(
        (v) =>
          this.status(calendario, m, agora, this.reaberturasDe(calendario, usuario, v)) ===
          StatusMes.REABERTO,
      );
      if (status === StatusMes.FECHADO && reabertaParaAlguma) status = StatusMes.REABERTO;
      const prazo = dataFechamento(ciclo.ano, m, calendario.feriados);
      return {
        mes: m,
        status,
        fechaEm: prazo.toJSDate().toISOString(),
        diasUteisRestantes:
          status === StatusMes.ABERTO
            ? diasUteisRestantes(agora, prazo, calendario.feriados)
            : null,
        pendentes: minhas.filter((v) => {
          const l = porChave.get(`${v.id}:${String(m)}`);
          return l === undefined || l.valor === null;
        }).length,
      };
    });
    const mes = mesPedido ?? this.mesInicial(meses, ciclo.ano, agora);

    const variaveis: VariavelLancamento[] = mostradas.map((v) => {
      const doMes = porChave.get(`${v.id}:${String(mes)}`);
      return {
        id: v.id,
        setorId: v.setorId,
        setorCodigo: v.setor.codigo,
        setorNome: v.setor.nome,
        codigo: v.codigo,
        nome: v.nome,
        tipo: v.tipo,
        acumulacao: v.acumulacao,
        casasDecimais: v.casasDecimais,
        editavel: editaveis.has(v.id),
        status: this.status(calendario, mes, agora, this.reaberturasDe(calendario, usuario, v)),
        valor: doMes === undefined ? null : textoOuNulo(doMes.valor),
        versao: doMes?.versao ?? 0,
        origem: doMes?.origem ?? null,
        atualizadoEm: doMes?.atualizadoEm.toISOString() ?? null,
        valoresAno: Array.from({ length: 12 }, (_, i) => {
          const l = porChave.get(`${v.id}:${String(i + 1)}`);
          return l === undefined ? null : textoOuNulo(l.valor);
        }),
      };
    });

    const definicao = (m: DefinicaoBanco, setorDaMeta: string) => {
      const chaves: Record<string, string> = {};
      for (const { variavel } of m.variaveis) {
        chaves[`${variavel.setor.codigo}.${variavel.codigo}`] = variavel.id;
        if (variavel.setor.codigo === setorDaMeta) chaves[variavel.codigo] = variavel.id;
      }
      return {
        id: m.id,
        codigo: m.codigo,
        indicador: m.indicador,
        unidade: m.unidade,
        formula: m.formulaTexto,
        modoApuracao: m.modoApuracao,
        operador: m.operador,
        tolerancia: textoOuNulo(m.tolerancia),
        mesInicio: m.mesInicio,
        mesFim: m.mesFim,
        objetivos: m.objetivos.map((o) => ({ mes: o.mes, valor: texto(o.valor) })),
        pesoInterno: textoOuNulo(m.pesoInterno),
        variaveis: chaves,
      };
    };
    const metas: MetaLancamento[] = raizes.map((r) => ({
      ...definicao(r, r.setor.codigo),
      setorNome: r.setor.nome,
      regraPontuacao: r.regraPontuacao,
      submetas: r.submetas.map((s) => definicao(s, r.setor.codigo)),
    }));

    return {
      ciclo: { id: ciclo.id, ano: ciclo.ano, status: ciclo.status },
      mes,
      status: this.status(calendario, mes, agora, this.reaberturasDe(calendario, usuario, null)),
      fechaEm: dataFechamento(ciclo.ano, mes, calendario.feriados).toJSDate().toISOString(),
      meses,
      cargaHistorica: carga,
      variaveis,
      metas,
    };
  }

  // ---------------------------------------------------------------------------------------------
  // Gravação
  // ---------------------------------------------------------------------------------------------

  async salvar(usuario: UsuarioAtual, dados: LancamentosEntrada): Promise<LancamentosSalvos> {
    const ciclo = await this.obterCiclo(dados.ciclo);
    const ano = String(ciclo.ano);
    if (ciclo.status === StatusCiclo.ENCERRADO) {
      throw new ErroApi(
        CodigoErro.CICLO_ENCERRADO,
        `O ciclo ${ano} está encerrado e não aceita lançamentos.`,
      );
    }
    const carga = this.politicas.podeFazerCargaHistorica(usuario);
    if (!carga && ciclo.status !== StatusCiclo.ATIVO) {
      throw new ErroApi(
        CodigoErro.STATUS_CICLO_INVALIDO,
        `O ciclo ${ano} ainda não foi ativado: os lançamentos começam depois da ativação.`,
      );
    }

    const ids = [...new Set(dados.itens.map((i) => i.variavelId))];
    const variaveis = new Map(
      (await this.prisma.variavel.findMany({ where: { id: { in: ids } }, select: VARIAVEL })).map(
        (v) => [v.id, v],
      ),
    );
    const responsaveis = await this.responsaveisDosSetores(this.prisma, ciclo.id);
    const calendario = await this.calendario(this.prisma, ciclo.id, ciclo.ano);
    const agora = this.relogio.agora();

    // Problemas por gravidade: permissão, mês futuro, mês fechado, valor inválido.
    const problemas = {
      permissao: [] as ProblemaLancamento[],
      futuro: [] as ProblemaLancamento[],
      fechado: [] as ProblemaLancamento[],
      invalido: [] as ProblemaLancamento[],
    };
    const reaberturaDoItem = new Map<number, string>();
    dados.itens.forEach((item, indice) => {
      const problema = (mensagem: string): ProblemaLancamento => ({
        indice,
        variavelId: item.variavelId,
        mes: item.mes,
        mensagem,
      });
      const v = variaveis.get(item.variavelId);
      if (v?.cicloId !== ciclo.id) {
        problemas.invalido.push(problema('Variável não encontrada neste ciclo.'));
        return;
      }
      if (!v.ativo) {
        problemas.invalido.push(problema(`A variável ${v.codigo} está inativa.`));
        return;
      }
      if (!carga) {
        if (!this.responde(usuario, v, responsaveis)) {
          problemas.permissao.push(
            problema(`Você não é o responsável pelo lançamento da variável ${v.codigo}.`),
          );
          return;
        }
        const reaberturas = this.reaberturasDe(calendario, usuario, v);
        const status = this.status(calendario, item.mes, agora, reaberturas);
        if (status === StatusMes.FUTURO) {
          problemas.futuro.push(
            problema(`${nomeMes(item.mes, ciclo.ano)} ainda não começou: não aceita lançamentos.`),
          );
          return;
        }
        if (status === StatusMes.FECHADO) {
          const prazo = dataFechamento(ciclo.ano, item.mes, calendario.feriados).toJSDate();
          problemas.fechado.push(
            problema(`${nomeMes(item.mes, ciclo.ano)} fechou em ${dataBr(prazo)}.`),
          );
          return;
        }
        if (status === StatusMes.REABERTO) {
          const vigente = this.reaberturaVigente(reaberturas, item.mes, agora);
          if (vigente !== undefined) reaberturaDoItem.set(indice, vigente);
        }
      }
      const erroValor = this.validarValor(v, item.valor);
      if (erroValor !== null) problemas.invalido.push(problema(erroValor));
    });

    const ordem: [ProblemaLancamento[], CodigoErro][] = [
      [problemas.permissao, CodigoErro.SEM_PERMISSAO_VARIAVEL],
      [problemas.futuro, CodigoErro.MES_FUTURO],
      [problemas.fechado, CodigoErro.MES_FECHADO],
      [problemas.invalido, CodigoErro.VALIDACAO],
    ];
    for (const [lista, codigo] of ordem) {
      const [primeiro] = lista;
      if (primeiro !== undefined) {
        const todos = [
          ...problemas.permissao,
          ...problemas.futuro,
          ...problemas.fechado,
          ...problemas.invalido,
        ].sort((a, b) => a.indice - b.indice);
        throw new ErroApi(codigo, primeiro.mensagem, { itens: todos });
      }
    }

    const origem = carga ? OrigemLancamento.CARGA_HISTORICA : OrigemLancamento.DIGITACAO;
    try {
      return await this.prisma.$transaction(
        (tx) => this.gravar(tx, usuario, dados, origem, reaberturaDoItem),
        { timeout: 30_000 },
      );
    } catch (erro) {
      // Duas gravações simultâneas do primeiro valor da mesma variável e mês.
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
        throw new ErroApi(
          CodigoErro.CONFLITO_VERSAO,
          'Outra pessoa salvou estes valores ao mesmo tempo. Recarregue e confira antes de salvar.',
        );
      }
      throw erro;
    }
  }

  private async gravar(
    tx: Transacao,
    usuario: UsuarioAtual,
    dados: LancamentosEntrada,
    origem: OrigemLancamento,
    reaberturaDoItem: ReadonlyMap<number, string>,
  ): Promise<LancamentosSalvos> {
    const existentes = await tx.lancamento.findMany({
      where: {
        OR: dados.itens.map((i) => ({ variavelId: i.variavelId, mes: i.mes })),
      },
      select: {
        id: true,
        variavelId: true,
        mes: true,
        valor: true,
        versao: true,
        atualizadoEm: true,
      },
    });
    const porChave = new Map(existentes.map((l) => [`${l.variavelId}:${String(l.mes)}`, l]));

    const conflitos: ConflitoLancamento[] = [];
    for (const item of dados.itens) {
      const atual = porChave.get(`${item.variavelId}:${String(item.mes)}`);
      if ((atual?.versao ?? 0) !== item.versao) {
        conflitos.push({
          variavelId: item.variavelId,
          mes: item.mes,
          valorAtual: atual === undefined ? null : textoOuNulo(atual.valor),
          versaoAtual: atual?.versao ?? 0,
          atualizadoEm: atual?.atualizadoEm.toISOString() ?? null,
        });
      }
    }
    if (conflitos.length > 0) {
      throw new ErroApi(
        CodigoErro.CONFLITO_VERSAO,
        conflitos.length === 1
          ? 'Um valor foi alterado por outra pessoa depois que você abriu a tela. Confira o valor atual antes de salvar.'
          : `${String(conflitos.length)} valores foram alterados por outra pessoa depois que você abriu a tela. Confira os valores atuais antes de salvar.`,
        { conflitos },
      );
    }

    const mudaram = new Set<string>();
    const salvos: LancamentosSalvos['itens'] = [];
    let gravados = 0;
    for (const [indice, item] of dados.itens.entries()) {
      const atual = porChave.get(`${item.variavelId}:${String(item.mes)}`);
      const anterior = atual === undefined ? null : textoOuNulo(atual.valor);
      const igual =
        anterior === null || item.valor === null
          ? anterior === item.valor
          : new Decimal(anterior).eq(item.valor);
      if (igual) {
        salvos.push({ ...item, versao: atual?.versao ?? 0 });
        continue;
      }

      let lancamentoId: string;
      let versao: number;
      if (atual === undefined) {
        const criado = await tx.lancamento.create({
          data: {
            variavelId: item.variavelId,
            mes: item.mes,
            valor: item.valor,
            origem,
            versao: 1,
            criadoPor: usuario.id,
            atualizadoPor: usuario.id,
          },
          select: { id: true },
        });
        lancamentoId = criado.id;
        versao = 1;
      } else {
        // A condição na versão fecha a corrida entre a leitura acima e esta gravação.
        const { count } = await tx.lancamento.updateMany({
          where: { id: atual.id, versao: atual.versao },
          data: {
            valor: item.valor,
            origem,
            versao: { increment: 1 },
            atualizadoPor: usuario.id,
          },
        });
        if (count === 0) {
          throw new ErroApi(
            CodigoErro.CONFLITO_VERSAO,
            'Um valor foi alterado por outra pessoa enquanto você salvava. Recarregue e confira.',
          );
        }
        lancamentoId = atual.id;
        versao = atual.versao + 1;
      }
      await tx.lancamentoHistorico.create({
        data: {
          lancamentoId,
          valorAnterior: anterior,
          valorNovo: item.valor,
          origem,
          usuarioId: usuario.id,
          reaberturaId: reaberturaDoItem.get(indice) ?? null,
        },
      });
      mudaram.add(item.variavelId);
      salvos.push({ ...item, versao });
      gravados++;
    }

    await this.resultados.recalcularPorVariaveis(tx, [...mudaram]);
    return { gravados, itens: salvos };
  }

  // ---------------------------------------------------------------------------------------------
  // Apoio
  // ---------------------------------------------------------------------------------------------

  /**
   * Mês mostrado quando a tela não pede um (especificação 9.2): o aberto mais antigo com
   * pendências; senão, o último aberto; senão, o mês corrente (ou o mais próximo dele no ciclo).
   */
  private mesInicial(meses: readonly MesLancamento[], ano: number, agora: Date): number {
    const abertos = meses.filter(
      (m) => m.status === StatusMes.ABERTO || m.status === StatusMes.REABERTO,
    );
    const comPendencia = abertos.find((m) => m.pendentes > 0);
    if (comPendencia !== undefined) return comPendencia.mes;
    const ultimoAberto = abertos.at(-1);
    if (ultimoAberto !== undefined) return ultimoAberto.mes;
    const hoje = noFusoDasRegras(agora);
    if (hoje.year < ano) return 1;
    if (hoje.year > ano) return 12;
    return hoje.month;
  }

  private async cicloAtivo() {
    const ciclo = await this.prisma.ciclo.findFirst({
      where: { status: StatusCiclo.ATIVO },
      select: { id: true, ano: true, status: true },
    });
    if (ciclo === null) {
      throw new ErroApi(CodigoErro.NAO_ENCONTRADO, 'Não há ciclo ativo para lançamento.');
    }
    return ciclo;
  }

  private async obterCiclo(id: string) {
    const ciclo = await this.prisma.ciclo.findUnique({
      where: { id },
      select: { id: true, ano: true, status: true },
    });
    if (ciclo === null) throw new ErroApi(CodigoErro.NAO_ENCONTRADO, 'Ciclo não encontrado.');
    return ciclo;
  }

  private async responsaveisDosSetores(
    cliente: PrismaService | Transacao,
    cicloId: string,
  ): Promise<Map<string, string>> {
    const linhas = await cliente.setorResponsavel.findMany({
      where: { cicloId },
      select: { setorId: true, usuarioId: true },
    });
    return new Map(linhas.map((l) => [l.setorId, l.usuarioId]));
  }

  /** O usuário responde pelo lançamento da variável (RN-07), decidido pelo PoliticasService. */
  private responde(
    usuario: UsuarioAtual,
    v: VariavelBanco,
    responsaveis: ReadonlyMap<string, string>,
  ): boolean {
    return this.politicas.podeLancar(usuario, {
      responsavelId: responsavelPeloLancamento({
        setorCorporativo: v.setor.corporativo,
        responsavelDaVariavel: v.responsavelId,
        responsavelDoSetorNoCiclo: responsaveis.get(v.setorId) ?? null,
      }),
    });
  }

  /**
   * Feriados que decidem os prazos dos meses do ciclo (o de dezembro cai em janeiro do ano
   * seguinte) e as reaberturas do ciclo.
   */
  private async calendario(
    cliente: PrismaService | Transacao,
    cicloId: string,
    ano: number,
  ): Promise<Calendario> {
    const feriados = await cliente.feriado.findMany({
      where: {
        data: { gte: new Date(Date.UTC(ano, 0, 1)), lt: new Date(Date.UTC(ano + 1, 2, 1)) },
      },
      select: { data: true },
    });
    const reaberturas = await cliente.reabertura.findMany({
      where: { cicloId },
      select: {
        id: true,
        mes: true,
        escopo: true,
        escopoId: true,
        validoAte: true,
        canceladaEm: true,
      },
    });
    return {
      ano,
      feriados: feriados.map((f) => f.data.toISOString().slice(0, 10)),
      reaberturas,
    };
  }

  /**
   * Reaberturas que valem para o usuário (RN-36): de todos, do setor da variável ou dele. Sem
   * variável, as de todos e as dele (situação geral do mês).
   */
  private reaberturasDe(
    calendario: Calendario,
    usuario: UsuarioAtual,
    v: VariavelBanco | null,
  ): ReaberturaBanco[] {
    return calendario.reaberturas.filter(
      (r) =>
        r.escopo === EscopoReabertura.TODOS ||
        (r.escopo === EscopoReabertura.GESTOR && r.escopoId === usuario.id) ||
        (r.escopo === EscopoReabertura.SETOR && v !== null && r.escopoId === v.setorId),
    );
  }

  private status(
    calendario: Calendario,
    mes: number,
    agora: Date,
    reaberturas: readonly ReaberturaBanco[],
  ): StatusMes {
    return statusMes(
      calendario.ano,
      mes,
      agora,
      calendario.feriados,
      reaberturas.map((r) => ({
        ano: calendario.ano,
        mes: r.mes,
        validoAte: r.validoAte,
        canceladaEm: r.canceladaEm,
      })),
    );
  }

  /** Reabertura que liberou o mês agora (a de prazo mais longo), para ligar ao histórico. */
  private reaberturaVigente(
    reaberturas: readonly ReaberturaBanco[],
    mes: number,
    agora: Date,
  ): string | undefined {
    return reaberturas
      .filter(
        (r) =>
          r.mes === mes &&
          r.validoAte.getTime() >= agora.getTime() &&
          (r.canceladaEm === null || r.canceladaEm.getTime() > agora.getTime()),
      )
      .sort((a, b) => b.validoAte.getTime() - a.validoAte.getTime())[0]?.id;
  }

  /** Regras do valor (decisão de 13/11/2026). `null` (vazio) sempre vale. */
  private validarValor(v: VariavelBanco, valor: string | null): string | null {
    if (valor === null) return null;
    const numero = new Decimal(valor);
    if (v.tipo === TipoVariavel.SIM_NAO) {
      return numero.eq(0) || numero.eq(1)
        ? null
        : `A variável ${v.codigo} é SIM/NÃO: use 1 (sim) ou 0 (não).`;
    }
    // Percentual é guardado como fração e digitado de 0 a 100: as casas contam no digitado.
    const digitado = v.tipo === TipoVariavel.PERCENTUAL ? numero.times(100) : numero;
    if (digitado.decimalPlaces() > v.casasDecimais) {
      return v.casasDecimais === 0
        ? `A variável ${v.codigo} aceita só números inteiros.`
        : `A variável ${v.codigo} aceita no máximo ${String(v.casasDecimais)} ${
            v.casasDecimais === 1 ? 'casa decimal' : 'casas decimais'
          }.`;
    }
    return null;
  }
}

/** Para o controller: só Gestor e Administrador usam a tela de lançamento (7.5). */
export const PERFIS_LANCAMENTO = [Perfil.GESTOR, Perfil.ADMIN] as const;
