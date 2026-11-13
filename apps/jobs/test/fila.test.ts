import { pino } from 'pino';
import { describe, expect, it } from 'vitest';

import { CRON_ROTINA_DIARIA, FILA_ROTINA_DIARIA, iniciarFila } from '../src/fila.js';
import { urlBancoTesteComoApp } from './ambiente.js';

describe('fila de jobs (pg-boss)', () => {
  it('sobe como metas_app no schema da migração, agenda as 00h05 e já roda a rotina ao iniciar', async () => {
    let chamadas = 0;
    let avisar: () => void = () => undefined;
    const executou = new Promise<void>((resolver) => {
      avisar = resolver;
    });

    const boss = await iniciarFila({
      databaseUrl: urlBancoTesteComoApp(),
      logger: pino({ level: 'silent' }),
      executar: () => {
        chamadas++;
        avisar();
        return Promise.resolve();
      },
    });
    try {
      await executou;
      const agendas = await boss.getSchedules(FILA_ROTINA_DIARIA);
      expect(agendas).toMatchObject([
        { name: FILA_ROTINA_DIARIA, cron: CRON_ROTINA_DIARIA, timezone: 'America/Sao_Paulo' },
      ]);
      expect(chamadas).toBe(1);
    } finally {
      await boss.stop({ graceful: true, timeout: 10_000 });
    }
  });
});
