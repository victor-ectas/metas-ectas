import { Global, Module } from '@nestjs/common';

import { PoliticasService } from './politicas.service.js';

/** Serviço de políticas disponível em toda a API. */
@Global()
@Module({ providers: [PoliticasService], exports: [PoliticasService] })
export class PoliticasModule {}
