import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { opcoesPrismaClient, PrismaClient } from '@metas/prisma';

import { CONFIG, type Config } from '../config/config.js';

/**
 * PrismaClient da aplicação, com o usuário de privilégios mínimos (`DATABASE_URL`).
 * Conecta sob demanda: a API sobe mesmo com o banco fora do ar, e a rota de saúde mostra isso.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(CONFIG) config: Config) {
    super(opcoesPrismaClient(config.DATABASE_URL));
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
