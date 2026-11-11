import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { CABECALHO_USUARIO_DEV } from './auth/auth.guard.js';
import type { Config } from './config/config.js';

export const PREFIXO_API = 'api/v1';

/**
 * Configuração HTTP da aplicação (CLAUDE.md 5.2 e 6), compartilhada por `main.ts` e testes:
 * logger pino, prefixo /api/v1, proxy confiável, helmet, CORS restrito e OpenAPI fora de produção.
 */
export function configurarApp(app: NestExpressApplication, config: Config): void {
  const logger = app.get(Logger);
  app.useLogger(logger);
  if (config.AUTH_DEV) {
    logger.warn(
      'Modo DEV de autenticação ATIVO: o token do Entra ID não é validado. Só para desenvolvimento.',
    );
  }
  app.setGlobalPrefix(PREFIXO_API);

  // O IIS (ARR) fica na mesma máquina: confia só no proxy local para ler o IP real do cliente.
  app.set('trust proxy', 'loopback');
  app.disable('x-powered-by');

  const producao = config.NODE_ENV === 'production';
  // A interface do Swagger usa scripts inline; o CSP completo vale em produção, onde ela não existe.
  app.use(helmet({ contentSecurityPolicy: producao ? undefined : false }));

  app.enableCors({
    // Lista: o cabeçalho Access-Control-Allow-Origin só sai para a origem permitida.
    origin: [config.WEB_ORIGIN],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'X-Request-Id',
      // Modo DEV: a web escolhe o usuário simulado.
      ...(config.AUTH_DEV ? [CABECALHO_USUARIO_DEV] : []),
    ],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 600,
  });

  if (!producao) {
    const documento = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Sistema de Gestão de Metas — API')
        .setDescription('API REST. Erros no formato { codigo, mensagem, detalhes }.')
        .setVersion('1')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup(`${PREFIXO_API}/docs`, app, documento);
  }
}
