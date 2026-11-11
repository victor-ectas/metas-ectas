import { describe, expect, it } from 'vitest';

import { carregarConfig, ErroConfiguracao } from '../src/config/config.js';

const MINIMO = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://metas_app:x@localhost:5433/metas',
  WEB_ORIGIN: 'http://localhost:5173',
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

describe('carregarConfig', () => {
  it('aplica os valores padrão', () => {
    expect(carregarConfig(MINIMO)).toEqual({
      ...MINIMO,
      PORT_API: 3000,
      LOG_LEVEL: 'info',
      LIMITE_ESCRITA_POR_MINUTO: 120,
    });
  });

  it('converte números vindos do ambiente', () => {
    const config = carregarConfig({ ...MINIMO, PORT_API: '8080', LIMITE_ESCRITA_POR_MINUTO: '10' });
    expect(config.PORT_API).toBe(8080);
    expect(config.LIMITE_ESCRITA_POR_MINUTO).toBe(10);
  });

  it('lista todas as variáveis obrigatórias que faltam', () => {
    expect(problemas({})).toEqual([
      'NODE_ENV: obrigatória: development, test ou production',
      'DATABASE_URL: obrigatória',
      'WEB_ORIGIN: obrigatória',
    ]);
  });

  it('variável vazia no .env conta como ausente', () => {
    expect(problemas({ ...MINIMO, DATABASE_URL: '' })).toEqual(['DATABASE_URL: obrigatória']);
  });

  it('recusa valores inválidos com mensagem em português', () => {
    expect(
      problemas({
        NODE_ENV: 'prod',
        PORT_API: '70000',
        DATABASE_URL: 'mysql://x',
        WEB_ORIGIN: 'localhost',
        LOG_LEVEL: 'verbose',
        LIMITE_ESCRITA_POR_MINUTO: '0',
      }),
    ).toEqual([
      'NODE_ENV: obrigatória: development, test ou production',
      'PORT_API: deve estar entre 1 e 65535',
      'DATABASE_URL: deve ser uma URL postgresql://',
      'WEB_ORIGIN: deve ser uma URL, ex.: https://metas.empresa.com.br',
      'LOG_LEVEL: deve ser fatal, error, warn, info, debug, trace ou silent',
      'LIMITE_ESCRITA_POR_MINUTO: deve ser maior que zero',
    ]);
  });

  it('a mensagem do erro lista os problemas para o log de inicialização', () => {
    expect(() => carregarConfig({})).toThrow(
      'Configuração inválida. Corrija as variáveis de ambiente:\n- NODE_ENV:',
    );
  });
});
