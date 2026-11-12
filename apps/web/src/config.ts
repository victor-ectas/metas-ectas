import { z } from 'zod';

/**
 * Configuração da web, lida das variáveis `VITE_*` (CLAUDE.md 11). O Vite as embute no build, então
 * nada aqui é segredo: são identificadores públicos do registro do aplicativo no Entra ID.
 */
export type ConfigWeb =
  | { readonly apiUrl: string; readonly auth: { readonly modo: 'DEV' } }
  | {
      readonly apiUrl: string;
      readonly auth: {
        readonly modo: 'ENTRA';
        readonly clientId: string;
        readonly tenantId: string;
        readonly escopoApi: string;
      };
    };

export class ConfigInvalida extends Error {
  constructor(readonly problemas: readonly string[]) {
    super(`Configuração da web inválida:\n- ${problemas.join('\n- ')}`);
    this.name = 'ConfigInvalida';
  }
}

/** Variável vazia no `.env` (`VITE_X=`) conta como ausente. */
const texto = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().trim().optional(),
);

const EnvSchema = z.object({
  VITE_API_URL: texto,
  VITE_AUTH_DEV: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.enum(['true', 'false'], { error: 'VITE_AUTH_DEV deve ser "true" ou "false".' }).optional(),
  ),
  VITE_ENTRA_CLIENT_ID: texto,
  VITE_ENTRA_TENANT_ID: texto,
  VITE_API_SCOPE: texto,
});

/** Em produção a API fica no mesmo endereço do site, atrás do IIS (CLAUDE.md 3). */
const API_URL_PADRAO = '/api/v1';

/**
 * Valida as variáveis e monta a configuração.
 *
 * O modo DEV de autenticação só existe no servidor de desenvolvimento do Vite (`desenvolvimento`):
 * no build de produção `VITE_AUTH_DEV` é ignorado, e o login é sempre pelo Entra ID (CLAUDE.md 6).
 */
export function lerConfig(env: Record<string, unknown>, desenvolvimento: boolean): ConfigWeb {
  const lido = EnvSchema.safeParse(env);
  if (!lido.success) {
    throw new ConfigInvalida(lido.error.issues.map((problema) => problema.message));
  }
  const valores = lido.data;
  const apiUrl = (valores.VITE_API_URL ?? API_URL_PADRAO).replace(/\/+$/, '');

  if (desenvolvimento && valores.VITE_AUTH_DEV === 'true') {
    return { apiUrl, auth: { modo: 'DEV' } };
  }

  const faltando = (
    [
      ['VITE_ENTRA_CLIENT_ID', valores.VITE_ENTRA_CLIENT_ID],
      ['VITE_ENTRA_TENANT_ID', valores.VITE_ENTRA_TENANT_ID],
      ['VITE_API_SCOPE', valores.VITE_API_SCOPE],
    ] as const
  )
    .filter(([, valor]) => valor === undefined)
    .map(([nome]) => `${nome} é obrigatória para o login pelo Entra ID.`);
  if (
    faltando.length > 0 ||
    valores.VITE_ENTRA_CLIENT_ID === undefined ||
    valores.VITE_ENTRA_TENANT_ID === undefined ||
    valores.VITE_API_SCOPE === undefined
  ) {
    throw new ConfigInvalida(faltando);
  }
  return {
    apiUrl,
    auth: {
      modo: 'ENTRA',
      clientId: valores.VITE_ENTRA_CLIENT_ID,
      tenantId: valores.VITE_ENTRA_TENANT_ID,
      escopoApi: valores.VITE_API_SCOPE,
    },
  };
}
