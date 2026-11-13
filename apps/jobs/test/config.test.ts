import { describe, expect, it } from 'vitest';

import { carregarConfig, ErroConfiguracao } from '../src/config.js';

const MINIMO = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://metas_app:x@localhost:5432/metas',
};

function problemas(env: Record<string, string | undefined>): string[] {
  try {
    carregarConfig(env);
  } catch (erro) {
    if (erro instanceof ErroConfiguracao) return erro.problemas;
    throw erro;
  }
  throw new Error('Era esperado erro de configuração');
}

describe('configuração do serviço de jobs', () => {
  it('aplica o nível de log padrão', () => {
    expect(carregarConfig(MINIMO)).toEqual({ ...MINIMO, LOG_LEVEL: 'info' });
  });

  it('lista todas as variáveis obrigatórias que faltam', () => {
    expect(problemas({})).toEqual([
      'NODE_ENV: obrigatória: development, test ou production',
      'DATABASE_URL: obrigatória',
    ]);
  });

  it('variável vazia conta como ausente, e valores inválidos são recusados', () => {
    expect(problemas({ ...MINIMO, DATABASE_URL: '' })).toEqual(['DATABASE_URL: obrigatória']);
    expect(problemas({ ...MINIMO, DATABASE_URL: 'mysql://x', LOG_LEVEL: 'verbose' })).toEqual([
      'DATABASE_URL: deve ser uma URL postgresql://',
      'LOG_LEVEL: deve ser fatal, error, warn, info, debug, trace ou silent',
    ]);
  });
});
