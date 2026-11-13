import { z } from 'zod';

/** Token de injeção da configuração validada. */
export const CONFIG = Symbol('CONFIG');

/** Texto vazio no .env (`VAR=`) conta como ausente. */
const vazioComoAusente = (valor: unknown) => (valor === '' ? undefined : valor);
const texto = () => z.preprocess(vazioComoAusente, z.string({ error: 'obrigatória' }));
const textoOpcional = () => z.preprocess(vazioComoAusente, z.string().optional());

const ConfigSchema = z.object({
  NODE_ENV: z.preprocess(
    (valor) => (valor === '' ? undefined : valor),
    z.enum(['development', 'test', 'production'], {
      error: 'obrigatória: development, test ou production',
    }),
  ),
  PORT_API: z.coerce
    .number({ error: 'deve ser um número' })
    .int({ error: 'deve ser um número inteiro' })
    .min(1, { error: 'deve estar entre 1 e 65535' })
    .max(65535, { error: 'deve estar entre 1 e 65535' })
    .default(3000),
  /** Usuário da aplicação, com privilégios mínimos. */
  DATABASE_URL: texto().pipe(
    z.string().regex(/^postgres(ql)?:\/\/.+/, { error: 'deve ser uma URL postgresql://' }),
  ),
  /** Origem do front-end liberada no CORS. */
  WEB_ORIGIN: texto().pipe(z.url({ error: 'deve ser uma URL, ex.: https://metas.empresa.com.br' })),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'], {
      error: 'deve ser fatal, error, warn, info, debug, trace ou silent',
    })
    .default('info'),
  /** Requisições de escrita (POST, PUT, PATCH, DELETE) por minuto e por IP. */
  LIMITE_ESCRITA_POR_MINUTO: z.coerce
    .number({ error: 'deve ser um número' })
    .int({ error: 'deve ser um número inteiro' })
    .positive({ error: 'deve ser maior que zero' })
    .default(120),
  /** Tenant do Entra ID (GUID). Obrigatório fora do modo DEV. */
  ENTRA_TENANT_ID: textoOpcional().pipe(
    z.uuid({ error: 'deve ser o GUID do tenant (ID do diretório)' }).optional(),
  ),
  /**
   * Audiências aceitas no token, separadas por vírgula. Tokens v2 trazem em `aud` o ID do
   * aplicativo (GUID) da API; o URI (`api://metas`) também é aceito.
   */
  ENTRA_API_AUDIENCE: textoOpcional().transform((valor) =>
    (valor ?? '')
      .split(',')
      .map((parte) => parte.trim())
      .filter((parte) => parte !== ''),
  ),
  /** Modo DEV de autenticação (CLAUDE.md 6): só com NODE_ENV=development. */
  AUTH_DEV: z
    .preprocess(vazioComoAusente, z.enum(['true', 'false'], { error: 'deve ser true ou false' }))
    .default('false')
    .transform((valor) => valor === 'true'),
  /** Usuário simulado no modo DEV (precisa existir no banco). */
  AUTH_DEV_EMAIL: textoOpcional().pipe(
    z
      .email({ error: 'deve ser um e-mail' })
      .transform((email) => email.toLowerCase())
      .optional(),
  ),
  /**
   * Instante fixo para o relógio das regras de fechamento (ISO 8601 com fuso, ex.:
   * 2026-11-13T12:00:00-03:00). Só para os testes ponta a ponta: aceito só em desenvolvimento.
   */
  RELOGIO_FIXO: textoOpcional().pipe(
    z.iso
      .datetime({
        offset: true,
        error: 'deve ser data e hora ISO com fuso, ex.: 2026-11-13T12:00:00-03:00',
      })
      .transform((valor) => new Date(valor))
      .optional(),
  ),
});

const ConfigValidadaSchema = ConfigSchema.superRefine((config, ctx) => {
  if (config.RELOGIO_FIXO !== undefined && config.NODE_ENV !== 'development') {
    ctx.addIssue({
      code: 'custom',
      path: ['RELOGIO_FIXO'],
      message: `RELOGIO_FIXO só é permitido com NODE_ENV=development (atual: ${config.NODE_ENV}). A API não inicia assim.`,
    });
  }
  if (config.AUTH_DEV) {
    if (config.NODE_ENV !== 'development') {
      ctx.addIssue({
        code: 'custom',
        path: ['AUTH_DEV'],
        message: `AUTH_DEV=true só é permitido com NODE_ENV=development (atual: ${config.NODE_ENV}). A API não inicia assim.`,
      });
    }
    if (config.AUTH_DEV_EMAIL === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['AUTH_DEV_EMAIL'],
        message: 'obrigatória com AUTH_DEV=true',
      });
    }
    return;
  }
  if (config.ENTRA_TENANT_ID === undefined) {
    ctx.addIssue({ code: 'custom', path: ['ENTRA_TENANT_ID'], message: 'obrigatória' });
  }
  if (config.ENTRA_API_AUDIENCE.length === 0) {
    ctx.addIssue({ code: 'custom', path: ['ENTRA_API_AUDIENCE'], message: 'obrigatória' });
  }
});

export type Config = z.infer<typeof ConfigValidadaSchema>;

/** Erro de configuração: a API não deve iniciar. */
export class ErroConfiguracao extends Error {
  constructor(readonly problemas: string[]) {
    super(
      `Configuração inválida. Corrija as variáveis de ambiente:\n${problemas.map((p) => `- ${p}`).join('\n')}`,
    );
    this.name = 'ErroConfiguracao';
  }
}

/** Lê e valida as variáveis de ambiente. Lança `ErroConfiguracao` listando todos os problemas. */
export function carregarConfig(env: Readonly<Record<string, string | undefined>>): Config {
  const resultado = ConfigValidadaSchema.safeParse(env);
  if (!resultado.success) {
    throw new ErroConfiguracao(
      resultado.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    );
  }
  return resultado.data;
}
