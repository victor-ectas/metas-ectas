import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException } from '@nestjs/common';
import { type ErroApi as CorpoErro, CodigoErro } from '@metas/tipos';
import type { Request, Response } from 'express';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { ZodError } from 'zod';

import { ErroApi } from './erro-api.js';

/** Mensagens para erros HTTP genéricos (rota inexistente, corpo grande demais etc.). */
const MENSAGEM_DO_STATUS: Readonly<Record<number, [CodigoErro, string]>> = {
  400: [CodigoErro.VALIDACAO, 'Requisição inválida.'],
  401: [CodigoErro.NAO_AUTENTICADO, 'Faça login para continuar.'],
  403: [CodigoErro.SEM_PERMISSAO, 'Você não tem permissão para esta ação.'],
  404: [CodigoErro.NAO_ENCONTRADO, 'Recurso não encontrado.'],
  413: [CodigoErro.VALIDACAO, 'Os dados enviados são grandes demais.'],
  415: [CodigoErro.VALIDACAO, 'Formato de dados não suportado. Envie JSON.'],
  429: [
    CodigoErro.MUITAS_REQUISICOES,
    'Muitas requisições em pouco tempo. Aguarde um minuto e tente de novo.',
  ],
};

interface Resposta {
  status: number;
  corpo: CorpoErro;
}

/**
 * Filtro global: toda resposta de erro sai no formato `{ codigo, mensagem, detalhes }`
 * (CLAUDE.md 5.3), com mensagem em português e sem stack, SQL ou mensagens internas.
 * Erros inesperados (500) são registrados no log com o requestId.
 */
@Catch()
export class FiltroErros implements ExceptionFilter {
  constructor(@InjectPinoLogger(FiltroErros.name) private readonly logger: PinoLogger) {}

  catch(excecao: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const requisicao = http.getRequest<Request>();
    const resposta = http.getResponse<Response>();
    // O id é gerado por gerarRequestId (sempre texto).
    const requestId = typeof requisicao.id === 'string' ? requisicao.id : '';
    const { status, corpo } = this.converter(excecao, requestId);
    resposta.status(status).json(corpo);
  }

  private converter(excecao: unknown, requestId: string): Resposta {
    if (excecao instanceof ErroApi) {
      return {
        status: excecao.status,
        corpo: { codigo: excecao.codigo, mensagem: excecao.message, detalhes: excecao.detalhes },
      };
    }

    if (excecao instanceof ZodError) {
      return {
        status: 400,
        corpo: {
          codigo: CodigoErro.VALIDACAO,
          mensagem: 'Dados inválidos. Confira os campos destacados.',
          detalhes: {
            campos: excecao.issues.map((issue) => ({
              campo: issue.path.join('.'),
              mensagem: issue.message,
            })),
          },
        },
      };
    }

    // JSON malformado no corpo (body-parser do Express).
    if (ehErroDeCorpo(excecao)) {
      return {
        status: 400,
        corpo: {
          codigo: CodigoErro.VALIDACAO,
          mensagem: 'O corpo da requisição não é um JSON válido.',
          detalhes: {},
        },
      };
    }

    if (excecao instanceof HttpException && excecao.getStatus() < 500) {
      const status = excecao.getStatus();
      const [codigo, mensagem] = MENSAGEM_DO_STATUS[status] ?? [
        CodigoErro.VALIDACAO,
        'Requisição inválida.',
      ];
      return { status, corpo: { codigo, mensagem, detalhes: {} } };
    }

    this.logger.error({ err: excecao, requestId }, 'Erro inesperado');
    return {
      status: 500,
      corpo: {
        codigo: CodigoErro.ERRO_INTERNO,
        mensagem: `Erro interno no servidor. Se persistir, informe o código ${requestId} ao suporte.`,
        detalhes: { requestId },
      },
    };
  }
}

/**
 * JSON malformado: o body-parser lança um erro com `type: 'entity.parse.failed'`, que o
 * adapter do Nest embrulha numa BadRequestException (em `cause`).
 */
function ehErroDeCorpo(excecao: unknown): boolean {
  const original = excecao instanceof HttpException ? excecao.cause : excecao;
  return (
    typeof original === 'object' &&
    original !== null &&
    'type' in original &&
    original.type === 'entity.parse.failed'
  );
}
