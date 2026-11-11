import path from 'node:path';

import { config as carregarEnv } from 'dotenv';

carregarEnv({ path: path.resolve(import.meta.dirname, '../../../.env'), quiet: true });

/**
 * URL do banco de testes com o dono do esquema (metas_owner). Usada só para preparar e limpar.
 * Por segurança, o nome do banco precisa terminar em `_teste`.
 */
export function urlBancoTeste(): string {
  const url = process.env.DATABASE_URL_TESTE;
  if (url === undefined || url === '') {
    throw new Error('Defina DATABASE_URL_TESTE no .env para os testes da API.');
  }
  if (!new URL(url).pathname.endsWith('_teste')) {
    throw new Error('O banco de testes deve terminar em _teste.');
  }
  return url;
}

/**
 * URL do banco de testes com o usuário da aplicação (metas_app): mesma credencial de
 * DATABASE_URL, apontando para o banco de DATABASE_URL_TESTE (que precisa terminar em _teste).
 */
export function urlBancoTesteComoApp(): string {
  const app = process.env.DATABASE_URL;
  const teste = process.env.DATABASE_URL_TESTE;
  if (app === undefined || app === '' || teste === undefined || teste === '') {
    throw new Error('Defina DATABASE_URL e DATABASE_URL_TESTE no .env para os testes da API.');
  }
  const url = new URL(app);
  url.pathname = new URL(teste).pathname;
  if (!url.pathname.endsWith('_teste')) {
    throw new Error('O banco de testes deve terminar em _teste.');
  }
  return url.toString();
}
