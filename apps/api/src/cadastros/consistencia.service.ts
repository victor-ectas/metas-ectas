import { Injectable } from '@nestjs/common';
import { Prisma } from '@metas/prisma';
import {
  calcularCiclo,
  dataFechamento,
  type MetaEntrada as MetaMotor,
  type No,
  noFusoDasRegras,
  validar,
  validarMeta,
  validarPesosGestor,
} from '@metas/motor';
import {
  Bloco,
  type Ciclo,
  CodigoErro,
  type ConsistenciaCiclo,
  GravidadeProblema,
  Perfil,
  type PesosGestor,
  type ProblemaConsistencia,
  StatusCiclo,
  TipoProblema,
} from '@metas/tipos';

import { type Autor, AuditoriaService, type Transacao } from '../auditoria/auditoria.service.js';
import { ErroApi } from '../comum/erro-api.js';
import { traduzirErroBanco } from '../comum/erros-banco.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { carregarCiclo } from '../resultados/carregar-ciclo.js';
import { ResultadosService } from '../resultados/resultados.service.js';

type Cliente = PrismaService | Transacao;

const CAMPOS_META = {
  id: true,
  codigo: true,
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
} as const satisfies Prisma.MetaSelect;

type MetaBanco = Prisma.MetaGetPayload<{ select: typeof CAMPOS_META }>;

const USUARIO = { select: { id: true, nome: true, perfil: true, ativo: true } } as const;
type UsuarioBanco = { id: string; nome: string; perfil: Perfil; ativo: boolean };

const gestorAtivo = (u: UsuarioBanco | null): boolean =>
  u !== null && u.ativo && u.perfil === Perfil.GESTOR;

const texto = (valor: Prisma.Decimal): string => valor.toFixed();
const dataBr = (instante: Date): string => noFusoDasRegras(instante).toFormat('dd/MM/yyyy');
const SELECAO_CICLO = { id: true, ano: true, status: true, encerradoEm: true } as const;

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const;

/**
 * Painel de consistência, ativação e encerramento do ciclo (P15, RF-07, RF-16, RN-03, RN-32).
 *
 * Decisões do desenvolvedor (12/11/2026, ADR-021):
 * - só um ciclo ativo: ativar o novo exige o anterior encerrado;
 * - encerrar só ciclo ativo, depois do prazo de dezembro e sem reabertura em vigor;
 * - bloqueiam a ativação: pesos do gestor, pesos internos e demais regras da meta, fórmula
 *   inválida, meta sem atribuição, usuário que deixou de ser Gestor ativo, variável do
 *   Corporativo sem responsável e setor com variáveis ou metas sem responsável. O resto avisa.
 */
@Injectable()
export class ConsistenciaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly resultados: ResultadosService,
  ) {}

  /** Instante atual; separado para os testes. */
  protected agora(): Date {
    return new Date();
  }

  async avaliar(cicloId: string, cliente: Cliente = this.prisma): Promise<ConsistenciaCiclo> {
    const ciclo = await cliente.ciclo.findUnique({ where: { id: cicloId }, select: SELECAO_CICLO });
    if (ciclo === null) throw new ErroApi(CodigoErro.NAO_ENCONTRADO, 'Ciclo não encontrado.');

    // Consultas em sequência: na transação da ativação, a conexão é uma só.
    const outroAtivo = await cliente.ciclo.findFirst({
      where: { status: StatusCiclo.ATIVO, id: { not: cicloId } },
      select: { ano: true },
    });
    const problemasEPesos = await this.problemas(cliente, cicloId);
    const encerramento = await this.encerramento(cliente, ciclo);
    const { problemas, gestores } = problemasEPesos;

    let motivoNaoAtivar: string | null = null;
    if (ciclo.status === StatusCiclo.ENCERRADO) {
      motivoNaoAtivar = `O ciclo ${String(ciclo.ano)} está encerrado.`;
    } else if (ciclo.status === StatusCiclo.ATIVO) {
      motivoNaoAtivar = `O ciclo ${String(ciclo.ano)} já está ativo.`;
    } else if (outroAtivo !== null) {
      motivoNaoAtivar = `Encerre o ciclo ${String(outroAtivo.ano)} antes de ativar o ${String(ciclo.ano)}: só um ciclo fica ativo por vez.`;
    }

    return {
      ciclo: { ...ciclo, encerradoEm: ciclo.encerradoEm?.toISOString() ?? null },
      podeAtivar:
        motivoNaoAtivar === null &&
        !problemas.some((p) => p.gravidade === GravidadeProblema.BLOQUEIA),
      motivoNaoAtivar,
      gestores,
      problemas,
      encerramento,
    };
  }

  /** Rascunho → Ativo, só sem problema que bloqueia e sem outro ciclo ativo (RF-07, RF-16). */
  async ativar(cicloId: string, autor: Autor): Promise<Ciclo> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const painel = await this.avaliar(cicloId, tx);
        const { ciclo } = painel;
        if (ciclo.status === StatusCiclo.ENCERRADO) {
          throw new ErroApi(CodigoErro.CICLO_ENCERRADO, painel.motivoNaoAtivar ?? '');
        }
        if (painel.motivoNaoAtivar !== null) {
          throw new ErroApi(CodigoErro.STATUS_CICLO_INVALIDO, painel.motivoNaoAtivar);
        }
        const bloqueios = painel.problemas.filter(
          (p) => p.gravidade === GravidadeProblema.BLOQUEIA,
        );
        const [primeiro] = bloqueios;
        if (primeiro !== undefined) {
          const quantos =
            bloqueios.length === 1
              ? 'um problema que impede'
              : `${String(bloqueios.length)} problemas que impedem`;
          throw new ErroApi(
            CodigoErro.CICLO_INCONSISTENTE,
            `O ciclo ${String(ciclo.ano)} tem ${quantos} a ativação. Primeiro: ${primeiro.mensagem}`,
            { problemas: bloqueios },
          );
        }

        const alterado = await tx.ciclo.update({
          where: { id: cicloId, status: StatusCiclo.RASCUNHO },
          data: { status: StatusCiclo.ATIVO, atualizadoPor: autor.usuarioId },
          select: SELECAO_CICLO,
        });
        await this.auditoria.registrar(tx, autor, {
          entidade: 'ciclo',
          entidadeId: cicloId,
          acao: 'ATIVAR',
          antes: { status: StatusCiclo.RASCUNHO },
          depois: { status: StatusCiclo.ATIVO, avisos: painel.problemas.length },
        });
        return { ...alterado, encerradoEm: null };
      });
    } catch (erro) {
      throw traduzirErroBanco(erro, 'Ciclo em uso.');
    }
  }

  /**
   * Ativo → Encerrado, depois do prazo de dezembro e sem reabertura em vigor. Calcula o ciclo
   * inteiro com o motor e grava a fotografia final (`nota_fechamento`, RN-32): a nota de cada
   * gestor por bloco, com as metas que a compõem.
   */
  async encerrar(cicloId: string, autor: Autor): Promise<Ciclo> {
    return this.prisma.$transaction(
      async (tx) => {
        const ciclo = await tx.ciclo.findUnique({ where: { id: cicloId }, select: SELECAO_CICLO });
        if (ciclo === null) throw new ErroApi(CodigoErro.NAO_ENCONTRADO, 'Ciclo não encontrado.');
        if (ciclo.status === StatusCiclo.ENCERRADO) {
          throw new ErroApi(
            CodigoErro.CICLO_ENCERRADO,
            `O ciclo ${String(ciclo.ano)} já está encerrado.`,
          );
        }
        const encerramento = await this.encerramento(tx, ciclo);
        if (!encerramento.permitido) {
          throw new ErroApi(CodigoErro.STATUS_CICLO_INVALIDO, encerramento.motivo ?? '');
        }

        // Tabelas de resultado em dia com a fotografia (especificação 6.5: ciclo inteiro).
        await this.resultados.recalcularCiclo(tx, cicloId);
        const { entrada, metas } = await carregarCiclo(tx, cicloId);
        const resultado = calcularCiclo(entrada);
        const porMeta = new Map(resultado.metas.map((m) => [m.metaId, m]));
        const congeladoEm = this.agora();
        const seis = (valor: { toDecimalPlaces(casas: number): { toFixed(): string } }) =>
          valor.toDecimalPlaces(6).toFixed();

        const notas = resultado.notasPorBloco.map((nota) => ({
          cicloId,
          usuarioId: nota.usuarioId,
          bloco: nota.bloco,
          pontos: seis(nota.pontos),
          congeladoEm,
          dados: {
            pesoTotal: seis(nota.pesoTotal),
            metas: resultado.atribuicoes
              .filter((a) => a.usuarioId === nota.usuarioId && a.bloco === nota.bloco)
              .map((a) => {
                const meta = porMeta.get(a.metaId);
                return {
                  metaId: a.metaId,
                  codigo: metas.get(a.metaId)?.codigo ?? '',
                  indicador: metas.get(a.metaId)?.indicador ?? '',
                  peso: seis(a.peso),
                  pontos: seis(a.pontos),
                  acumulado: meta?.acumulado == null ? null : seis(meta.acumulado),
                  objetivo: meta?.objetivo == null ? null : seis(meta.objetivo),
                  atendimento: meta === undefined ? null : seis(meta.atendimento),
                  situacao: meta?.situacao ?? null,
                };
              }),
          },
        }));
        await tx.notaFechamento.createMany({ data: notas });

        const alterado = await tx.ciclo.update({
          where: { id: cicloId, status: StatusCiclo.ATIVO },
          data: {
            status: StatusCiclo.ENCERRADO,
            encerradoEm: congeladoEm,
            encerradoPor: autor.usuarioId,
            atualizadoPor: autor.usuarioId,
          },
          select: SELECAO_CICLO,
        });
        await this.auditoria.registrar(tx, autor, {
          entidade: 'ciclo',
          entidadeId: cicloId,
          acao: 'ENCERRAR',
          antes: { status: StatusCiclo.ATIVO },
          depois: {
            status: StatusCiclo.ENCERRADO,
            notas: notas.map((n) => ({ usuarioId: n.usuarioId, bloco: n.bloco, pontos: n.pontos })),
          },
        });
        return { ...alterado, encerradoEm: congeladoEm.toISOString() };
      },
      { timeout: 30_000 },
    );
  }

  // -------------------------------------------------------------------------------------------

  private async encerramento(
    cliente: Cliente,
    ciclo: { id: string; ano: number; status: StatusCiclo },
  ): Promise<ConsistenciaCiclo['encerramento']> {
    // O 15º dia útil de janeiro depende dos feriados de janeiro (e, por segurança, fevereiro).
    const feriados = await cliente.feriado.findMany({
      where: {
        data: {
          gte: new Date(Date.UTC(ciclo.ano + 1, 0, 1)),
          lt: new Date(Date.UTC(ciclo.ano + 1, 2, 1)),
        },
      },
      select: { data: true },
    });
    const prazo = dataFechamento(
      ciclo.ano,
      12,
      feriados.map((f) => f.data.toISOString().slice(0, 10)),
    ).toJSDate();
    const dezembroFechaEm = prazo.toISOString();
    const agora = this.agora();
    const nao = (motivo: string) => ({ permitido: false, motivo, dezembroFechaEm });

    if (ciclo.status === StatusCiclo.ENCERRADO) {
      return nao(`O ciclo ${String(ciclo.ano)} já está encerrado.`);
    }
    if (ciclo.status === StatusCiclo.RASCUNHO) {
      return nao('Só um ciclo ativo pode ser encerrado.');
    }
    if (agora.getTime() <= prazo.getTime()) {
      return nao(
        `Dezembro/${String(ciclo.ano)} aceita lançamentos até ${dataBr(prazo)}. O ciclo só pode ser encerrado depois.`,
      );
    }
    const reaberta = await cliente.reabertura.findFirst({
      where: { cicloId: ciclo.id, canceladaEm: null, validoAte: { gte: agora } },
      select: { mes: true, validoAte: true },
      orderBy: { validoAte: 'desc' },
    });
    if (reaberta !== null) {
      return nao(
        `${MESES[reaberta.mes - 1] ?? ''}/${String(ciclo.ano)} está reaberto até ${dataBr(reaberta.validoAte)}. Espere o prazo ou cancele a reabertura antes de encerrar.`.replace(
          /^./,
          (letra) => letra.toUpperCase(),
        ),
      );
    }
    return { permitido: true, motivo: null, dezembroFechaEm };
  }

  private async problemas(
    cliente: Cliente,
    cicloId: string,
  ): Promise<{ problemas: ProblemaConsistencia[]; gestores: PesosGestor[] }> {
    // Uma consulta de cada vez: na transação, a conexão é uma só (o `pg` não as aceita juntas).
    const metas = await cliente.meta.findMany({
      where: { cicloId, metaPaiId: null, ativo: true },
      select: {
        ...CAMPOS_META,
        setorId: true,
        setor: { select: { codigo: true, corporativo: true } },
        responsavel: USUARIO,
        atribuicoes: { select: { peso: true, usuario: USUARIO } },
        submetas: { where: { ativo: true }, select: CAMPOS_META },
      },
      orderBy: [{ setor: { nome: 'asc' } }, { ordem: 'asc' }, { codigo: 'asc' }],
    });
    const variaveis = await cliente.variavel.findMany({
      where: { cicloId, ativo: true },
      select: {
        id: true,
        codigo: true,
        setorId: true,
        setor: { select: { codigo: true, corporativo: true } },
        responsavel: USUARIO,
      },
      orderBy: [{ setor: { nome: 'asc' } }, { codigo: 'asc' }],
    });
    const setores = await cliente.setor.findMany({
      where: { corporativo: false },
      select: { id: true, nome: true, ativo: true },
      orderBy: { nome: 'asc' },
    });
    const responsaveis = await cliente.setorResponsavel.findMany({
      where: { cicloId },
      select: { setorId: true, usuario: USUARIO },
    });
    const gestoresAtivos = await cliente.usuario.findMany({
      where: { perfil: Perfil.GESTOR, ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    });

    const problemas: ProblemaConsistencia[] = [];
    const adicionar = (
      tipo: TipoProblema,
      gravidade: GravidadeProblema,
      mensagem: string,
      ref: Partial<
        Pick<ProblemaConsistencia, 'metaId' | 'metaCodigo' | 'variavelId' | 'setorId' | 'usuarioId'>
      > & { codigo?: CodigoErro } = {},
    ) => {
      problemas.push({
        tipo,
        gravidade,
        codigo: ref.codigo ?? CodigoErro.VALIDACAO,
        mensagem,
        metaId: ref.metaId ?? null,
        metaCodigo: ref.metaCodigo ?? null,
        variavelId: ref.variavelId ?? null,
        setorId: ref.setorId ?? null,
        usuarioId: ref.usuarioId ?? null,
      });
    };
    const { BLOQUEIA, AVISO } = GravidadeProblema;
    const responsavelDoSetor = new Map(responsaveis.map((r) => [r.setorId, r.usuario]));

    // Chaves das variáveis ativas, como no P13: `SETOR.CODIGO` sempre e `CODIGO` no próprio setor.
    const chavesGlobais = variaveis.map((v) => `${v.setor.codigo}.${v.codigo}`);
    const chavesDoSetor = (setorId: string) => [
      ...chavesGlobais,
      ...variaveis.filter((v) => v.setorId === setorId).map((v) => v.codigo),
    ];

    // --- Metas ------------------------------------------------------------------------------
    const pesos = new Map<
      string,
      { usuario: UsuarioBanco; atribuicoes: { bloco: Bloco; peso: string }[] }
    >();
    for (const meta of metas) {
      const ref = { metaId: meta.id, metaCodigo: meta.codigo };
      const bloco = meta.setor.corporativo ? Bloco.CORPORATIVO : Bloco.DEPARTAMENTAL;
      const chaves = chavesDoSetor(meta.setorId);
      const codigos = new Map([meta, ...meta.submetas].map((m) => [m.id, m.codigo]));

      for (const item of [meta, ...meta.submetas]) {
        if (item.formulaTexto === null) continue;
        const resultado = validar(item.formulaTexto, chaves);
        if (!resultado.valida) {
          for (const erro of resultado.erros) {
            adicionar(
              TipoProblema.FORMULA_INVALIDA,
              BLOQUEIA,
              `Fórmula de ${item.codigo}: ${erro.mensagem}.`,
              { ...ref, codigo: CodigoErro.FORMULA_INVALIDA },
            );
          }
        }
      }

      const paraMotor = (m: MetaBanco, submetas: MetaMotor[]): MetaMotor => ({
        id: m.id,
        formula: m.formulaTexto === null ? null : (m.formulaAst as unknown as No),
        variaveis: {},
        modoApuracao: m.modoApuracao,
        operador: m.operador,
        tolerancia: m.tolerancia === null ? null : texto(m.tolerancia),
        mesInicio: m.mesInicio,
        mesFim: m.mesFim,
        objetivos: Object.fromEntries(m.objetivos.map((o) => [o.mes, texto(o.valor)])),
        regraPontuacao: m.regraPontuacao,
        pesoInterno: m.pesoInterno === null ? null : texto(m.pesoInterno),
        submetas,
      });
      const erros = validarMeta(
        paraMotor(
          meta,
          meta.submetas.map((s) => paraMotor(s, [])),
        ),
      );
      for (const erro of erros) {
        const de = erro.metaId === null ? meta.codigo : (codigos.get(erro.metaId) ?? meta.codigo);
        adicionar(TipoProblema.META_INVALIDA, BLOQUEIA, `${de}: ${erro.mensagem}.`, {
          ...ref,
          codigo: erro.codigo,
        });
      }

      if (!gestorAtivo(meta.responsavel)) {
        adicionar(
          TipoProblema.USUARIO_INVALIDO,
          BLOQUEIA,
          `${meta.codigo}: o responsável ${meta.responsavel.nome} não é mais um Gestor ativo.`,
          { ...ref, usuarioId: meta.responsavel.id },
        );
      }

      if (meta.atribuicoes.length === 0) {
        adicionar(
          TipoProblema.META_SEM_ATRIBUICAO,
          BLOQUEIA,
          `${meta.codigo} não está atribuída a nenhum gestor e não vale pontos.`,
          ref,
        );
      }
      for (const a of meta.atribuicoes) {
        if (!gestorAtivo(a.usuario)) {
          adicionar(
            TipoProblema.USUARIO_INVALIDO,
            BLOQUEIA,
            `${meta.codigo}: está atribuída a ${a.usuario.nome}, que não é mais um Gestor ativo.`,
            { ...ref, usuarioId: a.usuario.id },
          );
        }
        const doGestor = pesos.get(a.usuario.id) ?? { usuario: a.usuario, atribuicoes: [] };
        doGestor.atribuicoes.push({ bloco, peso: texto(a.peso) });
        pesos.set(a.usuario.id, doGestor);
      }

      const doSetor = responsavelDoSetor.get(meta.setorId);
      if (!meta.setor.corporativo && doSetor !== undefined && doSetor.id !== meta.responsavel.id) {
        adicionar(
          TipoProblema.RESPONSAVEL_DIFERENTE,
          AVISO,
          `${meta.codigo}: o responsável é ${meta.responsavel.nome}, mas o setor tem ${doSetor.nome} como responsável no ciclo.`,
          { ...ref, setorId: meta.setorId, usuarioId: meta.responsavel.id },
        );
      }
    }

    // --- Pesos por gestor (RN-03, CT-17) ------------------------------------------------------
    const gestores: PesosGestor[] = [...pesos.values()]
      .sort((a, b) => a.usuario.nome.localeCompare(b.usuario.nome))
      .map(({ usuario, atribuicoes }) => {
        const erros = validarPesosGestor(atribuicoes);
        for (const erro of erros) {
          adicionar(TipoProblema.PESOS_GESTOR, BLOQUEIA, `${usuario.nome}: ${erro.mensagem}.`, {
            codigo: erro.codigo,
            usuarioId: usuario.id,
          });
        }
        const soma = (bloco: Bloco | null) =>
          atribuicoes
            .filter((a) => bloco === null || a.bloco === bloco)
            .reduce((total, a) => total.plus(a.peso), new Prisma.Decimal(0))
            .toFixed();
        return {
          usuarioId: usuario.id,
          nome: usuario.nome,
          ativo: gestorAtivo(usuario),
          corporativo: soma(Bloco.CORPORATIVO),
          departamental: soma(Bloco.DEPARTAMENTAL),
          total: soma(null),
          comCorporativas: atribuicoes.some((a) => a.bloco === Bloco.CORPORATIVO),
          ok: erros.length === 0,
        };
      });

    // --- Variáveis do Corporativo (RN-07) --------------------------------------------------
    for (const v of variaveis) {
      if (!v.setor.corporativo) continue;
      const ref = { variavelId: v.id, setorId: v.setorId };
      if (v.responsavel === null) {
        adicionar(
          TipoProblema.VARIAVEL_SEM_RESPONSAVEL,
          BLOQUEIA,
          `A variável ${v.setor.codigo}.${v.codigo} do Corporativo não tem responsável pelo lançamento.`,
          ref,
        );
      } else if (!gestorAtivo(v.responsavel)) {
        adicionar(
          TipoProblema.USUARIO_INVALIDO,
          BLOQUEIA,
          `A variável ${v.setor.codigo}.${v.codigo} tem ${v.responsavel.nome} como responsável, que não é mais um Gestor ativo.`,
          { ...ref, usuarioId: v.responsavel.id },
        );
      }
    }

    // --- Setores (RN-07: o responsável do setor lança as variáveis) --------------------------
    const comConteudo = new Set([
      ...variaveis.filter((v) => !v.setor.corporativo).map((v) => v.setorId),
      ...metas.filter((m) => !m.setor.corporativo).map((m) => m.setorId),
    ]);
    for (const setor of setores) {
      const responsavel = responsavelDoSetor.get(setor.id);
      const usado = comConteudo.has(setor.id);
      if (!usado && !setor.ativo) continue;
      if (responsavel === undefined) {
        adicionar(
          TipoProblema.SETOR_SEM_RESPONSAVEL,
          usado ? BLOQUEIA : AVISO,
          usado
            ? `O setor ${setor.nome} tem variáveis ou metas no ciclo, mas não tem responsável.`
            : `O setor ${setor.nome} não tem responsável nem variáveis ou metas no ciclo.`,
          { setorId: setor.id },
        );
      } else if (usado && !gestorAtivo(responsavel)) {
        adicionar(
          TipoProblema.USUARIO_INVALIDO,
          BLOQUEIA,
          `O responsável pelo setor ${setor.nome}, ${responsavel.nome}, não é mais um Gestor ativo.`,
          { setorId: setor.id, usuarioId: responsavel.id },
        );
      }
    }

    // --- Avisos gerais ------------------------------------------------------------------------
    for (const gestor of gestoresAtivos) {
      if (!pesos.has(gestor.id)) {
        adicionar(
          TipoProblema.GESTOR_SEM_METAS,
          AVISO,
          `${gestor.nome} é Gestor ativo e não tem nenhuma meta atribuída no ciclo.`,
          { usuarioId: gestor.id },
        );
      }
    }
    if (metas.length === 0) {
      adicionar(TipoProblema.CICLO_SEM_METAS, AVISO, 'O ciclo ainda não tem nenhuma meta ativa.');
    }

    // Bloqueios primeiro, mantendo a ordem em que foram encontrados.
    const ordenados = [
      ...problemas.filter((p) => p.gravidade === BLOQUEIA),
      ...problemas.filter((p) => p.gravidade === AVISO),
    ];
    return { problemas: ordenados, gestores };
  }
}
