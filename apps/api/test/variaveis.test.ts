import { randomUUID } from 'node:crypto';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { parse } from '@metas/motor';
import {
  type ErroApi as CorpoErro,
  ListaVariaveisSchema,
  type Variavel,
  VariavelSchema,
} from '@metas/tipos';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { configTeste, criarApp, emitirToken } from './apoio.js';
import {
  ANO_ATIVO,
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
const codigo = (prefixo = 'V') => `${prefixo}_${randomUUID().slice(0, 8).toUpperCase()}`;

let app: NestExpressApplication;
let admin: UsuarioBanco;
let gestor: UsuarioBanco;
let tokenAdmin: string;
let cicloId: string;
let setorA: SetorBanco;
let setorB: SetorBanco;

const http = () => request(app.getHttpServer());
const autorizar = (r: request.Test) => r.set('Authorization', `Bearer ${tokenAdmin}`);
const comoAdmin = {
  get: (url: string) => autorizar(http().get(`/api/v1${url}`)),
  post: (url: string, corpo: object) => autorizar(http().post(`/api/v1${url}`)).send(corpo),
  put: (url: string, corpo: object) => autorizar(http().put(`/api/v1${url}`)).send(corpo),
  delete: (url: string) => autorizar(http().delete(`/api/v1${url}`)),
};
const tokenDe = (u: UsuarioBanco) => emitirToken({ oid: u.entraOid, preferred_username: u.email });
const rota = (sufixo = '') => `/ciclos/${cicloId}/variaveis${sufixo}`;

/** Corpo do PUT a partir do que a API devolveu, com alterações. */
function edicao(v: Variavel, alteracoes: Partial<Variavel> = {}) {
  const atual = { ...v, ...alteracoes };
  return {
    setorId: atual.setorId,
    codigo: atual.codigo,
    nome: atual.nome,
    tipo: atual.tipo,
    acumulacao: atual.acumulacao,
    origem: atual.origem,
    responsavelId: atual.responsavelId,
    casasDecimais: atual.casasDecimais,
    ativo: atual.ativo,
  };
}

async function obter(id: string): Promise<Variavel> {
  return VariavelSchema.parse((await comoAdmin.get(rota(`/${id}`))).body);
}

beforeAll(async () => {
  await limparDados();
  app = await criarApp(configTeste());
  admin = await criarUsuario('ADMIN', { nome: 'Admin do Teste' });
  gestor = await criarUsuario('GESTOR', { nome: 'Gestor do Teste' });
  tokenAdmin = await tokenDe(admin);
  // Rascunho: um ciclo ATIVO aberto o tempo todo colidiria com os testes do @metas/prisma, que
  // usam o mesmo banco (só pode haver um ativo). Para variáveis, só "encerrado" muda algo.
  cicloId = (await criarCiclo(ANO_ATIVO, 'RASCUNHO')).id;
  setorA = await criarSetor('Setor A');
  setorB = await criarSetor('Setor B');
});

afterAll(async () => {
  await app.close();
  await limparDados();
  await desconectar();
});

describe('permissão: variáveis só do Administrador (7.5)', () => {
  it.each(['DIRETORIA', 'GESTOR', 'LEITOR'] as const)(
    '%s recebe 403 em todas as rotas',
    async (perfil) => {
      const token = await tokenDe(await criarUsuario(perfil));
      const id = randomUUID();
      const chamadas = [
        http().get(`/api/v1${rota()}`),
        http().get(`/api/v1${rota(`/${id}`)}`),
        http().post(`/api/v1${rota()}`),
        http().put(`/api/v1${rota(`/${id}`)}`),
        http().delete(`/api/v1${rota(`/${id}`)}`),
      ];
      for (const chamada of chamadas) {
        const r = await chamada.set('Authorization', `Bearer ${token}`).send({});
        expect([r.status, erro(r).codigo]).toEqual([403, 'SEM_PERMISSAO']);
      }
    },
  );
});

describe('cadastro (RF-19)', () => {
  it('cria com o código em maiúsculas e registra a auditoria', async () => {
    const cod = codigo();
    const r = await comoAdmin.post(rota(), {
      setorId: setorA.id,
      codigo: cod.toLowerCase(),
      nome: 'Requisições atendidas',
      tipo: 'NUMERO',
      acumulacao: 'SOMA',
      casasDecimais: 0,
    });
    expect(r.status).toBe(201);
    const criada = VariavelSchema.parse(r.body);
    expect(criada).toMatchObject({
      cicloId,
      setorId: setorA.id,
      setorCodigo: setorA.codigo,
      codigo: cod,
      origem: 'DIGITADA',
      responsavelId: null,
      casasDecimais: 0,
      ativo: true,
      temLancamentos: false,
      usadaPor: [],
    });
    const auditoria = await banco().auditoria.findFirst({
      where: { entidade: 'variavel', entidadeId: criada.id, acao: 'CRIAR' },
    });
    expect(auditoria?.depois).toMatchObject({ codigo: cod, tipo: 'NUMERO', acumulacao: 'SOMA' });
  });

  it('código único por ciclo e setor; em outro setor pode repetir', async () => {
    const cod = codigo();
    const corpo = {
      setorId: setorA.id,
      codigo: cod,
      nome: 'Total',
      tipo: 'NUMERO',
      acumulacao: 'SOMA',
    };
    expect((await comoAdmin.post(rota(), corpo)).status).toBe(201);

    const repetida = await comoAdmin.post(rota(), corpo);
    expect(repetida.status).toBe(409);
    expect(erro(repetida)).toEqual({
      codigo: 'JA_EXISTE',
      mensagem: 'Já existe uma variável com este código neste setor e ciclo.',
      detalhes: {},
    });

    expect((await comoAdmin.post(rota(), { ...corpo, setorId: setorB.id })).status).toBe(201);
  });

  it('mesmo código em outro ciclo é outra variável', async () => {
    const outro = await criarCiclo(ANO_RASCUNHO, 'RASCUNHO');
    const cod = codigo();
    const corpo = {
      setorId: setorA.id,
      codigo: cod,
      nome: 'Total',
      tipo: 'NUMERO',
      acumulacao: 'SOMA',
    };
    expect((await comoAdmin.post(rota(), corpo)).status).toBe(201);
    expect((await comoAdmin.post(`/ciclos/${outro.id}/variaveis`, corpo)).status).toBe(201);
  });

  it('recusa código que é nome de função', async () => {
    const r = await comoAdmin.post(rota(), {
      setorId: setorA.id,
      codigo: 'arred',
      nome: 'Arredondado',
      tipo: 'NUMERO',
      acumulacao: 'SOMA',
    });
    expect(r.status).toBe(400);
    expect(erro(r).codigo).toBe('VALIDACAO');
  });

  it('setor inativo não recebe variáveis', async () => {
    const inativo = await criarSetor('Setor inativo');
    await banco().setor.update({ where: { id: inativo.id }, data: { ativo: false } });
    const r = await comoAdmin.post(rota(), {
      setorId: inativo.id,
      codigo: codigo(),
      nome: 'Total',
      tipo: 'NUMERO',
      acumulacao: 'SOMA',
    });
    expect(r.status).toBe(400);
    expect(erro(r).mensagem).toBe('O setor está inativo e não pode receber variáveis.');
  });

  it('ciclo inexistente: 404; ciclo encerrado: CICLO_ENCERRADO (RN-39)', async () => {
    const corpo = {
      setorId: setorA.id,
      codigo: codigo(),
      nome: 'Total',
      tipo: 'NUMERO',
      acumulacao: 'SOMA',
    };
    const inexistente = await comoAdmin.post(`/ciclos/${randomUUID()}/variaveis`, corpo);
    expect(inexistente.status).toBe(404);

    const encerrado = await banco().ciclo.create({
      data: { ano: 2096, status: 'ENCERRADO', encerradoEm: new Date() },
    });
    try {
      const r = await comoAdmin.post(`/ciclos/${encerrado.id}/variaveis`, corpo);
      expect(r.status).toBe(422);
      expect(erro(r)).toMatchObject({
        codigo: 'CICLO_ENCERRADO',
        mensagem: 'O ciclo 2096 está encerrado e não aceita alterações.',
      });
    } finally {
      await banco().ciclo.delete({ where: { id: encerrado.id } });
    }
  });
});

describe('responsável próprio (RN-07)', () => {
  const corpo = (setorId: string, responsavelId: string | null) => ({
    setorId,
    codigo: codigo('C'),
    nome: 'Entradas de caixa',
    tipo: 'MOEDA',
    acumulacao: 'SOMA',
    responsavelId,
  });

  it('Corporativo aceita Gestor ativo ou nenhum', async () => {
    const corporativo = await setorCorporativo();
    const com = await comoAdmin.post(rota(), corpo(corporativo.id, gestor.id));
    expect(com.status).toBe(201);
    expect(VariavelSchema.parse(com.body)).toMatchObject({
      responsavelId: gestor.id,
      responsavelNome: 'Gestor do Teste',
    });
    expect((await comoAdmin.post(rota(), corpo(corporativo.id, null))).status).toBe(201);
  });

  it('Corporativo recusa quem não é Gestor ativo', async () => {
    const corporativo = await setorCorporativo();
    const diretoria = await criarUsuario('DIRETORIA');
    const inativo = await criarUsuario('GESTOR', { ativo: false });
    for (const usuario of [diretoria, inativo]) {
      const r = await comoAdmin.post(rota(), corpo(corporativo.id, usuario.id));
      expect(r.status).toBe(400);
      expect(erro(r).detalhes).toEqual({
        campos: [
          {
            campo: 'responsavelId',
            mensagem: 'O responsável precisa ser um usuário Gestor e ativo.',
          },
        ],
      });
    }
  });

  it('outros setores não têm responsável próprio', async () => {
    const r = await comoAdmin.post(rota(), corpo(setorA.id, gestor.id));
    expect(r.status).toBe(400);
    expect(erro(r).mensagem).toMatch(/^Só variáveis do Corporativo têm responsável próprio/);
  });
});

describe('uso por metas (RF-20) e renomeação (RF-21)', () => {
  it('lista com as metas que usam cada variável e filtra por setor', async () => {
    const v = await criarVariavel(cicloId, setorB.id, codigo());
    const meta = await criarMeta({
      cicloId,
      setorId: setorB.id,
      responsavelId: gestor.id,
      formula: `${v.codigo} * 2`,
      variavelIds: [v.id],
    });
    const r = await comoAdmin.get(rota(`?setor=${setorB.id}`));
    expect(r.status).toBe(200);
    const lista = ListaVariaveisSchema.parse(r.body);
    expect(lista.every((item) => item.setorId === setorB.id)).toBe(true);
    expect(lista.find((item) => item.id === v.id)?.usadaPor).toEqual([
      { id: meta.id, codigo: meta.codigo, indicador: 'Meta de teste', ativo: true },
    ]);
  });

  it('trocar o código reescreve as fórmulas, regrava a AST e sobe a versão das metas', async () => {
    const v = await criarVariavel(cicloId, setorA.id, codigo('ANTIGO'));
    const outra = await criarVariavel(cicloId, setorA.id, codigo('TOTAL'));
    const doSetor = await criarMeta({
      cicloId,
      setorId: setorA.id,
      responsavelId: gestor.id,
      formula: `arred(${v.codigo}/${outra.codigo}, 2) + ${v.codigo}_X`,
      variavelIds: [v.id, outra.id],
    });
    const deFora = await criarMeta({
      cicloId,
      setorId: setorB.id,
      responsavelId: gestor.id,
      formula: `${setorA.codigo}.${v.codigo} - 1`,
      variavelIds: [v.id],
    });

    const novo = codigo('NOVO');
    const r = await comoAdmin.put(rota(`/${v.id}`), edicao(await obter(v.id), { codigo: novo }));
    expect(r.status).toBe(200);
    expect(VariavelSchema.parse(r.body).codigo).toBe(novo);

    const metas = await banco().meta.findMany({
      where: { id: { in: [doSetor.id, deFora.id] } },
      select: { id: true, formulaTexto: true, formulaAst: true, versao: true },
    });
    const porId = new Map(metas.map((m) => [m.id, m]));
    const esperadaA = `arred(${novo}/${outra.codigo}, 2) + ${v.codigo}_X`;
    const esperadaB = `${setorA.codigo}.${novo} - 1`;
    expect(porId.get(doSetor.id)).toEqual({
      id: doSetor.id,
      formulaTexto: esperadaA,
      formulaAst: parse(esperadaA),
      versao: 2,
    });
    expect(porId.get(deFora.id)).toMatchObject({ formulaTexto: esperadaB, versao: 2 });

    const auditoria = await banco().auditoria.findFirst({
      where: { entidade: 'meta', entidadeId: deFora.id, acao: 'RENOMEAR_VARIAVEL' },
    });
    expect(auditoria?.antes).toEqual({
      formulaTexto: `${setorA.codigo}.${v.codigo} - 1`,
      versao: 1,
    });
    expect(auditoria?.depois).toEqual({ formulaTexto: esperadaB, versao: 2, variavelId: v.id });
  });

  it('se a renomeação falha, nada muda (transação)', async () => {
    const v = await criarVariavel(cicloId, setorA.id, codigo());
    const existente = await criarVariavel(cicloId, setorA.id, codigo());
    const meta = await criarMeta({
      cicloId,
      setorId: setorA.id,
      responsavelId: gestor.id,
      formula: `${v.codigo} + 1`,
      variavelIds: [v.id],
    });
    const r = await comoAdmin.put(
      rota(`/${v.id}`),
      edicao(await obter(v.id), { codigo: existente.codigo }),
    );
    expect(r.status).toBe(409);
    const depois = await banco().meta.findUniqueOrThrow({ where: { id: meta.id } });
    expect([depois.formulaTexto, depois.versao]).toEqual([`${v.codigo} + 1`, 1]);
  });
});

describe('travas (decisões de 12/11/2026)', () => {
  it('com lançamentos: tipo, acumulação e setor fixos; nome e casas mudam', async () => {
    const v = await criarVariavel(cicloId, setorA.id, codigo());
    await banco().lancamento.create({
      data: { variavelId: v.id, mes: 1, valor: 10, origem: 'DIGITACAO' },
    });
    const atual = await obter(v.id);
    expect(atual.temLancamentos).toBe(true);

    const casos = [
      [{ tipo: 'PERCENTUAL' }, 'tipo', 'O tipo não pode mudar: a variável já tem lançamentos.'],
      [
        { acumulacao: 'MEDIA' },
        'acumulacao',
        'A acumulação não pode mudar: a variável já tem lançamentos.',
      ],
      [{ setorId: setorB.id }, 'setorId', 'O setor não pode mudar: a variável já tem lançamentos.'],
    ] as const;
    for (const [alteracao, campo, mensagem] of casos) {
      const r = await comoAdmin.put(rota(`/${v.id}`), edicao(atual, alteracao));
      expect(r.status).toBe(400);
      expect(erro(r).detalhes).toEqual({ campos: [{ campo, mensagem }] });
    }

    const ok = await comoAdmin.put(
      rota(`/${v.id}`),
      edicao(atual, { nome: 'Novo nome', casasDecimais: 4, origem: 'IMPORTADA' }),
    );
    expect(ok.status).toBe(200);
    expect(VariavelSchema.parse(ok.body)).toMatchObject({
      nome: 'Novo nome',
      casasDecimais: 4,
      origem: 'IMPORTADA',
    });
  });

  it('usada em meta (sem lançamentos): tipo fixo', async () => {
    const v = await criarVariavel(cicloId, setorA.id, codigo());
    await criarMeta({
      cicloId,
      setorId: setorA.id,
      responsavelId: gestor.id,
      formula: v.codigo,
      variavelIds: [v.id],
    });
    const r = await comoAdmin.put(rota(`/${v.id}`), edicao(await obter(v.id), { tipo: 'DIAS' }));
    expect(erro(r).mensagem).toBe('O tipo não pode mudar: a variável já é usada por metas.');
  });

  it('sem lançamentos nem metas: tudo pode mudar, inclusive o setor', async () => {
    const v = await criarVariavel(cicloId, setorA.id, codigo());
    const r = await comoAdmin.put(
      rota(`/${v.id}`),
      edicao(await obter(v.id), { tipo: 'PERCENTUAL', acumulacao: 'ULTIMO', setorId: setorB.id }),
    );
    expect(r.status).toBe(200);
    expect(VariavelSchema.parse(r.body)).toMatchObject({
      tipo: 'PERCENTUAL',
      acumulacao: 'ULTIMO',
      setorId: setorB.id,
    });
  });

  it('não inativa enquanto uma meta ativa a usa; com a meta inativa, pode', async () => {
    const v = await criarVariavel(cicloId, setorA.id, codigo());
    const meta = await criarMeta({
      cicloId,
      setorId: setorA.id,
      responsavelId: gestor.id,
      formula: v.codigo,
      variavelIds: [v.id],
    });
    const recusada = await comoAdmin.put(
      rota(`/${v.id}`),
      edicao(await obter(v.id), { ativo: false }),
    );
    expect(recusada.status).toBe(409);
    expect(erro(recusada)).toEqual({
      codigo: 'EM_USO',
      mensagem: `A variável é usada por metas ativas (${meta.codigo}). Tire-a das fórmulas ou inative as metas antes.`,
      detalhes: { metas: [meta.id] },
    });

    await banco().meta.update({ where: { id: meta.id }, data: { ativo: false } });
    const aceita = await comoAdmin.put(
      rota(`/${v.id}`),
      edicao(await obter(v.id), { ativo: false }),
    );
    expect(aceita.status).toBe(200);
    expect(VariavelSchema.parse(aceita.body).ativo).toBe(false);
  });
});

describe('exclusão: só sem registros associados', () => {
  it('sem uso: exclui e audita', async () => {
    const v = await criarVariavel(cicloId, setorA.id, codigo());
    expect((await comoAdmin.delete(rota(`/${v.id}`))).status).toBe(204);
    expect(await banco().variavel.count({ where: { id: v.id } })).toBe(0);
    const auditoria = await banco().auditoria.findFirst({
      where: { entidade: 'variavel', entidadeId: v.id, acao: 'EXCLUIR' },
    });
    expect(auditoria?.antes).toMatchObject({ codigo: v.codigo });
  });

  it.each(['lançamento', 'meta'] as const)('com %s: EM_USO', async (registro) => {
    const v = await criarVariavel(cicloId, setorA.id, codigo());
    if (registro === 'meta') {
      await criarMeta({
        cicloId,
        setorId: setorA.id,
        responsavelId: gestor.id,
        formula: v.codigo,
        variavelIds: [v.id],
      });
    } else {
      await banco().lancamento.create({
        data: { variavelId: v.id, mes: 2, valor: null, origem: 'DIGITACAO' },
      });
    }
    const r = await comoAdmin.delete(rota(`/${v.id}`));
    expect(r.status).toBe(409);
    expect(erro(r)).toEqual({
      codigo: 'EM_USO',
      mensagem:
        'Esta variável tem lançamentos ou é usada por metas e não pode ser excluída. Inative-a.',
      detalhes: {},
    });
  });

  it('variável de outro ciclo não é encontrada por este', async () => {
    const outro =
      (await banco().ciclo.findFirst({ where: { ano: ANO_RASCUNHO } })) ??
      (await criarCiclo(ANO_RASCUNHO, 'RASCUNHO'));
    const v = await criarVariavel(outro.id, setorA.id, codigo());
    expect((await comoAdmin.delete(rota(`/${v.id}`))).status).toBe(404);
  });
});
