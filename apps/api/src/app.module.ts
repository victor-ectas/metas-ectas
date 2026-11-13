import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { type DynamicModule, Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { AuthGuard } from './auth/auth.guard.js';
import { AuthModule } from './auth/auth.module.js';
import { CadastrosModule } from './cadastros/cadastros.module.js';
import { LancamentosModule } from './lancamentos/lancamentos.module.js';
import { MetasModule } from './metas/metas.module.js';
import { ResultadosModule } from './resultados/resultados.module.js';
import { VariaveisModule } from './variaveis/variaveis.module.js';
import { FiltroErros } from './comum/filtro-erros.js';
import { LimiteEscritaGuard } from './comum/limite-escrita.guard.js';
import { CONFIG, type Config } from './config/config.js';
import { PoliticasModule } from './politicas/politicas.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SaudeModule } from './saude/saude.module.js';

/** requestId vindo do proxy ou do cliente é aceito só se for curto e simples. */
const REQUEST_ID_VALIDO = /^[\w-]{1,100}$/;

/** Usa o `X-Request-Id` recebido ou gera um UUID, e devolve no cabeçalho da resposta. */
export function gerarRequestId(requisicao: IncomingMessage, resposta: ServerResponse): string {
  const recebido = requisicao.headers['x-request-id'];
  const id =
    typeof recebido === 'string' && REQUEST_ID_VALIDO.test(recebido) ? recebido : randomUUID();
  resposta.setHeader('X-Request-Id', id);
  return id;
}

@Global()
@Module({})
class ConfigModule {
  static registrar(config: Config): DynamicModule {
    return {
      module: ConfigModule,
      providers: [{ provide: CONFIG, useValue: config }],
      exports: [CONFIG],
    };
  }
}

@Module({})
export class AppModule {
  /** Monta a aplicação com a configuração já validada (também usado nos testes). */
  static registrar(config: Config): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.registrar(config),
        LoggerModule.forRoot({
          pinoHttp: {
            level: config.LOG_LEVEL,
            genReqId: gerarRequestId,
            // Só o essencial da requisição: nunca cabeçalhos (token, cookies) nem corpo.
            serializers: {
              req: (req: { id: unknown; method: string; url: string }) => ({
                id: req.id,
                method: req.method,
                url: req.url,
              }),
              res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
            },
            customLogLevel: (_req, res, erro) =>
              erro !== undefined || res.statusCode >= 500
                ? 'error'
                : res.statusCode >= 400
                  ? 'warn'
                  : 'info',
          },
        }),
        ThrottlerModule.forRoot([
          { name: 'escrita', ttl: 60_000, limit: config.LIMITE_ESCRITA_POR_MINUTO },
        ]),
        PrismaModule,
        PoliticasModule,
        AuthModule,
        SaudeModule,
        CadastrosModule,
        VariaveisModule,
        MetasModule,
        ResultadosModule,
        LancamentosModule,
      ],
      providers: [
        // Ordem: limite de taxa antes do login (barra excesso sem consultar o banco).
        { provide: APP_GUARD, useClass: LimiteEscritaGuard },
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: APP_FILTER, useClass: FiltroErros },
      ],
    };
  }
}
