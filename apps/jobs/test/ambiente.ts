import { existsSync } from 'node:fs';
import path from 'node:path';

const arquivoEnv = path.resolve(import.meta.dirname, '../../../.env');
if (existsSync(arquivoEnv)) process.loadEnvFile(arquivoEnv);

/** Banco de testes com o dono do esquema (migrações). O nome precisa terminar em `_teste`. */
export function urlBancoTeste(): string {
  const url = process.env.DATABASE_URL_TESTE;
  if (url === undefined || url === '') {
    throw new Error('Defina DATABASE_URL_TESTE no .env para os testes dos jobs.');
  }
  if (!new URL(url).pathname.endsWith('_teste')) {
    throw new Error('O banco de testes deve terminar em _teste.');
  }
  return url;
}

/** Banco de testes com o usuário da aplicação (metas_app), como o serviço roda em produção. */
export function urlBancoTesteComoApp(): string {
  const app = process.env.DATABASE_URL;
  if (app === undefined || app === '') throw new Error('Defina DATABASE_URL no .env.');
  const url = new URL(app);
  url.pathname = new URL(urlBancoTeste()).pathname;
  return url.toString();
}
