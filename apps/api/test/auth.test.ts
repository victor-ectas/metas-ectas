import { randomUUID } from 'node:crypto';

import { Controller, Get } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { type ErroApi as CorpoErro, type Sessao, SessaoSchema } from '@metas/tipos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Perfis } from '../src/auth/decoradores.js';
import { emissorEntra } from '../src/auth/validador-token.js';
import {
  AUDIENCIA_URI,
  configTeste,
  criarApp,
  emitirToken,
  ORIGEM_WEB,
  OUTRO_TENANT,
  cliente,
} from './apoio.js';
import {
  ANO_ATIVO,
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

/** Rotas de teste com cada nível de exigência. */
@Controller('teste-auth')
class TesteAuthController {
  @Get('logado')
  logado(): { ok: true } {
    return { ok: true };
  }

  @Get('admin')
  @Perfis('ADMIN')
  admin(): { ok: true } {
    return { ok: true };
  }

  @Get('visao-geral')
  @Perfis('ADMIN', 'DIRETORIA')
  visaoGeral(): { ok: true } {
    return { ok: true };
  }
}

const erro = (r: { body: unknown }): CorpoErro => r.body as CorpoErro;
const sessao = (r: { body: unknown }): Sessao => SessaoSchema.parse(r.body);

type Usuario = Awaited<ReturnType<typeof criarUsuario>>;
/** Token de um usuário já cadastrado (pelo oid). */
const tokenDe = (u: Usuario) => emitirToken({ oid: u.entraOid, preferred_username: u.email });

let app: NestExpressApplication;
const http = () => cliente(app);

beforeAll(async () => {
  await limparDados();
  app = await criarApp(configTeste(), [TesteAuthController]);
});

afterAll(async () => {
  await app.close();
  await limparDados();
  await desconectar();
});

describe('token do Entra ID (CLAUDE.md 6)', () => {
  let usuario: Usuario;
  beforeAll(async () => {
    usuario = await criarUsuario('ADMIN');
  });

  it('token válido: entra', async () => {
    const r = await http()
      .get('/api/v1/teste-auth/logado')
      .set('Authorization', `Bearer ${await tokenDe(usuario)}`);
    expect(r.status).toBe(200);
  });

  it('aceita a audiência pelo URI da API também', async () => {
    const token = await emitirToken({ oid: usuario.entraOid }, { audiencia: AUDIENCIA_URI });
    const r = await http().get('/api/v1/teste-auth/logado').set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(200);
  });

  it('sem token → 401 NAO_AUTENTICADO', async () => {
    const r = await http().get('/api/v1/teste-auth/logado');
    expect(r.status).toBe(401);
    expect(r.body).toEqual({
      codigo: 'NAO_AUTENTICADO',
      mensagem: 'Faça login para continuar.',
      detalhes: {},
    });
  });

  it('cabeçalho que não é Bearer → 401', async () => {
    const r = await http().get('/api/v1/me').set('Authorization', 'Basic dXNlcjpzZW5oYQ==');
    expect(r.status).toBe(401);
  });

  const MENSAGEM_INVALIDO = 'Login inválido. Entre de novo com sua conta Microsoft.';

  it.each([
    ['texto qualquer', () => Promise.resolve('nao-e-um-jwt')],
    ['assinado com outra chave', () => emitirToken({}, { chaveEstranha: true })],
    ['de outro tenant', () => emitirToken({}, { emissor: emissorEntra(OUTRO_TENANT) })],
    ['emissor v1', () => emitirToken({}, { emissor: `https://sts.windows.net/${OUTRO_TENANT}/` })],
    ['de outra audiência', () => emitirToken({}, { audiencia: 'api://outro-sistema' })],
    ['sem scp (token de aplicação ou ID token)', () => emitirToken({ scp: undefined })],
    ['sem oid', () => emitirToken({ oid: undefined })],
    ['sem expiração (exp)', () => emitirToken({}, { expiraEm: null })],
  ])('token %s → 401 NAO_AUTENTICADO', async (_caso, gerar) => {
    const r = await http()
      .get('/api/v1/teste-auth/logado')
      .set('Authorization', `Bearer ${await gerar()}`);
    expect(r.status).toBe(401);
    expect(r.body).toEqual({
      codigo: 'NAO_AUTENTICADO',
      mensagem: MENSAGEM_INVALIDO,
      detalhes: {},
    });
  });

  it('token expirado → 401 com mensagem de sessão expirada', async () => {
    const token = await emitirToken({ oid: usuario.entraOid }, { expiraEm: -120 });
    const r = await http().get('/api/v1/me').set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(401);
    expect(r.body).toEqual({
      codigo: 'NAO_AUTENTICADO',
      mensagem: 'Sua sessão expirou. Entre de novo.',
      detalhes: { motivo: 'TOKEN_EXPIRADO' },
    });
  });

  it('tolera até 60 s de diferença de relógio', async () => {
    const token = await emitirToken({ oid: usuario.entraOid }, { expiraEm: -30 });
    const r = await http().get('/api/v1/me').set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(200);
  });

  it('a rota de saúde continua pública', async () => {
    expect((await http().get('/api/v1/saude')).status).toBe(200);
  });
});

describe('primeiro acesso (RF-02)', () => {
  it('usuário novo é criado como Leitor inativo, com auditoria', async () => {
    const oid = randomUUID();
    const email = emailTeste('novo');
    const token = await emitirToken({
      oid,
      preferred_username: email.toUpperCase(),
      name: 'Maria Nova',
    });

    const r = await http().get('/api/v1/me').set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(200);
    expect(sessao(r)).toMatchObject({
      usuario: { nome: 'Maria Nova', email, perfil: 'LEITOR', ativo: false, gerenteGeral: false },
      todosOsSetores: false,
      setores: [],
    });

    const criado = await banco().usuario.findUniqueOrThrow({ where: { entraOid: oid } });
    expect(criado).toMatchObject({ email, perfil: 'LEITOR', ativo: false });
    const auditoria = await banco().auditoria.findMany({ where: { entidadeId: criado.id } });
    expect(auditoria).toEqual([
      expect.objectContaining({
        entidade: 'usuario',
        acao: 'CRIAR_NO_PRIMEIRO_ACESSO',
        usuarioId: criado.id,
      }),
    ]);

    // Segundo acesso: o mesmo usuário, sem nova auditoria.
    expect((await http().get('/api/v1/me').set('Authorization', `Bearer ${token}`)).status).toBe(
      200,
    );
    expect(await banco().usuario.count({ where: { email } })).toBe(1);
    expect(await banco().auditoria.count({ where: { entidadeId: criado.id } })).toBe(1);
  });

  it('o recém-criado não acessa nada além de /me', async () => {
    const token = await emitirToken({ oid: randomUUID(), preferred_username: emailTeste('novo') });
    const r = await http().get('/api/v1/teste-auth/logado').set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(403);
    expect(erro(r).detalhes).toEqual({ motivo: 'USUARIO_INATIVO' });
  });

  it('primeiro acesso simultâneo (duas abas) cria um usuário só', async () => {
    const email = emailTeste('duas-abas');
    const token = await emitirToken({ oid: randomUUID(), preferred_username: email });
    const respostas = await Promise.all(
      [1, 2, 3].map(() => http().get('/api/v1/me').set('Authorization', `Bearer ${token}`)),
    );
    expect(
      respostas.map((r) => [r.status, (r.body as { codigo?: string }).codigo ?? null]),
    ).toEqual([
      [200, null],
      [200, null],
      [200, null],
    ]);
    expect(await banco().usuario.count({ where: { email } })).toBe(1);
  });

  it('usuário pré-cadastrado pelo e-mail é ligado ao oid no primeiro login', async () => {
    const pre = await criarUsuario('GESTOR', { entraOid: null, email: emailTeste('pre') });
    const oid = randomUUID();
    const token = await emitirToken({ oid, email: pre.email.toUpperCase() });

    const r = await http().get('/api/v1/me').set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(200);
    expect(sessao(r).usuario).toMatchObject({ id: pre.id, perfil: 'GESTOR', ativo: true });

    expect((await banco().usuario.findUniqueOrThrow({ where: { id: pre.id } })).entraOid).toBe(oid);
    const auditoria = await banco().auditoria.findMany({ where: { entidadeId: pre.id } });
    expect(auditoria).toEqual([
      expect.objectContaining({
        acao: 'VINCULAR_ENTRA_ID',
        antes: { entraOid: null },
        depois: { entraOid: oid },
      }),
    ]);
  });

  it('e-mail já ligado a outra conta Microsoft → 403, sem alterar o cadastro', async () => {
    const existente = await criarUsuario('GESTOR');
    const token = await emitirToken({ oid: randomUUID(), preferred_username: existente.email });
    const r = await http().get('/api/v1/me').set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(403);
    expect(erro(r).mensagem).toBe(
      'Seu e-mail já está ligado a outra conta Microsoft no sistema. Procure o Administrador.',
    );
    const depois = await banco().usuario.findUniqueOrThrow({ where: { id: existente.id } });
    expect(depois.entraOid).toBe(existente.entraOid);
  });

  it('token sem e-mail de um usuário desconhecido → 403', async () => {
    const token = await emitirToken({ oid: randomUUID(), preferred_username: undefined });
    const r = await http().get('/api/v1/me').set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(403);
    expect(erro(r).codigo).toBe('SEM_PERMISSAO');
  });
});

describe('perfis e usuário inativo', () => {
  const usuarios: Partial<Record<string, Usuario>> = {};
  beforeAll(async () => {
    for (const perfil of ['ADMIN', 'DIRETORIA', 'GESTOR', 'LEITOR'] as const) {
      usuarios[perfil] = await criarUsuario(perfil);
    }
  });
  const de = (perfil: string): Usuario => {
    const u = usuarios[perfil];
    if (u === undefined) throw new Error(perfil);
    return u;
  };

  it.each([
    ['ADMIN', 200, 200],
    ['DIRETORIA', 403, 200],
    ['GESTOR', 403, 403],
    ['LEITOR', 403, 403],
  ])('%s: rota de Admin → %d; rota de Admin e Diretoria → %d', async (perfil, admin, visao) => {
    const token = await tokenDe(de(perfil));
    const rAdmin = await http()
      .get('/api/v1/teste-auth/admin')
      .set('Authorization', `Bearer ${token}`);
    const rVisao = await http()
      .get('/api/v1/teste-auth/visao-geral')
      .set('Authorization', `Bearer ${token}`);
    expect([rAdmin.status, rVisao.status]).toEqual([admin, visao]);
    if (admin === 403) {
      expect(rAdmin.body).toEqual({
        codigo: 'SEM_PERMISSAO',
        mensagem: 'Você não tem permissão para esta ação.',
        detalhes: {},
      });
    }
  });

  it.each(['ADMIN', 'DIRETORIA', 'GESTOR', 'LEITOR'] as const)(
    '%s inativo: só /me; o resto → 403 USUARIO_INATIVO',
    async (perfil) => {
      const inativo = await criarUsuario(perfil, { ativo: false });
      const token = await tokenDe(inativo);
      const me = await http().get('/api/v1/me').set('Authorization', `Bearer ${token}`);
      expect(me.status).toBe(200);
      expect(sessao(me)).toMatchObject({
        usuario: { perfil, ativo: false },
        todosOsSetores: false,
        setores: [],
      });
      for (const rota of ['logado', 'admin', 'visao-geral']) {
        const r = await http()
          .get(`/api/v1/teste-auth/${rota}`)
          .set('Authorization', `Bearer ${token}`);
        expect(r.status, rota).toBe(403);
        expect(r.body, rota).toEqual({
          codigo: 'SEM_PERMISSAO',
          mensagem:
            'Seu acesso ainda não foi liberado. Peça ao Administrador do sistema para ativar seu usuário.',
          detalhes: { motivo: 'USUARIO_INATIVO' },
        });
      }
    },
  );
});

describe('GET /me: setores de cada perfil', () => {
  it('Administrador e Diretoria: todos os setores', async () => {
    for (const perfil of ['ADMIN', 'DIRETORIA'] as const) {
      const u = await criarUsuario(perfil);
      const r = await http()
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${await tokenDe(u)}`);
      expect(sessao(r)).toMatchObject({ todosOsSetores: true, setores: [] });
    }
  });

  it('Gestor: setores pelos quais responde no ciclo ATIVO (não os do rascunho)', async () => {
    const gestor = await criarUsuario('GESTOR');
    const [ativo, rascunho] = [
      await criarCiclo(ANO_ATIVO, 'ATIVO'),
      await criarCiclo(ANO_RASCUNHO, 'RASCUNHO'),
    ];
    const [rh, ti, fiscal] = [
      await criarSetor('RH teste'),
      await criarSetor('TI teste'),
      await criarSetor('Fiscal teste'),
    ];
    await banco().setorResponsavel.createMany({
      data: [
        { cicloId: ativo.id, setorId: rh.id, usuarioId: gestor.id },
        { cicloId: ativo.id, setorId: ti.id, usuarioId: gestor.id },
        { cicloId: rascunho.id, setorId: fiscal.id, usuarioId: gestor.id },
      ],
    });

    const r = await http()
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${await tokenDe(gestor)}`);
    expect(sessao(r)).toEqual({
      usuario: expect.objectContaining({ id: gestor.id, perfil: 'GESTOR' }) as unknown,
      todosOsSetores: false,
      setores: [
        { id: rh.id, codigo: rh.codigo, nome: 'RH teste', corporativo: false },
        { id: ti.id, codigo: ti.codigo, nome: 'TI teste', corporativo: false },
      ],
    });
  });

  it('Leitor: setores liberados a ele', async () => {
    const leitor = await criarUsuario('LEITOR');
    const [contabil, outro] = [await criarSetor('Contábil teste'), await criarSetor('Outro teste')];
    await banco().leitorSetor.create({ data: { usuarioId: leitor.id, setorId: contabil.id } });

    const r = await http()
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${await tokenDe(leitor)}`);
    expect(sessao(r).setores.map((s) => s.id)).toEqual([contabil.id]);
    expect(sessao(r).setores.map((s) => s.id)).not.toContain(outro.id);
  });
});

describe('modo DEV de autenticação', () => {
  let appDev: NestExpressApplication;
  let admin: Usuario;
  let gestor: Usuario;
  beforeAll(async () => {
    admin = await criarUsuario('ADMIN');
    gestor = await criarUsuario('GESTOR');
    appDev = await criarApp(
      configTeste({
        NODE_ENV: 'development',
        AUTH_DEV: true,
        AUTH_DEV_EMAIL: admin.email,
        ENTRA_TENANT_ID: undefined,
        ENTRA_API_AUDIENCE: [],
      }),
      [TesteAuthController],
    );
  });
  afterAll(async () => {
    await appDev.close();
  });
  const httpDev = () => cliente(appDev);

  it('sem token, entra como o usuário de AUTH_DEV_EMAIL', async () => {
    const r = await httpDev().get('/api/v1/me');
    expect(r.status).toBe(200);
    expect(sessao(r).usuario.id).toBe(admin.id);
    expect((await httpDev().get('/api/v1/teste-auth/admin')).status).toBe(200);
  });

  it('o cabeçalho X-Usuario-Dev escolhe outro usuário', async () => {
    const r = await httpDev().get('/api/v1/me').set('X-Usuario-Dev', gestor.email.toUpperCase());
    expect(sessao(r).usuario.id).toBe(gestor.id);
    const admin = await httpDev()
      .get('/api/v1/teste-auth/admin')
      .set('X-Usuario-Dev', gestor.email);
    expect(admin.status).toBe(403);
  });

  it('usuário simulado inexistente → 401 com orientação', async () => {
    const r = await httpDev().get('/api/v1/me').set('X-Usuario-Dev', `ninguem@${DOMINIO}`);
    expect(r.status).toBe(401);
    expect(erro(r).mensagem).toMatch(/Modo DEV: usuário .* não cadastrado/);
  });

  it('o CORS libera X-Usuario-Dev só no modo DEV', async () => {
    const preflight = (servidor: NestExpressApplication) =>
      cliente(servidor)
        .options('/api/v1/me')
        .set('Origin', ORIGEM_WEB)
        .set('Access-Control-Request-Method', 'GET')
        .set('Access-Control-Request-Headers', 'X-Usuario-Dev');
    expect((await preflight(appDev)).headers['access-control-allow-headers']).toContain(
      'x-usuario-dev',
    );
    expect((await preflight(app)).headers['access-control-allow-headers']).not.toContain(
      'x-usuario-dev',
    );
  });

  it('fora do modo DEV, X-Usuario-Dev é ignorado', async () => {
    const r = await http().get('/api/v1/me').set('X-Usuario-Dev', admin.email);
    expect(r.status).toBe(401);
  });
});
