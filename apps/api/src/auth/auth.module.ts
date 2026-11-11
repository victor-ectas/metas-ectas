import { Module } from '@nestjs/common';
import { createRemoteJWKSet } from 'jose';

import { CONFIG, type Config } from '../config/config.js';
import { AcessoService } from './acesso.service.js';
import { MeController } from './me.controller.js';
import { CHAVES_ENTRA, type ChavesEntra, ValidadorToken } from './validador-token.js';

/** Endereço das chaves públicas (JWKS) do tenant, para tokens v2. */
export const urlChavesEntra = (tenant: string) =>
  new URL(`https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`);

const semChaves: ChavesEntra = () => {
  throw new Error('Modo DEV: tokens do Entra ID não são validados.');
};

@Module({
  controllers: [MeController],
  providers: [
    {
      provide: CHAVES_ENTRA,
      inject: [CONFIG],
      // As chaves são buscadas no 1º uso e guardadas em cache pelo jose (renovadas se mudarem).
      useFactory: (config: Config): ChavesEntra =>
        config.ENTRA_TENANT_ID === undefined
          ? semChaves
          : createRemoteJWKSet(urlChavesEntra(config.ENTRA_TENANT_ID), { timeoutDuration: 5000 }),
    },
    ValidadorToken,
    AcessoService,
  ],
  exports: [ValidadorToken, AcessoService],
})
export class AuthModule {}
