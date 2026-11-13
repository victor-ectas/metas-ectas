import { randomUUID } from 'node:crypto';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { dataFechamento } from '@metas/motor';
import {
  type ConflitoLancamento,
  type ErroApi as CorpoErro,
  type ItemLancamento,
  type LancamentosMes,
  LancamentosMesSchema,
  LancamentosSalvosSchema,
  type Meta,
  MetaSchema,
  type ProblemaLancamento,
  ResultadoMetaSchema,
} from '@metas/tipos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { cliente, configTeste, criarApp, emitirToken } from './apoio.js';
import {
  ANO_ATIVO,
  ANO_FECHADO,
  ANO_RASCUNHO,
  banco,
  criarCiclo,
  criarSetor,
  criarUsuario,
  desconectar,
  limparDados,
  setorCorporativo,
} from './dados.js';
import { Relogio } from '../src/comum/relogio.js';

type UsuarioBanco = Awaited<ReturnType<typeof criarUsuario>>;
type SetorBanco = Awaited<ReturnType<typeof criarSetor>>;

/** 10/03/2097, 12h em São Paulo: janeiro fechado, fevereiro e março abertos, abril futuro. */
const AGORA = new Date('2097-03-10T15:00:00Z');

const erro = (r: { body: unknown }): CorpoErro => r.body as CorpoErro;
const itensDoErro = (r: { body: unknown }) => erro(r).detalhes.itens as ProblemaLancamento[];

let app: NestExpressApplication;
let admin: UsuarioBanco;
let julia: UsuarioBanco;
let carlos: UsuarioBanco;
let diretoria: UsuarioBanco;
let leitor: UsuarioBanco;
let fiscal: SetorBanco;
let rh: SetorBanco;
let cicloId: string;
let ct01: Meta;
const v: Record<string, string> = {};

const tokens = new Map<string, string>();
const como = (u: UsuarioBanco) => {
  const token = tokens.get(u.id) ?? '';
  return {
    get: (url: string) => cliente(app).get(`/api/v1${url}`).set('Authorization', `Bearer ${token}`),
    put: (url: string, corpo: object) =>
      cliente(app).put(`/api/v1${url}`).set('Authorization', `Bearer ${token}`).send(corpo),
    post: (url: string, corpo: object) =>
      cliente(app).post(`/api/v1${url}`).set('Authorization', `Bearer ${token}`).send(corpo),
  };
};

async function consultar(u: UsuarioBanco, mes: number, ciclo = cicloId): Promise<LancamentosMes> {
  const r = await como(u).get(`/lancamentos?ciclo=${ciclo}&mes=${String(mes)}`);
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return LancamentosMesSchema.parse(r.body);
}

const lancar = (u: UsuarioBanco, itens: ItemLancamento[], ciclo = cicloId) =>
  como(u).put('/lancamentos', { ciclo, itens });

async function lancarOk(u: UsuarioBanco, itens: ItemLancamento[]) {
  const r = await lancar(u, itens);
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return LancamentosSalvosSchema.parse(r.body);
}

/** Versão atual do lançamento (0 se não existe), como a tela leria. */
async function versao(variavelId: string, mes: number): Promise<number> {
  const l = await banco().lancamento.findUnique({
    where: { variavelId_mes: { variavelId, mes } },
  });
  return l?.versao ?? 0;
}

const variavel = (
  setor: SetorBanco | { id: string },
  codigo: string,
  tipo: 'NUMERO' | 'PERCENTUAL' | 'SIM_NAO',
  extra: { casasDecimais?: number; responsavelId?: string; ativo?: boolean; ciclo?: string } = {},
) =>
  banco().variavel.create({
    data: {
      cicloId: extra.ciclo ?? cicloId,
      setorId: setor.id,
      codigo,
      nome: codigo,
      tipo,
      acumulacao: 'SOMA',
      casasDecimais: extra.casasDecimais ?? (tipo === 'SIM_NAO' ? 0 : 2),
      responsavelId: extra.responsavelId ?? null,
      ativo: extra.ativo ?? true,
    },
  });

beforeAll(async () => {
  await limparDados();
  app = await criarApp(configTeste(), [], [{ provide: Relogio, useValue: { agora: () => AGORA } }]);
  admin = await criarUsuario('ADMIN', { nome: 'Admin do Teste' });
  julia = await criarUsuario('GESTOR', { nome: 'Julia Souza' });
  carlos = await criarUsuario('GESTOR', { nome: 'Carlos Lima' });
  diretoria = await criarUsuario('DIRETORIA');
  leitor = await criarUsuario('LEITOR');
  for (const u of [admin, julia, carlos, diretoria, leitor]) {
    tokens.set(u.id, await emitirToken({ oid: u.entraOid, preferred_username: u.email }));
  }
  fiscal = await criarSetor('Fiscal (teste)');
  rh = await criarSetor('RH (teste)');
  const corporativo = await setorCorporativo();
  cicloId = (await criarCiclo(ANO_ATIVO, 'ATIVO')).id;
  await banco().setorResponsavel.createMany({
    data: [
      { cicloId, setorId: fiscal.id, usuarioId: julia.id },
      { cicloId, setorId: rh.id, usuarioId: carlos.id },
    ],
  });

  v.atendidos = (await variavel(fiscal, 'REQ_ATENDIDOS', 'NUMERO', { casasDecimais: 0 })).id;
  v.total = (await variavel(fiscal, 'TOTAL_REQ', 'NUMERO', { casasDecimais: 0 })).id;
  v.pct = (await variavel(fiscal, 'PCT_IMPL', 'PERCENTUAL')).id;
  v.implantado = (await variavel(fiscal, 'IMPLANTADO', 'SIM_NAO')).id;
  v.inativa = (await variavel(fiscal, 'ANTIGA', 'NUMERO', { ativo: false })).id;
  v.colab = (await variavel(rh, 'TOTAL_COLAB', 'NUMERO', { casasDecimais: 0 })).id;
  v.entradas = (await variavel(corporativo, 'ENTRADAS', 'NUMERO', { responsavelId: julia.id })).id;

  // CT-01 da Julia; outra meta do Fiscal usa uma variável do RH (só leitura para a Julia).
  const meta = async (formula: string, objetivo: string) => {
    const r = await como(admin).post(`/ciclos/${cicloId}/metas`, {
      setorId: fiscal.id,
      codigo: `M_${randomUUID().slice(0, 8).toUpperCase()}`,
      indicador: formula,
      metrica: formula,
      unidade: 'PERCENTUAL',
      formula,
      modoApuracao: 'FORMULA_SOBRE_ACUMULADOS',
      operador: 'GE',
      mesInicio: 1,
      mesFim: 12,
      objetivos: [{ mes: 0, valor: objetivo }],
      regraPontuacao: 'PROPORCIONAL',
      responsavelId: julia.id,
      atribuicoes: [{ usuarioId: julia.id, peso: '10' }],
    });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    return MetaSchema.parse(r.body);
  };
  ct01 = await meta('REQ_ATENDIDOS / TOTAL_REQ', '0.8');
  await meta(`REQ_ATENDIDOS / ${rh.codigo}.TOTAL_COLAB`, '1');
});

afterAll(async () => {
  await app.close();
  await limparDados();
  await desconectar();
});

describe('GET /lancamentos', () => {
  it('Gestor: as variáveis dele (setor e Corporativo), as de outro setor só para leitura, e as metas', async () => {
    const r = await consultar(julia, 2);
    expect(r).toMatchObject({ mes: 2, status: 'ABERTO', cargaHistorica: false });
    const porCodigo = new Map(r.variaveis.map((x) => [x.codigo, x]));
    expect([...porCodigo.keys()].sort()).toEqual(
      ['ENTRADAS', 'IMPLANTADO', 'PCT_IMPL', 'REQ_ATENDIDOS', 'TOTAL_COLAB', 'TOTAL_REQ'].sort(),
    );
    expect(porCodigo.get('TOTAL_COLAB')?.editavel).toBe(false);
    expect(porCodigo.get('REQ_ATENDIDOS')).toMatchObject({
      editavel: true,
      valor: null,
      versao: 0,
      status: 'ABERTO',
    });
    expect(porCodigo.get('REQ_ATENDIDOS')?.valoresAno).toHaveLength(12);
    expect(r.metas.map((m) => m.id)).toContain(ct01.id);
    const meta = r.metas.find((m) => m.id === ct01.id);
    expect(meta?.variaveis).toMatchObject({ REQ_ATENDIDOS: v.atendidos, TOTAL_REQ: v.total });
    expect(r.fechaEm).toBe(dataFechamento(ANO_ATIVO, 2, []).toJSDate().toISOString());
  });

  it('status do mês: janeiro fechado, abril futuro', async () => {
    expect((await consultar(julia, 1)).status).toBe('FECHADO');
    expect((await consultar(julia, 4)).status).toBe('FUTURO');
  });

  it('Carlos vê as do RH; o Administrador vê todas, como carga histórica', async () => {
    const carlosVe = await consultar(carlos, 2);
    expect(carlosVe.variaveis.filter((x) => x.editavel).map((x) => x.codigo)).toEqual([
      'TOTAL_COLAB',
    ]);
    const adminVe = await consultar(admin, 2);
    expect(adminVe.cargaHistorica).toBe(true);
    expect(adminVe.variaveis.every((x) => x.editavel)).toBe(true);
  });

  it.each([
    ['Diretoria', () => diretoria],
    ['Leitor', () => leitor],
  ])('%s não lança (403)', async (_, quem) => {
    const r = await como(quem()).get(`/lancamentos?ciclo=${cicloId}&mes=2`);
    expect(r.status).toBe(403);
    expect(
      (await lancar(quem(), [{ variavelId: v.total ?? '', mes: 2, valor: '1', versao: 0 }])).status,
    ).toBe(403);
  });

  it('mês fora de 1 a 12 ou ciclo inexistente', async () => {
    expect((await como(julia).get(`/lancamentos?ciclo=${cicloId}&mes=13`)).status).toBe(400);
    expect((await como(julia).get(`/lancamentos?ciclo=${randomUUID()}&mes=2`)).status).toBe(404);
  });
});

describe('PUT /lancamentos', () => {
  it('grava em lote, cria o histórico e recalcula a meta (CT-01: fev 20/25)', async () => {
    const salvos = await lancarOk(julia, [
      { variavelId: v.atendidos ?? '', mes: 2, valor: '20', versao: 0 },
      { variavelId: v.total ?? '', mes: 2, valor: '25', versao: 0 },
    ]);
    expect(salvos.gravados).toBe(2);
    expect(salvos.itens.map((i) => i.versao)).toEqual([1, 1]);
    const historico = await banco().lancamentoHistorico.findMany({
      where: { lancamento: { variavelId: v.atendidos ?? '', mes: 2 } },
    });
    expect(historico).toHaveLength(1);
    expect(historico[0]).toMatchObject({
      valorAnterior: null,
      origem: 'DIGITACAO',
      usuarioId: julia.id,
      reaberturaId: null,
    });
    expect(historico[0]?.valorNovo?.toFixed()).toBe('20');

    const resultado = ResultadoMetaSchema.parse(
      (await como(admin).get(`/resultados/meta/${ct01.id}`)).body,
    );
    expect(resultado.resultado).toMatchObject({ acumulado: '0.8', situacao: 'BATIDA' });
  });

  it('vazio não é zero (RN-08): zero conta, vazio grava null e não apaga o histórico', async () => {
    await lancarOk(julia, [
      { variavelId: v.atendidos ?? '', mes: 3, valor: '0', versao: 0 },
      { variavelId: v.total ?? '', mes: 3, valor: '5', versao: 0 },
    ]);
    // 20 / 30: o zero de março entrou na soma.
    let r = ResultadoMetaSchema.parse((await como(admin).get(`/resultados/meta/${ct01.id}`)).body);
    expect(r.resultado?.acumulado).toBe('0.666667');

    await lancarOk(julia, [
      { variavelId: v.atendidos ?? '', mes: 3, valor: null, versao: 1 },
      { variavelId: v.total ?? '', mes: 3, valor: null, versao: 1 },
    ]);
    const lancamento = await banco().lancamento.findUniqueOrThrow({
      where: { variavelId_mes: { variavelId: v.atendidos ?? '', mes: 3 } },
    });
    expect(lancamento).toMatchObject({ valor: null, versao: 2 });
    expect(
      await banco().lancamentoHistorico.count({ where: { lancamentoId: lancamento.id } }),
    ).toBe(2);
    // Vazio fica fora: volta a 20/25.
    r = ResultadoMetaSchema.parse((await como(admin).get(`/resultados/meta/${ct01.id}`)).body);
    expect(r.resultado?.acumulado).toBe('0.8');
  });

  it('valor igual ao gravado não gera histórico nem nova versão', async () => {
    const salvos = await lancarOk(julia, [
      { variavelId: v.atendidos ?? '', mes: 2, valor: '20.0', versao: 1 },
    ]);
    expect(salvos).toMatchObject({ gravados: 0, itens: [{ versao: 1 }] });
  });

  it('conflito de versão: nada é gravado e o erro traz o valor atual', async () => {
    const r = await lancar(julia, [
      { variavelId: v.pct ?? '', mes: 2, valor: '0.5', versao: 0 },
      { variavelId: v.atendidos ?? '', mes: 2, valor: '21', versao: 0 },
    ]);
    expect(r.status).toBe(409);
    expect(erro(r).codigo).toBe('CONFLITO_VERSAO');
    expect(erro(r).detalhes.conflitos as ConflitoLancamento[]).toEqual([
      expect.objectContaining({
        variavelId: v.atendidos,
        mes: 2,
        valorAtual: '20',
        versaoAtual: 1,
      }),
    ]);
    expect(await versao(v.pct ?? '', 2)).toBe(0);
  });

  it('mês fechado: MES_FECHADO com a data do fechamento', async () => {
    const r = await lancar(julia, [{ variavelId: v.total ?? '', mes: 1, valor: '20', versao: 0 }]);
    expect(r.status).toBe(422);
    const prazo = dataFechamento(ANO_ATIVO, 1, []).toFormat('dd/MM/yyyy');
    expect(erro(r)).toMatchObject({
      codigo: 'MES_FECHADO',
      mensagem: `Janeiro/${String(ANO_ATIVO)} fechou em ${prazo}.`,
    });
  });

  it('mês futuro: MES_FUTURO', async () => {
    const r = await lancar(julia, [{ variavelId: v.total ?? '', mes: 4, valor: '20', versao: 0 }]);
    expect(r.status).toBe(422);
    expect(erro(r).codigo).toBe('MES_FUTURO');
  });

  it('variável de outro setor: SEM_PERMISSAO_VARIAVEL, e nada do lote é gravado', async () => {
    const r = await lancar(julia, [
      { variavelId: v.pct ?? '', mes: 2, valor: '0.5', versao: 0 },
      { variavelId: v.colab ?? '', mes: 2, valor: '80', versao: 0 },
    ]);
    expect(r.status).toBe(403);
    expect(erro(r).codigo).toBe('SEM_PERMISSAO_VARIAVEL');
    expect(itensDoErro(r)).toEqual([expect.objectContaining({ indice: 1, variavelId: v.colab })]);
    expect(await versao(v.pct ?? '', 2)).toBe(0);
    // O responsável pelo RH lança.
    await lancarOk(carlos, [{ variavelId: v.colab ?? '', mes: 2, valor: '80', versao: 0 }]);
  });

  it('variável do Corporativo: só o responsável dela', async () => {
    await lancarOk(julia, [{ variavelId: v.entradas ?? '', mes: 2, valor: '40', versao: 0 }]);
    const r = await lancar(carlos, [
      { variavelId: v.entradas ?? '', mes: 3, valor: '40', versao: 0 },
    ]);
    expect(erro(r).codigo).toBe('SEM_PERMISSAO_VARIAVEL');
  });

  describe('valores (decisão de 13/11/2026)', () => {
    it.each([
      ['SIM/NÃO com 0,5', 'implantado', '0.5', 'é SIM/NÃO: use 1 (sim) ou 0 (não)'],
      ['inteiro com casas', 'total', '1.5', 'aceita só números inteiros'],
      [
        'percentual com 3 casas no digitado (12,345%)',
        'pct',
        '0.12345',
        'no máximo 2 casas decimais',
      ],
    ])('recusa %s', async (_, chave, valor, mensagem) => {
      const r = await lancar(julia, [{ variavelId: v[chave] ?? '', mes: 2, valor, versao: 0 }]);
      expect(r.status).toBe(400);
      expect(erro(r).codigo).toBe('VALIDACAO');
      expect(erro(r).mensagem).toContain(mensagem);
    });

    it('aceita SIM/NÃO 1, percentual com 2 casas no digitado e negativo (CT-09)', async () => {
      await lancarOk(julia, [
        { variavelId: v.implantado ?? '', mes: 2, valor: '1', versao: 0 },
        { variavelId: v.pct ?? '', mes: 2, valor: '-0.1979', versao: 0 },
      ]);
    });

    it('variável inativa ou de outro ciclo: VALIDACAO', async () => {
      const outroCiclo = await criarCiclo(ANO_RASCUNHO, 'RASCUNHO');
      const deOutro = await variavel(fiscal, 'OUTRO', 'NUMERO', { ciclo: outroCiclo.id });
      const r = await lancar(julia, [
        { variavelId: v.inativa ?? '', mes: 2, valor: '1', versao: 0 },
        { variavelId: deOutro.id, mes: 2, valor: '1', versao: 0 },
      ]);
      expect(erro(r).codigo).toBe('VALIDACAO');
      expect(itensDoErro(r).map((i) => i.mensagem)).toEqual([
        'A variável ANTIGA está inativa.',
        'Variável não encontrada neste ciclo.',
      ]);
    });

    it('mesma variável e mês duas vezes no lote: 400', async () => {
      const item = { variavelId: v.total ?? '', mes: 2, valor: '1', versao: 1 };
      expect((await lancar(julia, [item, item])).status).toBe(400);
    });
  });

  describe('reabertura (RN-36): só o escopo dela', () => {
    it('janeiro reaberto para o Fiscal: a Julia lança e o histórico liga a reabertura', async () => {
      const reabertura = await banco().reabertura.create({
        data: {
          cicloId,
          mes: 1,
          escopo: 'SETOR',
          escopoId: fiscal.id,
          validoAte: new Date('2097-03-20T02:59:59Z'),
          motivo: 'Correção pedida pela Diretoria',
          autorizadoPor: 'Diretoria',
        },
      });
      const r = await consultar(julia, 1);
      expect(r.variaveis.find((x) => x.codigo === 'TOTAL_REQ')?.status).toBe('REABERTO');
      expect(r.variaveis.find((x) => x.codigo === 'ENTRADAS')?.status).toBe('FECHADO');

      await lancarOk(julia, [{ variavelId: v.total ?? '', mes: 1, valor: '20', versao: 0 }]);
      const historico = await banco().lancamentoHistorico.findFirstOrThrow({
        where: { lancamento: { variavelId: v.total ?? '', mes: 1 } },
      });
      expect(historico.reaberturaId).toBe(reabertura.id);

      // RH continua fechado.
      const rh = await lancar(carlos, [
        { variavelId: v.colab ?? '', mes: 1, valor: '80', versao: 0 },
      ]);
      expect(erro(rh).codigo).toBe('MES_FECHADO');
    });
  });
});

describe('ciclo e carga histórica (RN-38, RN-39)', () => {
  it('Administrador lança em mês fechado e futuro como carga histórica', async () => {
    await lancarOk(admin, [
      { variavelId: v.atendidos ?? '', mes: 1, valor: '16', versao: 0 },
      { variavelId: v.colab ?? '', mes: 5, valor: '80', versao: 0 },
    ]);
    const historico = await banco().lancamentoHistorico.findFirstOrThrow({
      where: { lancamento: { variavelId: v.atendidos ?? '', mes: 1 } },
    });
    expect(historico).toMatchObject({ origem: 'CARGA_HISTORICA', usuarioId: admin.id });
    const lancamento = await banco().lancamento.findUniqueOrThrow({
      where: { variavelId_mes: { variavelId: v.atendidos ?? '', mes: 1 } },
    });
    expect(lancamento.origem).toBe('CARGA_HISTORICA');
  });

  it('Gestor não lança em ciclo que ainda não foi ativado', async () => {
    const rascunho = await banco().ciclo.findFirstOrThrow({ where: { ano: ANO_RASCUNHO } });
    const r = await lancar(
      julia,
      [{ variavelId: v.total ?? '', mes: 2, valor: '1', versao: 1 }],
      rascunho.id,
    );
    expect(r.status).toBe(422);
    expect(erro(r).codigo).toBe('STATUS_CICLO_INVALIDO');
  });

  it('ciclo encerrado não aceita nem carga histórica', async () => {
    const encerrado = await criarCiclo(ANO_FECHADO, 'ENCERRADO');
    const r = await lancar(
      admin,
      [{ variavelId: v.total ?? '', mes: 2, valor: '1', versao: 1 }],
      encerrado.id,
    );
    expect(r.status).toBe(422);
    expect(erro(r).codigo).toBe('CICLO_ENCERRADO');
  });
});
