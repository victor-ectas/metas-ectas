import { z } from 'zod';

/** Texto vazio no .env (`VAR=`) conta como ausente. */
const vazioComoAusente = (valor: unknown) => (valor === '' ? undefined : valor);

const ConfigSchema = z.object({
  NODE_ENV: z.preprocess(
    vazioComoAusente,
    z.enum(['development', 'test', 'production'], {
      error: 'obrigatória: development, test ou production',
    }),
  ),
  /** Usuário da aplicação (metas_app): o mesmo da API, com privilégios mínimos. */
  DATABASE_URL: z.preprocess(
    vazioComoAusente,
    z
      .string({ error: 'obrigatória' })
      .regex(/^postgres(ql)?:\/\/.+/, { error: 'deve ser uma URL postgresql://' }),
  ),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'], {
      error: 'deve ser fatal, error, warn, info, debug, trace ou silent',
    })
    .default('info'),
});

export type ConfigJobs = z.infer<typeof ConfigSchema>;

/** Erro de configuração: o serviço não deve iniciar. */
export class ErroConfiguracao extends Error {
  constructor(readonly problemas: string[]) {
    super(
      `Configuração inválida. Corrija as variáveis de ambiente:\n${problemas.map((p) => `- ${p}`).join('\n')}`,
    );
    this.name = 'ErroConfiguracao';
  }
}

/** Lê e valida as variáveis de ambiente do serviço de jobs, listando todos os problemas. */
export function carregarConfig(env: Readonly<Record<string, string | undefined>>): ConfigJobs {
  const resultado = ConfigSchema.safeParse(env);
  if (!resultado.success) {
    throw new ErroConfiguracao(
      resultado.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    );
  }
  return resultado.data;
}
