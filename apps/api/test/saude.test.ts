import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { configTeste, criarApp } from './apoio.js';

describe('GET /api/v1/saude (RNF-14)', () => {
  it('200 com o banco respondendo, pública e sem autenticação', async () => {
    const app = await criarApp();
    try {
      const r = await request(app.getHttpServer()).get('/api/v1/saude');
      expect(r.status).toBe(200);
      expect(r.body).toEqual({
        status: 'ok',
        verificacoes: { banco: { status: 'ok', latenciaMs: expect.any(Number) as unknown } },
        em: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) as unknown,
      });
    } finally {
      await app.close();
    }
  });

  it('503 com o banco fora do ar, e a API continua de pé', async () => {
    const app = await criarApp(
      configTeste({ DATABASE_URL: 'postgresql://metas_app:x@127.0.0.1:1/metas_teste' }),
    );
    try {
      const r = await request(app.getHttpServer()).get('/api/v1/saude');
      expect(r.status).toBe(503);
      expect(r.body).toMatchObject({
        status: 'indisponivel',
        verificacoes: { banco: { status: 'erro' } },
      });
      expect(JSON.stringify(r.body)).not.toMatch(/ECONNREFUSED|127\.0\.0\.1|metas_app/);
    } finally {
      await app.close();
    }
  });
});
