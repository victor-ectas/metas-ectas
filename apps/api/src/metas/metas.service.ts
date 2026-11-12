import { Injectable } from '@nestjs/common';
import { Prisma } from '@metas/prisma';
import {
  avaliar,
  type MetaEntrada as MetaMotor,
  type No,
  validar,
  validarMeta,
} from '@metas/motor';
import {
  Bloco,
  CodigoErro,
  type Meta,
  type MetaEntradaSchema,
  Perfil,
  StatusCiclo,
  type ValidarFormulaEntradaSchema,
  type ValidarFormulaSaida,
} from '@metas/tipos';
import type { z } from 'zod';

import { type Autor, AuditoriaService, type Transacao } from '../auditoria/auditoria.service.js';
import type { UsuarioAtual } from '../auth/usuario-atual.js';
import { ErroApi } from '../comum/erro-api.js';
import { traduzirErroBanco } from '../comum/erros-banco.js';
import { PoliticasService } from '../politicas/politicas.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

type DadosMeta = z.output<typeof MetaEntradaSchema>;
type DadosSubmeta = DadosMeta['submetas'][number];
type DadosValidarFormula = z.output<typeof ValidarFormulaEntradaSchema>;
type Cliente = PrismaService | Transacao;

// ---------------------------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------------------------

const CAMPOS_CALCULO = {
  id: true,
  codigo: true,
  indicador: true,
  metrica: true,
  unidade: true,
  formulaTexto: true,
  modoApuracao: true,
  operador: true,
  tolerancia: true,
  mesInicio: true,
  mesFim: true,
  pesoInterno: true,
  ordem: true,
  ativo: true,
  versao: true,
  objetivos: { select: { mes: true, valor: true }, orderBy: { mes: 'asc' } },
  variaveis: {
    select: {
      variavel: {
        select: { id: true, codigo: true, nome: true, setor: { select: { codigo: true } } },
      },
    },
  },
} as const satisfies Prisma.MetaSelect;

const SELECAO = {
  ...CAMPOS_CALCULO,
  cicloId: true,
  setorId: true,
  regraPontuacao: true,
  responsavelId: true,
  setor: { select: { codigo: true, nome: true, corporativo: true } },
  responsavel: { select: { nome: true } },
  atribuicoes: {
    select: { id: true, usuarioId: true, peso: true, usuario: { select: { nome: true } } },
    orderBy: { usuario: { nome: 'asc' } },
  },
  submetas: { select: CAMPOS_CALCULO, orderBy: [{ ordem: 'asc' }, { codigo: 'asc' }] },
} as const satisfies Prisma.MetaSelect;

type MetaBanco = Prisma.MetaGetPayload<{ select: typeof SELECAO }>;
type CalculoBanco = Prisma.MetaGetPayload<{ select: typeof CAMPOS_CALCULO }>;

/** `numeric` do banco para texto sem notação científica nem zeros sobrando. */
const texto = (valor: Prisma.Decimal): string => valor.toFixed();
const textoOuNulo = (valor: Prisma.Decimal | null): string | null =>
  valor === null ? null : texto(valor);

function paraCalculo(m: CalculoBanco, setorDaMeta: string) {
  return {
    id: m.id,
    codigo: m.codigo,
    indicador: m.indicador,
    metrica: m.metrica,
    unidade: m.unidade,
    formula: m.formulaTexto,
    modoApuracao: m.modoApuracao,
    operador: m.operador,
    tolerancia: textoOuNulo(m.tolerancia),
    mesInicio: m.mesInicio,
    mesFim: m.mesFim,
    objetivos: m.objetivos.map((o) => ({ mes: o.mes, valor: texto(o.valor) })),
    pesoInterno: textoOuNulo(m.pesoInterno),
    ordem: m.ordem,
    ativo: m.ativo,
    versao: m.versao,
    variaveis: m.variaveis
      .map(({ variavel: v }) => ({
        id: v.id,
        chave: v.setor.codigo === setorDaMeta ? v.codigo : `${v.setor.codigo}.${v.codigo}`,
        nome: v.nome,
      }))
      .sort((a, b) => a.chave.localeCompare(b.chave)),
  };
}

function paraMeta(m: MetaBanco, temLancamentos: boolean): Meta {
  return {
    ...paraCalculo(m, m.setor.codigo),
    cicloId: m.cicloId,
    setorId: m.setorId,
    setorCodigo: m.setor.codigo,
    setorNome: m.setor.nome,
    bloco: m.setor.corporativo ? Bloco.CORPORATIVO : Bloco.DEPARTAMENTAL,
    regraPontuacao: m.regraPontuacao,
    responsavelId: m.responsavelId,
    responsavelNome: m.responsavel.nome,
    atribuicoes: m.atribuicoes.map((a) => ({
      id: a.id,
      usuarioId: a.usuarioId,
      usuarioNome: a.usuario.nome,
      peso: texto(a.peso),
    })),
    submetas: m.submetas.map((s) => paraCalculo(s, m.setor.codigo)),
    temLancamentos,
  };
}

/** Ids das variáveis usadas pela meta e pelas submetas. */
const variaveisDaArvore = (m: MetaBanco): string[] => [
  ...new Set(
    [m, ...m.submetas].flatMap((item) => item.variaveis.map(({ variavel }) => variavel.id)),
  ),
];

/** O que vai para a auditoria: a meta inteira como a API devolve, sem os nomes derivados. */
function retrato(meta: Meta) {
  return {
    ...meta,
    setorNome: undefined,
    responsavelNome: undefined,
    temLancamentos: undefined,
    atribuicoes: meta.atribuicoes.map((a) => ({ usuarioId: a.usuarioId, peso: a.peso })),
  };
}

const invalido = (mensagem: string, campo?: string) =>
  new ErroApi(
    CodigoErro.VALIDACAO,
    mensagem,
    campo === undefined ? {} : { campos: [{ campo, mensagem }] },
  );

const MENSAGEM_EM_USO =
  'A meta tem lançamentos nas suas variáveis e não pode ser excluída. Inative-a.';

/** Fórmula já validada: AST e ids das variáveis (para `meta_variavel`). */
interface FormulaPronta {
  ast: No | null;
  variavelIds: string[];
}

/**
 * Metas e submetas (RF-11 a RF-18, RN-01 a RN-06, RN-13 a RN-31). A meta-mãe é salva inteira, com
 * as submetas, os objetivos e as atribuições, numa transação: os pesos internos só fecham 100%
 * no conjunto (RF-13). Ao salvar, cada fórmula é validada pelo motor contra as variáveis ativas
 * do ciclo, a AST e `meta_variavel` são regravadas e `validarMeta` confere período, objetivo,
 * tolerância, RN-23 e pesos internos. A `versao` sobe a cada alteração (controle otimista).
 *
 * Regras do desenvolvedor (12/11/2026, ADR-018): meta departamental é atribuída só ao
 * responsável; responsável é qualquer Gestor ativo; excluir só sem valor lançado nas variáveis
 * da meta (RF-18), senão inativar. Ciclo encerrado não aceita alterações (RN-39).
 */
@Injectable()
export class MetasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly politicas: PoliticasService,
  ) {}

  /** Metas sem pai do ciclo, só as que o usuário pode ver (7.5). */
  async listar(
    cicloId: string,
    filtro: { setor?: string; gestor?: string },
    usuario: UsuarioAtual,
  ): Promise<Meta[]> {
    await this.obterCiclo(cicloId);
    const metas = await this.prisma.meta.findMany({
      where: {
        cicloId,
        metaPaiId: null,
        ...(filtro.setor === undefined ? {} : { setorId: filtro.setor }),
        ...(filtro.gestor === undefined
          ? {}
          : {
              OR: [
                { responsavelId: filtro.gestor },
                { atribuicoes: { some: { usuarioId: filtro.gestor } } },
              ],
            }),
      },
      select: SELECAO,
      orderBy: [{ setor: { corporativo: 'desc' } }, { setor: { nome: 'asc' } }, { ordem: 'asc' }],
    });
    const visiveis = metas.filter((m) => this.politicas.podeVerMeta(usuario, this.acesso(m)));
    const comValor = await this.variaveisComValor(visiveis.flatMap(variaveisDaArvore));
    return visiveis.map((m) =>
      paraMeta(
        m,
        variaveisDaArvore(m).some((id) => comValor.has(id)),
      ),
    );
  }

  /** Meta sem pai com submetas, objetivos e atribuições. */
  async obter(id: string, usuario: UsuarioAtual): Promise<Meta> {
    const meta = await this.carregar(this.prisma, id);
    if (!this.politicas.podeVerMeta(usuario, this.acesso(meta))) {
      throw new ErroApi(CodigoErro.SEM_PERMISSAO, 'Você não tem acesso a esta meta.');
    }
    return this.completar(this.prisma, meta);
  }

  async criar(cicloId: string, dados: DadosMeta, autor: Autor): Promise<Meta> {
    await this.cicloAberto(cicloId);
    const formulas = await this.preparar(cicloId, dados, true);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const raiz = await tx.meta.create({
          data: {
            ...this.camposDaRaiz(cicloId, dados, formulas.get(dados.codigo), autor),
            criadoPor: autor.usuarioId,
          },
          select: { id: true },
        });
        await this.gravarFilhos(tx, raiz.id, dados, formulas, autor);
        const criada = await this.completar(tx, await this.carregar(tx, raiz.id));
        await this.auditoria.registrar(tx, autor, {
          entidade: 'meta',
          entidadeId: raiz.id,
          acao: 'CRIAR',
          depois: retrato(criada),
        });
        return criada;
      });
    } catch (erro) {
      throw traduzirErroBanco(erro, MENSAGEM_EM_USO);
    }
  }

  async alterar(id: string, versao: number, dados: DadosMeta, autor: Autor): Promise<Meta> {
    const atual = await this.completar(this.prisma, await this.carregar(this.prisma, id));
    await this.cicloAberto(atual.cicloId);
    if (versao !== atual.versao) throw this.conflito(atual.versao);

    const existentes = new Map(atual.submetas.map((s) => [s.id, s]));
    for (const submeta of dados.submetas) {
      if (submeta.id !== undefined && !existentes.has(submeta.id)) {
        throw invalido(`A submeta ${submeta.codigo} não pertence a esta meta.`, 'submetas');
      }
    }
    const mantidas = new Set(dados.submetas.flatMap((s) => (s.id === undefined ? [] : [s.id])));
    const removidas = atual.submetas.filter((s) => !mantidas.has(s.id));
    if (removidas.length > 0) {
      const comValor = await this.variaveisComValor(
        removidas.flatMap((s) => s.variaveis.map((v) => v.id)),
      );
      const bloqueada = removidas.find((s) => s.variaveis.some((v) => comValor.has(v.id)));
      if (bloqueada !== undefined) {
        throw invalido(
          `A submeta ${bloqueada.codigo} tem lançamentos nas suas variáveis e não pode ser removida. Inative-a.`,
          'submetas',
        );
      }
    }

    const formulas = await this.preparar(atual.cicloId, dados, dados.setorId !== atual.setorId);
    try {
      return await this.prisma.$transaction(async (tx) => {
        // A condição na versão fecha a corrida entre a leitura acima e esta gravação.
        const { count } = await tx.meta.updateMany({
          where: { id, versao },
          data: {
            ...this.camposDaRaiz(atual.cicloId, dados, formulas.get(dados.codigo), autor),
            versao: { increment: 1 },
          },
        });
        if (count === 0) throw this.conflito(versao + 1);
        await tx.metaObjetivo.deleteMany({ where: { metaId: id } });
        await tx.metaAtribuicao.deleteMany({ where: { metaId: id } });
        await tx.metaVariavel.deleteMany({ where: { metaId: id } });
        if (removidas.length > 0) {
          await tx.meta.deleteMany({ where: { id: { in: removidas.map((s) => s.id) } } });
        }
        await this.gravarFilhos(tx, id, dados, formulas, autor);
        const depois = await this.completar(tx, await this.carregar(tx, id));
        await this.auditoria.registrar(tx, autor, {
          entidade: 'meta',
          entidadeId: id,
          acao: 'ALTERAR',
          antes: retrato(atual),
          depois: retrato(depois),
        });
        return depois;
      });
    } catch (erro) {
      throw traduzirErroBanco(erro, MENSAGEM_EM_USO);
    }
  }

  /** Exclui a meta e as submetas, só sem valor lançado nas variáveis (RF-18). */
  async excluir(id: string, autor: Autor): Promise<void> {
    const atual = await this.completar(this.prisma, await this.carregar(this.prisma, id));
    await this.cicloAberto(atual.cicloId);
    if (atual.temLancamentos) throw new ErroApi(CodigoErro.EM_USO, MENSAGEM_EM_USO);
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.meta.deleteMany({ where: { metaPaiId: id } });
        await tx.meta.delete({ where: { id } });
        await this.auditoria.registrar(tx, autor, {
          entidade: 'meta',
          entidadeId: id,
          acao: 'EXCLUIR',
          antes: retrato(atual),
        });
      });
    } catch (erro) {
      throw traduzirErroBanco(erro, MENSAGEM_EM_USO);
    }
  }

  /**
   * `POST /formulas/validar` (RF-17): erros com posição, variáveis usadas e, com valores de
   * teste, o resultado (nulo quando falta valor ou há divisão por zero).
   */
  async validarFormula(dados: DadosValidarFormula): Promise<ValidarFormulaSaida> {
    await this.obterCiclo(dados.cicloId);
    const setor = await this.prisma.setor.findUnique({
      where: { id: dados.setorId },
      select: { id: true },
    });
    if (setor === null) throw invalido('Setor não encontrado.', 'setorId');
    const disponiveis = await this.variaveisDisponiveis(dados.cicloId, dados.setorId);
    const resultado = validar(dados.formula, disponiveis.keys());
    if (!resultado.valida) {
      return { valida: false, erros: resultado.erros, variaveis: [], teste: null };
    }
    const variaveis = resultado.variaveis.map((ref) => {
      const chave = ref.setor === null ? ref.codigo : `${ref.setor}.${ref.codigo}`;
      const v = disponiveis.get(chave);
      // validar() só aceita chaves disponíveis.
      if (v === undefined)
        throw new Error(`Variável ${chave} sumiu entre a validação e a leitura.`);
      return { id: v.id, chave, nome: v.nome, tipo: v.tipo };
    });
    let teste: ValidarFormulaSaida['teste'] = null;
    if (dados.valores !== undefined) {
      const escopo = Object.fromEntries(
        Object.entries(dados.valores).map(([chave, valor]) => [chave.toUpperCase(), valor]),
      );
      const avaliacao = avaliar(resultado.ast, escopo);
      teste = {
        resultado: avaliacao.valor?.toFixed() ?? null,
        avisos: avaliacao.avisos.map(() => 'Divisão por zero: o resultado fica vazio.'),
      };
    }
    return { valida: true, erros: [], variaveis, teste };
  }

  // -------------------------------------------------------------------------------------------

  private acesso(m: MetaBanco) {
    return {
      setorId: m.setorId,
      responsavelId: m.responsavelId,
      atribuidos: m.atribuicoes.map((a) => a.usuarioId),
    };
  }

  private async carregar(cliente: Cliente, id: string): Promise<MetaBanco> {
    const meta = await cliente.meta.findFirst({ where: { id, metaPaiId: null }, select: SELECAO });
    if (meta === null) throw new ErroApi(CodigoErro.NAO_ENCONTRADO, 'Meta não encontrada.');
    return meta;
  }

  private async completar(cliente: Cliente, meta: MetaBanco): Promise<Meta> {
    const comValor = await this.variaveisComValor(variaveisDaArvore(meta), cliente);
    return paraMeta(meta, comValor.size > 0);
  }

  /** Variáveis (entre as informadas) com algum valor lançado, ou seja, não vazio (RN-08). */
  private async variaveisComValor(ids: readonly string[], cliente: Cliente = this.prisma) {
    if (ids.length === 0) return new Set<string>();
    const linhas = await cliente.lancamento.findMany({
      where: { variavelId: { in: [...new Set(ids)] }, valor: { not: null } },
      select: { variavelId: true },
      distinct: ['variavelId'],
    });
    return new Set(linhas.map((l) => l.variavelId));
  }

  /** Variáveis ativas do ciclo por chave da fórmula: `CODIGO` (setor da meta) e `SETOR.CODIGO`. */
  private async variaveisDisponiveis(cicloId: string, setorId: string) {
    const variaveis = await this.prisma.variavel.findMany({
      where: { cicloId, ativo: true },
      select: {
        id: true,
        codigo: true,
        nome: true,
        tipo: true,
        setorId: true,
        setor: { select: { codigo: true } },
      },
    });
    const porChave = new Map<string, (typeof variaveis)[number]>();
    for (const v of variaveis) {
      porChave.set(`${v.setor.codigo}.${v.codigo}`, v);
      if (v.setorId === setorId) porChave.set(v.codigo, v);
    }
    return porChave;
  }

  /**
   * Confere tudo antes de gravar: setor, responsável, atribuições, fórmulas (motor) e
   * `validarMeta` (motor). Devolve a fórmula pronta de cada meta, pelo código.
   */
  private async preparar(
    cicloId: string,
    dados: DadosMeta,
    entraNoSetor: boolean,
  ): Promise<Map<string, FormulaPronta>> {
    const setor = await this.prisma.setor.findUnique({
      where: { id: dados.setorId },
      select: { ativo: true, corporativo: true },
    });
    if (setor === null) throw invalido('Setor não encontrado.', 'setorId');
    if (entraNoSetor && !setor.ativo) {
      throw invalido('O setor está inativo e não pode receber metas.', 'setorId');
    }

    const usuarios = [dados.responsavelId, ...dados.atribuicoes.map((a) => a.usuarioId)];
    const gestores = new Set(
      (
        await this.prisma.usuario.findMany({
          where: { id: { in: usuarios }, perfil: Perfil.GESTOR, ativo: true },
          select: { id: true },
        })
      ).map((u) => u.id),
    );
    if (!gestores.has(dados.responsavelId)) {
      throw invalido('O responsável precisa ser um usuário Gestor e ativo.', 'responsavelId');
    }
    if (setor.corporativo) {
      if (dados.atribuicoes.some((a) => !gestores.has(a.usuarioId))) {
        throw invalido('A meta só pode ser atribuída a usuários Gestor e ativos.', 'atribuicoes');
      }
    } else {
      const [unica] = dados.atribuicoes;
      if (dados.atribuicoes.length !== 1 || unica?.usuarioId !== dados.responsavelId) {
        throw invalido(
          'Meta departamental é atribuída só ao gestor responsável por ela. Só as metas do Corporativo têm várias atribuições.',
          'atribuicoes',
        );
      }
    }

    // Fórmulas: cada uma contra as variáveis ativas do ciclo, resolvidas pelo setor da meta.
    const disponiveis = await this.variaveisDisponiveis(cicloId, dados.setorId);
    const prontas = new Map<string, FormulaPronta>();
    const errosFormula: { meta: string; mensagem: string; posicao: number | null }[] = [];
    for (const item of [dados, ...dados.submetas]) {
      if (item.formula === null) {
        prontas.set(item.codigo, { ast: null, variavelIds: [] });
        continue;
      }
      const resultado = validar(item.formula, disponiveis.keys());
      if (!resultado.valida) {
        errosFormula.push(...resultado.erros.map((e) => ({ meta: item.codigo, ...e })));
        continue;
      }
      const ids = resultado.variaveis.flatMap((ref) => {
        const v = disponiveis.get(ref.setor === null ? ref.codigo : `${ref.setor}.${ref.codigo}`);
        return v === undefined ? [] : [v.id];
      });
      prontas.set(item.codigo, { ast: resultado.ast, variavelIds: [...new Set(ids)] });
    }
    const [primeiro] = errosFormula;
    if (primeiro !== undefined) {
      throw new ErroApi(
        CodigoErro.FORMULA_INVALIDA,
        `Fórmula de ${primeiro.meta}: ${primeiro.mensagem}`,
        { erros: errosFormula },
      );
    }

    // Regras de configuração do motor (RN-13, RN-15, RN-20, RN-23, RN-26, RN-04/RN-30).
    const paraMotor = (item: DadosMeta | DadosSubmeta, submetas: MetaMotor[]): MetaMotor => ({
      id: item.codigo,
      formula: prontas.get(item.codigo)?.ast ?? null,
      variaveis: {},
      modoApuracao: item.modoApuracao,
      operador: item.operador,
      tolerancia: item.tolerancia,
      mesInicio: item.mesInicio,
      mesFim: item.mesFim,
      objetivos: Object.fromEntries(item.objetivos.map((o) => [o.mes, o.valor])),
      regraPontuacao: 'regraPontuacao' in item ? item.regraPontuacao : dados.regraPontuacao,
      pesoInterno: item.pesoInterno,
      submetas,
    });
    // Submeta inativa não entra no cálculo nem na soma dos pesos internos.
    const ativas = dados.submetas.filter((s) => s.ativo).map((s) => paraMotor(s, []));
    const erros = validarMeta(paraMotor(dados, ativas));
    const [problema] = erros;
    if (problema !== undefined) {
      throw new ErroApi(problema.codigo, problema.mensagem + '.', {
        erros: erros.map((e) => ({ meta: e.metaId, mensagem: e.mensagem })),
      });
    }
    return prontas;
  }

  private camposDaRaiz(
    cicloId: string,
    dados: DadosMeta,
    formula: FormulaPronta | undefined,
    autor: Autor,
  ) {
    return {
      cicloId,
      setorId: dados.setorId,
      metaPaiId: null,
      codigo: dados.codigo,
      indicador: dados.indicador,
      metrica: dados.metrica,
      unidade: dados.unidade,
      formulaTexto: dados.formula,
      formulaAst: this.ast(formula),
      modoApuracao: dados.modoApuracao,
      operador: dados.operador,
      tolerancia: dados.tolerancia,
      mesInicio: dados.mesInicio,
      mesFim: dados.mesFim,
      regraPontuacao: dados.regraPontuacao,
      pesoInterno: dados.pesoInterno,
      responsavelId: dados.responsavelId,
      ordem: dados.ordem,
      ativo: dados.ativo,
      atualizadoPor: autor.usuarioId,
    };
  }

  /** AST em JSON; sem fórmula, NULL no banco (o CHECK exige texto e AST juntos). */
  private ast(formula: FormulaPronta | undefined): Prisma.InputJsonValue | typeof Prisma.DbNull {
    return formula?.ast == null ? Prisma.DbNull : (formula.ast as unknown as Prisma.InputJsonValue);
  }

  /** Objetivos, atribuições, `meta_variavel` da raiz e as submetas (criadas ou alteradas). */
  private async gravarFilhos(
    tx: Transacao,
    raizId: string,
    dados: DadosMeta,
    formulas: Map<string, FormulaPronta>,
    autor: Autor,
  ): Promise<void> {
    const quem = { criadoPor: autor.usuarioId, atualizadoPor: autor.usuarioId };
    await this.gravarObjetivosEVariaveis(tx, raizId, dados, formulas, autor);
    await tx.metaAtribuicao.createMany({
      data: dados.atribuicoes.map((a) => ({ metaId: raizId, ...a, ...quem })),
    });

    const raiz = await tx.meta.findUniqueOrThrow({
      where: { id: raizId },
      select: { cicloId: true },
    });
    for (const [ordem, submeta] of dados.submetas.entries()) {
      const campos = {
        codigo: submeta.codigo,
        indicador: submeta.indicador,
        metrica: submeta.metrica,
        unidade: submeta.unidade,
        formulaTexto: submeta.formula,
        formulaAst: this.ast(formulas.get(submeta.codigo)),
        modoApuracao: submeta.modoApuracao,
        operador: submeta.operador,
        tolerancia: submeta.tolerancia,
        mesInicio: submeta.mesInicio,
        mesFim: submeta.mesFim,
        pesoInterno: submeta.pesoInterno,
        ordem,
        ativo: submeta.ativo,
        // RN-29: herda ciclo, setor e responsável; a regra de pontuação não se aplica.
        cicloId: raiz.cicloId,
        setorId: dados.setorId,
        responsavelId: dados.responsavelId,
        regraPontuacao: dados.regraPontuacao,
        atualizadoPor: autor.usuarioId,
      };
      let id: string;
      if (submeta.id === undefined) {
        ({ id } = await tx.meta.create({
          data: { ...campos, metaPaiId: raizId, criadoPor: autor.usuarioId },
          select: { id: true },
        }));
      } else {
        id = submeta.id;
        await tx.meta.update({ where: { id }, data: { ...campos, versao: { increment: 1 } } });
        await tx.metaObjetivo.deleteMany({ where: { metaId: id } });
        await tx.metaVariavel.deleteMany({ where: { metaId: id } });
      }
      await this.gravarObjetivosEVariaveis(tx, id, submeta, formulas, autor);
    }
  }

  private async gravarObjetivosEVariaveis(
    tx: Transacao,
    metaId: string,
    item: DadosMeta | DadosSubmeta,
    formulas: Map<string, FormulaPronta>,
    autor: Autor,
  ): Promise<void> {
    const quem = { criadoPor: autor.usuarioId, atualizadoPor: autor.usuarioId };
    await tx.metaObjetivo.createMany({
      data: item.objetivos.map((o) => ({ metaId, mes: o.mes, valor: o.valor, ...quem })),
    });
    await tx.metaVariavel.createMany({
      data: (formulas.get(item.codigo)?.variavelIds ?? []).map((variavelId) => ({
        metaId,
        variavelId,
      })),
    });
  }

  private conflito(versaoAtual: number): ErroApi {
    return new ErroApi(
      CodigoErro.CONFLITO_VERSAO,
      'Esta meta foi alterada por outra pessoa enquanto você editava. Recarregue para ver a versão atual.',
      { versaoAtual },
    );
  }

  private async obterCiclo(id: string) {
    const ciclo = await this.prisma.ciclo.findUnique({
      where: { id },
      select: { ano: true, status: true },
    });
    if (ciclo === null) throw new ErroApi(CodigoErro.NAO_ENCONTRADO, 'Ciclo não encontrado.');
    return ciclo;
  }

  /** RN-39: ciclo encerrado não aceita alterações. Ciclo ativo aceita (o recálculo vem no P17). */
  private async cicloAberto(id: string) {
    const ciclo = await this.obterCiclo(id);
    if (ciclo.status === StatusCiclo.ENCERRADO) {
      throw new ErroApi(
        CodigoErro.CICLO_ENCERRADO,
        `O ciclo ${String(ciclo.ano)} está encerrado e não aceita alterações.`,
      );
    }
  }
}
