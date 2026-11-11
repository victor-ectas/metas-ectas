import path from 'node:path';

import { config } from 'dotenv';

config({ path: path.resolve(import.meta.dirname, '../../.env'), quiet: true });

/**
 * URL do banco de testes. Por segurança, o nome do banco precisa terminar em `_teste`: os
 * testes nunca rodam no banco de desenvolvimento nem no de produção.
 */
export function urlBancoTeste(): string {
  const url = process.env.DATABASE_URL_TESTE;
  if (url === undefined || url === '') {
    throw new Error('Defina DATABASE_URL_TESTE no .env para rodar os testes de integração.');
  }
  const banco = new URL(url).pathname.replace(/^\//, '');
  if (!banco.endsWith('_teste')) {
    throw new Error(
      `DATABASE_URL_TESTE aponta para "${banco}"; o banco de testes deve terminar em _teste.`,
    );
  }
  return url;
}

/** Mesma conexão do banco de testes, mas com o usuário da aplicação (DATABASE_URL). */
export function urlBancoTesteComoApp(): string {
  const app = process.env.DATABASE_URL;
  if (app === undefined || app === '') {
    throw new Error('Defina DATABASE_URL no .env.');
  }
  const url = new URL(app);
  url.pathname = new URL(urlBancoTeste()).pathname;
  return url.toString();
}
