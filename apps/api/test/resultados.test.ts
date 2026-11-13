import { randomUUID } from 'node:crypto';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { parse } from '@metas/motor';
import type { Prisma } from '@metas/prisma';
import {
  type ErroApi as CorpoErro,
  type Meta,
  type MetaEntrada,
  MetaSchema,
  RecalculoSchema,
  type ResultadoMeta,
  ResultadoMetaSchema,
  type ResultadosGestor,
  ResultadosGestorSchema,
  type SubmetaEntrada,
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
  criarVariavel,
  desconectar,
  limparDados,
  setorCorporativo,
} from './dados.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { ResultadosService } from '../src/resultados/resultados.service.js';

type UsuarioBanco = Awaited<ReturnType<typeof criarUsuario>>;
type SetorBanco = Awaited<ReturnType<typeof criarSetor>>;

const erro = (r: { body: unknown }): CorpoErro => r.body as CorpoErro;
const codigo = (prefixo: string) => `${prefixo}_${randomUUID().slice(0, 8).toUpperCase()}`;

let app: NestExpressApplication;
let admin: UsuarioBanco;
let julia: UsuarioBanco;
let carlos: UsuarioBanco;
let diretoria: UsuarioBanco;
let leitor: UsuarioBanco;
let fiscal: SetorBanco;
let rh: SetorBanco;
let corporativoId: string;
let cicloId: string;

const tokens = new Map<string, string>();
const como = (u: UsuarioBanco) => {
  const token = tokens.get(u.id) ?? '';
  return {
    get: (url: string) => cliente(app).get(`/api/v1${url}`).set('Authorization', `Bearer ${token}`),
    post: (url: string, corpo: object = {}) =>
      cliente(app).post(`/api/v1${url}`).set('Authorization', `Bearer ${token}`).send(corpo),
    put: (url: string, corpo: object) =>
      cliente(app).put(`/api/v1${url}`).set('Authorization', `Bearer ${token}`).send(corpo),
    delete: (url: string) =>
      cliente(app).delete(`/api/v1${url}`).set('Authorization', `Bearer ${token}`),
  };
};

async function criarMetaApi(corpo: MetaEntrada): Promise<Meta> {
  const r = await como(admin).post(`/ciclos/${cicloId}/metas`, corpo);
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return MetaSchema.parse(r.body);
}

async function resultadoMeta(id: string, quem: UsuarioBanco = admin): Promise<ResultadoMeta> {
  const r = await como(quem).get(`/resultados/meta/${id}`);
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return ResultadoMetaSchema.parse(r.body);
}

async function resultadosGestor(
  gestor: UsuarioBanco,
  quem: UsuarioBanco = admin,
): Promise<ResultadosGestor> {
  const r = await como(quem).get(`/resultados/gestor/${gestor.id}?ciclo=${cicloId}`);
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return ResultadosGestorSchema.parse(r.body);
}

async function recalcular(id = cicloId) {
  const r = await como(admin).post(`/ciclos/${id}/recalcular`);
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return RecalculoSchema.parse(r.body);
}

/** Valores por mês (1 = janeiro), como a carga histórica gravaria. */
async function lancar(variavelId: string, valores: readonly (string | null)[]) {
  await banco().lancamento.createMany({
    data: valores.map((valor, i) => ({ variavelId, mes: i + 1, valor, origem: 'CARGA_HISTORICA' })),
  });
}

const base = (alteracoes: Partial<MetaEntrada>): MetaEntrada => ({
  setorId: fiscal.id,
  codigo: codigo('M'),
  indicador: 'Meta de teste',
  metrica: 'Teste',
  unidade: 'PERCENTUAL',
  formula: null,
  modoApuracao: 'FORMULA_SOBRE_ACUMULADOS',
  operador: 'GE',
  mesInicio: 1,
  mesFim: 12,
  objetivos: [],
  regraPontuacao: 'PROPORCIONAL',
  responsavelId: julia.id,
  atribuicoes: [{ usuarioId: julia.id, peso: '10' }],
  ...alteracoes,
});

let ct01: Meta;
let ct12: Meta;
let ct15: Meta;
let totalReqId: string;

beforeAll(async () => {
  await limparDados();
  app = await criarApp(configTeste());
  admin = await criarUsuario('ADMIN', { nome: 'Admin do Teste' });
  julia = await criarUsuario('GESTOR', { nome: 'Julia Souza' });
  carlos = await criarUsuario('GESTOR', { nome: 'Carlos Lima' });
  diretoria = await criarUsuario('DIRETORIA', { nome: 'Diretoria' });
  fiscal = await criarSetor('Fiscal (teste)');
  rh = await criarSetor('RH (teste)');
  corporativoId = (await setorCorporativo()).id;
  leitor = await criarUsuario('LEITOR', { nome: 'Leitor do Fiscal' });
  await banco().leitorSetor.create({ data: { usuarioId: leitor.id, setorId: fiscal.id } });
  for (const u of [admin, julia, carlos, diretoria, leitor]) {
    tokens.set(u.id, await emitirToken({ oid: u.entraOid, preferred_username: u.email }));
  }
  cicloId = (await criarCiclo(ANO_ATIVO, 'ATIVO')).id;

  // CT-01: REQ_ATENDIDOS / TOTAL_REQ, ambas SOMA, GE 0,80; jan 16/20, fev 20/25.
  const atendidos = await criarVariavel(cicloId, fiscal.id, 'REQ_ATENDIDOS');
  const total = await criarVariavel(cicloId, fiscal.id, 'TOTAL_REQ');
  totalReqId = total.id;
  ct01 = await criarMetaApi(
    base({ formula: 'REQ_ATENDIDOS / TOTAL_REQ', objetivos: [{ mes: 0, valor: '0.8' }] }),
  );
  await lancar(atendidos.id, ['16', '20']);
  await lancar(total.id, ['20', '25']);

  // CT-12: Engajamento da Julia, 5 submetas × 20%, proporcional, peso 10 (dados do motor, P05).
  const variavel = async (cod: string, acumulacao: 'SOMA' | 'ULTIMO', valores: string[]) => {
    const v = await banco().variavel.create({
      data: { cicloId, setorId: rh.id, codigo: cod, nome: cod, tipo: 'NUMERO', acumulacao },
    });
    await lancar(v.id, valores);
  };
  await variavel('EVENTOS_PART', 'SOMA', ['20', '23']);
  await variavel('EVENTOS_TOTAL', 'SOMA', ['24', '24']);
  await variavel('ADMISSOES', 'SOMA', ['1', '1']);
  await variavel('DEMISSOES', 'SOMA', ['1', '0']);
  await variavel('TOTAL_COLAB', 'ULTIMO', ['80', '80']);
  await variavel('JORNADA_PCT', 'ULTIMO', ['0.0056']);
  await variavel('PCT_PROJETO', 'ULTIMO', ['0']);
  await variavel('NOTA_LIDERANCA', 'ULTIMO', ['3.04']);
  const submeta = (formula: string, alteracoes: Partial<SubmetaEntrada> = {}): SubmetaEntrada => ({
    codigo: codigo('SUB'),
    indicador: formula,
    metrica: formula,
    unidade: 'PERCENTUAL',
    formula,
    modoApuracao: 'ULTIMO_RESULTADO',
    operador: 'GE',
    mesInicio: 1,
    mesFim: 12,
    objetivos: [{ mes: 0, valor: '1' }],
    pesoInterno: '0.2',
    ...alteracoes,
  });
  ct12 = await criarMetaApi(
    base({
      setorId: rh.id,
      codigo: codigo('ENGAJAMENTO'),
      indicador: 'Engajamento',
      submetas: [
        submeta('EVENTOS_PART / EVENTOS_TOTAL', {
          modoApuracao: 'FORMULA_SOBRE_ACUMULADOS',
          objetivos: [{ mes: 0, valor: '0.9' }],
        }),
        submeta('(ADMISSOES + DEMISSOES) / 2 / TOTAL_COLAB', {
          modoApuracao: 'FORMULA_SOBRE_ACUMULADOS',
          operador: 'LE',
          objetivos: [{ mes: 0, valor: '0.1' }],
        }),
        submeta('JORNADA_PCT', { operador: 'LE', objetivos: [{ mes: 0, valor: '0.03' }] }),
        submeta('PCT_PROJETO'),
        submeta('NOTA_LIDERANCA', { unidade: 'NUMERO', objetivos: [{ mes: 0, valor: '3' }] }),
      ],
    }),
  );

  // CT-15: corporativa atribuída a Julia (15) e Carlos (10); atendimento 0,8.
  const entradas = await banco().variavel.create({
    data: {
      cicloId,
      setorId: corporativoId,
      codigo: 'ENTRADAS',
      nome: 'Entradas',
      tipo: 'NUMERO',
      acumulacao: 'SOMA',
      responsavelId: julia.id,
    },
  });
  await lancar(entradas.id, ['40', '40']);
  ct15 = await criarMetaApi(
    base({
      setorId: corporativoId,
      codigo: codigo('CORP'),
      indicador: 'Entradas de caixa',
      unidade: 'NUMERO',
      formula: 'ENTRADAS',
      objetivos: [{ mes: 0, valor: '100' }],
      atribuicoes: [
        { usuarioId: julia.id, peso: '15' },
        { usuarioId: carlos.id, peso: '10' },
      ],
    }),
  );
});

afterAll(async () => {
  await app.close();
  await limparDados();
  await desconectar();
});

describe('cálculo ao salvar e recálculo do ciclo', () => {
  it('a meta salva já tem resultado (sem lançamentos depois dela: os do CT-01 vieram antes?)', async () => {
    // A meta do CT-01 foi salva antes dos lançamentos: o resultado gravado ainda é "sem dados".
    const r = await resultadoMeta(ct01.id);
    expect(r.resultado).toMatchObject({ acumulado: null, situacao: 'SEM_DADOS', atendimento: '0' });
    expect(r.mensal).toHaveLength(12);
  });

  it('recalcular o ciclo: todas as metas sem pai, com o tempo gasto', async () => {
    const recalculo = await recalcular();
    expect(recalculo.metas).toBe(3);
  });
});

describe('CT-01 pela API', () => {
  it('80,00% contra ≥ 80%: atendimento 1, BATIDA, 10 pontos, mês a mês e memória', async () => {
    const r = await resultadoMeta(ct01.id);
    expect(r.resultado).toMatchObject({
      acumulado: '0.8',
      objetivo: '0.8',
      atendimento: '1',
      situacao: 'BATIDA',
    });
    expect(r.mensal.slice(0, 3)).toEqual([
      expect.objectContaining({ mes: 1, resultado: '0.8', situacao: 'BATIDA', foraPeriodo: false }),
      expect.objectContaining({ mes: 2, resultado: '0.8', situacao: 'BATIDA' }),
      expect.objectContaining({ mes: 3, resultado: null, situacao: 'SEM_DADOS' }),
    ]);
    expect(r.memoria).toMatchObject({
      formula: 'REQ_ATENDIDOS / TOTAL_REQ',
      resultado: '0.8',
      variaveis: [
        expect.objectContaining({ chave: 'REQ_ATENDIDOS', acumulado: '36' }),
        expect.objectContaining({ chave: 'TOTAL_REQ', acumulado: '45' }),
      ],
    });
    expect(r.atribuicoes).toEqual([
      { usuarioId: julia.id, usuarioNome: 'Julia Souza', peso: '10', pontos: '10' },
    ]);
  });
});

describe('CT-12 pela API', () => {
  it('mãe com 5 submetas × 20%: atendimento 0,799074 (79,91%), 7,99 pontos', async () => {
    const r = await resultadoMeta(ct12.id);
    expect(r.submetas.map((s) => s.resultado?.atendimento)).toEqual([
      '0.99537',
      '1',
      '1',
      '0',
      '1',
    ]);
    expect(r.resultado).toMatchObject({ atendimento: '0.799074', situacao: 'ABAIXO' });
    expect(r.mensal).toEqual([]); // mãe sem fórmula própria só agrega
    const pontos = r.atribuicoes[0]?.pontos ?? '';
    expect(pontos).toBe('7.990741');
    expect(Number(pontos).toFixed(2)).toBe('7.99');
  });

  it('pedida pelo id de uma submeta, devolve a mãe', async () => {
    const submetaId = ct12.submetas[0]?.id ?? '';
    expect((await resultadoMeta(submetaId)).metaId).toBe(ct12.id);
  });
});

describe('CT-15 pela API', () => {
  it('um resultado, mesmo atendimento, pontos 15 × 0,8 e 10 × 0,8', async () => {
    const r = await resultadoMeta(ct15.id);
    expect(r.resultado).toMatchObject({ acumulado: '80', atendimento: '0.8' });
    expect(r.atribuicoes.map((a) => [a.usuarioNome, a.pontos])).toEqual([
      ['Carlos Lima', '8'],
      ['Julia Souza', '12'],
    ]);
  });

  it('o Gestor vê só a própria pontuação na corporativa', async () => {
    const r = await resultadoMeta(ct15.id, carlos);
    expect(r.atribuicoes).toEqual([
      { usuarioId: carlos.id, usuarioNome: 'Carlos Lima', peso: '10', pontos: '8' },
    ]);
  });
});

describe('notas do gestor', () => {
  it('Julia: Departamental 10 + 7,990741; Corporativo 12; total', async () => {
    const r = await resultadosGestor(julia);
    expect(r.notas).toMatchObject({
      corporativo: { peso: '15', pontos: '12' },
      departamental: { peso: '20', pontos: '17.990741' },
      total: '29.990741',
    });
    expect(r.metas.map((m) => [m.bloco, m.metaId, m.pontos])).toEqual([
      ['CORPORATIVO', ct15.id, '12'],
      ['DEPARTAMENTAL', ct01.id, '10'],
      ['DEPARTAMENTAL', ct12.id, '7.990741'],
    ]);
  });

  it('Carlos só com a corporativa', async () => {
    const r = await resultadosGestor(carlos, carlos);
    expect(r.notas).toMatchObject({
      corporativo: { pontos: '8' },
      departamental: null,
      total: '8',
    });
  });
});

describe('permissões (7.5)', () => {
  it('Gestor não vê os resultados de outro gestor', async () => {
    const r = await como(carlos).get(`/resultados/gestor/${julia.id}?ciclo=${cicloId}`);
    expect(r.status).toBe(403);
    expect(erro(r).codigo).toBe('SEM_PERMISSAO');
  });

  it('Gestor não vê meta que não é dele nem atribuída a ele (404)', async () => {
    const r = await como(carlos).get(`/resultados/meta/${ct01.id}`);
    expect(r.status).toBe(404);
  });

  it('Diretoria vê tudo, com as notas', async () => {
    expect((await resultadosGestor(julia, diretoria)).notas?.total).toBe('29.990741');
  });

  it('Leitor vê só as metas dos setores liberados, sem as notas', async () => {
    const r = await resultadosGestor(julia, leitor);
    expect(r.notas).toBeNull();
    expect(r.metas.map((m) => m.metaId)).toEqual([ct01.id]);
    expect((await como(leitor).get(`/resultados/meta/${ct12.id}`)).status).toBe(404);
    expect((await resultadoMeta(ct01.id, leitor)).resultado?.situacao).toBe('BATIDA');
  });

  it('só o Administrador recalcula', async () => {
    for (const u of [diretoria, julia, leitor]) {
      expect((await como(u).post(`/ciclos/${cicloId}/recalcular`)).status).toBe(403);
    }
  });

  it('ciclo, gestor ou meta inexistentes: 404', async () => {
    expect((await como(admin).get(`/resultados/meta/${randomUUID()}`)).status).toBe(404);
    expect(
      (await como(admin).get(`/resultados/gestor/${randomUUID()}?ciclo=${cicloId}`)).status,
    ).toBe(404);
    expect(
      (await como(admin).get(`/resultados/gestor/${julia.id}?ciclo=${randomUUID()}`)).status,
    ).toBe(404);
    expect((await como(admin).post(`/ciclos/${randomUUID()}/recalcular`)).status).toBe(404);
  });

  it('sem ?ciclo=, vale o ciclo ativo (o Gestor não lista ciclos, P20)', async () => {
    const r = await como(julia).get(`/resultados/gestor/${julia.id}`);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const corpo = ResultadosGestorSchema.parse(r.body);
    expect(corpo.ciclo).toEqual({ id: cicloId, ano: ANO_ATIVO, status: 'ATIVO' });
    expect(corpo.ciclos.map((c) => c.id)).toEqual([cicloId]);
    expect(corpo.metas.map((m) => m.metaId)).toContain(ct01.id);
  });
});

describe('recálculo por evento (especificação 6.5)', () => {
  it('meta alterada (objetivo 0,90): resultado e nota da Julia mudam na hora', async () => {
    const atual = MetaSchema.parse((await como(admin).get(`/metas/${ct01.id}`)).body);
    const r = await como(admin).put(`/metas/${ct01.id}`, {
      versao: atual.versao,
      meta: base({
        codigo: atual.codigo,
        formula: 'REQ_ATENDIDOS / TOTAL_REQ',
        objetivos: [{ mes: 0, valor: '0.9' }],
      }),
    });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const depois = await resultadoMeta(ct01.id);
    expect(depois.resultado).toMatchObject({ atendimento: '0.888889', situacao: 'ABAIXO' });
    expect((await resultadosGestor(julia)).notas?.departamental?.pontos).toBe('16.87963');
  });

  it('lançamento numa variável (o P18 chama o mesmo gatilho): só as metas que a usam', async () => {
    await banco().lancamento.create({
      data: { variavelId: totalReqId, mes: 3, valor: '5', origem: 'CARGA_HISTORICA' },
    });
    const antesCt15 = (await resultadoMeta(ct15.id)).resultado?.calculadoEm;
    const prisma = app.get(PrismaService);
    const resultados = app.get(ResultadosService);
    await prisma.$transaction((tx) => resultados.recalcularPorVariaveis(tx, [totalReqId]));
    // 36 / 50 = 0,72 contra ≥ 0,90.
    expect((await resultadoMeta(ct01.id)).resultado).toMatchObject({ acumulado: '0.72' });
    expect((await resultadoMeta(ct15.id)).resultado?.calculadoEm).toBe(antesCt15);
  });

  it('meta inativada sai da nota; reativada volta', async () => {
    const atual = MetaSchema.parse((await como(admin).get(`/metas/${ct15.id}`)).body);
    const corpo = (ativo: boolean, versao: number) => ({
      versao,
      meta: base({
        setorId: corporativoId,
        codigo: atual.codigo,
        indicador: atual.indicador,
        unidade: 'NUMERO',
        formula: 'ENTRADAS',
        objetivos: [{ mes: 0, valor: '100' }],
        atribuicoes: [
          { usuarioId: julia.id, peso: '15' },
          { usuarioId: carlos.id, peso: '10' },
        ],
        ativo,
      }),
    });
    const inativada = await como(admin).put(`/metas/${ct15.id}`, corpo(false, atual.versao));
    expect(inativada.status, JSON.stringify(inativada.body)).toBe(200);
    expect((await resultadoMeta(ct15.id)).resultado).toBeNull();
    expect((await resultadosGestor(carlos)).notas).toMatchObject({ corporativo: null, total: '0' });

    const reativada = await como(admin).put(`/metas/${ct15.id}`, corpo(true, atual.versao + 1));
    expect(reativada.status, JSON.stringify(reativada.body)).toBe(200);
    expect((await resultadosGestor(carlos)).notas?.total).toBe('8');
  });

  it('meta excluída: a nota do gestor perde os pontos', async () => {
    const extra = await criarMetaApi(
      base({
        setorId: corporativoId,
        codigo: codigo('EXTRA'),
        unidade: 'NUMERO',
        formula: 'ENTRADAS',
        objetivos: [{ mes: 0, valor: '50' }],
        atribuicoes: [{ usuarioId: carlos.id, peso: '5' }],
      }),
    );
    expect((await resultadosGestor(carlos)).notas?.corporativo).toEqual({
      peso: '15',
      pontos: '13',
    });
    // A meta usa ENTRADAS, que tem valor: a API só deixa excluir sem lançamentos. Aqui o teste
    // tira a meta pelo serviço de metas com o vínculo removido antes (caso de uma meta nova).
    await banco().metaVariavel.deleteMany({ where: { metaId: extra.id } });
    expect((await como(admin).delete(`/metas/${extra.id}`)).status).toBe(204);
    expect((await resultadosGestor(carlos)).notas?.corporativo).toEqual({
      peso: '10',
      pontos: '8',
    });
  });

  it('ciclo encerrado não recalcula (notas congeladas)', async () => {
    const encerrado = await criarCiclo(ANO_RASCUNHO, 'ENCERRADO');
    const r = await como(admin).post(`/ciclos/${encerrado.id}/recalcular`);
    expect(r.status).toBe(422);
    expect(erro(r).codigo).toBe('CICLO_ENCERRADO');
  });
});

describe('desempenho (aceite do P17)', () => {
  it('recalcula um ciclo de 150 metas, 300 variáveis e 12 meses em menos de 1 s', async () => {
    const outro = await criarCiclo(ANO_FECHADO, 'RASCUNHO');
    const gestores = [julia, carlos];
    const variaveis = Array.from({ length: 300 }, (_, i) => ({
      id: randomUUID(),
      cicloId: outro.id,
      setorId: fiscal.id,
      codigo: `V${String(i).padStart(3, '0')}`,
      nome: `Variável ${String(i)}`,
      tipo: 'NUMERO' as const,
      acumulacao: i % 2 === 0 ? ('SOMA' as const) : ('ULTIMO' as const),
    }));
    await banco().variavel.createMany({ data: variaveis });
    await banco().lancamento.createMany({
      data: variaveis.flatMap((v, i) =>
        Array.from({ length: 12 }, (_, m) => ({
          variavelId: v.id,
          mes: m + 1,
          valor: String(((i + 1) * (m + 3)) % 97),
          origem: 'CARGA_HISTORICA' as const,
        })),
      ),
    });
    const modos = [
      'FORMULA_SOBRE_ACUMULADOS',
      'SOMA_RESULTADOS',
      'MEDIA_RESULTADOS',
      'MAXIMO_RESULTADOS',
      'ULTIMO_RESULTADO',
    ] as const;
    const metas = Array.from({ length: 150 }, (_, i) => {
      const [a, b] = [variaveis[2 * i], variaveis[2 * i + 1]];
      const formula = `${a?.codigo ?? ''} / ${b?.codigo ?? ''}`;
      return {
        id: randomUUID(),
        cicloId: outro.id,
        setorId: fiscal.id,
        responsavelId: julia.id,
        codigo: `PERF_${String(i).padStart(3, '0')}`,
        indicador: `Meta ${String(i)}`,
        metrica: 'Teste',
        unidade: 'PERCENTUAL' as const,
        formulaTexto: formula,
        formulaAst: parse(formula) as unknown as Prisma.InputJsonValue,
        modoApuracao: modos[i % modos.length] ?? 'FORMULA_SOBRE_ACUMULADOS',
        operador: i % 3 === 0 ? ('LE' as const) : ('GE' as const),
        mesInicio: 1,
        mesFim: 12,
        regraPontuacao: 'PROPORCIONAL' as const,
      };
    });
    await banco().meta.createMany({ data: metas });
    await banco().metaVariavel.createMany({
      data: metas.flatMap((m, i) =>
        [variaveis[2 * i], variaveis[2 * i + 1]].map((v) => ({
          metaId: m.id,
          variavelId: v?.id ?? '',
        })),
      ),
    });
    await banco().metaObjetivo.createMany({
      data: metas.map((m) => ({ metaId: m.id, mes: 0, valor: '0.5' })),
    });
    await banco().metaAtribuicao.createMany({
      data: metas.map((m, i) => ({
        metaId: m.id,
        usuarioId: gestores[i % 2]?.id ?? '',
        peso: '1',
      })),
    });

    await recalcular(outro.id); // aquece (primeira execução compila caminhos no V8)
    const inicio = performance.now();
    const recalculo = await recalcular(outro.id);
    const total = performance.now() - inicio;
    expect(recalculo.metas).toBe(150);
    expect(recalculo.milissegundos).toBeLessThan(1000);
    expect(total).toBeLessThan(1000);
    expect(await banco().resultadoMetaMes.count({ where: { meta: { cicloId: outro.id } } })).toBe(
      1800,
    );
    console.info(
      `Recálculo de 150 metas: ${String(recalculo.milissegundos)} ms no servidor, ${total.toFixed(0)} ms com a requisição.`,
    );
  });
});

describe('ciclos do seletor de ano em Minhas metas (P20)', () => {
  // Usa o ciclo em rascunho do teste de desempenho (150 metas da Julia e do Carlos).
  const outroCiclo = () => banco().ciclo.findUniqueOrThrow({ where: { ano: ANO_FECHADO } });
  const doGestor = async (quem: UsuarioBanco, gestor: UsuarioBanco, ciclo?: string) => {
    const r = await como(quem).get(
      `/resultados/gestor/${gestor.id}${ciclo === undefined ? '' : `?ciclo=${ciclo}`}`,
    );
    return {
      status: r.status,
      corpo: r.status === 200 ? ResultadosGestorSchema.parse(r.body) : null,
    };
  };

  it('rascunho: só Administrador e Diretoria veem; para o Gestor ele não existe', async () => {
    const rascunho = await outroCiclo();
    expect(rascunho.status).toBe('RASCUNHO');
    const daJulia = await doGestor(julia, julia);
    expect(daJulia.corpo?.ciclos.map((c) => c.ano)).toEqual([ANO_ATIVO]);
    expect((await doGestor(julia, julia, rascunho.id)).status).toBe(404);
    const meta = await banco().meta.findFirstOrThrow({
      where: { cicloId: rascunho.id, atribuicoes: { some: { usuarioId: julia.id } } },
    });
    expect((await como(julia).get(`/resultados/meta/${meta.id}`)).status).toBe(404);
    expect((await como(admin).get(`/resultados/meta/${meta.id}`)).status).toBe(200);

    for (const quem of [admin, diretoria]) {
      const r = await doGestor(quem, julia);
      expect(r.corpo?.ciclos.map((c) => c.ano)).toEqual([ANO_ATIVO, ANO_FECHADO]);
      expect(r.corpo?.ciclo?.ano).toBe(ANO_ATIVO);
    }
  });

  it('encerrados entram no seletor; sem ciclo ativo, abre o encerrado mais recente', async () => {
    const anterior = await outroCiclo();
    await banco().ciclo.update({
      where: { id: anterior.id },
      data: { status: 'ENCERRADO', encerradoEm: new Date() },
    });
    try {
      const comAtivo = await doGestor(julia, julia);
      expect(comAtivo.corpo?.ciclos.map((c) => [c.ano, c.status])).toEqual([
        [ANO_ATIVO, 'ATIVO'],
        [ANO_FECHADO, 'ENCERRADO'],
      ]);
      expect(comAtivo.corpo?.ciclo?.ano).toBe(ANO_ATIVO);
      const pedido = await doGestor(julia, julia, anterior.id);
      expect(pedido.corpo?.ciclo).toEqual({
        id: anterior.id,
        ano: ANO_FECHADO,
        status: 'ENCERRADO',
      });
      expect(pedido.corpo?.metas.length).toBeGreaterThan(0);

      await banco().ciclo.update({
        where: { id: cicloId },
        data: { status: 'ENCERRADO', encerradoEm: new Date() },
      });
      const semAtivo = await doGestor(julia, julia);
      expect(semAtivo.corpo?.ciclo?.ano).toBe(ANO_ATIVO);
      expect(semAtivo.corpo?.ciclo?.status).toBe('ENCERRADO');
    } finally {
      await banco().ciclo.update({
        where: { id: cicloId },
        data: { status: 'ATIVO', encerradoEm: null },
      });
      await banco().ciclo.update({
        where: { id: anterior.id },
        data: { status: 'RASCUNHO', encerradoEm: null },
      });
    }
  });

  it('gestor ainda sem metas: sem ciclo, sem notas e sem erro', async () => {
    const novo = await criarUsuario('GESTOR', { nome: 'Gestor sem metas' });
    tokens.set(novo.id, await emitirToken({ oid: novo.entraOid, preferred_username: novo.email }));
    const r = await doGestor(novo, novo);
    expect(r.status).toBe(200);
    expect(r.corpo).toMatchObject({ ciclo: null, ciclos: [], notas: null, metas: [] });
  });
});
