import { z } from 'zod';

/** Token de injeção da configuração validada. */
export const CONFIG = Symbol('CONFIG');

/** Texto vazio no .env (`VAR=`) conta como ausente. */
const texto = () =>
  z.preprocess((valor) => (valor === '' ? undefined : valor), z.string({ error: 'obrigatória' }));

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
});

export type Config = z.infer<typeof ConfigSchema>;

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
  const resultado = ConfigSchema.safeParse(env);
  if (!resultado.success) {
    throw new ErroConfiguracao(
      resultado.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    );
  }
  return resultado.data;
}
