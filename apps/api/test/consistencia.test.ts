import { randomUUID } from 'node:crypto';

import type { NestExpressApplication } from '@nestjs/platform-express';
import {
  CicloSchema,
  type ConsistenciaCiclo,
  ConsistenciaCicloSchema,
  type ErroApi as CorpoErro,
  type Meta,
  type MetaEntrada,
  MetaSchema,
  type ProblemaConsistencia,
} from '@metas/tipos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { cliente, configTeste, criarApp, emitirToken } from './apoio.js';
import {
  ANO_ATIVO,
  ANO_FECHADO,
  ANO_RASCUNHO,
  banco,
  criarCiclo,
  criarMeta,
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
let fiscal: SetorBanco;
let corporativoId: string;

const http = () => cliente(app);
const como = (token: string) => ({
  get: (url: string) => http().get(`/api/v1${url}`).set('Authorization', `Bearer ${token}`),
  post: (url: string, corpo: object = {}) =>
    http().post(`/api/v1${url}`).set('Authorization', `Bearer ${token}`).send(corpo),
  put: (url: string, corpo: object) =>
    http().put(`/api/v1${url}`).set('Authorization', `Bearer ${token}`).send(corpo),
});
const comoAdmin = () => como(tokenAdmin);
const tokenDe = (u: UsuarioBanco) => emitirToken({ oid: u.entraOid, preferred_username: u.email });

async function painel(cicloId: string): Promise<ConsistenciaCiclo> {
  const r = await comoAdmin().get(`/ciclos/${cicloId}/consistencia`);
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return ConsistenciaCicloSchema.parse(r.body);
}

const doTipo = (p: ConsistenciaCiclo, tipo: ProblemaConsistencia['tipo']) =>
  p.problemas.filter((x) => x.tipo === tipo);

/** CT-01 departamental do Fiscal, atribuída à Julia com o peso pedido. */
function metaFiscal(peso: string, alteracoes: Partial<MetaEntrada> = {}): MetaEntrada {
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
    atribuicoes: [{ usuarioId: julia.id, peso }],
    ...alteracoes,
  };
}

async function criarMetaApi(cicloId: string, corpo: MetaEntrada): Promise<Meta> {
  const r = await comoAdmin().post(`/ciclos/${cicloId}/metas`, corpo);
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return MetaSchema.parse(r.body);
}

async function variaveisFiscal(cicloId: string) {
  return {
    atendidos: await criarVariavel(cicloId, fiscal.id, 'REQ_ATENDIDOS'),
    total: await criarVariavel(cicloId, fiscal.id, 'TOTAL_REQ'),
  };
}

const definirResponsavel = (cicloId: string, setorId: string, usuarioId: string) =>
  banco().setorResponsavel.create({ data: { cicloId, setorId, usuarioId } });

beforeAll(async () => {
  await limparDados();
  app = await criarApp(configTeste());
  admin = await criarUsuario('ADMIN', { nome: 'Admin do Teste' });
  julia = await criarUsuario('GESTOR', { nome: 'Julia Souza' });
  carlos = await criarUsuario('GESTOR', { nome: 'Carlos Lima' });
  tokenAdmin = await tokenDe(admin);
  fiscal = await criarSetor('Fiscal (teste)');
  corporativoId = (await setorCorporativo()).id;
});

afterAll(async () => {
  await app.close();
  await limparDados();
  await desconectar();
});

describe('permissão (tabela 7.5: só o Administrador)', () => {
  it.each(['GESTOR', 'DIRETORIA', 'LEITOR'] as const)(
    '%s não consulta, ativa nem encerra',
    async (perfil) => {
      const ciclo = await criarCiclo(ANO_RASCUNHO, 'RASCUNHO');
      const usuario = await criarUsuario(perfil);
      const token = await tokenDe(usuario);
      try {
        for (const r of [
          await como(token).get(`/ciclos/${ciclo.id}/consistencia`),
          await como(token).post(`/ciclos/${ciclo.id}/ativar`),
          await como(token).post(`/ciclos/${ciclo.id}/encerrar`),
        ]) {
          expect(r.status).toBe(403);
          expect(erro(r).codigo).toBe('SEM_PERMISSAO');
        }
        expect((await banco().ciclo.findUniqueOrThrow({ where: { id: ciclo.id } })).status).toBe(
          'RASCUNHO',
        );
      } finally {
        await banco().ciclo.delete({ where: { id: ciclo.id } });
      }
    },
  );

  it('ciclo inexistente: 404', async () => {
    const r = await comoAdmin().get(`/ciclos/${randomUUID()}/consistencia`);
    expect(r.status).toBe(404);
    expect(erro(r).codigo).toBe('NAO_ENCONTRADO');
  });
});

describe('CT-17 e ativação', () => {
  let cicloId: string;
  let meta: Meta;

  beforeAll(async () => {
    cicloId = (await criarCiclo(ANO_RASCUNHO, 'RASCUNHO')).id;
    await variaveisFiscal(cicloId);
    await definirResponsavel(cicloId, fiscal.id, julia.id);
    meta = await criarMetaApi(cicloId, metaFiscal('90'));
  });

  it('CT-17: gestor sem corporativas com departamentais somando 90 → PESOS_INCONSISTENTES', async () => {
    const p = await painel(cicloId);
    const [pesos, ...outros] = doTipo(p, 'PESOS_GESTOR');
    expect(outros).toHaveLength(0);
    expect(pesos).toMatchObject({
      gravidade: 'BLOQUEIA',
      codigo: 'PESOS_INCONSISTENTES',
      usuarioId: julia.id,
      mensagem: 'Julia Souza: Os pesos do bloco Departamental somam 90,00; deveriam somar 100,00.',
    });
    expect(p.gestores).toEqual([
      {
        usuarioId: julia.id,
        nome: 'Julia Souza',
        ativo: true,
        corporativo: '0',
        departamental: '90',
        total: '90',
        comCorporativas: false,
        ok: false,
      },
    ]);
    expect(p.podeAtivar).toBe(false);
    expect(p.motivoNaoAtivar).toBeNull();
  });

  it('ciclo inconsistente não ativa: CICLO_INCONSISTENTE com a lista dos bloqueios', async () => {
    const r = await comoAdmin().post(`/ciclos/${cicloId}/ativar`);
    expect(r.status).toBe(422);
    expect(erro(r).codigo).toBe('CICLO_INCONSISTENTE');
    expect(erro(r).mensagem).toContain('tem um problema que impede a ativação');
    const problemas = erro(r).detalhes.problemas as ProblemaConsistencia[];
    expect(problemas.map((x) => x.codigo)).toEqual(['PESOS_INCONSISTENTES']);
    expect((await banco().ciclo.findUniqueOrThrow({ where: { id: cicloId } })).status).toBe(
      'RASCUNHO',
    );
  });

  it('com os pesos fechando 100, ativa (avisos não impedem) e audita', async () => {
    const pesos = meta.atribuicoes.map((a) => ({ usuarioId: a.usuarioId, peso: '100' }));
    const r = await comoAdmin().put(`/metas/${meta.id}`, {
      versao: meta.versao,
      meta: { ...metaFiscal('100', { codigo: meta.codigo }), atribuicoes: pesos },
    });
    expect(r.status, JSON.stringify(r.body)).toBe(200);

    const p = await painel(cicloId);
    expect(p.problemas.filter((x) => x.gravidade === 'BLOQUEIA')).toEqual([]);
    // Carlos é Gestor ativo e não tem metas: só aviso.
    expect(doTipo(p, 'GESTOR_SEM_METAS').map((x) => x.usuarioId)).toContain(carlos.id);
    expect(p.gestores[0]).toMatchObject({ departamental: '100', ok: true });
    expect(p.podeAtivar).toBe(true);

    const ativado = await comoAdmin().post(`/ciclos/${cicloId}/ativar`);
    expect(ativado.status, JSON.stringify(ativado.body)).toBe(200);
    expect(CicloSchema.parse(ativado.body)).toMatchObject({ id: cicloId, status: 'ATIVO' });
    const auditoria = await banco().auditoria.findFirst({
      where: { entidade: 'ciclo', entidadeId: cicloId, acao: 'ATIVAR' },
    });
    expect(auditoria).toMatchObject({
      usuarioId: admin.id,
      antes: { status: 'RASCUNHO' },
      depois: { status: 'ATIVO' },
    });
  });

  it('ativar de novo: STATUS_CICLO_INVALIDO', async () => {
    const r = await comoAdmin().post(`/ciclos/${cicloId}/ativar`);
    expect(r.status).toBe(422);
    expect(erro(r)).toMatchObject({
      codigo: 'STATUS_CICLO_INVALIDO',
      mensagem: `O ciclo ${String(ANO_RASCUNHO)} já está ativo.`,
    });
  });

  it('com outro ciclo ativo, o novo não ativa: encerre o anterior antes', async () => {
    const outro = await criarCiclo(ANO_ATIVO, 'RASCUNHO');
    const p = await painel(outro.id);
    expect(p.podeAtivar).toBe(false);
    expect(p.motivoNaoAtivar).toBe(
      `Encerre o ciclo ${String(ANO_RASCUNHO)} antes de ativar o ${String(ANO_ATIVO)}: só um ciclo fica ativo por vez.`,
    );
    const r = await comoAdmin().post(`/ciclos/${outro.id}/ativar`);
    expect(r.status).toBe(422);
    expect(erro(r).codigo).toBe('STATUS_CICLO_INVALIDO');
    await banco().ciclo.delete({ where: { id: outro.id } });
  });

  it('não encerra antes do prazo de dezembro', async () => {
    const p = await painel(cicloId);
    expect(p.encerramento.permitido).toBe(false);
    expect(p.encerramento.motivo).toMatch(
      new RegExp(
        `^Dezembro/${String(ANO_RASCUNHO)} aceita lançamentos até \\d{2}/01/${String(ANO_RASCUNHO + 1)}\\.`,
      ),
    );
    const r = await comoAdmin().post(`/ciclos/${cicloId}/encerrar`);
    expect(r.status).toBe(422);
    expect(erro(r).codigo).toBe('STATUS_CICLO_INVALIDO');
    // Deixa o ciclo fora do caminho dos próximos testes (só um ativo por vez).
    await banco().ciclo.update({ where: { id: cicloId }, data: { status: 'RASCUNHO' } });
  });
});

describe('problemas que bloqueiam e avisos', () => {
  let cicloId: string;
  let p: ConsistenciaCiclo;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    cicloId = (await criarCiclo(ANO_ATIVO, 'RASCUNHO')).id;
    const { total } = await variaveisFiscal(cicloId);
    // Fiscal sem responsável no ciclo, com variáveis e metas: bloqueia.
    const comCarlos = await criarMetaApi(
      cicloId,
      metaFiscal('100', {
        responsavelId: carlos.id,
        atribuicoes: [{ usuarioId: carlos.id, peso: '100' }],
      }),
    );
    ids.comCarlos = comCarlos.id;
    // Fórmula que ficou inválida: a variável foi inativada depois (direto no banco).
    const quebrada = await criarMetaApi(cicloId, metaFiscal('0.5', { formula: 'TOTAL_REQ' }));
    ids.quebrada = quebrada.id;
    await banco().variavel.update({ where: { id: total.id }, data: { ativo: false } });
    // Meta sem atribuição e sem objetivo (montada direto no banco).
    const atendidos = await banco().variavel.findFirstOrThrow({
      where: { cicloId, codigo: 'REQ_ATENDIDOS' },
    });
    ids.sem = (
      await criarMeta({
        cicloId,
        setorId: fiscal.id,
        responsavelId: julia.id,
        formula: 'REQ_ATENDIDOS',
        variavelIds: [atendidos.id],
      })
    ).id;
    // Variável do Corporativo sem responsável próprio.
    ids.corp = (await criarVariavel(cicloId, corporativoId, codigo('CORP'))).id;
    // Setor ativo sem nada e sem responsável: só aviso.
    ids.vazio = (await criarSetor('Setor vazio (teste)')).id;
    // Gestor atribuído que foi inativado depois.
    const ana = await criarUsuario('GESTOR', { nome: 'Ana Inativa' });
    const daAna = await criarMetaApi(
      cicloId,
      metaFiscal('100', {
        formula: 'REQ_ATENDIDOS',
        responsavelId: ana.id,
        atribuicoes: [{ usuarioId: ana.id, peso: '100' }],
      }),
    );
    ids.daAna = daAna.id;
    ids.ana = ana.id;
    await banco().usuario.update({ where: { id: ana.id }, data: { ativo: false } });

    p = await painel(cicloId);
  });

  it('fórmula que deixou de validar (variável inativada)', () => {
    const formulas = doTipo(p, 'FORMULA_INVALIDA');
    // A meta do Carlos (REQ_ATENDIDOS / TOTAL_REQ) e a que só usa TOTAL_REQ.
    expect(formulas.map((x) => x.metaId).sort()).toEqual([ids.comCarlos, ids.quebrada].sort());
    for (const problema of formulas) {
      expect(problema).toMatchObject({ gravidade: 'BLOQUEIA', codigo: 'FORMULA_INVALIDA' });
      expect(problema.mensagem).toContain('TOTAL_REQ');
    }
  });

  it('meta sem atribuição e regra da meta (objetivo) do motor', () => {
    expect(doTipo(p, 'META_SEM_ATRIBUICAO')).toEqual([
      expect.objectContaining({ gravidade: 'BLOQUEIA', metaId: ids.sem }),
    ]);
    expect(doTipo(p, 'META_INVALIDA')).toEqual([
      expect.objectContaining({
        gravidade: 'BLOQUEIA',
        metaId: ids.sem,
        mensagem: expect.stringContaining('Falta o objetivo') as string,
      }),
    ]);
  });

  it('variável do Corporativo sem responsável', () => {
    expect(doTipo(p, 'VARIAVEL_SEM_RESPONSAVEL')).toEqual([
      expect.objectContaining({ gravidade: 'BLOQUEIA', variavelId: ids.corp }),
    ]);
  });

  it('setor com conteúdo sem responsável bloqueia; setor vazio só avisa', () => {
    const setores = doTipo(p, 'SETOR_SEM_RESPONSAVEL');
    expect(setores.find((x) => x.setorId === fiscal.id)?.gravidade).toBe('BLOQUEIA');
    expect(setores.find((x) => x.setorId === ids.vazio)?.gravidade).toBe('AVISO');
  });

  it('usuário que deixou de ser Gestor ativo (responsável e atribuição)', () => {
    const usuarios = doTipo(p, 'USUARIO_INVALIDO').filter((x) => x.metaId === ids.daAna);
    expect(usuarios).toHaveLength(2);
    expect(usuarios.every((x) => x.gravidade === 'BLOQUEIA' && x.usuarioId === ids.ana)).toBe(true);
    expect(p.gestores.find((g) => g.usuarioId === ids.ana)).toMatchObject({ ativo: false });
  });

  it('pesos de cada gestor (a Julia só tem 0,5 de 100)', () => {
    expect(p.gestores.find((g) => g.usuarioId === julia.id)).toMatchObject({
      departamental: '0.5',
      ok: false,
    });
    expect(p.gestores.find((g) => g.usuarioId === carlos.id)).toMatchObject({ ok: true });
  });

  it('bloqueios vêm antes dos avisos e o ciclo não ativa', async () => {
    const gravidades = p.problemas.map((x) => x.gravidade);
    expect(gravidades.indexOf('AVISO')).toBeGreaterThan(gravidades.lastIndexOf('BLOQUEIA'));
    expect(p.podeAtivar).toBe(false);
    const r = await comoAdmin().post(`/ciclos/${cicloId}/ativar`);
    expect(erro(r).codigo).toBe('CICLO_INCONSISTENTE');
  });

  it('responsável da meta diferente do responsável do setor: aviso', async () => {
    await definirResponsavel(cicloId, fiscal.id, julia.id);
    const depois = await painel(cicloId);
    expect(doTipo(depois, 'RESPONSAVEL_DIFERENTE')).toContainEqual(
      expect.objectContaining({ gravidade: 'AVISO', metaId: ids.comCarlos, usuarioId: carlos.id }),
    );
    expect(doTipo(depois, 'SETOR_SEM_RESPONSAVEL').map((x) => x.setorId)).not.toContain(fiscal.id);
  });
});

describe('encerramento (RN-32): fotografia final em nota_fechamento', () => {
  let cicloId: string;
  let departamental: Meta;
  let corporativa: Meta;

  beforeAll(async () => {
    // Nenhum outro ativo (os testes acima devolvem os seus para Rascunho).
    cicloId = (await criarCiclo(ANO_FECHADO, 'ATIVO')).id;
    const { atendidos, total } = await variaveisFiscal(cicloId);
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
    departamental = await criarMetaApi(cicloId, metaFiscal('50'));
    // CT-15: corporativa atribuída a dois gestores (15 e 10), atendimento 0,8.
    corporativa = await criarMetaApi(cicloId, {
      ...metaFiscal('15'),
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
    });
    const lancar = (variavelId: string, mes: number, valor: string) =>
      banco().lancamento.create({
        data: { variavelId, mes, valor, origem: 'CARGA_HISTORICA' },
      });
    // CT-01: jan 16/20, fev 20/25 → 80% contra ≥ 80%.
    await lancar(atendidos.id, 1, '16');
    await lancar(total.id, 1, '20');
    await lancar(atendidos.id, 2, '20');
    await lancar(total.id, 2, '25');
    await lancar(entradas.id, 1, '40');
    await lancar(entradas.id, 2, '40');
  });

  it('com reabertura em vigor não encerra', async () => {
    const reabertura = await banco().reabertura.create({
      data: {
        cicloId,
        mes: 12,
        escopo: 'TODOS',
        validoAte: new Date(Date.now() + 86_400_000),
        motivo: 'Teste',
        autorizadoPor: 'Diretoria',
      },
    });
    const p = await painel(cicloId);
    expect(p.encerramento.permitido).toBe(false);
    expect(p.encerramento.motivo).toMatch(
      /^Dezembro\/2003 está reaberto até \d{2}\/\d{2}\/\d{4}\./,
    );
    const r = await comoAdmin().post(`/ciclos/${cicloId}/encerrar`);
    expect(r.status).toBe(422);
    expect(erro(r).codigo).toBe('STATUS_CICLO_INVALIDO');
    await banco().reabertura.update({
      where: { id: reabertura.id },
      data: { canceladaEm: new Date() },
    });
  });

  it('encerra, congela as notas por gestor e bloco e audita', async () => {
    expect((await painel(cicloId)).encerramento).toMatchObject({ permitido: true, motivo: null });

    const r = await comoAdmin().post(`/ciclos/${cicloId}/encerrar`);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const ciclo = CicloSchema.parse(r.body);
    expect(ciclo.status).toBe('ENCERRADO');
    expect(ciclo.encerradoEm).not.toBeNull();

    const notas = await banco().notaFechamento.findMany({
      where: { cicloId },
      orderBy: [{ usuarioId: 'asc' }, { bloco: 'asc' }],
    });
    const resumo = notas.map((n) => ({
      usuarioId: n.usuarioId,
      bloco: n.bloco,
      pontos: n.pontos.toFixed(2),
    }));
    expect(resumo).toEqual(
      expect.arrayContaining([
        { usuarioId: julia.id, bloco: 'DEPARTAMENTAL', pontos: '50.00' },
        { usuarioId: julia.id, bloco: 'CORPORATIVO', pontos: '12.00' },
        { usuarioId: carlos.id, bloco: 'CORPORATIVO', pontos: '8.00' },
      ]),
    );
    expect(resumo).toHaveLength(3);
    const corpJulia = notas.find((n) => n.usuarioId === julia.id && n.bloco === 'CORPORATIVO');
    expect(corpJulia?.dados).toEqual({
      pesoTotal: '15',
      metas: [
        {
          metaId: corporativa.id,
          codigo: corporativa.codigo,
          indicador: 'Entradas de caixa',
          peso: '15',
          pontos: '12',
          acumulado: '80',
          objetivo: '100',
          atendimento: '0.8',
          situacao: 'ABAIXO',
        },
      ],
    });
    const depJulia = notas.find((n) => n.usuarioId === julia.id && n.bloco === 'DEPARTAMENTAL');
    expect(depJulia?.dados).toMatchObject({
      metas: [{ metaId: departamental.id, acumulado: '0.8', atendimento: '1', situacao: 'BATIDA' }],
    });

    const auditoria = await banco().auditoria.findFirst({
      where: { entidade: 'ciclo', entidadeId: cicloId, acao: 'ENCERRAR' },
    });
    expect(auditoria).toMatchObject({
      usuarioId: admin.id,
      antes: { status: 'ATIVO' },
      depois: { status: 'ENCERRADO' },
    });
  });

  it('ciclo encerrado: não encerra nem ativa de novo (CICLO_ENCERRADO)', async () => {
    for (const acao of ['encerrar', 'ativar']) {
      const r = await comoAdmin().post(`/ciclos/${cicloId}/${acao}`);
      expect(r.status).toBe(422);
      expect(erro(r).codigo).toBe('CICLO_ENCERRADO');
    }
    const p = await painel(cicloId);
    expect(p.encerramento.permitido).toBe(false);
    expect(p.motivoNaoAtivar).toBe(`O ciclo ${String(ANO_FECHADO)} está encerrado.`);
  });

  it('rascunho não encerra', async () => {
    // O ciclo do bloco de problemas, ainda em Rascunho.
    const rascunho = await banco().ciclo.findFirstOrThrow({ where: { ano: ANO_ATIVO } });
    const r = await comoAdmin().post(`/ciclos/${rascunho.id}/encerrar`);
    expect(r.status).toBe(422);
    expect(erro(r)).toMatchObject({
      codigo: 'STATUS_CICLO_INVALIDO',
      mensagem: 'Só um ciclo ativo pode ser encerrado.',
    });
  });
});
