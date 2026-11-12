import { randomUUID } from 'node:crypto';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { parse } from '@metas/motor';
import {
  type ErroApi as CorpoErro,
  ListaMetasSchema,
  type Meta,
  type MetaEntrada,
  type SubmetaEntrada,
  MetaSchema,
  ValidarFormulaSaidaSchema,
} from '@metas/tipos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { configTeste, criarApp, emitirToken, cliente } from './apoio.js';
import {
  ANO_ATIVO,
  banco,
  criarCiclo,
  criarSetor,
  criarUsuario,
  criarVariavel,
  desconectar,
  limparDados,
  setorCorporativo,
} from './dados.js';

type UsuarioBanco = Awaited<ReturnType<typeof criarUsuario>>;
type SetorBanco = Awaited<ReturnType<typeof criarSetor>>;

const erro = (r: { body: unknown }): CorpoErro => r.body as CorpoErro;
const codigo = (prefixo = 'M') => `${prefixo}_${randomUUID().slice(0, 8).toUpperCase()}`;

let app: NestExpressApplication;
let admin: UsuarioBanco;
let julia: UsuarioBanco;
let carlos: UsuarioBanco;
let tokenAdmin: string;
let cicloId: string;
let fiscal: SetorBanco;
let rh: SetorBanco;
let corporativoId: string;

const http = () => cliente(app);
const como = (token: string) => ({
  get: (url: string) => http().get(`/api/v1${url}`).set('Authorization', `Bearer ${token}`),
  post: (url: string, corpo: object) =>
    http().post(`/api/v1${url}`).set('Authorization', `Bearer ${token}`).send(corpo),
  put: (url: string, corpo: object) =>
    http().put(`/api/v1${url}`).set('Authorization', `Bearer ${token}`).send(corpo),
  delete: (url: string) => http().delete(`/api/v1${url}`).set('Authorization', `Bearer ${token}`),
});
const comoAdmin = () => como(tokenAdmin);
const tokenDe = (u: UsuarioBanco) => emitirToken({ oid: u.entraOid, preferred_username: u.email });

/** CT-01: REQ_ATENDIDOS / TOTAL_REQ, GE 0,80, departamental do Fiscal, peso 10 para a Julia. */
function metaCt01(alteracoes: Partial<MetaEntrada> = {}): MetaEntrada {
  return {
    setorId: fiscal.id,
    codigo: codigo('FISCAL'),
    indicador: 'Requisições atendidas no prazo',
    metrica: 'Requisições atendidas / total de requisições',
    unidade: 'PERCENTUAL',
    formula: 'REQ_ATENDIDOS / TOTAL_REQ',
    modoApuracao: 'FORMULA_SOBRE_ACUMULADOS',
    operador: 'GE',
    mesInicio: 1,
    mesFim: 12,
    objetivos: [{ mes: 0, valor: '0.8' }],
    regraPontuacao: 'PROPORCIONAL',
    responsavelId: julia.id,
    atribuicoes: [{ usuarioId: julia.id, peso: '10' }],
    ...alteracoes,
  };
}

/** Submeta simples de `PRESENCAS` com o peso interno pedido. */
function submeta(peso: string, alteracoes: Partial<SubmetaEntrada> = {}): SubmetaEntrada {
  return {
    codigo: codigo('SUB'),
    indicador: 'Presença',
    metrica: 'Presenças',
    unidade: 'NUMERO',
    formula: 'PRESENCAS',
    modoApuracao: 'SOMA_RESULTADOS',
    operador: 'GE',
    mesInicio: 1,
    mesFim: 12,
    objetivos: [{ mes: 0, valor: '10' }],
    pesoInterno: peso,
    ...alteracoes,
  };
}

async function criar(corpo: MetaEntrada): Promise<Meta> {
  const r = await comoAdmin().post(`/ciclos/${cicloId}/metas`, corpo);
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return MetaSchema.parse(r.body);
}

/** Corpo do PUT a partir da meta devolvida pela API. */
function edicao(meta: Meta, alteracoes: Partial<MetaEntrada> = {}) {
  return {
    versao: meta.versao,
    meta: {
      setorId: meta.setorId,
      codigo: meta.codigo,
      indicador: meta.indicador,
      metrica: meta.metrica,
      unidade: meta.unidade,
      formula: meta.formula,
      modoApuracao: meta.modoApuracao,
      operador: meta.operador,
      tolerancia: meta.tolerancia,
      mesInicio: meta.mesInicio,
      mesFim: meta.mesFim,
      objetivos: meta.objetivos,
      regraPontuacao: meta.regraPontuacao,
      pesoInterno: meta.pesoInterno,
      responsavelId: meta.responsavelId,
      ordem: meta.ordem,
      ativo: meta.ativo,
      atribuicoes: meta.atribuicoes.map((a) => ({ usuarioId: a.usuarioId, peso: a.peso })),
      submetas: meta.submetas.map((s) => ({
        id: s.id,
        codigo: s.codigo,
        indicador: s.indicador,
        metrica: s.metrica,
        unidade: s.unidade,
        formula: s.formula,
        modoApuracao: s.modoApuracao,
        operador: s.operador,
        tolerancia: s.tolerancia,
        mesInicio: s.mesInicio,
        mesFim: s.mesFim,
        objetivos: s.objetivos,
        pesoInterno: s.pesoInterno ?? '0',
        ativo: s.ativo,
      })),
      ...alteracoes,
    },
  };
}

let presencasId: string;
let reqAtendidosId: string;

beforeAll(async () => {
  await limparDados();
  app = await criarApp(configTeste());
  admin = await criarUsuario('ADMIN', { nome: 'Admin do Teste' });
  julia = await criarUsuario('GESTOR', { nome: 'Julia Souza' });
  carlos = await criarUsuario('GESTOR', { nome: 'Carlos Lima' });
  tokenAdmin = await tokenDe(admin);
  cicloId = (await criarCiclo(ANO_ATIVO, 'RASCUNHO')).id;
  fiscal = await criarSetor('Fiscal (teste)');
  rh = await criarSetor('RH (teste)');
  corporativoId = (await setorCorporativo()).id;
  reqAtendidosId = (await criarVariavel(cicloId, fiscal.id, 'REQ_ATENDIDOS')).id;
  await criarVariavel(cicloId, fiscal.id, 'TOTAL_REQ');
  presencasId = (await criarVariavel(cicloId, fiscal.id, 'PRESENCAS')).id;
  await criarVariavel(cicloId, rh.id, 'TOTAL_COLAB');
  await criarVariavel(cicloId, corporativoId, 'SALDO_CAIXA');
  await criarVariavel(cicloId, fiscal.id, 'DESATIVADA', { ativo: false });
});

afterAll(async () => {
  await app.close();
  await limparDados();
  await desconectar();
});

describe('permissão (7.5)', () => {
  it.each(['DIRETORIA', 'GESTOR', 'LEITOR'] as const)('%s não altera metas', async (perfil) => {
    const usuario = como(await tokenDe(await criarUsuario(perfil)));
    const id = randomUUID();
    const respostas = [
      await usuario.post(`/ciclos/${cicloId}/metas`, {}),
      await usuario.put(`/metas/${id}`, {}),
      await usuario.delete(`/metas/${id}`),
      await usuario.post('/formulas/validar', {}),
    ];
    for (const r of respostas) expect([r.status, erro(r).codigo]).toEqual([403, 'SEM_PERMISSAO']);
  });

  it('Gestor vê só as metas pelas quais responde ou que lhe foram atribuídas', async () => {
    const daJulia = await criar(metaCt01());
    const doCarlos = await criar(
      metaCt01({ responsavelId: carlos.id, atribuicoes: [{ usuarioId: carlos.id, peso: '5' }] }),
    );
    const comoJulia = como(await tokenDe(julia));
    const lista = ListaMetasSchema.parse((await comoJulia.get(`/ciclos/${cicloId}/metas`)).body);
    const ids = lista.map((m) => m.id);
    expect(ids).toContain(daJulia.id);
    expect(ids).not.toContain(doCarlos.id);
    expect((await comoJulia.get(`/metas/${daJulia.id}`)).status).toBe(200);
    const negado = await comoJulia.get(`/metas/${doCarlos.id}`);
    expect([negado.status, erro(negado).codigo]).toEqual([403, 'SEM_PERMISSAO']);
  });

  it('Leitor vê as metas dos setores liberados', async () => {
    const meta = await criar(metaCt01());
    const leitor = await criarUsuario('LEITOR');
    const comoLeitor = como(await tokenDe(leitor));
    expect((await comoLeitor.get(`/metas/${meta.id}`)).status).toBe(403);
    await banco().leitorSetor.create({ data: { usuarioId: leitor.id, setorId: fiscal.id } });
    expect((await comoLeitor.get(`/metas/${meta.id}`)).status).toBe(200);
  });
});

describe('cadastro (RF-11, RF-12)', () => {
  it('CT-01: grava fórmula, AST, variáveis usadas, objetivo e atribuição, com auditoria', async () => {
    const meta = await criar(metaCt01({ formula: 'req_atendidos / Total_Req' }));
    expect(meta).toMatchObject({
      bloco: 'DEPARTAMENTAL',
      setorCodigo: fiscal.codigo,
      versao: 1,
      objetivos: [{ mes: 0, valor: '0.8' }],
      atribuicoes: [{ usuarioId: julia.id, usuarioNome: 'Julia Souza', peso: '10' }],
      variaveis: [
        { chave: 'REQ_ATENDIDOS', nome: 'Variável REQ_ATENDIDOS' },
        { chave: 'TOTAL_REQ', nome: 'Variável TOTAL_REQ' },
      ],
      temLancamentos: false,
    });
    const banco_ = await banco().meta.findUniqueOrThrow({ where: { id: meta.id } });
    expect(banco_.formulaAst).toEqual(parse('req_atendidos / Total_Req'));
    expect(
      await banco().auditoria.count({
        where: { entidade: 'meta', entidadeId: meta.id, acao: 'CRIAR' },
      }),
    ).toBe(1);
  });

  it('objetivo mensal dentro do período; fora dele ou misturado com único é recusado', async () => {
    const ok = await criar(
      metaCt01({
        mesInicio: 7,
        mesFim: 12,
        objetivos: [
          { mes: 7, valor: '0.5' },
          { mes: 12, valor: '1' },
        ],
      }),
    );
    expect(ok.objetivos).toEqual([
      { mes: 7, valor: '0.5' },
      { mes: 12, valor: '1' },
    ]);
    const fora = await comoAdmin().post(
      `/ciclos/${cicloId}/metas`,
      metaCt01({ mesInicio: 7, objetivos: [{ mes: 3, valor: '1' }] }),
    );
    expect(JSON.stringify(erro(fora).detalhes)).toMatch(
      /Os objetivos mensais precisam estar dentro do período/,
    );
    const misturado = await comoAdmin().post(
      `/ciclos/${cicloId}/metas`,
      metaCt01({
        objetivos: [
          { mes: 0, valor: '1' },
          { mes: 12, valor: '1' },
        ],
      }),
    );
    expect(JSON.stringify(erro(misturado).detalhes)).toMatch(/objetivo único ou objetivos por mês/);
  });

  it('sem objetivo para o último mês do período: recusa (validarMeta)', async () => {
    const r = await comoAdmin().post(
      `/ciclos/${cicloId}/metas`,
      metaCt01({ mesFim: 11, objetivos: [{ mes: 10, valor: '1' }], mesInicio: 1 }),
    );
    expect(r.status).toBe(400);
    expect(erro(r).mensagem).toMatch(/Falta o objetivo.*novembro/);
  });

  it('código repetido no ciclo: JA_EXISTE', async () => {
    const meta = await criar(metaCt01());
    const r = await comoAdmin().post(`/ciclos/${cicloId}/metas`, metaCt01({ codigo: meta.codigo }));
    expect([r.status, erro(r).mensagem]).toEqual([
      409,
      'Já existe uma meta ou submeta com este código neste ciclo.',
    ]);
  });

  it('responsável precisa ser Gestor ativo', async () => {
    const diretoria = await criarUsuario('DIRETORIA');
    const r = await comoAdmin().post(
      `/ciclos/${cicloId}/metas`,
      metaCt01({
        responsavelId: diretoria.id,
        atribuicoes: [{ usuarioId: diretoria.id, peso: '10' }],
      }),
    );
    expect(erro(r).detalhes).toEqual({
      campos: [
        {
          campo: 'responsavelId',
          mensagem: 'O responsável precisa ser um usuário Gestor e ativo.',
        },
      ],
    });
  });

  it('ciclo encerrado: CICLO_ENCERRADO (RN-39)', async () => {
    const encerrado = await banco().ciclo.create({
      data: { ano: 2096, status: 'ENCERRADO', encerradoEm: new Date() },
    });
    try {
      const r = await comoAdmin().post(`/ciclos/${encerrado.id}/metas`, metaCt01());
      expect([r.status, erro(r).codigo]).toEqual([422, 'CICLO_ENCERRADO']);
    } finally {
      await banco().ciclo.delete({ where: { id: encerrado.id } });
    }
  });
});

describe('fórmulas (8.1)', () => {
  it('fórmula inválida: FORMULA_INVALIDA com a posição', async () => {
    const r = await comoAdmin().post(
      `/ciclos/${cicloId}/metas`,
      metaCt01({ formula: '(REQ_ATENDIDOS / TOTAL_REQ' }),
    );
    expect(r.status).toBe(422);
    expect(erro(r).codigo).toBe('FORMULA_INVALIDA');
    expect(erro(r).mensagem).toMatch(/^Fórmula de FISCAL_.*: Esperava "\)"/);
    expect(erro(r).detalhes).toMatchObject({ erros: [{ posicao: 27 }] });
  });

  it('variável inexistente, inativa ou de outro setor sem prefixo: desconhecida', async () => {
    for (const formula of ['NAO_EXISTE * 2', 'DESATIVADA', 'TOTAL_COLAB']) {
      const r = await comoAdmin().post(`/ciclos/${cicloId}/metas`, metaCt01({ formula }));
      expect(erro(r).codigo).toBe('FORMULA_INVALIDA');
      expect(erro(r).mensagem).toMatch(/Variável desconhecida/);
    }
  });

  it('variável de outro setor com SETOR.VAR', async () => {
    const meta = await criar(metaCt01({ formula: `PRESENCAS / ${rh.codigo}.TOTAL_COLAB` }));
    expect(meta.variaveis.map((v) => v.chave)).toEqual(['PRESENCAS', `${rh.codigo}.TOTAL_COLAB`]);
  });

  it('POST /formulas/validar: variáveis, resultado de teste e divisão por zero', async () => {
    const validar = (formula: string, valores?: Record<string, string | null>) =>
      comoAdmin().post('/formulas/validar', { cicloId, setorId: fiscal.id, formula, valores });

    const ok = ValidarFormulaSaidaSchema.parse(
      (await validar('REQ_ATENDIDOS / TOTAL_REQ', { REQ_ATENDIDOS: '16', total_req: '20' })).body,
    );
    expect(ok).toMatchObject({
      valida: true,
      erros: [],
      variaveis: [
        { id: reqAtendidosId, chave: 'REQ_ATENDIDOS', tipo: 'NUMERO' },
        { chave: 'TOTAL_REQ' },
      ],
      teste: { resultado: '0.8', avisos: [] },
    });

    const zero = ValidarFormulaSaidaSchema.parse(
      (await validar('REQ_ATENDIDOS / TOTAL_REQ', { REQ_ATENDIDOS: '1', TOTAL_REQ: '0' })).body,
    );
    expect(zero.teste).toEqual({
      resultado: null,
      avisos: ['Divisão por zero: o resultado fica vazio.'],
    });

    const vazio = ValidarFormulaSaidaSchema.parse(
      (await validar('PRESENCAS', { PRESENCAS: null })).body,
    );
    expect(vazio.teste?.resultado).toBeNull();

    const ruim = ValidarFormulaSaidaSchema.parse((await validar('ARRED(3,2)')).body);
    expect(ruim.valida).toBe(false);
    expect(ruim.erros[0]?.mensagem).toMatch(/use ";" para separar os argumentos/);
    expect(ruim.teste).toBeNull();
  });
});

describe('submetas (RN-26 a RN-30)', () => {
  it('mãe com 5 submetas de 20%, sem fórmula própria (CT-12)', async () => {
    const meta = await criar(
      metaCt01({
        formula: null,
        objetivos: [],
        submetas: [1, 2, 3, 4, 5].map(() => submeta('0.2')),
      }),
    );
    expect(meta.formula).toBeNull();
    expect(meta.submetas).toHaveLength(5);
    expect(meta.submetas.map((s) => s.ordem)).toEqual([0, 1, 2, 3, 4]);
    expect(meta.submetas[0]?.variaveis).toEqual([
      { id: presencasId, chave: 'PRESENCAS', nome: 'Variável PRESENCAS' },
    ]);
    const filhas = await banco().meta.findMany({ where: { metaPaiId: meta.id } });
    expect(filhas.every((f) => f.responsavelId === julia.id && f.setorId === fiscal.id)).toBe(true);
    expect(
      await banco().metaAtribuicao.count({ where: { metaId: { in: filhas.map((f) => f.id) } } }),
    ).toBe(0);
  });

  it('pesos internos ≠ 100%: PESOS_INCONSISTENTES', async () => {
    const r = await comoAdmin().post(
      `/ciclos/${cicloId}/metas`,
      metaCt01({ formula: null, objetivos: [], submetas: [submeta('0.5'), submeta('0.4')] }),
    );
    expect([r.status, erro(r).codigo]).toEqual([422, 'PESOS_INCONSISTENTES']);
    expect(erro(r).mensagem).toBe('Os pesos internos somam 90,00%; deveriam somar 100,00%.');
  });

  it('fórmula própria da mãe entra como componente com peso interno (RN-30)', async () => {
    const meta = await criar(
      metaCt01({ pesoInterno: '0.5', submetas: [submeta('0.25'), submeta('0.25')] }),
    );
    expect(meta.pesoInterno).toBe('0.5');
    const semPeso = await comoAdmin().post(
      `/ciclos/${cicloId}/metas`,
      metaCt01({ submetas: [submeta('0.5'), submeta('0.5')] }),
    );
    expect(erro(semPeso).codigo).toBe('PESOS_INCONSISTENTES');
  });

  it('neto proibido: submeta não tem submetas (máximo 2 níveis)', async () => {
    const r = await comoAdmin().post(
      `/ciclos/${cicloId}/metas`,
      metaCt01({
        formula: null,
        objetivos: [],
        submetas: [submeta('1', { submetas: [submeta('1')] })],
      }),
    );
    expect(r.status).toBe(400);
    expect(erro(r).detalhes).toEqual({
      campos: [
        {
          campo: 'submetas.0.submetas',
          mensagem: 'Uma submeta não pode ter submetas (máximo de 2 níveis).',
        },
      ],
    });
  });

  it('período da submeta fora do da mãe: recusa (RN-29)', async () => {
    const r = await comoAdmin().post(
      `/ciclos/${cicloId}/metas`,
      metaCt01({
        mesInicio: 3,
        objetivos: [],
        formula: null,
        submetas: [submeta('1', { mesInicio: 1 })],
      }),
    );
    expect(erro(r).mensagem).toMatch(/período da submeta precisa estar dentro/);
  });
});

describe('pontuação e atribuições (RN-05, RN-23)', () => {
  it('proporcional com objetivo ≤ 0 é recusado (CT-09)', async () => {
    const r = await comoAdmin().post(
      `/ciclos/${cicloId}/metas`,
      metaCt01({ operador: 'LE', objetivos: [{ mes: 0, valor: '-0.1' }] }),
    );
    expect(r.status).toBe(400);
    expect(erro(r).mensagem).toBe(
      'Pontuação proporcional não é permitida com objetivo menor ou igual a zero; use tudo ou nada.',
    );
    await criar(
      metaCt01({
        operador: 'LE',
        objetivos: [{ mes: 0, valor: '-0.1' }],
        regraPontuacao: 'TUDO_OU_NADA',
      }),
    );
  });

  it('meta corporativa com várias atribuições, cada uma com seu peso (CT-15)', async () => {
    const meta = await criar(
      metaCt01({
        setorId: corporativoId,
        formula: 'SALDO_CAIXA',
        unidade: 'MOEDA',
        objetivos: [{ mes: 0, valor: '100000' }],
        atribuicoes: [
          { usuarioId: julia.id, peso: '15' },
          { usuarioId: carlos.id, peso: '10' },
        ],
      }),
    );
    expect(meta.bloco).toBe('CORPORATIVO');
    expect(meta.atribuicoes.map((a) => [a.usuarioNome, a.peso])).toEqual([
      ['Carlos Lima', '10'],
      ['Julia Souza', '15'],
    ]);
  });

  it('meta departamental: uma atribuição, só ao responsável', async () => {
    const duas = await comoAdmin().post(
      `/ciclos/${cicloId}/metas`,
      metaCt01({
        atribuicoes: [
          { usuarioId: julia.id, peso: '10' },
          { usuarioId: carlos.id, peso: '5' },
        ],
      }),
    );
    expect(erro(duas).mensagem).toMatch(/^Meta departamental é atribuída só ao gestor responsável/);
    const outro = await comoAdmin().post(
      `/ciclos/${cicloId}/metas`,
      metaCt01({ atribuicoes: [{ usuarioId: carlos.id, peso: '10' }] }),
    );
    expect(erro(outro).codigo).toBe('VALIDACAO');
  });
});

describe('alteração (RN-39) e exclusão (RF-18)', () => {
  it('sobe a versão, troca objetivos e atribuição, e audita antes/depois', async () => {
    const meta = await criar(metaCt01());
    const r = await comoAdmin().put(
      `/metas/${meta.id}`,
      edicao(meta, {
        objetivos: [{ mes: 0, valor: '0.9' }],
        atribuicoes: [{ usuarioId: julia.id, peso: '12.5' }],
        formula: 'PRESENCAS / TOTAL_REQ',
      }),
    );
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const depois = MetaSchema.parse(r.body);
    expect(depois).toMatchObject({
      versao: 2,
      objetivos: [{ mes: 0, valor: '0.9' }],
      atribuicoes: [{ peso: '12.5' }],
    });
    expect(depois.variaveis.map((v) => v.chave)).toEqual(['PRESENCAS', 'TOTAL_REQ']);
    const auditoria = await banco().auditoria.findFirst({
      where: { entidade: 'meta', entidadeId: meta.id, acao: 'ALTERAR' },
    });
    expect(auditoria?.antes).toMatchObject({ versao: 1, formula: 'REQ_ATENDIDOS / TOTAL_REQ' });
    expect(auditoria?.depois).toMatchObject({ versao: 2, formula: 'PRESENCAS / TOTAL_REQ' });
  });

  it('versão desatualizada: CONFLITO_VERSAO', async () => {
    const meta = await criar(metaCt01());
    expect((await comoAdmin().put(`/metas/${meta.id}`, edicao(meta))).status).toBe(200);
    const r = await comoAdmin().put(`/metas/${meta.id}`, edicao(meta, { indicador: 'Outro' }));
    expect([r.status, erro(r).codigo]).toEqual([409, 'CONFLITO_VERSAO']);
    expect(erro(r).detalhes).toEqual({ versaoAtual: 2 });
  });

  it('altera, cria e remove submetas na mesma operação', async () => {
    const meta = await criar(
      metaCt01({ formula: null, objetivos: [], submetas: [submeta('0.5'), submeta('0.5')] }),
    );
    const corpo = edicao(meta);
    const [primeira] = corpo.meta.submetas;
    if (primeira === undefined) throw new Error('sem submeta');
    corpo.meta.submetas = [
      { ...primeira, pesoInterno: '0.7', indicador: 'Alterada' },
      { ...submeta('0.3'), pesoInterno: '0.3', ativo: true },
    ];
    const r = await comoAdmin().put(`/metas/${meta.id}`, corpo);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const depois = MetaSchema.parse(r.body);
    expect(depois.submetas.map((s) => [s.indicador, s.pesoInterno])).toEqual([
      ['Alterada', '0.7'],
      ['Presença', '0.3'],
    ]);
    expect(depois.submetas[0]).toMatchObject({ id: primeira.id, versao: 2 });
    expect(await banco().meta.count({ where: { metaPaiId: meta.id } })).toBe(2);
  });

  it('submeta de outra meta não entra', async () => {
    const a = await criar(metaCt01({ formula: null, objetivos: [], submetas: [submeta('1')] }));
    const b = await criar(metaCt01({ formula: null, objetivos: [], submetas: [submeta('1')] }));
    const corpo = edicao(a);
    corpo.meta.submetas = edicao(b).meta.submetas;
    const r = await comoAdmin().put(`/metas/${a.id}`, corpo);
    expect(erro(r).mensagem).toMatch(/não pertence a esta meta/);
  });

  it('sem lançamentos: exclui com as submetas; com valor lançado: só inativa', async () => {
    const livre = await criar(metaCt01({ formula: null, objetivos: [], submetas: [submeta('1')] }));
    expect((await comoAdmin().delete(`/metas/${livre.id}`)).status).toBe(204);
    expect(
      await banco().meta.count({ where: { OR: [{ id: livre.id }, { metaPaiId: livre.id }] } }),
    ).toBe(0);

    const variavel = await criarVariavel(cicloId, fiscal.id, codigo('V'));
    const usada = await criar(metaCt01({ formula: variavel.codigo }));
    // Lançamento vazio não conta (RN-08).
    await banco().lancamento.create({
      data: { variavelId: variavel.id, mes: 1, valor: null, origem: 'DIGITACAO' },
    });
    expect(
      MetaSchema.parse((await comoAdmin().get(`/metas/${usada.id}`)).body).temLancamentos,
    ).toBe(false);
    await banco().lancamento.update({
      where: { variavelId_mes: { variavelId: variavel.id, mes: 1 } },
      data: { valor: 3 },
    });
    const r = await comoAdmin().delete(`/metas/${usada.id}`);
    expect([r.status, erro(r).codigo]).toEqual([409, 'EM_USO']);

    const inativa = await comoAdmin().put(`/metas/${usada.id}`, edicao(usada, { ativo: false }));
    expect(MetaSchema.parse(inativa.body).ativo).toBe(false);
  });

  it('submeta com valor lançado não pode ser removida', async () => {
    const variavel = await criarVariavel(cicloId, fiscal.id, codigo('V'));
    const meta = await criar(
      metaCt01({
        formula: null,
        objetivos: [],
        submetas: [submeta('0.5', { formula: variavel.codigo }), submeta('0.5')],
      }),
    );
    await banco().lancamento.create({
      data: { variavelId: variavel.id, mes: 2, valor: 1, origem: 'DIGITACAO' },
    });
    const corpo = edicao(meta);
    corpo.meta.submetas = corpo.meta.submetas.slice(1).map((s) => ({ ...s, pesoInterno: '1' }));
    const r = await comoAdmin().put(`/metas/${meta.id}`, corpo);
    expect(erro(r).mensagem).toMatch(/tem lançamentos nas suas variáveis e não pode ser removida/);
  });
});
