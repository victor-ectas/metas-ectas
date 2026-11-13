import { Inject, Injectable } from '@nestjs/common';

import { CONFIG, type Config } from '../config/config.js';

/**
 * Instante atual, num provider: os testes trocam por um relógio fixo para simular mês aberto,
 * fechado, reaberto e futuro (RN-34) sem depender da data em que rodam. Os testes ponta a ponta
 * fixam o instante por `RELOGIO_FIXO`, aceito só em desenvolvimento (config.ts).
 */
@Injectable()
export class Relogio {
  constructor(@Inject(CONFIG) private readonly config: Config) {}

  agora(): Date {
    return this.config.RELOGIO_FIXO === undefined
      ? new Date()
      : new Date(this.config.RELOGIO_FIXO.getTime());
  }
}
