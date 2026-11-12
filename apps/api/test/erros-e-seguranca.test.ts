import { Body, Controller, ForbiddenException, Get, Post } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { type ErroApi as CorpoErro, ErroApiSchema, MesSchema } from '@metas/tipos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { Publica } from '../src/auth/decoradores.js';
import { ErroApi } from '../src/comum/erro-api.js';
import { ValidacaoZod } from '../src/comum/validacao-zod.pipe.js';
import { configTeste, criarApp, ORIGEM_WEB, cliente } from './apoio.js';

const CorpoTeste = z.object({ mes: MesSchema });

/** Rotas só para os testes, montadas junto com a aplicação real. */
@Publica()
@Controller('teste')
class TesteController {
  @Get('erro-api')
  erroApi(): never {
    throw new ErroApi('MES_FECHADO', 'Outubro/2026 fechou em 24/11/2026.', { mes: 10 });
  }

  @Get('conflito')
  conflito(): never {
    throw new ErroApi('CONFLITO_VERSAO', 'O valor foi alterado por outra pessoa.');
  }

  @Get('proibido')
  proibido(): never {
    throw new ForbiddenException('Forbidden resource');
  }

  @Get('inesperado')
  inesperado(): never {
    throw new Error('falha interna: SELECT * FROM usuario WHERE senha = 123');
  }

  @Post('validar')
  validar(@Body(new ValidacaoZod(CorpoTeste)) corpo: z.infer<typeof CorpoTeste>): { mes: number } {
    return corpo;
  }

  @Post('escrita')
  escrita(): { ok: true } {
    return { ok: true };
  }

  @Get('leitura')
  leitura(): { ok: true } {
    return { ok: true };
  }
}

/** Corpo de uma resposta de erro (o supertest tipa o body como any). */
const erro = (r: { body: unknown }): CorpoErro => r.body as CorpoErro;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('formato único de erro (CLAUDE.md 5.3)', () => {
  let app: NestExpressApplication;
  beforeAll(async () => {
    app = await criarApp(configTeste(), [TesteController]);
  });
  afterAll(async () => {
    await app.close();
  });

  const http = () => cliente(app);

  it('ErroApi: código, mensagem, detalhes e status do código', async () => {
    const r = await http().get('/api/v1/teste/erro-api');
    expect(r.status).toBe(422);
    expect(r.body).toEqual({
      codigo: 'MES_FECHADO',
      mensagem: 'Outubro/2026 fechou em 24/11/2026.',
      detalhes: { mes: 10 },
    });
    expect(r.headers['content-type']).toMatch(/application\/json/);
  });

  it('conflito de versão → 409', async () => {
    const r = await http().get('/api/v1/teste/conflito');
    expect(r.status).toBe(409);
    expect(erro(r).codigo).toBe('CONFLITO_VERSAO');
  });

  it('exceção HTTP do Nest vira código e mensagem em português', async () => {
    const r = await http().get('/api/v1/teste/proibido');
    expect(r.status).toBe(403);
    expect(r.body).toEqual({
      codigo: 'SEM_PERMISSAO',
      mensagem: 'Você não tem permissão para esta ação.',
      detalhes: {},
    });
  });

  it('rota inexistente → 404 NAO_ENCONTRADO', async () => {
    const r = await http().get('/api/v1/nao-existe');
    expect(r.status).toBe(404);
    expect(r.body).toEqual({
      codigo: 'NAO_ENCONTRADO',
      mensagem: 'Recurso não encontrado.',
      detalhes: {},
    });
  });

  it('validação Zod → 400 VALIDACAO com os campos e as mensagens do schema', async () => {
    const r = await http().post('/api/v1/teste/validar').send({ mes: 13 });
    expect(r.status).toBe(400);
    expect(r.body).toEqual({
      codigo: 'VALIDACAO',
      mensagem: 'Dados inválidos. Confira os campos destacados.',
      detalhes: { campos: [{ campo: 'mes', mensagem: 'O mês deve estar entre 1 e 12.' }] },
    });
    const ok = await http().post('/api/v1/teste/validar').send({ mes: 10 });
    expect(ok.status).toBe(201);
    expect(ok.body).toEqual({ mes: 10 });
  });

  it('JSON malformado → 400 VALIDACAO', async () => {
    const r = await http()
      .post('/api/v1/teste/validar')
      .set('Content-Type', 'application/json')
      .send('{"mes": 1');
    expect(r.status).toBe(400);
    expect(r.body).toEqual({
      codigo: 'VALIDACAO',
      mensagem: 'O corpo da requisição não é um JSON válido.',
      detalhes: {},
    });
  });

  it('erro inesperado → 500 ERRO_INTERNO, sem vazar mensagem interna, com requestId', async () => {
    const r = await http().get('/api/v1/teste/inesperado');
    expect(r.status).toBe(500);
    expect(erro(r).codigo).toBe('ERRO_INTERNO');
    expect(JSON.stringify(r.body)).not.toMatch(/SELECT|senha|falha interna|stack/i);
    expect(erro(r).detalhes).toEqual({ requestId: r.headers['x-request-id'] });
    expect(erro(r).mensagem).toBe(
      `Erro interno no servidor. Se persistir, informe o código ${String(r.headers['x-request-id'])} ao suporte.`,
    );
  });

  it('todos os erros seguem o schema compartilhado ErroApiSchema', async () => {
    for (const rota of ['erro-api', 'conflito', 'proibido', 'inesperado']) {
      const r = await http().get(`/api/v1/teste/${rota}`);
      expect(ErroApiSchema.safeParse(r.body).success, rota).toBe(true);
    }
  });
});

describe('requestId, cabeçalhos de segurança e CORS', () => {
  let app: NestExpressApplication;
  beforeAll(async () => {
    app = await criarApp(configTeste(), [TesteController]);
  });
  afterAll(async () => {
    await app.close();
  });

  const http = () => cliente(app);

  it('gera um X-Request-Id por requisição', async () => {
    const a = await http().get('/api/v1/teste/leitura');
    const b = await http().get('/api/v1/teste/leitura');
    expect(a.headers['x-request-id']).toMatch(UUID);
    expect(b.headers['x-request-id']).not.toBe(a.headers['x-request-id']);
  });

  it('reaproveita o X-Request-Id recebido, se for válido', async () => {
    const r = await http().get('/api/v1/teste/leitura').set('X-Request-Id', 'iis-12345');
    expect(r.headers['x-request-id']).toBe('iis-12345');
    const invalido = await http().get('/api/v1/teste/leitura').set('X-Request-Id', 'x'.repeat(101));
    expect(invalido.headers['x-request-id']).toMatch(UUID);
  });

  it('helmet: cabeçalhos de segurança e sem X-Powered-By', async () => {
    const r = await http().get('/api/v1/teste/leitura');
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.headers['strict-transport-security']).toMatch(/max-age=/);
    expect(r.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(r.headers['x-powered-by']).toBeUndefined();
  });

  it('CORS só para a origem do front-end', async () => {
    const permitida = await http().get('/api/v1/teste/leitura').set('Origin', ORIGEM_WEB);
    expect(permitida.headers['access-control-allow-origin']).toBe(ORIGEM_WEB);
    expect(permitida.headers['access-control-expose-headers']).toBe('X-Request-Id');

    const outra = await http()
      .get('/api/v1/teste/leitura')
      .set('Origin', 'https://site-qualquer.com');
    expect(outra.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('preflight de CORS libera Authorization e os métodos de escrita', async () => {
    const r = await http()
      .options('/api/v1/teste/escrita')
      .set('Origin', ORIGEM_WEB)
      .set('Access-Control-Request-Method', 'PUT')
      .set('Access-Control-Request-Headers', 'Authorization, Content-Type');
    expect(r.status).toBe(204);
    expect(r.headers['access-control-allow-methods']).toContain('PUT');
    expect(r.headers['access-control-allow-headers']).toContain('Authorization');
  });

  it('OpenAPI publicado fora de produção', async () => {
    const r = await http().get('/api/v1/docs-json');
    expect(r.status).toBe(200);
    const documento = r.body as { openapi: string; paths: Record<string, unknown> };
    expect(documento.openapi).toMatch(/^3\./);
    expect(Object.keys(documento.paths)).toContain('/api/v1/saude');
  });
});

describe('em produção', () => {
  it('não publica a documentação OpenAPI e liga o CSP completo', async () => {
    const app = await criarApp(configTeste({ NODE_ENV: 'production' }), [TesteController]);
    try {
      const docs = await cliente(app).get('/api/v1/docs-json');
      expect(docs.status).toBe(404);
      expect(erro(docs).codigo).toBe('NAO_ENCONTRADO');
      const r = await cliente(app).get('/api/v1/teste/leitura');
      expect(r.headers['content-security-policy']).toMatch(/default-src 'self'/);
    } finally {
      await app.close();
    }
  });
});

describe('limite de taxa nas rotas de escrita (CLAUDE.md 6)', () => {
  let app: NestExpressApplication;
  beforeAll(async () => {
    app = await criarApp(configTeste({ LIMITE_ESCRITA_POR_MINUTO: 3 }), [TesteController]);
  });
  afterAll(async () => {
    await app.close();
  });

  it('bloqueia a escrita acima do limite com 429 MUITAS_REQUISICOES', async () => {
    const http = cliente(app);
    for (let i = 0; i < 3; i++) {
      expect((await http.post('/api/v1/teste/escrita')).status).toBe(201);
    }
    const bloqueada = await http.post('/api/v1/teste/escrita');
    expect(bloqueada.status).toBe(429);
    expect(bloqueada.body).toEqual({
      codigo: 'MUITAS_REQUISICOES',
      mensagem: 'Muitas requisições em pouco tempo. Aguarde um minuto e tente de novo.',
      detalhes: {},
    });
  });

  it('não limita leituras', async () => {
    const http = cliente(app);
    for (let i = 0; i < 10; i++) {
      expect((await http.get('/api/v1/teste/leitura')).status).toBe(200);
    }
  });
});
