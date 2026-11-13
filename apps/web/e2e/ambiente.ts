import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Ambiente dos testes ponta a ponta (P21). Lê o `.env` da raiz (sem sobrescrever o que já veio do
 * ambiente) e monta as URLs do banco próprio do E2E, separado do de desenvolvimento e do de
 * testes de integração: a API dos testes ponta a ponta precisa de um ciclo ativo só dela.
 */
export const RAIZ = path.resolve(import.meta.dirname, '../../..');

const arquivoEnv = path.join(RAIZ, '.env');
if (existsSync(arquivoEnv)) process.loadEnvFile(arquivoEnv);

/** Por segurança, o preparo só apaga dados num banco com este nome. */
export const BANCO_E2E = 'metas_e2e_teste';

export const PORTA_API = 3100;
export const PORTA_WEB = 5174;
export const URL_WEB = `http://localhost:${String(PORTA_WEB)}`;
export const URL_API = `http://localhost:${String(PORTA_API)}/api/v1`;

/**
 * Instante fixo da API e do navegador: 13/11/2026, meio-dia em São Paulo. Com os feriados de
 * 02/11 e 20/11, setembro/2026 já fechou (21/10) e outubro/2026 fecha em 24/11 (CT-18).
 */
export const AGORA = '2026-11-13T12:00:00-03:00';

export const ADMIN = { email: 'admin@e2e.teste', nome: 'Administrador E2E' } as const;
export const GESTOR = { email: 'paula@e2e.teste', nome: 'Paula Fiscal' } as const;

function variavel(nome: string): string {
  const valor = process.env[nome];
  if (valor === undefined || valor === '') {
    throw new Error(`Defina ${nome} no .env para os testes ponta a ponta.`);
  }
  return valor;
}

/** Mesma credencial de `base`, apontando para o banco `banco`. */
function noBanco(base: string, banco: string): string {
  const url = new URL(base);
  url.pathname = `/${banco}`;
  return url.toString();
}

/** Dono do esquema (migrações, limpeza e dados de exemplo), no banco `banco`. */
export function urlDono(banco: string = BANCO_E2E): string {
  return noBanco(variavel('DATABASE_URL_TESTE'), banco);
}

/** Banco dos testes de integração, que sempre existe: daqui se cria o do E2E. */
export function urlBancoDeTestes(): string {
  return variavel('DATABASE_URL_TESTE');
}

/** Usuário da aplicação (privilégios mínimos), no banco do E2E: é o que a API usa. */
export function urlApp(): string {
  return noBanco(variavel('DATABASE_URL'), BANCO_E2E);
}

/** Nome do usuário da aplicação, para os privilégios do banco novo. */
export function usuarioApp(): string {
  return decodeURIComponent(new URL(variavel('DATABASE_URL')).username);
}
