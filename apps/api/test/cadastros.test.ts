import { randomUUID } from 'node:crypto';

import type { NestExpressApplication } from '@nestjs/platform-express';
import {
  type ErroApi as CorpoErro,
  ListaFeriadosSchema,
  ListaResponsaveisSchema,
  ListaSetoresSchema,
  ListaUsuariosSchema,
  SetorSchema,
  UsuarioSchema,
} from '@metas/tipos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { configTeste, criarApp, emitirToken, cliente } from './apoio.js';
import {
  ANO_ATIVO,
  ANO_PASSADO,
  ANO_RASCUNHO,
  banco,
  criarCiclo,
  criarSetor,
  criarUsuario,
  desconectar,
  DOMINIO,
  emailTeste,
  limparDados,
} from './dados.js';

type UsuarioBanco = Awaited<ReturnType<typeof criarUsuario>>;

const erro = (r: { body: unknown }): CorpoErro => r.body as CorpoErro;
const codigoSetor = () => `TAPI_${randomUUID().slice(0, 8).toUpperCase()}`;

let app: NestExpressApplication;
let admin: UsuarioBanco;
let tokenAdmin: string;

const http = () => cliente(app);
const comoAdmin = {
  get: (url: string) => http().get(`/api/v1${url}`).set('Authorization', `Bearer ${tokenAdmin}`),
  post: (url: string, corpo: object) =>
    http().post(`/api/v1${url}`).set('Authorization', `Bearer ${tokenAdmin}`).send(corpo),
  put: (url: string, corpo: object) =>
    http().put(`/api/v1${url}`).set('Authorization', `Bearer ${tokenAdmin}`).send(corpo),
  delete: (url: string) =>
    http().delete(`/api/v1${url}`).set('Authorization', `Bearer ${tokenAdmin}`),
};
const tokenDe = (u: UsuarioBanco) => emitirToken({ oid: u.entraOid, preferred_username: u.email });

/** Último registro de auditoria de uma entidade, feito pelo Administrador do teste. */
function ultimaAuditoria(entidade: string, entidadeId: string) {
  return banco().auditoria.findFirst({
    where: { entidade, entidadeId, usuarioId: admin.id },
    orderBy: { em: 'desc' },
  });
}

beforeAll(async () => {
  await limparDados();
  app = await criarApp(configTeste());
  admin = await criarUsuario('ADMIN', { nome: 'Admin do Teste' });
  tokenAdmin = await tokenDe(admin);
});

afterAll(async () => {
  await app.close();
  await limparDados();
  await desconectar();
});

describe('permissão: cadastros só do Administrador (7.5)', () => {
  type Metodo = 'get' | 'post' | 'put' | 'delete';
  const requisitar = (metodo: Metodo, url: string) => {
    const servidor = http();
    const caminho = `/api/v1${url}`;
    switch (metodo) {
      case 'get':
        return servidor.get(caminho);
      case 'post':
        return servidor.post(caminho);
      case 'put':
        return servidor.put(caminho);
      case 'delete':
        return servidor.delete(caminho);
    }
  };
  const rotas: [Metodo, string][] = [
    ['get', '/usuarios'],
    ['post', '/usuarios'],
    ['get', '/setores'],
    ['post', '/setores'],
    ['get', '/ciclos'],
    ['post', '/ciclos'],
    ['get', `/ciclos/${randomUUID()}/responsaveis`],
    ['put', `/ciclos/${randomUUID()}/responsaveis`],
    ['get', '/feriados?ano=2097'],
    ['post', '/feriados'],
    ['delete', `/usuarios/${randomUUID()}`],
    ['put', `/usuarios/${randomUUID()}/setores-leitor`],
  ];

  it.each(['DIRETORIA', 'GESTOR', 'LEITOR'] as const)(
    '%s recebe 403 em todas as rotas',
    async (perfil) => {
      const token = await tokenDe(await criarUsuario(perfil));
      for (const [metodo, url] of rotas) {
        const r = await requisitar(metodo, url).set('Authorization', `Bearer ${token}`).send({});
        expect([url, r.status, erro(r).codigo]).toEqual([url, 403, 'SEM_PERMISSAO']);
      }
    },
  );

  it('Administrador inativo também recebe 403', async () => {
    const inativo = await criarUsuario('ADMIN', { ativo: false });
    const r = await http()
      .get('/api/v1/setores')
      .set('Authorization', `Bearer ${await tokenDe(inativo)}`);
    expect(r.status).toBe(403);
  });

  it('sem login: 401', async () => {
    expect((await http().get('/api/v1/usuarios')).status).toBe(401);
  });
});

describe('usuários (RF-03)', () => {
  it('pré-cadastra pelo e-mail, com auditoria', async () => {
    const email = emailTeste('Julia').toUpperCase();
    const r = await comoAdmin.post('/usuarios', { nome: 'Julia Souza', email, perfil: 'GESTOR' });
    expect(r.status).toBe(201);
    const criado = UsuarioSchema.parse(r.body);
    expect(criado).toMatchObject({
      nome: 'Julia Souza',
      email: email.toLowerCase(),
      perfil: 'GESTOR',
      ativo: true,
      gerenteGeral: false,
      superiorId: null,
      entrouAlgumaVez: false,
      setoresLeitor: [],
    });
    const auditoria = await ultimaAuditoria('usuario', criado.id);
    expect(auditoria).toMatchObject({ acao: 'CRIAR', antes: null });
    expect(auditoria?.depois).toMatchObject({ email: email.toLowerCase(), perfil: 'GESTOR' });
  });

  it('e-mail repetido: 409 JA_EXISTE', async () => {
    const r = await comoAdmin.post('/usuarios', {
      nome: 'Outro',
      email: admin.email,
      perfil: 'LEITOR',
    });
    expect(r.status).toBe(409);
    expect(erro(r)).toEqual({
      detalhes: {},
      codigo: 'JA_EXISTE',
      mensagem: 'Já existe um usuário com este e-mail.',
    });
  });

  it('validação: 400 com os campos', async () => {
    const r = await comoAdmin.post('/usuarios', {
      nome: 'Ana',
      email: emailTeste('ana'),
      perfil: 'GESTOR',
      gerenteGeral: true,
    });
    expect(r.status).toBe(400);
    expect(erro(r).codigo).toBe('VALIDACAO');
    expect(erro(r).detalhes).toEqual({
      campos: [
        {
          campo: 'gerenteGeral',
          mensagem: 'Só quem tem o perfil Diretoria pode ser Gerente Geral.',
        },
      ],
    });
  });

  it('Gerente Geral: vários na Diretoria', async () => {
    for (const nome of ['Diretor A', 'Diretor B']) {
      const r = await comoAdmin.post('/usuarios', {
        nome,
        email: emailTeste('dir'),
        perfil: 'DIRETORIA',
        gerenteGeral: true,
      });
      expect(r.status).toBe(201);
    }
  });

  it('altera com antes e depois na auditoria', async () => {
    const leitor = await criarUsuario('LEITOR', { nome: 'Leitor Antigo' });
    const r = await comoAdmin.put(`/usuarios/${leitor.id}`, {
      nome: 'Leitor Novo',
      email: leitor.email,
      perfil: 'DIRETORIA',
      ativo: true,
      superiorId: admin.id,
    });
    expect(r.status).toBe(200);
    expect(UsuarioSchema.parse(r.body)).toMatchObject({
      nome: 'Leitor Novo',
      perfil: 'DIRETORIA',
      superiorId: admin.id,
      superiorNome: 'Admin do Teste',
      entrouAlgumaVez: true,
    });
    const auditoria = await ultimaAuditoria('usuario', leitor.id);
    expect(auditoria?.acao).toBe('ALTERAR');
    expect(auditoria?.antes).toMatchObject({
      nome: 'Leitor Antigo',
      perfil: 'LEITOR',
      superiorId: null,
    });
    expect(auditoria?.depois).toMatchObject({
      nome: 'Leitor Novo',
      perfil: 'DIRETORIA',
      superiorId: admin.id,
    });
  });

  it('superior: não pode ser ele mesmo nem criar ciclo', async () => {
    const chefe = await criarUsuario('DIRETORIA');
    const sub = await criarUsuario('GESTOR');
    await banco().usuario.update({ where: { id: sub.id }, data: { superiorId: chefe.id } });
    const base = { nome: 'Chefe', email: chefe.email, perfil: 'DIRETORIA' };

    const proprio = await comoAdmin.put(`/usuarios/${chefe.id}`, { ...base, superiorId: chefe.id });
    expect(erro(proprio)).toMatchObject({
      mensagem: 'O usuário não pode ser superior de si mesmo.',
      detalhes: {
        campos: [{ campo: 'superiorId', mensagem: 'O usuário não pode ser superior de si mesmo.' }],
      },
    });
    const ciclo = await comoAdmin.put(`/usuarios/${chefe.id}`, { ...base, superiorId: sub.id });
    expect(ciclo.status).toBe(400);
    expect(erro(ciclo).mensagem).toContain('cria um ciclo');
    const inexistente = await comoAdmin.put(`/usuarios/${chefe.id}`, {
      ...base,
      superiorId: randomUUID(),
    });
    expect(erro(inexistente).mensagem).toBe('Superior imediato não encontrado.');
  });

  it('o Administrador não tira o próprio acesso', async () => {
    const base = { nome: admin.nome, email: admin.email };
    const inativar = await comoAdmin.put(`/usuarios/${admin.id}`, {
      ...base,
      perfil: 'ADMIN',
      ativo: false,
    });
    const rebaixar = await comoAdmin.put(`/usuarios/${admin.id}`, { ...base, perfil: 'GESTOR' });
    const excluir = await comoAdmin.delete(`/usuarios/${admin.id}`);
    expect([inativar.status, rebaixar.status, excluir.status]).toEqual([400, 400, 400]);
  });

  it('responsável por setor não pode ser inativado nem mudar de perfil', async () => {
    const gestor = await criarUsuario('GESTOR', { nome: 'Gestor Responsável' });
    const setor = await criarSetor('Setor do Gestor');
    const ciclo = await criarCiclo(ANO_RASCUNHO, 'RASCUNHO');
    await banco().setorResponsavel.create({
      data: { cicloId: ciclo.id, setorId: setor.id, usuarioId: gestor.id },
    });
    const base = { nome: gestor.nome, email: gestor.email };
    const inativar = await comoAdmin.put(`/usuarios/${gestor.id}`, {
      ...base,
      perfil: 'GESTOR',
      ativo: false,
    });
    expect(inativar.status).toBe(400);
    expect(erro(inativar).mensagem).toContain(`Setor do Gestor (${String(ANO_RASCUNHO)})`);
    const leitor = await comoAdmin.put(`/usuarios/${gestor.id}`, { ...base, perfil: 'LEITOR' });
    expect(leitor.status).toBe(400);

    // E não pode ser excluído: tem registro associado.
    const excluir = await comoAdmin.delete(`/usuarios/${gestor.id}`);
    expect(excluir.status).toBe(409);
    expect(erro(excluir).codigo).toBe('EM_USO');

    await banco().setorResponsavel.deleteMany({ where: { cicloId: ciclo.id } });
    await banco().ciclo.delete({ where: { id: ciclo.id } });
  });

  it('exclui quem não tem registros associados, com auditoria', async () => {
    const r = await comoAdmin.post('/usuarios', {
      nome: 'Engano',
      email: emailTeste('engano'),
      perfil: 'LEITOR',
    });
    const id = UsuarioSchema.parse(r.body).id;
    const excluir = await comoAdmin.delete(`/usuarios/${id}`);
    expect(excluir.status).toBe(204);
    expect(await banco().usuario.findUnique({ where: { id } })).toBeNull();
    expect(await ultimaAuditoria('usuario', id)).toMatchObject({ acao: 'EXCLUIR', depois: null });
    expect((await comoAdmin.delete(`/usuarios/${id}`)).status).toBe(404);
  });

  it('quem já entrou no sistema tem registro associado e só pode ser inativado', async () => {
    // O primeiro acesso grava auditoria em nome do próprio usuário.
    const novo = await criarUsuario('LEITOR', { entraOid: null });
    await http()
      .get('/api/v1/me')
      .set(
        'Authorization',
        `Bearer ${await emitirToken({ oid: randomUUID(), preferred_username: novo.email })}`,
      );
    const r = await comoAdmin.delete(`/usuarios/${novo.id}`);
    expect([r.status, erro(r).codigo]).toEqual([409, 'EM_USO']);
    expect(erro(r).mensagem).toContain('Inative-o');
  });

  it('setores do Leitor: só para o perfil Leitor', async () => {
    const leitor = await criarUsuario('LEITOR');
    const gestor = await criarUsuario('GESTOR');
    const [a, b] = [await criarSetor('A'), await criarSetor('B')];
    const r = await comoAdmin.put(`/usuarios/${leitor.id}/setores-leitor`, {
      setorIds: [a.id, b.id, a.id],
    });
    expect(r.status).toBe(200);
    expect(UsuarioSchema.parse(r.body).setoresLeitor.sort()).toEqual([a.id, b.id].sort());
    expect(await ultimaAuditoria('usuario', leitor.id)).toMatchObject({
      acao: 'DEFINIR_SETORES_LEITOR',
    });

    const naoLeitor = await comoAdmin.put(`/usuarios/${gestor.id}/setores-leitor`, {
      setorIds: [a.id],
    });
    expect(naoLeitor.status).toBe(400);
    const inexistente = await comoAdmin.put(`/usuarios/${leitor.id}/setores-leitor`, {
      setorIds: [randomUUID()],
    });
    expect(erro(inexistente).mensagem).toBe('Um ou mais setores não existem.');

    // Excluir o Leitor leva junto os setores liberados (configuração dele).
    expect((await comoAdmin.delete(`/usuarios/${leitor.id}`)).status).toBe(204);
  });

  it('lista com busca, filtros e paginação', async () => {
    const marca = randomUUID().slice(0, 6);
    for (let i = 0; i < 3; i++) {
      await criarUsuario('LEITOR', { nome: `Busca ${marca} ${String(i)}` });
    }
    await criarUsuario('LEITOR', { nome: `Busca ${marca} inativo`, ativo: false });

    const pagina = ListaUsuariosSchema.parse(
      (await comoAdmin.get(`/usuarios?busca=${marca}&ativo=true&tamanho=2&pagina=2`)).body,
    );
    expect(pagina).toMatchObject({ total: 3, pagina: 2, tamanho: 2 });
    expect(pagina.itens.map((u) => u.nome)).toEqual([`Busca ${marca} 2`]);

    const porEmail = ListaUsuariosSchema.parse(
      (await comoAdmin.get(`/usuarios?busca=${DOMINIO}&perfil=ADMIN`)).body,
    );
    expect(porEmail.itens.every((u) => u.perfil === 'ADMIN')).toBe(true);

    expect((await comoAdmin.get('/usuarios?ativo=talvez')).status).toBe(400);
    expect((await comoAdmin.get(`/usuarios/${randomUUID()}`)).status).toBe(404);
    expect((await comoAdmin.get('/usuarios/nao-e-uuid')).status).toBe(400);
  });
});

describe('setores (RF-04)', () => {
  it('cria com código em maiúsculas e auditoria; código repetido: 409', async () => {
    const codigo = codigoSetor();
    const r = await comoAdmin.post('/setores', { codigo: codigo.toLowerCase(), nome: 'Qualidade' });
    expect(r.status).toBe(201);
    const setor = SetorSchema.parse(r.body);
    expect(setor).toMatchObject({ codigo, nome: 'Qualidade', corporativo: false, ativo: true });
    expect(await ultimaAuditoria('setor', setor.id)).toMatchObject({ acao: 'CRIAR' });

    const repetido = await comoAdmin.post('/setores', { codigo, nome: 'Outro' });
    expect([repetido.status, erro(repetido).mensagem]).toEqual([
      409,
      'Já existe um setor com este código.',
    ]);

    const lista = ListaSetoresSchema.parse((await comoAdmin.get('/setores')).body);
    expect(lista.some((s) => s.id === setor.id)).toBe(true);
  });

  it('Corporativo: único, não inativa, não exclui', async () => {
    const existente = await banco().setor.findFirst({ where: { corporativo: true } });
    const corporativo =
      existente ??
      (await banco().setor.create({
        data: { codigo: codigoSetor(), nome: 'Corporativo', corporativo: true },
      }));

    const segundo = await comoAdmin.post('/setores', {
      codigo: codigoSetor(),
      nome: 'Outro corp',
      corporativo: true,
    });
    expect([segundo.status, erro(segundo).mensagem]).toEqual([
      409,
      'Já existe um setor Corporativo. Só pode haver um.',
    ]);
    const inativar = await comoAdmin.put(`/setores/${corporativo.id}`, {
      codigo: corporativo.codigo,
      nome: corporativo.nome,
      corporativo: true,
      ativo: false,
    });
    expect([inativar.status, erro(inativar).mensagem]).toEqual([
      400,
      'O setor Corporativo não pode ser inativado.',
    ]);
    const excluir = await comoAdmin.delete(`/setores/${corporativo.id}`);
    expect([excluir.status, erro(excluir).mensagem]).toEqual([
      400,
      'O setor Corporativo não pode ser excluído.',
    ]);

    if (existente === null) await banco().setor.delete({ where: { id: corporativo.id } });
  });

  it('código não muda depois que o setor tem variáveis', async () => {
    const setor = await criarSetor('Com variável');
    const ciclo = await criarCiclo(ANO_ATIVO, 'RASCUNHO');
    await banco().variavel.create({
      data: {
        cicloId: ciclo.id,
        setorId: setor.id,
        codigo: 'X',
        nome: 'X',
        tipo: 'NUMERO',
        acumulacao: 'SOMA',
      },
    });
    const r = await comoAdmin.put(`/setores/${setor.id}`, {
      codigo: codigoSetor(),
      nome: setor.nome,
    });
    expect(r.status).toBe(400);
    expect(erro(r).mensagem).toContain('usado nas fórmulas');
    // Nome pode mudar.
    const nome = await comoAdmin.put(`/setores/${setor.id}`, {
      codigo: setor.codigo,
      nome: 'Renomeado',
    });
    expect(nome.status).toBe(200);

    // E não pode ser excluído: tem registro associado.
    const excluir = await comoAdmin.delete(`/setores/${setor.id}`);
    expect([excluir.status, erro(excluir).codigo]).toEqual([409, 'EM_USO']);

    await banco().variavel.deleteMany({ where: { setorId: setor.id } });
    await banco().ciclo.delete({ where: { id: ciclo.id } });
  });

  it('inativa e exclui setor sem registros', async () => {
    const setor = await criarSetor('Temporário');
    const inativar = await comoAdmin.put(`/setores/${setor.id}`, {
      codigo: setor.codigo,
      nome: setor.nome,
      ativo: false,
    });
    expect(SetorSchema.parse(inativar.body).ativo).toBe(false);
    expect((await comoAdmin.delete(`/setores/${setor.id}`)).status).toBe(204);
    expect(await ultimaAuditoria('setor', setor.id)).toMatchObject({ acao: 'EXCLUIR' });
  });
});

describe('ciclos (RF-07) e responsáveis (RF-05)', () => {
  it('cria em Rascunho; ano repetido: 409', async () => {
    const r = await comoAdmin.post('/ciclos', { ano: ANO_RASCUNHO });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ ano: ANO_RASCUNHO, status: 'RASCUNHO', encerradoEm: null });
    const repetido = await comoAdmin.post('/ciclos', { ano: ANO_RASCUNHO });
    expect([repetido.status, erro(repetido).mensagem]).toEqual([
      409,
      'Já existe um ciclo para este ano.',
    ]);
    expect((await comoAdmin.post('/ciclos', { ano: 1999 })).status).toBe(400);
    await banco().ciclo.deleteMany({ where: { ano: ANO_RASCUNHO } });
  });

  it('define, troca e tira responsáveis, com auditoria', async () => {
    const ciclo = await criarCiclo(ANO_RASCUNHO, 'RASCUNHO');
    const [rh, ti] = [await criarSetor('RH'), await criarSetor('TI')];
    const [ana, bia] = [
      await criarUsuario('GESTOR', { nome: 'Ana' }),
      await criarUsuario('GESTOR', { nome: 'Bia' }),
    ];
    const url = `/ciclos/${ciclo.id}/responsaveis`;

    const r1 = await comoAdmin.put(url, {
      responsaveis: [
        { setorId: rh.id, usuarioId: ana.id },
        { setorId: ti.id, usuarioId: ana.id },
      ],
    });
    expect(r1.status).toBe(200);
    const lista = ListaResponsaveisSchema.parse(r1.body);
    expect(lista.find((l) => l.setor.id === rh.id)).toMatchObject({
      usuarioId: ana.id,
      usuarioNome: 'Ana',
    });

    await comoAdmin.put(url, {
      responsaveis: [
        { setorId: rh.id, usuarioId: bia.id },
        { setorId: ti.id, usuarioId: null },
      ],
    });
    const depois = ListaResponsaveisSchema.parse((await comoAdmin.get(url)).body);
    expect(depois.find((l) => l.setor.id === rh.id)?.usuarioId).toBe(bia.id);
    expect(depois.find((l) => l.setor.id === ti.id)?.usuarioId).toBeNull();

    expect(await ultimaAuditoria('setor_responsavel', `${ciclo.id}:${rh.id}`)).toMatchObject({
      acao: 'DEFINIR_RESPONSAVEL',
      antes: { usuarioId: ana.id },
      depois: { usuarioId: bia.id },
    });
    expect(await ultimaAuditoria('setor_responsavel', `${ciclo.id}:${ti.id}`)).toMatchObject({
      depois: { usuarioId: null },
    });

    await banco().setorResponsavel.deleteMany({ where: { cicloId: ciclo.id } });
    await banco().ciclo.delete({ where: { id: ciclo.id } });
  });

  it('responsável só Gestor ativo; setor inativo não recebe; ciclo encerrado recusa', async () => {
    const ciclo = await criarCiclo(ANO_RASCUNHO, 'RASCUNHO');
    const setor = await criarSetor('Vendas');
    const url = `/ciclos/${ciclo.id}/responsaveis`;
    for (const outro of [
      await criarUsuario('DIRETORIA'),
      await criarUsuario('GESTOR', { ativo: false }),
    ]) {
      const r = await comoAdmin.put(url, {
        responsaveis: [{ setorId: setor.id, usuarioId: outro.id }],
      });
      expect([r.status, erro(r).mensagem]).toEqual([
        400,
        'Só usuários com o perfil Gestor e ativos podem ser responsáveis por um setor.',
      ]);
    }
    const inativo = await banco().setor.update({ where: { id: setor.id }, data: { ativo: false } });
    const gestor = await criarUsuario('GESTOR');
    const r = await comoAdmin.put(url, {
      responsaveis: [{ setorId: inativo.id, usuarioId: gestor.id }],
    });
    expect(erro(r).mensagem).toContain('está inativo');

    const encerrado = await criarCiclo(ANO_ATIVO, 'ENCERRADO');
    const fechado = await comoAdmin.put(`/ciclos/${encerrado.id}/responsaveis`, {
      responsaveis: [{ setorId: setor.id, usuarioId: null }],
    });
    expect([fechado.status, erro(fechado).codigo]).toEqual([422, 'CICLO_ENCERRADO']);
    expect((await comoAdmin.get(`/ciclos/${randomUUID()}/responsaveis`)).status).toBe(404);

    await banco().ciclo.deleteMany({ where: { id: { in: [ciclo.id, encerrado.id] } } });
  });
});

describe('feriados (RF-06) e a trava de meses fechados', () => {
  it('cria, lista por ano, altera e exclui feriado futuro, com auditoria', async () => {
    const r = await comoAdmin.post('/feriados', {
      data: '2097-03-06',
      descricao: 'Teste',
      tipo: 'MUNICIPAL',
    });
    expect(r.status).toBe(201);
    const id = (r.body as { id: string }).id;
    expect(r.body).toMatchObject({ data: '2097-03-06', descricao: 'Teste', tipo: 'MUNICIPAL' });

    const lista = ListaFeriadosSchema.parse((await comoAdmin.get('/feriados?ano=2097')).body);
    expect(lista.map((f) => f.data)).toContain('2097-03-06');

    const repetido = await comoAdmin.post('/feriados', {
      data: '2097-03-06',
      descricao: 'Outro',
      tipo: 'EMPRESA',
    });
    expect([repetido.status, erro(repetido).mensagem]).toEqual([
      409,
      'Já existe um feriado nesta data.',
    ]);

    const alterado = await comoAdmin.put(`/feriados/${id}`, {
      data: '2097-03-07',
      descricao: 'Movido',
      tipo: 'EMPRESA',
    });
    expect(alterado.body).toMatchObject({ data: '2097-03-07', descricao: 'Movido' });
    expect(await ultimaAuditoria('feriado', id)).toMatchObject({
      acao: 'ALTERAR',
      antes: { data: '2097-03-06' },
      depois: { data: '2097-03-07' },
    });
    expect((await comoAdmin.delete(`/feriados/${id}`)).status).toBe(204);
  });

  it('recusa feriado que mudaria o prazo de um mês já fechado', async () => {
    // 07/03/2001 (quarta) conta dias úteis do fechamento de fevereiro/2001, que já passou.
    const r = await comoAdmin.post('/feriados', {
      data: '2001-03-07',
      descricao: 'Retroativo',
      tipo: 'EMPRESA',
    });
    expect(r.status).toBe(422);
    expect(erro(r)).toMatchObject({
      codigo: 'MES_FECHADO',
      detalhes: { mes: 2, ano: ANO_PASSADO },
    });
    expect(erro(r).mensagem).toContain('Fevereiro/2001');
    expect(erro(r).mensagem).toContain('use a reabertura');
  });

  it('aceita feriado de mês fechado que não muda prazo (fim de semana) e troca de descrição', async () => {
    const sabado = await comoAdmin.post('/feriados', {
      data: '2001-03-03',
      descricao: 'Sábado',
      tipo: 'EMPRESA',
    });
    expect(sabado.status).toBe(201);
    const id = (sabado.body as { id: string }).id;
    const descricao = await comoAdmin.put(`/feriados/${id}`, {
      data: '2001-03-03',
      descricao: 'Novo nome',
      tipo: 'EMPRESA',
    });
    expect(descricao.status).toBe(200);
    // Mover para um dia útil mudaria o prazo de fevereiro/2001.
    const mover = await comoAdmin.put(`/feriados/${id}`, {
      data: '2001-03-07',
      descricao: 'Novo nome',
      tipo: 'EMPRESA',
    });
    expect(mover.status).toBe(422);
  });

  it('recusa excluir feriado que já contou num fechamento', async () => {
    const feriado = await banco().feriado.create({
      data: { data: new Date('2001-03-08T00:00:00Z'), descricao: 'Antigo', tipo: 'MUNICIPAL' },
    });
    const r = await comoAdmin.delete(`/feriados/${feriado.id}`);
    expect([r.status, erro(r).codigo]).toEqual([422, 'MES_FECHADO']);
  });

  it('validação da data e do filtro', async () => {
    const r = await comoAdmin.post('/feriados', {
      data: '2097-02-30',
      descricao: 'Nunca',
      tipo: 'EMPRESA',
    });
    expect([r.status, erro(r).codigo]).toEqual([400, 'VALIDACAO']);
    expect((await comoAdmin.get('/feriados')).status).toBe(400);
  });
});
